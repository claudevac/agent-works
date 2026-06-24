// Pure, deterministic image facts — no model calls. Reads dimensions and byte
// size from the file header (via image-size). Everything a code grader needs to
// check an asset against its target format spec lives on ImageMeta.

import { imageSize } from "image-size";
import * as fs from "node:fs";

export interface ImageMeta {
    exists: boolean;
    valid: boolean;
    width: number;
    height: number;
    /** Detected file type, e.g. "png" | "jpg" | "webp". */
    type?: string;
    bytes: number;
    /** width / height, or 0 when unknown. */
    aspect: number;
}

const EMPTY: ImageMeta = {
    exists: false,
    valid: false,
    width: 0,
    height: 0,
    bytes: 0,
    aspect: 0,
};

export function parseImage(filePath: string): ImageMeta {
    let buf: Buffer;
    try {
        buf = fs.readFileSync(filePath);
    } catch {
        return { ...EMPTY };
    }
    try {
        const d = imageSize(buf);
        const width = d.width ?? 0;
        const height = d.height ?? 0;
        return {
            exists: true,
            valid: width > 0 && height > 0,
            width,
            height,
            type: d.type,
            bytes: buf.length,
            aspect: height > 0 ? width / height : 0,
        };
    } catch {
        return { ...EMPTY, exists: true, bytes: buf.length };
    }
}
