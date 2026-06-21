// The eval, declaratively.
//
// Each scorecard column is a `Grader`. The deterministic rule checks come from
// config/rules.config.yaml (code graders); the configurable taste columns are
// built from config/taste.config.yaml (judge graders). The runner (eval-runner.ts)
// builds the context once per task and runs every grader against it.
//
// Add a deterministic metric = append a code grader here.
// Add a taste criterion = edit config/taste.config.yaml (no code change).

import { taste } from "./config.js";
import { bannedTerms } from "./graders/code/banned-terms.js";
import { doNotTranslatePreserved } from "./graders/code/do-not-translate.js";
import { glossaryAdherence } from "./graders/code/glossary-adherence.js";
import { greekScriptRatio } from "./graders/code/greek-script-ratio.js";
import { lengthWithinLimit } from "./graders/code/length-within-limit.js";
import { localeFormatting } from "./graders/code/locale-formatting.js";
import { placeholderIntegrity } from "./graders/code/placeholder-integrity.js";
import { producedResult } from "./graders/code/produced-result.js";
import { tasteJudges } from "./graders/judge/taste-judges.js";
import type { Grader } from "./graders/types.js";

export type { Grader, GraderContext } from "./graders/types.js";

/** Deterministic translation-rule checks, in scorecard order. */
export const codeGraders: Grader[] = [
    producedResult,
    lengthWithinLimit,
    placeholderIntegrity,
    doNotTranslatePreserved,
    glossaryAdherence,
    greekScriptRatio,
    localeFormatting,
    bannedTerms,
];

/** Code rules first, then the configurable taste judges. */
export const GRADERS: Grader[] = [...codeGraders, ...tasteJudges(taste)];
