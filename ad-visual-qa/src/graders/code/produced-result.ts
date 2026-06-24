import type { Grader } from "../types.js";

/** Gate: did we get a readable AFTER image to QA at all? */
export const producedResult: Grader = {
    name: "Produced",
    kind: "code",
    description: "Is the AFTER asset a present, valid image?",
    grade(ctx) {
        if (!ctx.afterMeta.exists) return "missing";
        if (!ctx.afterMeta.valid) return "invalid";
        return "ok";
    },
};
