# Ad Visual QA — before/after format-adaptation analyst

A specialized **vision analyst** that QAs ad creatives across a
format-adaptation step. For each asset it compares the **BEFORE** (original
creative) against the **AFTER** (adapted to a target placement) and reports what
the reformatting broke — cropped subjects, illegible/clipped text, logo or CTA
lost or in a platform safe zone, distortion, color/brand drift.

It's the image/slide half of the eval-driven pattern, retargeted from "grade one
rendered slide" to "compare a before/after creative pair."

Two layers behind one uniform `Grader` interface:

- **Deterministic spec checks** (code graders, from `config/formats.config.yaml`):
  valid image produced, exact dimensions vs target, aspect-ratio deviation,
  file-size budget.
- **Vision analyst** (LLM judge, from `config/visual-rubric.config.yaml`):
  focal-point preserved, text legibility, logo safe-zone, CTA visibility, no
  distortion, color/brand consistency vs the original, overall adaptation.
  One model call per asset sends *both* images and scores every criterion;
  criteria/weights/rubrics are pure config.

## The loop

```
assets.json ──▶ analyze.ts ──▶ load BEFORE+AFTER images ──▶ graders ──▶ report.json + scorecard (Δ vs baseline)
 (before/after,    (frozen        (deterministic facts)    (spec checks +
  target format)    harness)                                vision analyst)
```

## Setup

```bash
npm install
cp .env-example .env        # ANTHROPIC_API_KEY
# put your creatives in assets/ and describe each pair in assets.json
npm run typecheck           # optional
```

## Run

```bash
# Analyze all assets, pin this run as the baseline the first time
npm run analyze -- --all --baseline

# After re-adapting creatives, re-run to see deltas vs baseline
npm run analyze -- --all

# Single asset
npm run analyze -- summer_sale__1x1_to_9x16
```

Each run writes `runs/<asset>/report.json` (per-criterion scores + the analyst's
findings + image metadata) and prints a heat-mapped scorecard with deltas.

## Inputs (`assets.json`)

```jsonc
{
  "id": "summer_sale__1x1_to_9x16",
  "before": "assets/summer_sale_1x1.png",   // original; optional
  "after":  "assets/summer_sale_9x16.png",  // adapted asset to QA
  "targetFormat": "story_9x16",             // key into formats.config.yaml
  "brief": "Keep the model's face and '50% OFF' badge; CTA at the bottom."
}
```

If `before` is omitted, the analyst evaluates the AFTER on its own merits.

## Layout

```
config/
  formats.config.yaml        target dimensions/aspect/safe-zone/file-budget per placement
  visual-rubric.config.yaml  analyst criteria/weights/rubrics (edit to retune; no code change)
assets.json                  the asset set: before/after paths + target format + brief
src/
  analyze.ts                 frozen harness: context → graders → report.json + scorecard
  graders.ts                 the analysis, declaratively (GRADERS array)
  graders/code/*.ts          deterministic spec checks
  graders/judge/judge.ts     the vision analyst (two-image call; ANALYST_PREAMBLE = the agent)
  graders/judge/visual-judges.ts  per-criterion + weighted-overall columns
  parse-image.ts             pure image facts (dimensions, bytes) via image-size
  config.ts, lib.ts          config/asset loading, CLI helpers
docs/agent-deployment.md     run the same analyst prompt as a Claude Managed Agent
```

## Extending

- **New spec check:** add a `Grader` in `src/graders/code/` and append it to
  `codeGraders` in `src/graders.ts`. Read its inputs from `formats.config.yaml`.
- **New analyst criterion:** add an entry under `criteria:` in
  `config/visual-rubric.config.yaml`. A new column appears automatically.
- **New placement:** add a block under `formats:` in `formats.config.yaml`.

## Notes

- The vision judge uses structured outputs (`messages.parse` + `zodOutputFormat`,
  zod v4) and a vision-capable model (default `claude-opus-4-8`, set in the
  rubric config — switch to `claude-sonnet-4-6` to cut cost on large batches).
- `assets/*.{png,jpg,webp}` and `runs/` are gitignored.
