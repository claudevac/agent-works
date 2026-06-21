// Grader harness (frozen — don't edit while iterating the translation agent).
//
// For each task: read runs/<task>/output.txt, build a GraderContext, run every
// grader in GRADERS against it, write runs/<task>/score.json, and print the
// scorecard. Deltas compare against a pinned baseline (--baseline).
//
// The metrics live in graders.ts and config/*.yaml — this file is just the runner.

import Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";
import * as fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { rules, taste } from "./config.js";
import { GRADERS, type Grader, type GraderContext } from "./graders.js";
import { judgeTaste } from "./graders/judge/judge.js";
import { RUNS_DIR, selectTasks, type Task } from "./lib.js";
import { parseResponse } from "./parse-response.js";

interface TaskResult {
    taskId: string;
    /** Parallel to GRADERS — values[i] is the result of GRADERS[i]. */
    values: (number | string)[];
    /** Pinned baseline values, for deltas. */
    previous?: Record<string, number | string>;
}

/** Prepare everything the graders need for one task — pure data, no scoring. */
async function buildContext(
    client: Anthropic,
    task: Task,
): Promise<GraderContext> {
    const outPath = path.join(RUNS_DIR, task.id, "output.txt");
    const output = await fs.readFile(outPath, "utf8").catch(() => "");
    return {
        taskId: task.id,
        task,
        output,
        parsed: parseResponse(output),
        rules,
        taste,
        client,
    };
}

async function gradeTask(
    client: Anthropic,
    task: Task,
    pinBaseline: boolean,
): Promise<TaskResult> {
    console.log(`\n=== grading ${task.id} ===`);
    const taskDir = path.join(RUNS_DIR, task.id);
    await fs.mkdir(taskDir, { recursive: true });
    const scorePath = path.join(taskDir, "score.json");
    const baselinePath = path.join(taskDir, "baseline.score.json");

    // Deltas always compare against the pinned baseline, not the previous run,
    // so re-running the same agent version shows no movement (not noise).
    const previous: Record<string, number | string> | undefined = await fs
        .readFile(baselinePath, "utf8")
        .then((txt) => JSON.parse(txt).results)
        .catch(() => undefined);

    const ctx = await buildContext(client, task);

    // Independent graders fan out. Judge graders share one memoized model call.
    const values = await Promise.all(GRADERS.map((g) => g.grade(ctx)));

    // Persist a debuggable record: headline values, the output, the parsed
    // facts, and the judge's free-text comment.
    const judge = await judgeTaste(ctx).catch(() => null);
    const score = {
        taskId: task.id,
        results: Object.fromEntries(GRADERS.map((g, i) => [g.name, values[i]])),
        output: ctx.output,
        parsed: ctx.parsed,
        tasteComment: judge?.comment,
    };
    const json = JSON.stringify(score, null, 2);
    await fs.writeFile(scorePath, json);
    if (pinBaseline) await fs.writeFile(baselinePath, json);

    return {
        taskId: task.id,
        values,
        previous: pinBaseline ? undefined : previous,
    };
}

/** Re-load a saved baseline scorecard without re-grading. */
async function loadBaseline(task: Task): Promise<TaskResult | null> {
    const baselinePath = path.join(RUNS_DIR, task.id, "baseline.score.json");
    const saved = await fs
        .readFile(baselinePath, "utf8")
        .then(
            (txt) =>
                JSON.parse(txt) as {
                    results: Record<string, number | string>;
                },
        )
        .catch(() => null);
    if (!saved) return null;
    return {
        taskId: task.id,
        values: GRADERS.map((g) => saved.results[g.name] ?? "-"),
        previous: undefined,
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

/** Format one cell, appending a signed delta vs the baseline when both numeric. */
function display(g: Grader, v: number | string, prev?: number | string): string {
    let cell = typeof v === "number" ? (g.format?.(v) ?? String(v)) : v;
    if (typeof v === "number" && typeof prev === "number" && v !== prev) {
        const d = v - prev;
        cell = `${cell} (${d > 0 ? "+" : ""}${Number(d.toFixed(2))})`;
    }
    return cell;
}

function summarize(results: TaskResult[]): string {
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
    const taskW = Math.max(4, ...results.map((r) => r.taskId.length));

    const lines: string[] = ["", "=== scorecard ==="];
    for (let h = 0; h < headerRows; h++) {
        lines.push(
            [
                (h === 0 ? "task" : "").padEnd(taskW) + " ",
                ...GRADERS.map(
                    (_, i) =>
                        ` ${(headerWords[i]![h] ?? "").padStart(widths[i]!)} `,
                ),
            ].join("|"),
        );
    }
    lines.push(
        ["-".repeat(taskW + 1), ...widths.map((w) => "-".repeat(w + 2))].join(
            "+",
        ),
    );
    for (let r = 0; r < results.length; r++) {
        lines.push(
            [
                results[r]!.taskId.padEnd(taskW) + " ",
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

    // Footer: average each judge-kind grader across all tasks.
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
    options: {
        all: { type: "boolean" },
        baseline: { type: "boolean" },
        "show-baseline": { type: "boolean" },
    },
    allowPositionals: true,
});
const selected = selectTasks(
    "src/eval-runner.ts",
    positionals,
    (values.all ?? false) || positionals.length === 0,
);

if (values["show-baseline"]) {
    const loaded = await Promise.all(selected.map(loadBaseline));
    const results = loaded.filter((r): r is TaskResult => r !== null);
    if (results.length === 0) {
        console.error(
            "No baseline.score.json found — run `npm run eval -- --baseline` first.",
        );
        process.exit(1);
    }
    console.log(summarize(results));
} else {
    const client = new Anthropic();
    const settled = await Promise.allSettled(
        selected.map((task) => gradeTask(client, task, values.baseline ?? false)),
    );
    const results: TaskResult[] = [];
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
}
