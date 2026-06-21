import type { Grader } from "../types.js";

/**
 * For each glossary entry whose English term appears in the source, the
 * mandated Greek target term must appear in the output. Returns the count of
 * violations (0 = good). Source matching is case-insensitive.
 */
export const glossaryAdherence: Grader = {
    name: "Glossary",
    kind: "code",
    description: "Required glossary term mappings violated (0 = all honored).",
    scale: { min: 0, max: 3, good: "low" },
    grade(ctx) {
        const src = ctx.task.source.toLowerCase();
        // Case-insensitive on both sides: the mandated term is still "used" when
        // it appears capitalized at a sentence start (e.g. "Δωρεάν" vs "δωρεάν").
        const out = ctx.output.toLowerCase();
        const violations = ctx.rules.glossary.filter(
            (g) =>
                src.includes(g.source.toLowerCase()) &&
                !out.includes(g.target.toLowerCase()),
        );
        return violations.length;
    },
};
