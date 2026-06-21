// Loads and normalizes the two config files into typed objects:
//   config/rules.config.yaml  -> deterministic translation rules (code graders)
//   config/taste.config.yaml  -> the configurable LLM-judge rubric

import * as fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { CONFIG_DIR } from "./lib.js";

export interface GlossaryEntry {
    source: string;
    target: string;
}

export interface RulesConfig {
    locale: string;
    glossary: GlossaryEntry[];
    doNotTranslate: string[];
    placeholders: string[];
    lengthLimits: Record<string, number>;
    localeFormat: { decimalSeparator: string; currency: string };
    bannedTerms: string[];
}

export interface TasteCriterion {
    key: string;
    weight: number;
    rubric: string;
}

export interface TasteConfig {
    locale: string;
    model: string;
    criteria: TasteCriterion[];
}

function readYaml(file: string): Record<string, unknown> {
    return parseYaml(fs.readFileSync(path.join(CONFIG_DIR, file), "utf8")) ?? {};
}

function loadRules(): RulesConfig {
    const raw = readYaml("rules.config.yaml");
    const lf = (raw.locale_format ?? {}) as Record<string, string>;
    return {
        locale: String(raw.locale ?? "el-GR"),
        glossary: (raw.glossary as GlossaryEntry[]) ?? [],
        doNotTranslate: (raw.do_not_translate as string[]) ?? [],
        placeholders: (raw.placeholders as string[]) ?? [],
        lengthLimits: (raw.length_limits as Record<string, number>) ?? {},
        localeFormat: {
            decimalSeparator: lf.decimal_separator ?? ",",
            currency: lf.currency ?? "trailing-euro",
        },
        bannedTerms: (raw.banned_terms as string[]) ?? [],
    };
}

function loadTaste(): TasteConfig {
    const raw = readYaml("taste.config.yaml");
    const criteriaRaw = (raw.criteria ?? {}) as Record<
        string,
        { weight?: number; rubric?: string }
    >;
    const criteria: TasteCriterion[] = Object.entries(criteriaRaw).map(
        ([key, v]) => ({
            key,
            weight: typeof v.weight === "number" ? v.weight : 1,
            rubric: (v.rubric ?? "").trim(),
        }),
    );
    return {
        locale: String(raw.locale ?? "el-GR"),
        model: String(raw.model ?? "claude-opus-4-7"),
        criteria,
    };
}

export const rules: RulesConfig = loadRules();
export const taste: TasteConfig = loadTaste();
