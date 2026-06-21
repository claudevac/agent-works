// Pure, deterministic parsing of the agent's Greek output — no model calls, no
// scoring policy. Produces the structural facts the code graders compute over.
// (Analogous to parse-pptx.ts in the slide-deck workshop: facts here, judgments
// in the graders.)

const GREEK_LETTER = /\p{Script=Greek}/gu;
const LATIN_LETTER = /\p{Script=Latin}/gu;
const ANY_LETTER = /\p{Letter}/gu;

export interface ParsedResponse {
    /** False when the output is empty/whitespace (agent produced nothing). */
    produced: boolean;
    text: string;
    charCount: number;
    wordCount: number;
    greekLetterCount: number;
    latinLetterCount: number;
    /** greekLetters / allLetters, in [0,1]. Catches untranslated leftovers. */
    greekLetterRatio: number;
}

export function parseResponse(text: string): ParsedResponse {
    const trimmed = text.trim();
    const produced = trimmed.length > 0;

    const greekLetterCount = (text.match(GREEK_LETTER) ?? []).length;
    const latinLetterCount = (text.match(LATIN_LETTER) ?? []).length;
    const totalLetters = (text.match(ANY_LETTER) ?? []).length;

    return {
        produced,
        text,
        charCount: trimmed.length,
        wordCount: produced ? trimmed.split(/\s+/).length : 0,
        greekLetterCount,
        latinLetterCount,
        greekLetterRatio: totalLetters > 0 ? greekLetterCount / totalLetters : 0,
    };
}
