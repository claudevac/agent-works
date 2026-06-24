// Shared library: paths, the Asset type, and CLI asset selection.

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
 * One adaptation unit to QA. Loaded from assets.json.
 * - `before`        original creative (pre-adaptation). Optional — if absent the
 *                   judge analyzes the AFTER on its own merits.
 * - `after`         the adapted creative to QA.
 * - `targetFormat`  key into formats.config.yaml (drives the deterministic checks).
 * - `brief`         what must survive the adaptation (handed to the vision judge).
 */
export interface Asset {
    id: string;
    before?: string;
    after: string;
    targetFormat: string;
    brief?: string;
}

export const assets: Asset[] = JSON.parse(
    fs.readFileSync(path.join(ROOT, "assets.json"), "utf8"),
);

/** Resolve an asset-relative path against the project root. */
export function resolveAsset(p: string): string {
    return path.isAbsolute(p) ? p : path.join(ROOT, p);
}

/**
 * Resolve asset ids from the CLI. Accepts any number of ids, or `--all` for
 * the full set. Exits with usage if none given or any id is unknown.
 */
export function selectAssets(
    script: string,
    ids: string[],
    all: boolean,
): Asset[] {
    if (all) return assets;
    const available = assets.map((a) => a.id).join(", ");
    if (ids.length === 0) {
        console.error(`usage: tsx ${script} <asset_id> [<asset_id> ...] | --all`);
        console.error(`available: ${available}`);
        process.exit(1);
    }
    return ids.map((id) => {
        const found = assets.find((a) => a.id === id);
        if (!found) {
            console.error(`unknown asset: ${id}\navailable: ${available}`);
            process.exit(1);
        }
        return found;
    });
}
