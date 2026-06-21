// Shared plumbing for the configurable taste judge. One model call per task
// scores every criterion in taste.config.yaml at once; the per-criterion graders
// and the weighted-overall grader all read from this single memoized result.

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import memoize from "lodash/memoize.js";
// Must match the zod major the SDK helper targets (it imports "zod/v4").
import * as z from "zod/v4";
import type { GraderContext } from "../types.js";

export const avg = (xs: number[]) =>
    xs.reduce((a, b) => a + b, 0) / xs.length;

// One 0-5 rubric score. Reused for every configured criterion.
const ScoreSchema = z.number().int().min(0).max(5);

export interface TasteResult {
    /** criterion key -> 0-5 score */
    scores: Record<string, number>;
    comment: string;
}

/**
 * One judge call per task, returning a 0-5 score for every configured criterion
 * plus a free-text comment. Memoized on taskId so the per-criterion graders and
 * the weighted-overall grader share a single model call per task.
 */
export const judgeTaste = memoize(
    async (ctx: GraderContext): Promise<TasteResult | null> => {
        if (!ctx.parsed.produced) return null;
        const { taste, task, output, client } = ctx;

        // Build the structured-output schema dynamically from config: one 0-5
        // field per criterion, plus a comment. Enforced server-side, so the
        // result lands typed with no manual JSON parsing.
        const shape: Record<string, typeof ScoreSchema> = {};
        for (const c of taste.criteria) shape[c.key] = ScoreSchema;
        const schema = z.object({ ...shape, comment: z.string() });

        const rubric = taste.criteria
            .map((c) => `- ${c.key}: ${c.rubric}`)
            .join("\n");

        const system = `You are a senior Greek (${taste.locale}) copywriter evaluating the localization of English advertising copy into Greek.

Score the Greek copy on each of the following criteria, as advertising — not just as a translation:

${rubric}

For each criterion, give an integer score between 0 and 5 (higher = better). Give scores across the full spectrum (0-5) instead of only good ones (3-5). Be a demanding judge: literal, unidiomatic, or off-brief copy should score low.`;

        const userText = [
            task.brief ? `Brand brief: ${task.brief}` : null,
            `Channel: ${task.channel}`,
            ``,
            `English source:\n${task.source}`,
            ``,
            `Greek translation to score:\n${output}`,
            task.reference
                ? `\nReference human transcreation (for comparison):\n${task.reference}`
                : null,
        ]
            .filter((l) => l !== null)
            .join("\n");

        const resp = await client.messages.parse(
            {
                model: taste.model,
                max_tokens: 512,
                system,
                output_config: { format: zodOutputFormat(schema) },
                messages: [{ role: "user", content: userText }],
            },
            { maxRetries: 10 },
        );

        if (!resp.parsed_output) return null;
        const { comment, ...rest } = resp.parsed_output as Record<
            string,
            unknown
        > & { comment: string };
        return { scores: rest as Record<string, number>, comment };
    },
    // Memoize key: one shared call per task.
    (ctx: GraderContext) => ctx.taskId,
);
