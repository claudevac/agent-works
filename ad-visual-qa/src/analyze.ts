// Vision-QA harness.
//
// For each asset: load the BEFORE/AFTER images, build a GraderContext, run every
// grader (deterministic spec checks + the vision analyst), write
// runs/<asset>/report.json (scores + findings), and print the scorecard.
// Deltas compare against a pinned baseline (--baseline).

import Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";
import * as fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { formats, rubric } from "./config.js";
import { GRADERS, type Grader, type GraderContext } from "./graders.js";
import { visualJudge } from "./graders/judge/judge.js";
import { RUNS_DIR, resolveAsset, selectAssets, type Asset } from "./lib.js";
import { parseImage } from "./parse-image.js";

interface AssetResult {
    assetId: string;
    values: (number | string)[];
    previous?: Record<string, number | string>;
    comment?: string;
}

/** Prepare everything the graders need for one asset — pure data, no scoring. */
function buildContext(client: Anthropic, asset: Asset): GraderContext {
    const afterPath = resolveAsset(asset.after);
    const beforePath = asset.before ? resolveAsset(asset.before) : undefined;
    return {
        assetId: asset.id,
        asset,
        afterPath,
        beforePath,
        afterMeta: parseImage(afterPath),
        beforeMeta: beforePath ? parseImage(beforePath) : undefined,
        format: formats[asset.targetFormat],
        rubric,
        client,
    };
}

async function gradeAsset(
    client: Anthropic,
    asset: Asset,
    pinBaseline: boolean,
): Promise<AssetResult> {
    console.log(`\n=== analyzing ${asset.id} ===`);
    const dir = path.join(RUNS_DIR, asset.id);
    await fs.mkdir(dir, { recursive: true });
    const reportPath = path.join(dir, "report.json");
    const baselinePath = path.join(dir, "baseline.report.json");

    const previous: Record<string, number | string> | undefined = await fs
        .readFile(baselinePath, "utf8")
        .then((txt) => JSON.parse(txt).results)
        .catch(() => undefined);

    const ctx = buildContext(client, asset);
    if (!formats[asset.targetFormat]) {
        console.warn(
            `  ! unknown targetFormat "${asset.targetFormat}" — spec checks skipped`,
        );
    }

    const values = await Promise.all(GRADERS.map((g) => g.grade(ctx)));

    // The judge's findings are the analysis deliverable — surface and persist them.
    const judge = await visualJudge(ctx).catch(() => null);
    if (judge?.comment) console.log(`  findings: ${judge.comment}`);

    const report = {
        assetId: asset.id,
        targetFormat: asset.targetFormat,
        results: Object.fromEntries(GRADERS.map((g, i) => [g.name, values[i]])),
        findings: judge?.comment,
        before: ctx.beforeMeta,
        after: ctx.afterMeta,
    };
    const json = JSON.stringify(report, null, 2);
    await fs.writeFile(reportPath, json);
    if (pinBaseline) await fs.writeFile(baselinePath, json);

    return {
        assetId: asset.id,
        values,
        previous: pinBaseline ? undefined : previous,
        comment: judge?.comment,
    };
}

/** Map a value in [min,max] to red->yellow->green. `good:"low"` flips it. */
function heat(v: number, scale: NonNullable<Grader["scale"]>) {
    const span = scale.max - scale.min || 1;
    let t =
        typeof scale.good === "number"
            ? 1 - Math.abs(v - scale.good) / span
            : (v - scale.min) / span;
    t = Math.max(0, Math.min(1, t));
    if (scale.good === "low") t = 1 - t;
    let r = t < 0.5 ? 255 : Math.round(255 * (1 - t) * 2);
    let g = t > 0.5 ? 255 : Math.round(255 * t * 2);
    const whiteText = g < 220;
    if (whiteText) {
        r = Math.round(r * 0.75);
        g = Math.round(g * 0.75);
    }
    const fg = whiteText ? 255 : 0;
    return chalk.bgRgb(r, g, 0).rgb(fg, fg, fg).bold;
}

function display(g: Grader, v: number | string, prev?: number | string): string {
    let cell = typeof v === "number" ? (g.format?.(v) ?? String(v)) : v;
    if (typeof v === "number" && typeof prev === "number" && v !== prev) {
        const d = v - prev;
        cell = `${cell} (${d > 0 ? "+" : ""}${Number(d.toFixed(2))})`;
    }
    return cell;
}

function summarize(results: AssetResult[]): string {
    const cells = results.map((r) =>
        GRADERS.map((g, i) => display(g, r.values[i]!, r.previous?.[g.name])),
    );
    const headerWords = GRADERS.map((g) => g.name.split(" "));
    const headerRows = Math.max(...headerWords.map((w) => w.length));
    const widths = GRADERS.map((g, i) =>
        Math.max(
            ...headerWords[i]!.map((w) => w.length),
            ...cells.map((row) => row[i]!.length),
        ),
    );
    const idW = Math.max(5, ...results.map((r) => r.assetId.length));

    const lines: string[] = ["", "=== scorecard ==="];
    for (let h = 0; h < headerRows; h++) {
        lines.push(
            [
                (h === 0 ? "asset" : "").padEnd(idW) + " ",
                ...GRADERS.map(
                    (_, i) =>
                        ` ${(headerWords[i]![h] ?? "").padStart(widths[i]!)} `,
                ),
            ].join("|"),
        );
    }
    lines.push(
        ["-".repeat(idW + 1), ...widths.map((w) => "-".repeat(w + 2))].join("+"),
    );
    for (let r = 0; r < results.length; r++) {
        lines.push(
            [
                results[r]!.assetId.padEnd(idW) + " ",
                ...cells[r]!.map((text, i) => {
                    const padded = ` ${text.padStart(widths[i]!)} `;
                    const v = results[r]!.values[i];
                    const scale = GRADERS[i]!.scale;
                    return typeof v === "number" && scale
                        ? heat(v, scale)(padded)
                        : padded;
                }),
            ].join("|"),
        );
    }

    const judgeAvgs = GRADERS.flatMap((g, i) => {
        if (g.kind !== "judge") return [];
        const nums = results
            .map((r) => r.values[i])
            .filter((v): v is number => typeof v === "number");
        if (nums.length === 0) return [];
        return [
            `${g.name}=${(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)}`,
        ];
    });
    if (judgeAvgs.length > 0) {
        lines.push("");
        lines.push(`overall judge avg: ${judgeAvgs.join(" ")}`);
    }
    return lines.join("\n");
}

// ------------------------------------------------------------------- CLI

const { values, positionals } = parseArgs({
    options: { all: { type: "boolean" }, baseline: { type: "boolean" } },
    allowPositionals: true,
});
const selected = selectAssets(
    "src/analyze.ts",
    positionals,
    (values.all ?? false) || positionals.length === 0,
);

const client = new Anthropic();
const settled = await Promise.allSettled(
    selected.map((asset) => gradeAsset(client, asset, values.baseline ?? false)),
);
const results: AssetResult[] = [];
for (const [i, r] of settled.entries()) {
    if (r.status === "fulfilled") {
        results.push(r.value);
    } else {
        console.error(
            `[${selected[i]!.id}] FAILED: ${r.reason?.message ?? r.reason}`,
        );
    }
}
console.log(summarize(results));
