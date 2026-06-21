// Generate step: drive YOUR copy translation agent (Claude Managed Agents) to
// localize each task's English source into Greek, and write the result to
// runs/<task>/output.txt for the grader to score.
//
// This is the only file that talks to the translation agent. If your agent
// isn't on Managed Agents, swap the body of translate() for your own call —
// the rest of the harness only cares that runs/<task>/output.txt exists.

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { RUNS_DIR, selectTasks, type Task } from "./lib.js";

const AGENT_ID = process.env.COPY_AGENT_ID ?? "";
const ENVIRONMENT_ID = process.env.COPY_AGENT_ENV_ID ?? "";

/** Prompt handed to the translation agent for one ad. */
function buildPrompt(task: Task): string {
    return [
        `Translate and adapt the following English advertising copy into Greek (el-GR) for the ad channel "${task.channel}".`,
        task.brief ? `Brand brief: ${task.brief}` : "",
        `Adapt idioms and cultural references for a Greek audience rather than translating literally.`,
        `Preserve any template tokens (e.g. {{app_name}}, {price}) and brand names exactly.`,
        `Return ONLY the final Greek copy, with no preamble or explanation.`,
        ``,
        task.source,
    ]
        .filter(Boolean)
        .join("\n");
}

/** Open a session against the copy agent, send the prompt, return its final text. */
async function translate(client: Anthropic, task: Task): Promise<string> {
    if (!AGENT_ID || !ENVIRONMENT_ID) {
        throw new Error(
            "Set COPY_AGENT_ID and COPY_AGENT_ENV_ID (see .env-example) to your copy translation agent.",
        );
    }

    const session = await client.beta.sessions.create({
        agent: AGENT_ID, // pins the agent's latest version for the session
        environment_id: ENVIRONMENT_ID,
        title: `ads-loc-${task.id}`,
    });

    const stream = await client.beta.sessions.events.stream(session.id);
    await client.beta.sessions.events.send(session.id, {
        events: [
            {
                type: "user.message",
                content: [{ type: "text", text: buildPrompt(task) }],
            },
        ],
    });

    let finalText = "";
    for await (const ev of stream) {
        if (ev.type === "agent.message") {
            // content is an array of text blocks comprising the agent response
            const text = ev.content.map((b) => b.text).join("");
            if (text.trim()) finalText = text;
        }
        if (ev.type === "session.status_idle") {
            if (ev.stop_reason?.type === "requires_action") continue;
            break;
        }
        if (ev.type === "session.status_terminated") break;
    }

    return finalText.trim();
}

// ------------------------------------------------------------------- CLI

const { values, positionals } = parseArgs({
    options: { all: { type: "boolean" }, force: { type: "boolean" } },
    allowPositionals: true,
});
const selected = selectTasks(
    "src/translate-ads.ts",
    positionals,
    (values.all ?? false) || positionals.length === 0,
);

const client = new Anthropic();

// Tasks are independent — fan out, but tolerate individual failures.
const settled = await Promise.allSettled(
    selected.map(async (task) => {
        const dir = path.join(RUNS_DIR, task.id);
        const outPath = path.join(dir, "output.txt");
        await fs.mkdir(dir, { recursive: true });

        // Resume support: skip already-produced outputs unless --force.
        if (!values.force) {
            const cached = await fs
                .readFile(outPath, "utf8")
                .catch(() => null);
            if (cached && cached.trim()) {
                console.log(`[${task.id}] cached`);
                return;
            }
        }

        console.log(`[${task.id}] translating...`);
        const output = await translate(client, task);
        await fs.writeFile(outPath, output);
        console.log(`[${task.id}] done (${output.length} chars)`);
    }),
);

for (const [i, r] of settled.entries()) {
    if (r.status === "rejected") {
        console.error(
            `[${selected[i]!.id}] FAILED: ${r.reason?.message ?? r.reason}`,
        );
    }
}

console.log("\nDone. Grade with: npm run eval -- --all");
