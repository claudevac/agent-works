# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

This is a monorepo-style workspace for testing agents ("agent-works"). Currently
it contains one project:

- `ads-localization-eval/` — an eval harness for an English→Greek (el-GR) ad-copy
  translation & localization agent. See below for details. Treat it as its own
  Node/TypeScript project (own `package.json`, `node_modules`, `tsconfig.json`).

## ads-localization-eval

### Commands (run from `ads-localization-eval/`)

```bash
npm install
cp .env-example .env   # fill in ANTHROPIC_API_KEY, COPY_AGENT_ID, COPY_AGENT_ENV_ID

npm run typecheck                     # tsc --noEmit, no test runner in this project

npm run translate -- --all            # generate Greek copy for every task -> runs/<task>/output.txt
npm run translate -- summer_sale_h1   # generate for a single task id (see tasks.json)
npm run translate -- --all --force    # re-translate even if output.txt already exists

npm run eval -- --all --baseline      # grade every task, pin as baseline
npm run eval -- summer_sale_h1        # grade a single task, diff vs baseline
npm run eval -- --show-baseline       # re-print the saved baseline without re-grading
```

There is no test suite; `npm run typecheck` is the only verification command.
`translate` and `eval` both take task ids or `--all` (defaults to `--all` when
no positional args are given).

### Architecture

This is an **eval harness**, not the translation agent itself. The agent being
measured (a Claude Managed Agents session) lives outside this repo. The harness
is meant to stay frozen while the agent is iterated on elsewhere.

The loop:

```
tasks.json ──▶ translate-ads.ts ──▶ runs/<task>/output.txt ──▶ eval-runner.ts ──▶ scorecard (Δ vs baseline)
 (English)      (your copy agent)      (Greek copy)             (rules + taste)
```

- `src/translate-ads.ts` — the **only file that talks to the translation agent**.
  Opens a Managed Agents session (`COPY_AGENT_ID`/`COPY_AGENT_ENV_ID`), sends the
  prompt built from a task, and writes the final text to `runs/<task>/output.txt`.
  Caches by default (skips tasks with existing output unless `--force`); tasks
  run concurrently via `Promise.allSettled` so one failure doesn't block others.
  If the agent isn't on Managed Agents, replace the body of `translate()` — the
  rest of the harness only needs `runs/<task>/output.txt` to exist.

- `src/eval-runner.ts` — the **frozen grader harness**. For each task: reads
  `output.txt`, builds a `GraderContext` (task + output + parsed facts + configs
  + Anthropic client), runs every `Grader` in `GRADERS` against it, writes
  `runs/<task>/score.json`, and prints a heat-mapped scorecard. `--baseline`
  pins the current results as `runs/<task>/baseline.score.json`; on later runs,
  deltas are always computed against that pinned baseline (not the previous
  run), so re-running the same agent version shows no movement.

- `src/graders.ts` — the eval, declaratively. `GRADERS = [...codeGraders,
  ...tasteJudges(taste)]`. This is the file to edit to add/remove a deterministic
  metric (append a `Grader` here); taste criteria are added via config instead
  (see below).

- `src/graders/types.ts` — the `Grader` contract that code graders and LLM-judge
  graders both implement, so the runner treats them identically:
  `{ name, kind: "code"|"judge", grade(ctx), format?, scale? }`. `kind` only
  affects footer averaging in the scorecard. `scale` drives the heat map
  (`good: "high" | "low" | number`).

- `src/graders/code/*.ts` — one deterministic, free check each (length limits,
  placeholder/brand-name integrity, do-not-translate terms, glossary adherence,
  Greek-script ratio, el-GR locale formatting, banned anglicisms), each reading
  its inputs from `config/rules.config.yaml`.

- `src/graders/judge/judge.ts` — shared plumbing for the LLM-as-judge taste
  score. Builds a Zod schema dynamically from `taste.config.yaml`'s criteria,
  makes **one memoized model call per task** (`memoize` keyed on `taskId`) that
  scores every criterion at once via structured outputs
  (`client.messages.parse` + `zodOutputFormat`), and returns `{ scores, comment
  }`. All per-criterion graders and the weighted-overall grader read from this
  single call instead of each making their own.

- `src/graders/judge/taste-judges.ts` — turns each `taste.config.yaml` criterion
  into a `Grader` (plus a weighted-overall column) by reading from the memoized
  `judgeTaste` result.

- `src/parse-response.ts` — pure fact-extraction from the Greek output (e.g.
  length, placeholders present) with **no scoring**; scoring lives entirely in
  the graders.

- `src/config.ts` — loads and types `config/rules.config.yaml` (→
  `RulesConfig`) and `config/taste.config.yaml` (→ `TasteConfig`).

- `src/lib.ts` — shared paths (`ROOT`, `RUNS_DIR`, `CONFIG_DIR`), the `Task`
  type (loaded from `tasks.json`), and `selectTasks()` CLI arg handling shared
  by both entry-point scripts.

### Extending

- **New deterministic rule:** add a `Grader` in `src/graders/code/` and append
  it to `codeGraders` in `src/graders.ts`. Read its inputs from
  `config/rules.config.yaml`.
- **New taste criterion:** add an entry under `criteria:` in
  `config/taste.config.yaml` — a new scorecard column appears automatically,
  no code change.
- **Different translation agent:** replace the body of `translate()` in
  `src/translate-ads.ts`; the harness only cares that `runs/<task>/output.txt`
  exists.

### Notes

- The taste judge requires a recent `@anthropic-ai/sdk` (structured outputs via
  `messages.parse`/`zodOutputFormat`, and Managed Agents sessions). It imports
  `zod/v4` specifically to match what the SDK helper targets — don't mix zod
  major versions here.
- `runs/` is gitignored: generated outputs, `score.json`, and
  `baseline.score.json` are local artifacts, not committed state.
- `docs/eval-flow.md` has a Mermaid diagram (with a static `eval-flow.svg`
  fallback) of the full inputs → generate → grade flow — check it before
  making structural changes to the pipeline.
