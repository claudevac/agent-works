// The grader contract — the keystone of the whole harness. Code graders and
// LLM-judge graders implement the same shape, so the runner treats them
// identically. Adding a metric = appending one Grader to GRADERS (graders.ts).

import type Anthropic from "@anthropic-ai/sdk";
import type { RulesConfig, TasteConfig } from "../config.js";
import type { Task } from "../lib.js";
import type { ParsedResponse } from "../parse-response.js";

export interface Grader {
    /** Scorecard column header. */
    name: string;
    /** "code" = deterministic, free. "judge" = model call. Only affects the footer averaging. */
    kind: "code" | "judge";
    description: string;
    grade(ctx: GraderContext): Promise<number | string> | number | string;
    /** Optional display formatter for numeric values (e.g. "4.2/5", "+3"). */
    format?(v: number): string;
    /** Drives the red->yellow->green heat map. `good:"low"` flips it. */
    scale?: { min: number; max: number; good: "high" | "low" | number };
}

/** Everything a grader needs for one task. Built once per task by the runner. */
export interface GraderContext {
    taskId: string;
    task: Task;
    /** The Greek copy the translation agent produced. */
    output: string;
    parsed: ParsedResponse;
    rules: RulesConfig;
    taste: TasteConfig;
    client: Anthropic;
}
