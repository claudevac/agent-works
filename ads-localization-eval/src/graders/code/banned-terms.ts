import type { Grader } from "../types.js";

/**
 * Count of banned anglicisms / off-brand terms appearing in the output
 * (case-insensitive). 0 = clean.
 */
export const bannedTerms: Grader = {
    name: "Banned",
    kind: "code",
    description: "Banned anglicisms / off-brand terms present (0 = clean).",
    scale: { min: 0, max: 3, good: "low" },
    grade(ctx) {
        const out = ctx.output.toLowerCase();
        return ctx.rules.bannedTerms.filter((t) =>
            out.includes(t.toLowerCase()),
        ).length;
    },
};
