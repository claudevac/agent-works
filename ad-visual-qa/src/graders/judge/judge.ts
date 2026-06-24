// The vision analyst — shared plumbing for the rubric judges.
//
// One model call per asset sends BOTH the BEFORE and AFTER creatives and scores
// every criterion in visual-rubric.config.yaml at once, returning a free-text
// findings comment. Memoized on assetId so all per-criterion graders share the
// single call. This call's system prompt IS the specialized analyst agent (see
// ANALYST_PREAMBLE) — the same text can be deployed as a Managed Agent.

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import memoize from "lodash/memoize.js";
import * as fs from "node:fs/promises";
import * as z from "zod/v4";
import type { GraderContext } from "../types.js";

export const avg = (xs: number[]) =>
    xs.reduce((a, b) => a + b, 0) / xs.length;

const ScoreSchema = z.number().int().min(0).max(5);

/** The specialized analyst persona — reused verbatim for Managed Agent deploy. */
export const ANALYST_PREAMBLE = `You are a senior advertising creative-operations QA specialist. You analyze ad visual assets across a format-adaptation step: a creative is reflowed/resized from one placement or aspect ratio (the BEFORE) to a target placement (the AFTER). Your job is to catch every defect the adaptation introduced — cropped subjects, text pushed off-canvas or shrunk below legibility, logos or CTAs lost or in platform safe zones, stretching/squashing, and color or brand drift — and to be specific about where each issue occurs. Be a demanding reviewer: a creative you would not ship should score low.`;

const MEDIA: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
};

async function imageBlock(filePath: string, type?: string) {
    const data = (await fs.readFile(filePath)).toString("base64");
    const ext = (type ?? filePath.split(".").pop() ?? "png").toLowerCase();
    return {
        type: "image" as const,
        source: {
            type: "base64" as const,
            media_type: (MEDIA[ext] ?? "image/png") as
                | "image/png"
                | "image/jpeg"
                | "image/webp"
                | "image/gif",
            data,
        },
    };
}

export interface VisualResult {
    /** criterion key -> 0-5 score */
    scores: Record<string, number>;
    /** specific defects found, with where they occur */
    comment: string;
}

export const visualJudge = memoize(
    async (ctx: GraderContext): Promise<VisualResult | null> => {
        if (!ctx.afterMeta.exists || !ctx.afterMeta.valid) return null;
        const { rubric, asset, format, client } = ctx;

        // Dynamic structured-output schema: one 0-5 field per configured
        // criterion, plus a findings comment. Enforced server-side.
        const shape: Record<string, typeof ScoreSchema> = {};
        for (const c of rubric.criteria) shape[c.key] = ScoreSchema;
        const schema = z.object({ ...shape, comment: z.string() });

        const rubricText = rubric.criteria
            .map((c) => `- ${c.key}: ${c.rubric}`)
            .join("\n");

        const formatLine = format
            ? `Target format: ${format.name} — ${format.width}x${format.height}px, safe zones top ${Math.round(
                  format.safeZone.top * 100,
              )}% / bottom ${Math.round(
                  format.safeZone.bottom * 100,
              )}%. Required elements: ${format.requiredElements.join(", ") || "(none)"}.`
            : `Target format: ${asset.targetFormat}.`;

        const hasBefore = !!(ctx.beforePath && ctx.beforeMeta?.valid);
        const system = `${ANALYST_PREAMBLE}

${formatLine}

Score the AFTER (adapted) asset on each criterion${hasBefore ? ", comparing against the BEFORE (original)" : ""}:

${rubricText}

For each criterion give an integer 0-5 (higher = better). Use the full 0-5 range, not only 3-5. In "comment", list the specific defects the adaptation introduced and where they appear (e.g. "logo clipped at top edge", "CTA text below ~14px, hard to read").`;

        const content: any[] = [
            { type: "text", text: `BRIEF: ${asset.brief ?? "(none)"}` },
        ];
        if (hasBefore) {
            content.push({ type: "text", text: "BEFORE (original creative):" });
            content.push(await imageBlock(ctx.beforePath!, ctx.beforeMeta?.type));
        }
        content.push({
            type: "text",
            text: "AFTER (adapted to the target format):",
        });
        content.push(await imageBlock(ctx.afterPath, ctx.afterMeta.type));
        content.push({
            type: "text",
            text: "Score the AFTER asset on every criterion and detail the issues in the comment.",
        });

        const resp = await client.messages.parse(
            {
                model: rubric.model,
                max_tokens: 1024,
                system,
                output_config: { format: zodOutputFormat(schema) },
                messages: [{ role: "user", content }],
            },
            { maxRetries: 8 },
        );

        if (!resp.parsed_output) return null;
        const { comment, ...rest } = resp.parsed_output as Record<
            string,
            unknown
        > & { comment: string };
        return { scores: rest as Record<string, number>, comment };
    },
    (ctx: GraderContext) => ctx.assetId,
);
