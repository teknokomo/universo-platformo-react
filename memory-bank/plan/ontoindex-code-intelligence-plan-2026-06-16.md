# OntoIndex Code-Intelligence Adoption — Implementation Plan (Phase A)

> Created: 2026-06-16
> Status: Draft — QA-reviewed 2026-06-16 (corrections applied: lint/CI coverage reality, Windows `spawnSync` cross-spawn fix; awaiting user approval)
> Research input: `memory-bank/research/ontoindex-code-intelligence-research-2026-06-16.md`
> Brief: MANAGER cross-project brief (tracked outside the repository)
> Scope decision (user, 2026-06-16): **Phase A only**, local-only, AGPL is not a gate.

---

## Overview

Adopt [OntoIndex](https://github.com/ontograph/ontoindex) `v1.9.10` as a
**local, developer-and-AI-agent code-intelligence tool** over this monorepo. It
builds a local code graph and exposes it through a stdio **MCP server** plus a
CLI. Phase A is **purely additive and dev-only**: a committed project `.mcp.json`
for Claude Code, a `.gitignore` entry, a small Node wrapper script in `tools/`
with a real test suite, a project-native agent skill, mirrored EN/RU GitBook docs,
and a one-line README mention. No `@universo-react/*` package, no backend route,
no UI, no database, no schema/template version bump.

### What Phase A is NOT (explicit non-goals)

- **No application/runtime UI.** Therefore the Runtime UI UX Quality Gate, MUI
  dashboard primitives, `apps-template-mui`, CRUD dialogs, DataGrid, and
  Playwright **UI screenshots of product screens do not apply** — there is no
  product screen to render. The only "visual" artifact is a terminal/CLI session,
  which we capture as fenced text output, not browser screenshots.
- **No new shared types/utils/i18n keys.** `packages/universo-react-{types,utils,i18n}`
  and `template-mui` are not touched: Phase A ships no product TypeScript and no
  user-facing UI strings. (Documented here only to confirm the deliberate
  decision, per the user's standing guidance about where shared code *would* go.)
- **No TanStack Query, no UUID v7, no Supabase, no metahub/app changes.** These
  belong to product code; Phase A has none. The local Supabase E2E stack
  (`pnpm supabase:e2e:start:minimal`) is **not needed** for this plan and will
  not be started.
- **No in-product search, backend proxy, or admin page** (that was Phase B —
  out of scope).

### Why this shape (from research)

The repo is greenfield for MCP but Claude is pre-enabled
(`.claude/settings.json:34` → `enableAllProjectMcpServers: true`), so a committed
`.mcp.json` is auto-approved with no per-developer prompt. OntoIndex is
local-first (`.ontoindex/` graph, `~/.ontoindex/` registry), node `20|22 LTS`
(repo is `>=22.6.0`), and its index never leaves the machine — aligning with the
repo's secret posture.

---

## Affected Areas

| Area | Path | Change | Risk |
|------|------|--------|------|
| MCP config | `.mcp.json` (new, repo root) | Claude Code project-scoped stdio server entry for `ontoindex` | Low |
| Git ignore | `.gitignore` | Add `.ontoindex/` under a new `## code-intelligence` section | Low |
| Wrapper script | `tools/ontoindex/run-ontoindex.mjs` (new) | Thin, safe ESM wrapper: presence check + arg passthrough | Low |
| Wrapper tests | `tools/ontoindex/__tests__/*.test.mjs` (new) + `tools/ontoindex/vitest.config.mjs` (new) | Vitest unit suite; registered in `vitest.workspace.ts` | Low |
| Root scripts | `package.json` | Add `ontoindex:*` script namespace + `test:tools:ontoindex` | Low |
| Agent skill | `.agents/skills/ontoindex-code-intelligence/SKILL.md` (+ `references/`) | Project-native skill: when/how agents query the graph; namespace-collision warning | Low |
| Skill ledger | `.agents/skills/SOURCES.md` | One row under "Local Project Skills" | Low |
| Docs (EN) | `docs/en/contributing/ontoindex-code-intelligence.md` (new) | GitBook page: install, analyze, MCP setup, reindex/stale, troubleshooting | Med (i18n gate) |
| Docs (RU) | `docs/ru/contributing/ontoindex-code-intelligence.md` (new) | Line-for-line mirror of EN | Med (i18n gate) |
| Docs nav | `docs/en/SUMMARY.md`, `docs/ru/SUMMARY.md` | One mirrored entry each in the Contributing section | Med |
| Docs gate | `tools/docs/check-i18n-docs.mjs` | Add the new page to `screenshotExemptPages` (CLI tool page has no product screenshot) | Med |
| README | `README.md`, `README-RU.md` | One mirrored bullet under Tech Stack / engineering tools | Med (parity) |

**Verified facts grounding the table:** `.mcp.json` does not exist yet (only
`tools/testing/e2e/playwright.mcp.client.example.json` shows the `mcpServers`
shape); `.gitignore` has no `.ontoindex` glob and `clean:all` won't wipe it;
`vitest.workspace.ts` already registers `tools/local-supabase/vitest.config.mjs`,
so a `tools/ontoindex/vitest.config.mjs` is the established pattern for tools
tests; `screenshotExemptPages` already lists all six `contributing/*.md` pages
(lines 129-134), so a seventh must be added or CI's screenshot policy fails;
`docs-i18n-check.yml` triggers on `docs/en/**`, `docs/ru/**`, `tools/docs/**`,
`package.json`; README Tech Stack is at `README.md:68` / `README-RU.md:68`.

---

## UI Contract

**Not applicable.** Phase A ships no MUI runtime screen, app-template view,
metahub UI metadata, CRUD dialog, DataGrid/table/card, relation builder, or
resource-source field. The only human-facing surface is a CLI invoked by the
developer and an MCP tool list consumed by the agent. Per the Runtime UI UX
Quality Gate scope ("for any MUI runtime screen…"), the gate does not bind here.
This is stated explicitly so a reviewer can confirm the omission is intentional,
not an oversight.

---

## Plan Steps

### Phase 0 — Preconditions & version pin

- [ ] **0.1** Confirm local OntoIndex availability and pin **`v1.9.10`** (latest
  tag, 2026-06-14). Record the pinned version in one place only: the skill
  frontmatter `metadata.version` anchor + a line in `SOURCES.md` (mirrors how the
  PlayCanvas Editor pin is tracked). Install is **per-developer**, documented, not
  added to repo `dependencies` (it is an external AGPL dev tool, not a linked
  package):
  ```bash
  # one-time, per developer (pinned tarball — reproducible, supply-chain-safe)
  npm install -g https://github.com/ontograph/ontoindex/releases/download/v1.9.10/ontoindex-1.9.10.tgz
  ontoindex --version   # expect 1.9.10
  ```
- [ ] **0.2** Confirm host prerequisites from research: node `>=22.6.0` (already
  required), `git` CLI present, and (Linux) `python3`/`make`/`g++` for native
  parser build. Document, do not enforce in CI (per-developer tool).

### Phase 1 — Ignore the local index (do this BEFORE first `analyze`)

- [ ] **1.1** Add to `.gitignore` a new commented section near `## turbo`:
  ```gitignore
  ## code-intelligence (OntoIndex local graph — never committed)
  .ontoindex
  ```
  Rationale (research): no existing glob matches `.ontoindex/`; if it ever holds
  `.js`/`.ts` artifacts and is untracked-but-not-ignored, `pnpm lint` in
  `main.yml` could try to lint generated content. The global registry lives in
  `~/.ontoindex/` (outside the repo) and needs no ignore.

### Phase 2 — Committed MCP config for Claude Code

- [ ] **2.1** Create root **`.mcp.json`** (hand-authored to guarantee project
  scope; the bare `claude mcp add` writes *local* scope — see research
  correction). Match the in-repo `mcpServers` JSON shape:
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
  - Keep the command **transparent** (`ontoindex mcp`, no opaque flags) to honor
    SEP-1024 in spirit. No secrets, no `env` block needed for local stdio.
  - `enableAllProjectMcpServers: true` already pre-approves it repo-wide — no
    per-developer approval prompt. (If a narrower policy is ever wanted,
    `enabledMcpjsonServers: ["ontoindex"]` is the per-server alternative — noted,
    not applied.)
- [ ] **2.2** Verify Claude Code picks it up: `claude mcp list` shows `ontoindex`
  as connected (not `⏸ Pending approval`). Capture the output as fenced text for
  the docs page.
- [ ] **2.3** Do **not** commit Codex/Gemini/Qoder config — `.codex/*` is
  git-ignored and those use tool-specific formats (`~/.codex/config.toml` TOML).
  Their setup is documented per-developer in Phase 5.

### Phase 3 — `tools/ontoindex/` wrapper script + tests (the "real code")

This is the only executable code Phase A ships. It must be safe, deterministic,
and tested. It is a **thin, defensive launcher** so contributors get a friendly
error when the tool is absent and a single discoverable entry point.

- [ ] **3.1** Create `tools/ontoindex/run-ontoindex.mjs`. Design rules: ESM
  `.mjs`, `#!/usr/bin/env node` shebang, `// Comments in English only`, no
  `console`-lint issues (`/* eslint-disable no-console */` like sibling tools),
  **no shell string interpolation** (use `execFileSync`/`spawnSync` with an argv
  array — never `exec` with a concatenated string), pass through unknown args
  verbatim, exit with the child's exit code.
  ```js
  #!/usr/bin/env node
  /* eslint-disable no-console */
  // Thin, safe launcher for the locally-installed OntoIndex CLI.
  // Phase A: developer/agent code-intelligence only. No network, no secrets.
  import { spawnSync } from 'node:child_process'

  const PINNED_VERSION = '1.9.10' // keep in sync with SKILL.md metadata.version + SOURCES.md

  // argv passthrough; default to a safe read-only verb when none is given
  const args = process.argv.slice(2)
  const forwarded = args.length > 0 ? args : ['status']

  // Resolve the binary without a shell so user input can never be interpreted
  // as a shell command (no injection surface).
  const probe = spawnSync('ontoindex', ['--version'], { encoding: 'utf8' })
  if (probe.error || probe.status !== 0) {
      console.error(
          [
              'OntoIndex CLI not found on PATH.',
              `Install the pinned version (${PINNED_VERSION}) per the contributor docs:`,
              '  docs/en/contributing/ontoindex-code-intelligence.md',
              'Quick install:',
              `  npm install -g https://github.com/ontograph/ontoindex/releases/download/v${PINNED_VERSION}/ontoindex-${PINNED_VERSION}.tgz`
          ].join('\n')
      )
      process.exit(127)
  }

  const installed = (probe.stdout || '').trim()
  if (installed && !installed.includes(PINNED_VERSION)) {
      // Warn but do not block: pinning is advisory for a local dev tool.
      console.warn(`Warning: OntoIndex ${installed} differs from pinned ${PINNED_VERSION}.`)
  }

  // shell:false (default) — argv array is passed directly to execvp.
  const result = spawnSync('ontoindex', forwarded, { stdio: 'inherit' })
  process.exit(result.status ?? 1)
  ```
  Security notes baked in: `spawnSync` with `shell:false` and an **array** argv =
  no command injection even if a developer passes odd args; the script never
  reads env secrets, never touches the network, never writes outside what
  `ontoindex` itself does.

  > **QA finding (cross-platform):** the repo supports Windows (`run-script-os`,
  > `start:windows` scripts). A globally `npm install -g`'d `ontoindex` is a
  > `.cmd` shim on Windows, and `spawnSync('ontoindex', …, {shell:false})` throws
  > `ENOENT` there — the wrapper would wrongly report "not found" for an installed
  > tool. **Decision for IMPLEMENT:** use `cross-spawn` (already pinned in the
  > workspace via the `cross-spawn` override `7.0.6` in root `package.json`) as a
  > drop-in `spawnSync` replacement — it resolves `.cmd`/PATHEXT and keeps
  > `shell:false` injection safety. Import it in the `.mjs` wrapper:
  > `import spawn from 'cross-spawn'` then `spawn.sync('ontoindex', argv, …)`.
  > The injection-guard test (3.4) must assert the argv array is passed verbatim
  > with no shell. Verify `cross-spawn` is resolvable from a root-run `.mjs`
  > before relying on it; if not, fall back to probing `process.platform` and
  > appending `.cmd` on win32. (This does not change Phase A scope — local devs on
  > Linux/macOS are unaffected; the fix prevents a false-negative on Windows.)
- [ ] **3.2** Create `tools/ontoindex/vitest.config.mjs` (mirror
  `tools/local-supabase/vitest.config.mjs`):
  ```js
  import { defineConfig } from 'vitest/config'
  export default defineConfig({
      test: { environment: 'node', include: ['tools/ontoindex/__tests__/**/*.test.mjs'] }
  })
  ```
- [ ] **3.3** Register it in `vitest.workspace.ts` (append one line after the
  existing `tools/local-supabase/vitest.config.mjs` entry). **Consequence:** the
  root `pnpm test:vitest` (`vitest run --workspace vitest.workspace.ts`) will then
  also run this suite — so the tests in 3.4 **must be hermetic** (fully mock
  `node:child_process`, never require OntoIndex to be installed). **Verified CI
  note:** `main.yml` does NOT run `pnpm test:vitest` (it runs `lint`, `build`, and
  PlayCanvas/LMS/MMOOMM gates only), so these tests are NOT a CI gate today — they
  guard locally and via `pnpm test:tools:ontoindex` / the closeout review. Make
  them hermetic anyway so anyone running the full workspace suite on a machine
  without the binary still passes.
- [ ] **3.4** Write `tools/ontoindex/__tests__/run-ontoindex.test.mjs` — a real,
  deterministic suite that does NOT depend on OntoIndex being installed (mock the
  child process / PATH). Cover:
  - missing-binary path → exits `127` with the install hint (mock `spawnSync`
    probe to return `status: 1`);
  - version-mismatch → emits a warning but still forwards (mock probe stdout to a
    different version);
  - happy path → forwards the exact argv array unchanged and returns the child
    exit code (assert `spawnSync` called with `['ontoindex', [<args>], …]` and no
    shell);
  - default verb → empty argv forwards `['status']`;
  - **injection guard** → an arg like `'; rm -rf /'` is passed as a single argv
    element, never shell-interpreted (assert the argv array contains it verbatim
    and `shell` is not enabled).
  Use Vitest `vi.mock('node:child_process')`. Target 100% of the wrapper's
  branches.
- [ ] **3.5** Add root `package.json` scripts (namespace consistent with existing
  `migration:*` / `supabase:*` tool namespaces; verbs match OntoIndex):
  ```jsonc
  "ontoindex:analyze": "node tools/ontoindex/run-ontoindex.mjs analyze",
  "ontoindex:status":  "node tools/ontoindex/run-ontoindex.mjs status",
  "ontoindex:changes": "node tools/ontoindex/run-ontoindex.mjs detect-changes",
  "test:tools:ontoindex": "pnpm exec vitest run -c tools/ontoindex/vitest.config.mjs"
  ```

### Phase 4 — Agent skill `ontoindex-code-intelligence`

- [ ] **4.1** Create `.agents/skills/ontoindex-code-intelligence/SKILL.md` using
  the **project-native** frontmatter (mirrors `research-before-plan`):
  ```yaml
  ---
  name: ontoindex-code-intelligence
  description: Use when an AI agent should consult the OntoIndex code graph before editing — finding symbol usages, blast-radius/impact across packages, call/route/process context, or diff-to-symbol review in this monorepo. Covers the `ontoindex` MCP tools and CLI, the local-first index, and the namespace-collision caveat (this is code intelligence, NOT OWL/RDF/SPARQL).
  metadata:
      version: "1.9.10"   # pinned OntoIndex version anchor
      scope: "project-workflow"
      owner: "Universo Platformo"
  ---
  ```
  Do **not** add `file_policy: markdown-only` (the skill references a wrapper
  script; precedent is `autoreview`, which ships `scripts/`).
- [ ] **4.2** Body content (concise, agent-actionable):
  - **When to apply / when NOT** (use for cross-package impact before refactors;
    do not use it as a substitute for reading the actual code or for product/runtime
    data search — it indexes source, not Supabase rows).
  - **Namespace-collision warning** (prominent): `ontograph/ontoindex` is a
    code-AST graph tool, NOT the OWL/RDF "OntoGraph" family, NOT the Rust
    `ontoindex-*` crates. Never `npm`/`cargo install` a similarly-named package.
  - **How to query** via MCP (the tools surface) and via CLI
    (`pnpm ontoindex:status`, `analyze`, `impact <symbol>`, `detect-changes`).
  - **Freshness rule**: the graph can go stale vs HEAD; re-`analyze` or
    `detect-changes` after pulling significant changes.
  - **Local-only**: index lives in `.ontoindex/` (gitignored); never commit it.
- [ ] **4.3** Optional `references/usage.md` with 8-10 golden Universo queries
  (metahub migrations, publication sync, three-tier DB executors, module runtime)
  for agents to copy — these double as the Phase 6 pilot checklist.
- [ ] **4.4** Add one row to `.agents/skills/SOURCES.md` under **Local Project
  Skills** (exact column shape verified):
  ```md
  | `ontoindex-code-intelligence`        | Local project workflow | Project repository license | Wraps the external OntoIndex CLI/MCP tool (`ontograph/ontoindex`, AGPL-3.0-or-later, pinned v1.9.10) used locally for code-graph queries; not vendored, not redistributed. |
  ```

### Phase 5 — Documentation (GitBook, EN + RU lockstep)

- [ ] **5.1** Write `docs/en/contributing/ontoindex-code-intelligence.md`. Match
  the in-repo contributing page style: a `--- description: … ---` frontmatter
  line, a single `# Title`, `##` sections, **no product screenshot** (CLI tool).
  Sections: What it is (+ collision caveat) · Install (pinned v1.9.10) ·
  Prerequisites · First index (`pnpm ontoindex:analyze`) · MCP setup for Claude
  Code (the committed `.mcp.json`, auto-approved) · MCP setup for Codex/Gemini/
  Qoder (per-developer one-liners, e.g. `codex mcp add ontoindex -- ontoindex mcp`)
  · Daily use & reindex/stale handling (`detect-changes`) · `.ontoindex/` is local
  & gitignored · Troubleshooting.
