# Autoreview Skill Adoption Research - 2026-05-27

## Research Question

Should Universo Platformo vendor and adapt the OpenClaw `autoreview` skill from
`openclaw/agent-skills`, and what project-specific changes are needed before it
can live under `.agents/skills/`?

## Source Inventory

| Source                                                               | Type                               | Freshness                                                                  | License / Attribution                                  | Notes                                                                                                                                              |
| -------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://github.com/openclaw/agent-skills/tree/main/skills/autoreview | User-provided upstream skill       | Checked on 2026-05-27 at commit `7b6ca5b2078af2746d1c4424fe90211901b997ae` | MIT, copyright 2026 openclaw                           | Contains `SKILL.md`, `scripts/autoreview`, and `scripts/test-review-harness`.                                                                      |
| https://github.com/openclaw/agent-skills                             | Upstream repository                | Checked on 2026-05-27 at commit `7b6ca5b2078af2746d1c4424fe90211901b997ae` | MIT, copyright 2026 openclaw                           | README explains shared skills, install/symlink workflow, and zero-setup vendored snapshots.                                                        |
| `/home/vladimir/.codex/skills/.system/skill-creator/SKILL.md`        | Local system skill authoring guide | Local current file                                                         | System skill                                           | Defines skill anatomy, progressive disclosure, validation with `quick_validate.py`, and guidance to avoid extra README/install docs inside skills. |
| `.agents/skills/SOURCES.md`                                          | Local source/license registry      | Current worktree                                                           | Project repository license plus imported skill notices | Existing place to register imported external skills, local skills, and reference sources.                                                          |
| `.gemini/rules/custom_modes/plan_mode.md`                            | Local PLAN mode rule               | Current worktree                                                           | Project repository license                             | Requires saved research artifacts for plans driven by external links.                                                                              |

## Upstream Autoreview Contents

The upstream skill is a structured closeout code-review workflow. The skill body
instructs agents to run the bundled helper as a final advisory review, verify
findings manually, rerun focused tests after review-triggered changes, and stop
after the helper exits cleanly with no accepted/actionable findings.

The helper script:

-   builds review bundles from local dirty changes, branch diffs, or commit diffs;
-   auto-selects dirty local changes first, otherwise PR base via `gh pr view`, or
    `origin/main` for non-main branches;
-   supports `codex`, `claude`, `droid`, and `copilot` engines;
-   defaults to `AUTOREVIEW_ENGINE` or `codex`;
-   asks the review engine for a strict JSON report with findings, correctness,
    explanation, and confidence;
-   validates the returned JSON shape and filters findings outside changed paths;
-   supports `--dry-run`, `--parallel-tests`, `--prompt`, `--prompt-file`,
    `--dataset`, `--output`, `--json-output`, `--stream-engine-output`,
    `--panel`, and `--reviewers`;
-   runs Codex with a read-only sandbox and `--ask-for-approval never`;
-   emits heartbeat lines during long-running reviews;
-   exits nonzero when accepted/actionable findings remain.

The upstream folder also includes `scripts/test-review-harness`, a Bash fixture
runner that creates temporary malicious/benign git repositories and exercises
the helper through selected engines.

## Project-Specific Material To Remove Or Rewrite

The upstream skill is useful but not ready as a drop-in project-local skill.
These pieces are OpenClaw- or author-environment-specific:

-   `Guardian auto_review` wording;
-   `clawsweeper[bot]`, `@clawsweeper automerge`, `/landpr`, and Gitcrawl
    operational guidance;
-   `agent-scripts` checkout/global helper paths;
-   `/Users/steipete/...` absolute path examples;
-   OpenClaw-specific helper path wording;
-   default examples that assume a generic `origin/main` branch without mentioning
    the repository's active branch/PR-base handling rules;
-   review closeout guidance that does not mention this repository's command
    restrictions, especially no automatic `pnpm dev`, focused package checks,
    local minimal Supabase only for E2E, and Playwright wrapper usage.

The helper script itself is mostly portable, but implementation should audit
whether to keep every engine. `codex` is immediately relevant. `claude`,
`droid`, and `copilot` are optional and should stay opt-in only if they do not
create hard dependencies or noisy failure modes in the default workflow.

## Project Implications

-   The correct target path is `.agents/skills/autoreview/`, not `.codex/skills/`
    or a symlink to the upstream repo.
-   Because the user wants a complete copy and the upstream license is MIT,
    implementation should preserve attribution in `.agents/skills/SOURCES.md` and
    include a copyright/license notice for the copied scripts.
-   The project-local `SKILL.md` should be rewritten, not copied verbatim. It
    should keep the useful workflow but remove OpenClaw-specific guidance and
    point to `.agents/skills/autoreview/scripts/autoreview`.
-   The script should be copied and then minimally adapted:
    -   keep deterministic bundle construction and structured JSON validation;
    -   add or preserve an executable shebang;
    -   avoid write operations except explicitly requested output files;
    -   keep Codex default;
    -   keep read-only review-engine prompt rules;
    -   make any Universo-specific defaults explicit only when they are real
        repository rules.
-   The validation harness can be copied as a script resource if it remains
    useful for maintaining the helper, but the main skill should not force it into
    normal closeout workflows.
-   No runtime UI, database, Supabase, package manifest, or i18n code changes are
    required for this adoption plan.

## Recommended Decision

Adopt the skill as a vendored and adapted project-local skill:

-   create `.agents/skills/autoreview/SKILL.md`;
-   create `.agents/skills/autoreview/scripts/autoreview`;
-   optionally create `.agents/skills/autoreview/scripts/test-review-harness`
    for helper maintenance;
-   update `.agents/skills/SOURCES.md` as an imported external skill with MIT
    attribution and upstream commit provenance;
-   refactor `SKILL.md` to Universo wording and remove OpenClaw-specific
    operations;
-   validate with `skill-creator` quick validation, script syntax checks,
    `scripts/autoreview --help`, `scripts/autoreview --dry-run`, Prettier where
    applicable, and repository docs/whitespace checks.

## Open Questions

-   Should `droid` and `copilot` support remain in the initial vendored helper, or
    should the first project-local version support only `codex` and `claude` to
    reduce maintenance?
-   Should `test-review-harness` be included in the vendored skill despite being a
    maintenance helper rather than normal user-facing workflow?
-   Should this repository add a future CI/checker to detect upstream drift for
    vendored external skills, or is `.agents/skills/SOURCES.md` provenance enough
    for now?
