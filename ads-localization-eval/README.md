# Ads Localization Eval (English → Greek)

An eval harness for measuring how well a copy translation agent **translates and
adapts advertising copy into Greek (el-GR)**. Modeled on the eval-driven agent
development pattern: a frozen grader harness scores the agent's output every
time you change the agent, so improvements are *measured*, not guessed.

Two layers of grading:

- **Deterministic translation rules** (code graders, free) — driven by
  `config/rules.config.yaml`: length limits, placeholder/brand-name integrity,
  glossary adherence, Greek-script ratio, el-GR number/currency formatting,
  banned anglicisms.
- **Configurable taste** (LLM-as-judge) — driven by `config/taste.config.yaml`:
  fluency, tone match, transcreation quality, persuasiveness, brevity. Each
  criterion is a scorecard column; criteria/weights/rubrics are edited in
  config with no code change.

## The loop

```
tasks.json ──▶ translate-ads.ts ──▶ runs/<task>/output.txt ──▶ eval-runner.ts ──▶ scorecard (Δ vs baseline)
 (English)      (your copy agent)      (Greek copy)             (rules + taste)
```

The agent you iterate lives **outside** this repo (your Managed Agents copy
agent). The harness here is the measuring stick and should stay frozen while you
tune the agent.

## Setup

```bash
npm install
cp .env-example .env   # fill in ANTHROPIC_API_KEY, COPY_AGENT_ID, COPY_AGENT_ENV_ID
npm run typecheck      # optional
```

## Run

```bash
# 1. Generate Greek copy from your translation agent (writes runs/<task>/output.txt)
npm run translate -- --all          # or: npm run translate -- summer_sale_h1

# 2. Grade, pinning this run as the baseline the first time
npm run eval -- --all --baseline

# 3. Change your agent, regenerate, and grade again to see deltas vs baseline
npm run translate -- --all --force
npm run eval -- --all

# Re-print the saved baseline without re-grading
npm run eval -- --show-baseline
```

`translate` and `eval` accept task ids or `--all` (default = all). `--force`
re-translates cached outputs.

## Layout

```
config/
  rules.config.yaml   deterministic rule inputs (edit to change code-grader behavior)
  taste.config.yaml   judge criteria/weights/rubrics (edit to change taste columns)
tasks.json            the eval set: English ad copy + channel + brand brief
src/
  translate-ads.ts    generate step — drives your copy agent (the only SDK-touching file)
  eval-runner.ts      frozen grader harness: context → graders → scorecard
  graders.ts          the eval, declaratively (the GRADERS array)
  graders/code/*.ts   one deterministic rule check each
  graders/judge/*.ts  configurable taste judge (shared call + per-criterion columns)
  parse-response.ts   pure facts about the Greek output (no scoring)
  config.ts, lib.ts   config loading, task loading, CLI helpers
```

## Extending

- **New deterministic rule:** add a `Grader` in `src/graders/code/` and append it
  to `codeGraders` in `src/graders.ts`. Read its inputs from `rules.config.yaml`.
- **New taste criterion:** add an entry under `criteria:` in
  `config/taste.config.yaml`. A new column appears automatically — no code change.
- **Different translation agent:** if your agent isn't on Managed Agents, replace
  the body of `translate()` in `src/translate-ads.ts`. The harness only needs
  `runs/<task>/output.txt` to exist.

## Notes

- The taste judge uses structured outputs (`messages.parse` + `zodOutputFormat`)
  and Managed Agents sessions, which require a recent Anthropic SDK. Pin the SDK
  version your environment provides if the betas differ.
- `runs/` is gitignored — it holds generated outputs and scores.