- [ ] **5.2** Write `docs/ru/contributing/ontoindex-code-intelligence.md` as a
  **line-for-line** mirror: identical line count and identical counts of headings,
  code fences, bullets, numbered items, images (zero), and table rows
  (`checkPair` in `tools/docs/check-i18n-docs.mjs:299`). Keep code blocks/paths/
  identifiers/URLs identical (not translated). Avoid the RU prose-drift terms and
  stale terms (`legacy`, `Flowise`, `V2`, …) the checker bans.
- [ ] **5.3** Add one entry to the **Contributing** section of both SUMMARY files,
  mirrored (EN `docs/en/SUMMARY.md:89` area / RU `docs/ru/SUMMARY.md:89` area):
  ```md
  # EN: -   [OntoIndex Code Intelligence](contributing/ontoindex-code-intelligence.md)
  # RU: -   [OntoIndex: интеллект по коду](contributing/ontoindex-code-intelligence.md)
  ```
- [ ] **5.3b** **README parity note (verified):** `docs:i18n:check` only walks
  `docs/en` + `docs/ru` (`localeRoots` in `tools/docs/check-i18n-docs.mjs:11`) and
  the `docs-i18n-check.yml` trigger lists `packages/**/README*.md` — **root
  `README.md`/`README-RU.md` parity is NOT CI-enforced**. The only guard is the
  steering rule `i18n-docs.md` ("same number of lines"). So the one-line README
  bullet (Phase 5.5) must be added to **both** files at the same Tech Stack
  position manually; nothing will catch drift automatically.
