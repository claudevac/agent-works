import type { Grader } from "../types.js";

/**
 * Fraction of letters that are Greek script. A low ratio flags untranslated
 * English left in the copy (translationese / lazy passthrough). Note: legitimate
 * do-not-translate brand names lower this slightly, so judge against a threshold
 * rather than demanding 100%.
 */
export const greekScriptRatio: Grader = {
    name: "Greek %",
    kind: "code",
    description: "Share of letters in Greek script (higher = less leftover English).",
    scale: { min: 0, max: 1, good: "high" },
    format: (v) => `${Math.round(v * 100)}%`,
    grade(ctx) {
        return ctx.parsed.greekLetterRatio;
    },
};
