# Development Process with Claude Code

A practical walkthrough of how to use Claude Code for day-to-day software development.

---

## 1. Starting a Session

Launch Claude Code from your terminal inside any project directory:

```bash
cd my-project
claude
```

Claude automatically detects your project structure, git status, and available tooling.

## 2. Orienting in a Codebase

Ask Claude to explore and understand your project:

```
> explain how the authentication module works
> what does the API layer look like?
> find where user permissions are checked
```

Claude will read files, search for patterns, and give you a concise summary — useful for onboarding onto unfamiliar codebases.

## 3. Making Changes

Describe what you want in plain language:

```
> add a rate limiter middleware to the Express app
> fix the off-by-one error in the pagination logic
> refactor the database queries to use connection pooling
```

Claude will:
1. Read the relevant files to understand existing code
2. Make targeted edits (preferring minimal, focused changes)
3. Show you exactly what changed

## 4. Running and Testing

Ask Claude to run your tests or build:

```
> run the test suite
> build the project and check for errors
> run just the tests related to authentication
```

If tests fail, Claude can read the output, diagnose the issue, and fix it.

## 5. Iterating

Development is rarely one-shot. Refine your changes conversationally:

```
> actually, the rate limiter should use a sliding window instead
> add error handling for the case where the DB connection drops
> the test is flaky — can you look at why?
```

Claude remembers the full context of your session, so you don't need to re-explain.

## 6. Committing and Pushing

When you're happy with the changes:

```
> /commit
```

Claude will review all staged/unstaged changes, write a descriptive commit message, and create the commit. You can also ask it to push:

```
> push to my feature branch
```

## 7. Code Review and PRs

Claude can help with pull requests:

```
> create a PR for this branch
> review the PR at https://github.com/org/repo/pull/42
```

It reads diffs, understands context, and provides actionable review feedback.

---

## Key Principles

| Principle | What it means |
|---|---|
| **Read before writing** | Claude reads existing code before suggesting changes |
| **Minimal changes** | Only touch what's needed — no drive-by refactors |
| **Test-driven** | Run tests after changes to verify correctness |
| **Conversational** | Iterate naturally; Claude keeps full session context |
| **Safe by default** | Destructive operations (force push, delete) require confirmation |

## Tips for Effective Use

- **Be specific** — "fix the login bug where email validation fails on + characters" beats "fix login"
- **Let Claude explore** — if you're unsure where something lives, ask Claude to search for it
- **Use slash commands** — `/commit` for commits, `/help` for guidance
- **Review changes** — Claude shows you what it edits; take a moment to verify
- **Break big tasks into steps** — complex features work best when tackled incrementally

---

## Example Workflow

```
you:   explain how the payment processing works
claude: [reads files, explains the flow]

you:   add support for refunds
claude: [reads relevant code, makes changes across service + controller + tests]

you:   run the tests
claude: [runs tests, 2 failures found, fixes them]

you:   /commit
claude: [creates commit: "Add refund support to payment processing"]

you:   create a PR
claude: [pushes branch, opens PR with summary]
```

That's the loop: **understand → change → verify → ship**.