- [ ] **5.5** Add one mirrored bullet under **Tech Stack** in `README.md:75` and
  `README-RU.md` (same offset), e.g. EN `-   OntoIndex (local code-intelligence
  for AI agents)` / RU `-   OntoIndex (локальный интеллект по коду для AI-агентов)`.
  Keep both files' line counts equal.
- [ ] **5.4** Add the page to `screenshotExemptPages` in
  `tools/docs/check-i18n-docs.mjs` (after line 134):
  ```js
  'contributing/ontoindex-code-intelligence.md',
  ```
  Without this, the screenshot policy (`checkScreenshotPolicy`, line 421) fails
  the page for having no image.

### Phase 6 — Validation pilot (local, evidence-based, no fabrication)

- [ ] **6.1** Run a real first index from repo root and capture timing + status:
  ```bash
  pnpm ontoindex:analyze     # build .ontoindex/ graph
  pnpm ontoindex:status      # confirm index health, lastCommit vs HEAD
  ```
  Paste the actual terminal output into the docs troubleshooting section (fenced
  text, real numbers — not invented).
- [ ] **6.2** Run the 8-10 golden queries from Phase 4.3 against the live graph
  (CLI `impact`/`ctx`/`query` and/or the MCP tools through a Claude session).
  Record which queries returned the expected Universo code paths. This validates
  the research's open item on retrieval quality and the SQL/DDL edge-quality
  caveat.
