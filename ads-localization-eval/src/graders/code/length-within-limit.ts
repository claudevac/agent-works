import type { Grader } from "../types.js";

/**
 * Characters over the channel's hard ad-platform limit. 0 = fits, higher = how
 * far over (the platform would truncate). A correctness rule, not a preference.
 */
export const lengthWithinLimit: Grader = {
    name: "Over limit",
    kind: "code",
    description: "Chars over the channel's length limit (0 = fits).",
    scale: { min: 0, max: 20, good: "low" },
    format: (v) => (v === 0 ? "ok" : `+${v}`),
    grade(ctx) {
        const limit = ctx.rules.lengthLimits[ctx.task.channel];
        if (limit == null) return "-"; // no limit configured for this channel
        return Math.max(0, ctx.parsed.charCount - limit);
    },
};
