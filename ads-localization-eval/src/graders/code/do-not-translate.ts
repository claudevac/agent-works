import type { Grader } from "../types.js";

/**
 * Brand/product names on the do-not-translate list must appear verbatim in the
 * output whenever they appear in the source. Returns the count missing (0 = good).
 */
export const doNotTranslatePreserved: Grader = {
    name: "DNT kept",
    kind: "code",
    description: "Do-not-translate terms dropped from the output (0 = all kept).",
    scale: { min: 0, max: 3, good: "low" },
    grade(ctx) {
        const missing = ctx.rules.doNotTranslate.filter(
            (t) => ctx.task.source.includes(t) && !ctx.output.includes(t),
        );
        return missing.length;
    },
};
