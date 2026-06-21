import type { Grader } from "../types.js";

// el-GR number/currency conventions: comma decimal separator, trailing euro
// sign ("19,99 €"), never the dollar sign. Each pattern below is a violation.
const LEADING_EURO = /€\s?\d/g; // "€10" / "€ 10" — euro should trail in el-GR
const DOLLAR = /\$|\bUSD\b/g; // dollar sign or USD currency code
const DOT_DECIMAL_PRICE = /\d+\.\d{2}(?!\d)/g; // "19.99" — el-GR uses a comma

/**
 * Count of locale-formatting violations in the output (0 = clean). Heuristic and
 * intentionally conservative — it flags the common, unambiguous mistakes.
 */
export const localeFormatting: Grader = {
    name: "Locale fmt",
    kind: "code",
    description: "el-GR currency/number formatting violations (0 = clean).",
    scale: { min: 0, max: 4, good: "low" },
    grade(ctx) {
        const out = ctx.output;
        return (
            (out.match(LEADING_EURO) ?? []).length +
            (out.match(DOLLAR) ?? []).length +
            (out.match(DOT_DECIMAL_PRICE) ?? []).length
        );
    },
};
