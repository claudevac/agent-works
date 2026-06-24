# Deploying the analyst as a Claude Managed Agent

The analysis brain is a single system prompt: `ANALYST_PREAMBLE` in
`src/graders/judge/judge.ts`, plus the rubric rendered from
`config/visual-rubric.config.yaml`. The local pipeline calls it as a one-shot
structured-output judge; the *same* prompt can run as a standing Managed Agent
that teammates chat with ("here's a before/after pair — what broke?").

Two ways to use it:

## 1. Local pipeline (default)

Batch QA over `assets.json` with deterministic spec checks + the vision judge,
producing `runs/<asset>/report.json` and a scorecard. See the main README. This
is the right mode for regression-testing an adaptation process across many assets.

## 2. Standing Managed Agent

Deploy the analyst persona so it can be invoked interactively or by other agents.

1. Build the system prompt: `ANALYST_PREAMBLE` + the rubric criteria (one line
   per criterion from `visual-rubric.config.yaml`) + the target-format context.
   Keep the "use the full 0-5 range" and "name specific defects and where they
   occur" instructions.
2. Create the agent (YAML piped to the `ant` CLI, as in the cwc-workshops):
   ```
   ant beta:agents create < ./resources/visual-qa-agent.yaml
   ```
   with the system prompt above and a vision-capable model
   (`claude-opus-4-8`, or `claude-sonnet-4-6` for cost).
3. To get the same machine-readable scores out of the standing agent, have it
   emit the structured object (the per-criterion 0-5 scores + `comment`) — either
   via the agent's output schema or by instructing it to return that JSON — so its
   responses can flow straight back into this harness's scorecard.

## Keep one source of truth

Whichever mode, the rubric lives in `visual-rubric.config.yaml`. Edit it there;
both the local judge and the deployed agent prompt are built from it, so they
stay in sync and changes remain measurable against a pinned baseline.
