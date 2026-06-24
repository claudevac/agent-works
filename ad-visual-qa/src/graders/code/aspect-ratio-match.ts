import type { Grader } from "../types.js";

/**
 * Absolute deviation of the AFTER aspect ratio from the target format's aspect.
 * 0 = exact. The vision judge catches *visual* distortion; this catches an asset
 * exported at the wrong ratio (which the platform would letterbox or crop).
 */
export const aspectRatioMatch: Grader = {
    name: "Aspect Δ",
    kind: "code",
    description: "Deviation of AFTER aspect ratio from the target format.",
    scale: { min: 0, max: 0.1, good: "low" },
    format: (v) => v.toFixed(3),
    grade(ctx) {
        if (!ctx.format || !ctx.afterMeta.valid) return "-";
        return Math.abs(ctx.afterMeta.aspect - ctx.format.aspect);
    },
};
