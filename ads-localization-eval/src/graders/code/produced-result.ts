import type { Grader } from "../types.js";

/** The gate: did the agent return non-empty Greek copy at all? */
export const producedResult: Grader = {
    name: "Produced",
    kind: "code",
    description: "Did the agent return non-empty, Greek-script copy?",
    grade(ctx) {
        if (!ctx.parsed.produced) return "missing";
        if (ctx.parsed.greekLetterRatio === 0) return "no-greek";
        return "ok";
    },
};
