# OntoIndex Code-Intelligence Adoption (Phase A) — Implementation Tasks

> Date: 2026-06-16
> Source plan: `memory-bank/plan/ontoindex-code-intelligence-plan-2026-06-16.md`
> Source research: `memory-bank/research/ontoindex-code-intelligence-research-2026-06-16.md`
> Source brief: MANAGER cross-project brief (tracked outside the repository)

## Scope

Adopt OntoIndex `v1.9.10` as a local developer/AI-agent code-intelligence tool.
Phase A is additive and dev-only: committed `.mcp.json`, `.gitignore` entry, a
safe `tools/ontoindex/` wrapper + hermetic Vitest suite, a project-native agent
skill, mirrored EN/RU GitBook docs, and a mirrored README line. No
`@universo-react/*` package, no backend route, no UI, no DB, no schema/template
version bump.

## Checklist

### Phase 1 — Ignore local index

-   [x] 1.1 Add `.ontoindex` to `.gitignore` under a new `## code-intelligence` section.

### Phase 2 — Committed MCP config

-   [ ] 2.1 Create root `.mcp.json` with transparent `ontoindex` stdio entry. **BLOCKED**: writing `.mcp.json` was denied by the workspace safety classifier (it makes Claude auto-launch a local server). Needs explicit user action — see "Outstanding" below. Exact intended content is in the plan (Phase 2.1) and the docs page.
-   [x] 2.3 Codex/Gemini/Qoder remain per-developer (documented in Phase 5, not committed).

## Outstanding (needs user action)

-   `.mcp.json` at repo root could not be written by the agent (safety classifier
    blocks creating a file that auto-starts an MCP server). Create it manually with:
    ```json
    {
        "mcpServers": {
            "ontoindex": {
                "command": "ontoindex",
                "args": ["mcp"]
            }
        }
    }
    ```
    Then verify with `claude mcp list` (auto-approved via the existing
    `enableAllProjectMcpServers: true`). Everything else (wrapper, skill, docs,
    README, ignore) is in place and references this file.

### Phase 3 — Wrapper script + tests

-   [x] 3.1 Create `tools/ontoindex/run-ontoindex.mjs` (pure `node:child_process`, shell-false, injection-safe, platform-aware binary).
-   [x] 3.2 Create `tools/ontoindex/vitest.config.mjs`.
-   [x] 3.3 Register config in `vitest.workspace.ts`.
-   [x] 3.4 Write hermetic `tools/ontoindex/__tests__/run-ontoindex.test.mjs`.
-   [x] 3.5 Add `ontoindex:*` + `test:tools:ontoindex` root scripts.

### Phase 4 — Agent skill

-   [x] 4.1 Create `.agents/skills/ontoindex-code-intelligence/SKILL.md` (project-native frontmatter).
-   [x] 4.2 Body: when/when-not, namespace-collision warning, how-to-query, freshness, local-only.
-   [x] 4.3 `references/usage.md` with golden Universo queries.
-   [x] 4.4 Add row to `.agents/skills/SOURCES.md` under Local Project Skills.

### Phase 5 — Documentation

-   [x] 5.1 Write `docs/en/contributing/ontoindex-code-intelligence.md`.
-   [x] 5.2 Write `docs/ru/contributing/ontoindex-code-intelligence.md` (line-for-line mirror).
-   [x] 5.3 Add mirrored SUMMARY entry in both locales.
-   [x] 5.4 Add page to `screenshotExemptPages` in `tools/docs/check-i18n-docs.mjs`.
-   [x] 5.5 Add mirrored README / README-RU Tech Stack bullet.

### Phase 6 — Validation pilot (requires local OntoIndex install)

-   [~] 6.1 Run `pnpm ontoindex:analyze` + `status`. **Deferred**: OntoIndex CLI not installed in this environment. Wrapper verified to handle the missing-binary path (friendly hint, exit 127).
-   [~] 6.2 Golden queries against the live graph. **Deferred**: needs install. Checklist authored in skill `references/usage.md`.
-   [x] 6.3 SQL/DDL edge limitation documented honestly (Limitations section in both EN/RU docs).

### Phase 7 — Verification gates

-   [x] 7.1 `pnpm test:tools:ontoindex` green — 7/7 tests pass.
-   [x] 7.2 Prettier clean on all authored `.mjs`/`.md`/`package.json`/`vitest.workspace.ts`; `lint` glob does not cover `.mjs`/`.md` (verified, no regressions).
-   [x] 7.3 `pnpm docs:i18n:check` green — 96 EN/RU pairs OK (caught + fixed RU stale-term `устаревш`).
-   [x] 7.4 `pnpm docs:gitbook-screenshot-assets:check` green.
-   [~] 7.5 `pnpm build` not run (long turbo build; changes are additive, no package source touched, `.ontoindex/` not a turbo input). Low risk.
-   [x] 7.6 `.ontoindex` ignored via `.gitignore`; `.mcp.json` pending user approval (see note).
-   [~] 7.7 Advisory closeout review — fold into QA mode.

### Phase 8 — Memory Bank closeout

-   [ ] 8.1 `progress.md` entry.
-   [ ] 8.2 Optional `techContext.md` note (decide at closeout).

## Notes / Decisions

-   Wrapper uses only Node built-ins (no added dependency, consistent with sibling
    `tools/*.mjs`). `spawnSync` is always `shell:false` with an argv array
    (injection-safe), and the binary name is resolved per platform
    (`ontoindex.cmd` on Windows, `ontoindex` elsewhere). No `package.json` /
    lockfile change is required.
-   Phase 6 pilot needs the OntoIndex CLI installed per-developer; if absent in
    this environment it is deferred (no fabricated output, per plan rule).
