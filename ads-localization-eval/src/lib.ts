// Eval harness shared library: paths, the Task type, and CLI task selection.

import * as fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);
export const RUNS_DIR = path.join(ROOT, "runs");
export const CONFIG_DIR = path.join(ROOT, "config");

/**
 * One ad to localize. Loaded from tasks.json.
 * - `source`   English ad copy to translate + adapt.
 * - `channel`  Key into rules.config length_limits (drives the length check).
 * - `brief`    Brand voice / context handed to the taste judge.
 * - `reference` Optional human transcreation, shown to the judge for comparison.
 */
export interface Task {
    id: string;
    source: string;
    channel: string;
    brief?: string;
    reference?: string;
}

export const tasks: Task[] = JSON.parse(
    fs.readFileSync(path.join(ROOT, "tasks.json"), "utf8"),
);

/**
 * Resolve task ids from the CLI. Accepts any number of ids, or `--all` for the
 * full set. Exits with usage if none given or any id is unknown.
 */
export function selectTasks(
    script: string,
    ids: string[],
    all: boolean,
): Task[] {
    if (all) return tasks;
    const available = tasks.map((t) => t.id).join(", ");
    if (ids.length === 0) {
        console.error(`usage: tsx ${script} <task_id> [<task_id> ...] | --all`);
        console.error(`available: ${available}`);
        process.exit(1);
    }
    return ids.map((id) => {
        const found = tasks.find((t) => t.id === id);
        if (!found) {
            console.error(`unknown task: ${id}\navailable: ${available}`);
            process.exit(1);
        }
        return found;
    });
}
