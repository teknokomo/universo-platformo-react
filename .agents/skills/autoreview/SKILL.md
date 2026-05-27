---
name: autoreview
description: Use when running a structured closeout code review for local changes, branch diffs, commit diffs, final QA after non-trivial edits, second-model review, or an explicit autoreview request. Provides the project-local `.agents/skills/autoreview/scripts/autoreview` helper for bundle-driven advisory review.
---

# Autoreview

Run the bundled structured review helper as a closeout check for non-trivial
changes. This is advisory code review, not automatic approval, merge permission,
or a replacement for focused tests.

Use this skill when:

-   the user asks for autoreview, structured review, second-model review, or final
    review;
-   a local patch, branch, PR branch, or commit needs a final code-quality pass;
-   QA wants an additional reviewer focused on bugs, regressions, security, and
    missing tests.

## Contract

-   Treat helper output as advisory. Verify every finding against the real code
    and adjacent files before changing anything.
-   Fix accepted findings at the right ownership boundary, then rerun focused
    tests and the helper until no accepted/actionable findings remain.
-   Reject speculative findings, broad rewrites, style-only churn, and fixes that
    make the codebase more complex without addressing a concrete risk.
-   Do not run nested review tools from inside the review. The helper builds one
    bundle, calls the selected engine, validates one structured report, and stops.
-   Do not push just to review. Use branch or commit mode for already committed
    work, and local mode only when the patch is actually dirty in the current
    checkout.
-   Do not run `pnpm dev`. Use focused package checks. Use Playwright and local
    minimal Supabase only when the reviewed change actually touches browser/E2E
    behavior and the relevant project skill requires that proof.
-   Preserve unrelated dirty work. If the repository has user changes outside the
    current task, do not treat those files as authored by the current
    implementation.
-   For long reviews, heartbeat lines such as
    `review still running: ... elapsed=... pid=...` mean the helper is still
    active. Let it continue unless the process has clearly failed or stopped
    emitting expected progress.

## Pick Target

Use the project-local helper:

```bash
.agents/skills/autoreview/scripts/autoreview --help
```

Dirty local work:

```bash
.agents/skills/autoreview/scripts/autoreview --mode local
```

Branch or PR work:

```bash
.agents/skills/autoreview/scripts/autoreview --mode branch --base origin/main
```

The helper does not fetch by default. If the review must update remote refs
first, make that git mutation explicit:

```bash
.agents/skills/autoreview/scripts/autoreview --mode branch --base origin/main --fetch
```

If an open PR exists and `gh` is available, prefer the actual PR base:

```bash
base=$(gh pr view --json baseRefName --jq .baseRefName)
.agents/skills/autoreview/scripts/autoreview --mode branch --base "origin/$base"
```

Single committed change:

```bash
.agents/skills/autoreview/scripts/autoreview --mode commit --commit HEAD
```

Optional review context:

```bash
.agents/skills/autoreview/scripts/autoreview \
  --mode branch \
  --base origin/main \
  --prompt-file /tmp/review-notes.md \
  --dataset /tmp/evidence.json
```

## Engines And Panels

-   Default engine: `AUTOREVIEW_ENGINE` or `codex`.
-   Supported opt-in engines: `codex`, `claude`, `droid`, and `copilot`.
-   Do not switch engine/model after the user requested one unless they approve
    the change.
-   Multi-reviewer panels are opt-in only and can be expensive:

```bash
.agents/skills/autoreview/scripts/autoreview --reviewers codex,claude
```

`--panel` is shorthand for Codex plus Claude unless `--engine` changes the first
reviewer:

```bash
.agents/skills/autoreview/scripts/autoreview --panel
```

## Parallel Closeout

Format first if formatting can change line locations. Then tests and review may
run in parallel:

```bash
.agents/skills/autoreview/scripts/autoreview \
  --parallel-tests "pnpm --filter <package> test"
```

If tests or review findings lead to edits, rerun the affected tests and rerun
autoreview. Stop after the helper exits cleanly with no accepted/actionable
findings.

## Helper Behavior

The helper:

-   chooses dirty local changes first in auto mode;
-   otherwise uses current PR base when `gh pr view` works;
-   otherwise uses `origin/main` as a generic non-main branch fallback;
-   does not fetch by default; `--fetch` explicitly updates `origin` before a
    branch diff;
-   supports `--mode local`, `--mode branch`, and `--mode commit`;
-   writes only to stdout unless `--output`, `--json-output`, or streamed engine
    output is requested;
-   supports `--dry-run`, `--parallel-tests`, `--prompt`, `--prompt-file`,
    `--dataset`, `--no-tools`, `--no-web-search`, `--stream-engine-output`,
    `--panel`, and `--reviewers`;
-   allows read-only tools and web search by default where the selected engine
    supports them;
-   runs Codex through `codex exec` with a read-only sandbox and structured output;
-   filters findings to changed paths;
-   exits nonzero when accepted/actionable findings remain.

## Final Report

Include:

-   the review command used;
-   tests or proof run;
-   findings accepted/rejected and the reason;
-   the clean final helper result, or why a remaining finding was consciously
    rejected.