- [ ] **6.3** If SQL-first/DDL edges are weak (a known research uncertainty),
  note it honestly in the docs "Limitations" subsection rather than overclaiming.

### Phase 7 — Verification gates (must all pass before done)

- [ ] **7.1** `pnpm test:tools:ontoindex` — wrapper unit suite green.
- [ ] **7.2** `pnpm lint` — runs `eslint "**/*.{js,jsx,ts,tsx}"`. **Verified
  reality:** this glob does NOT match `.mjs` (so `run-ontoindex.mjs` is NOT linted,
  same as every existing `tools/*.mjs`) and does NOT match `.md`/`.json` (so the
  docs fenced code and `.mcp.json` are NOT ESLint-checked either). Therefore lint
  is a no-op for everything this plan adds — do not rely on it as the wrapper's
  quality gate. Quality for the wrapper comes from **7.1 (unit tests)** and
  matching the prettier style manually (run `pnpm prettier --check
  "tools/ontoindex/**/*.mjs"` locally, since root `format` only globs
  `{ts,tsx,md}`). Keep `pnpm lint` in this list only as a sanity check that no
  unrelated `.ts`/`.tsx` regressed.
- [ ] **7.3** `pnpm docs:i18n:check` — EN/RU parity, SUMMARY coverage, screenshot
  policy all green. Run the same way CI does and also full scope locally.
