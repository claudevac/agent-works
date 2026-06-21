import type { Grader } from "../types.js";

/**
 * Template tokens present in the source ({{app_name}}, {price}, %s) must survive
 * verbatim in the output — ad platforms substitute them at serve time, so a
 * dropped token breaks the ad. Returns the count of missing tokens (0 = good).
 */
export const placeholderIntegrity: Grader = {
    name: "Placeholders",
    kind: "code",
    description: "Source template tokens dropped from the output (0 = all kept).",
    scale: { min: 0, max: 3, good: "low" },
    grade(ctx) {
        const missing = ctx.rules.placeholders.filter(
            (p) => ctx.task.source.includes(p) && !ctx.output.includes(p),
        );
        return missing.length;
    },
};
