# Runtime UX Reviewer Profiles

`.agents/agent-profiles` is the shared authoring source for Runtime UI UX reviewer roles. Native agent files in `.codex/agents`, `.gemini/agents`, `.claude/agents`, `.github/agents`, `.qoder/agents`, and `.kiro/steering/agent_profiles` must be self-contained copies, not link-only wrappers.

## Safe Defaults

-   Reviewer profiles are instruction-only and read-only by default.
-   Do not request shell, write, database, browser, or network permissions only to produce an architectural verdict.
-   Do not include destructive commands, secret-handling instructions, approval-bypass instructions, or opaque third-party skill content.

## Required Invariant Anchors

Every native copy must preserve these anchors in equivalent wording:

-   no raw user-facing IDs;
-   no raw JSON or object cells;
-   multiline long-text fields;
-   localized validation;
-   no page-level horizontal overflow;
-   reuse existing MUI dashboard primitives;
-   browser evidence when implemented UI is reviewed;
-   honest normal-user verdict.

## Drift Control

Run `pnpm check:runtime-ux-agents` after changing profiles or native copies.
