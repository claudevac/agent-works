// The analysis, declaratively.
//
// Each scorecard column is a `Grader`. Deterministic spec checks come from
// config/formats.config.yaml (code graders); the vision-analyst columns are
// built from config/visual-rubric.config.yaml (judge graders). The runner
// (analyze.ts) builds the context once per asset and runs every grader.
//
// Add a deterministic check = append a code grader here.
// Add a rubric criterion = edit config/visual-rubric.config.yaml (no code change).

import { rubric } from "./config.js";
import { aspectRatioMatch } from "./graders/code/aspect-ratio-match.js";
import { dimensionsMatch } from "./graders/code/dimensions-match.js";
import { fileSizeBudget } from "./graders/code/file-size-budget.js";
import { producedResult } from "./graders/code/produced-result.js";
import { visualJudges } from "./graders/judge/visual-judges.js";
import type { Grader } from "./graders/types.js";

export type { Grader, GraderContext } from "./graders/types.js";

/** Deterministic format-spec checks, in scorecard order. */
export const codeGraders: Grader[] = [
    producedResult,
    dimensionsMatch,
    aspectRatioMatch,
    fileSizeBudget,
];

/** Code checks first, then the configurable vision-analyst judges. */
export const GRADERS: Grader[] = [...codeGraders, ...visualJudges(rubric)];
