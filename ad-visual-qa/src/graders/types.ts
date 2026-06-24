// The grader contract. Code graders (deterministic, over image metadata) and
// the vision judge implement the same shape, so the runner treats them
// identically. Add a deterministic check = append a Grader to GRADERS.

import type Anthropic from "@anthropic-ai/sdk";
import type { FormatSpec, RubricConfig } from "../config.js";
import type { Asset } from "../lib.js";
import type { ImageMeta } from "../parse-image.js";

export interface Grader {
    name: string;
    kind: "code" | "judge";
    description: string;
    grade(ctx: GraderContext): Promise<number | string> | number | string;
    format?(v: number): string;
    scale?: { min: number; max: number; good: "high" | "low" | number };
}

/** Everything a grader needs for one adaptation unit. Built once per asset. */
export interface GraderContext {
    assetId: string;
    asset: Asset;
    beforePath?: string;
    afterPath: string;
    beforeMeta?: ImageMeta;
    afterMeta: ImageMeta;
    /** Target format spec named by asset.targetFormat (undefined if unknown). */
    format?: FormatSpec;
    rubric: RubricConfig;
    client: Anthropic;
}
