import type { Grader } from "../types.js";

/**
 * Does the AFTER asset match the target format's exact pixel dimensions?
 * Reports "ok", or the actual size when it differs (e.g. "1080x1700 ≠ 1080x1920").
 */
export const dimensionsMatch: Grader = {
    name: "Dimensions",
    kind: "code",
    description: "AFTER pixel dimensions vs the target format spec.",
    grade(ctx) {
        if (!ctx.format || !ctx.afterMeta.valid) return "-";
        const { width: w, height: h } = ctx.afterMeta;
        const { width: tw, height: th } = ctx.format;
        if (w === tw && h === th) return "ok";
        return `${w}x${h}≠${tw}x${th}`;
    },
};
