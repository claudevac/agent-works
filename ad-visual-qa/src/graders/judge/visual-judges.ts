// Builds the judge graders from visual-rubric.config.yaml: one scorecard column
// per criterion, plus a weighted-overall column. All share the single memoized
// visualJudge() call per asset.

import type { RubricConfig } from "../../config.js";
import type { Grader } from "../types.js";
import { visualJudge } from "./judge.js";

function label(key: string): string {
    return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function visualJudges(rubric: RubricConfig): Grader[] {
    const perCriterion: Grader[] = rubric.criteria.map((c) => ({
        name: label(c.key),
        kind: "judge",
        description: `Vision judge (weight ${c.weight}) — ${c.rubric}`,
        scale: { min: 0, max: 5, good: "high" },
        format: (v) => `${v.toFixed(1)}/5`,
        async grade(ctx) {
            const r = await visualJudge(ctx);
            if (!r) return "-";
            const s = r.scores[c.key];
            return typeof s === "number" ? s : "-";
        },
    }));

    const overall: Grader = {
        name: "Adapt (wtd)",
        kind: "judge",
        description: "Weighted average of all rubric criteria.",
        scale: { min: 0, max: 5, good: "high" },
        format: (v) => `${v.toFixed(1)}/5`,
        async grade(ctx) {
            const r = await visualJudge(ctx);
            if (!r) return "-";
            let sum = 0;
            let totalW = 0;
            for (const c of rubric.criteria) {
                const s = r.scores[c.key];
                if (typeof s === "number") {
                    sum += s * c.weight;
                    totalW += c.weight;
                }
            }
            return totalW > 0 ? sum / totalW : "-";
        },
    };

    return [...perCriterion, overall];
}