- [ ] **7.4** `pnpm docs:gitbook-screenshot-assets:check` — no unreferenced/missing
  assets (we add none).
- [ ] **7.5** `pnpm build` — turbo build unaffected (sanity; `.ontoindex/` is not
  a turbo input).
- [ ] **7.6** Manual: fresh `git status` shows `.ontoindex/` is ignored; `.mcp.json`
  is tracked; `claude mcp list` shows `ontoindex` connected.
- [ ] **7.7** Closeout review with the `autoreview` skill (advisory) focused on the
  wrapper script (injection surface, exit codes) and docs parity.

### Phase 8 — Memory Bank closeout

- [ ] **8.1** Add a `tasks.md` block and a `progress.md` entry (date 2026-06-16,
  Phase A scope, files touched count).
- [ ] **8.2** No Canon Refresh needed unless `techContext.md` gains a short
  "Developer Tooling" note about OntoIndex (optional, one paragraph) — decide at
  closeout, do not force it.

---

## Example: docs MCP block (must be byte-identical in EN and RU)

````md
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
````

(Code fences are not translated and are counted by the i18n checker, so EN and
RU carry the exact same block.)

---

## Potential Challenges

| Challenge | Likelihood | Mitigation |
|-----------|-----------|------------|
| i18n EN/RU line-count drift fails `docs:i18n:check` | High | Author RU as a strict structural mirror; run `pnpm docs:i18n:check` before commit; keep code fences identical |
| New contributing page not in `screenshotExemptPages` → screenshot-policy failure | High | Phase 5.4 adds it explicitly; verified the six existing pages are all listed |
| `claude mcp add` writes local (per-user) scope, not the shared `.mcp.json` | Medium | Hand-author `.mcp.json` (Phase 2.1); verify via `claude mcp list` |
| Wrapper script flagged for shell-injection in review | Medium | `spawnSync` `shell:false` + argv array (no string concat); explicit injection-guard test (3.4) |
| OntoIndex SQL/DDL edge quality weaker than TS/JS | Medium | Pilot (6.2/6.3); document limitation honestly; does not block Phase A (agents still get TS/route/call graph) |
| Version drift across OntoIndex sources (1.9.3/1.9.5/1.9.8/1.9.10) | Medium | Single pin `v1.9.10` recorded in SKILL.md + SOURCES.md; wrapper warns on mismatch |
| `.ontoindex/` accidentally committed or linted | Medium | Phase 1 ignores it before first `analyze`; Phase 7.6 verifies |
| `pnpm lint` does NOT cover `.mjs`/`.md` (glob is `{js,jsx,ts,tsx}`) | Low | Don't rely on lint for the wrapper; gate via unit tests (7.1) + `pnpm prettier --check` on the `.mjs` |
| Signal-killed child (`result.status === null`) collapses to exit 1 | Low | Acceptable for a dev launcher; optionally surface `result.signal` in a future hardening, not required for Phase A |
| Reviewer expects product UI / Playwright screenshots | Low | UI Contract + non-goals state explicitly there is no product surface in Phase A |

