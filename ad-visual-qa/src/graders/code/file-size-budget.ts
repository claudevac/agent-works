import type { Grader } from "../types.js";

/**
 * Kilobytes the AFTER asset is over the target format's file-size budget.
 * 0 = within budget. Ad platforms reject creatives over their byte cap.
 */
export const fileSizeBudget: Grader = {
    name: "Over KB",
    kind: "code",
    description: "KB over the format's file-size budget (0 = within budget).",
    scale: { min: 0, max: 500, good: "low" },
    format: (v) => (v === 0 ? "ok" : `+${Math.round(v)}`),
    grade(ctx) {
        if (!ctx.format || !ctx.format.maxFileKb || !ctx.afterMeta.exists)
            return "-";
        const kb = ctx.afterMeta.bytes / 1024;
        return Math.max(0, Math.round(kb - ctx.format.maxFileKb));
    },
};
