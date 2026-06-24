// Loads and normalizes the two config files:
//   config/formats.config.yaml      -> target format specs (code graders)
//   config/visual-rubric.config.yaml -> the configurable vision-judge rubric

import * as fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { CONFIG_DIR } from "./lib.js";

export interface FormatSpec {
    name: string;
    width: number;
    height: number;
    aspect: number;
    aspectTolerance: number;
    maxFileKb: number;
    safeZone: { top: number; bottom: number };
    requiredElements: string[];
}

export interface RubricCriterion {
    key: string;
    weight: number;
    rubric: string;
}

export interface RubricConfig {
    model: string;
    criteria: RubricCriterion[];
}

function readYaml(file: string): Record<string, any> {
    return parseYaml(fs.readFileSync(path.join(CONFIG_DIR, file), "utf8")) ?? {};
}

function loadFormats(): Record<string, FormatSpec> {
    const raw = readYaml("formats.config.yaml");
    const formatsRaw = (raw.formats ?? {}) as Record<string, any>;
    const out: Record<string, FormatSpec> = {};
    for (const [name, f] of Object.entries(formatsRaw)) {
        out[name] = {
            name,
            width: Number(f.width ?? 0),
            height: Number(f.height ?? 0),
            aspect: Number(f.aspect ?? 0),
            aspectTolerance: Number(f.aspect_tolerance ?? 0.02),
            maxFileKb: Number(f.max_file_kb ?? 0),
            safeZone: {
                top: Number(f.safe_zone?.top ?? 0),
                bottom: Number(f.safe_zone?.bottom ?? 0),
            },
            requiredElements: (f.required_elements as string[]) ?? [],
        };
    }
    return out;
}

function loadRubric(): RubricConfig {
    const raw = readYaml("visual-rubric.config.yaml");
    const criteriaRaw = (raw.criteria ?? {}) as Record<
        string,
        { weight?: number; rubric?: string }
    >;
    const criteria: RubricCriterion[] = Object.entries(criteriaRaw).map(
        ([key, v]) => ({
            key,
            weight: typeof v.weight === "number" ? v.weight : 1,
            rubric: (v.rubric ?? "").trim(),
        }),
    );
    return { model: String(raw.model ?? "claude-opus-4-8"), criteria };
}

export const formats: Record<string, FormatSpec> = loadFormats();
export const rubric: RubricConfig = loadRubric();