---

## Dependencies & Coordination

- **External, per-developer:** OntoIndex `v1.9.10` global install + native build
  toolchain. Not a repo dependency, not in `pnpm-workspace.yaml` catalog (it is an
  external AGPL CLI, deliberately not linked).
- **No cross-package coordination:** Phase A touches no `@universo-react/*`
  package, no DB, no migration, no schema/template version. Safe to land as a
  single PR; CI stays green throughout (each phase is independently valid).
- **Future (out of scope):** Phase B (HTTP service + backend proxy + admin search
  UI) would reuse request-scoped executors and admin guards and re-check AGPL for
  any networked exposure — a separate brief/plan when/if desired.

---

## Definition of Done

- `.mcp.json` committed and `claude mcp list` shows `ontoindex` connected.
- `.ontoindex/` ignored; never appears in `git status`.
- `tools/ontoindex/run-ontoindex.mjs` + tests; `pnpm test:tools:ontoindex` green.
- Skill authored + registered in `SOURCES.md`.
- EN/RU docs pages + both SUMMARYs + screenshot exemption; `pnpm docs:i18n:check`
  green.
- README + README-RU mirrored line.
- `pnpm lint` and `pnpm build` green.
- Pilot evidence (real terminal output) captured in docs; limitations noted.
- Memory Bank `tasks.md`/`progress.md` updated.
</content>
