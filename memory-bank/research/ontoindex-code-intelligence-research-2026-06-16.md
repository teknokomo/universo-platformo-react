# OntoIndex Code-Intelligence Adoption Research - 2026-06-16

> Created: 2026-06-16
> Status: Reviewed (QA pass 2026-06-16: corrected Claude Code MCP scope mechanics, Codex TOML vs `.mcp.json`; scope decisions resolved by user — Phase A only, local-only run, AGPL compliance confirmed by project owner)
> Trigger: RESEARCH (user) — validate the MANAGER cross-project brief (tracked outside the repository) before PLAN
> Follow-up plan: ../plan/ontoindex-code-intelligence-plan-YYYY-MM-DD.md (not yet created)

## Research Question

Is adopting [OntoIndex](https://github.com/ontograph/ontoindex) as an internal
code-intelligence / MCP service for the `universo-platformo-react` monorepo
technically sound, and what is the lowest-risk integration shape? The repository
decision this supports: whether to (A) wire OntoIndex as a local stdio MCP dev
tool for AI agents now and defer (B) an in-product HTTP-service + backend-proxy +
admin search UI — and exactly which repo conventions and CI gates the
implementation must respect.

## Source Inventory

| Source | Type | Date / Freshness | Why It Matters |
|--------|------|------------------|----------------|
| https://github.com/ontograph/ontoindex (README, fetched) | Primary | 2026-06-16; README version `1.9.8`, latest release tag `v1.9.10` (2026-06-14) | Authoritative tool surface: CLI, MCP, HTTP, license, node req, storage |
| `.backup/Внедрение-OntoIndex-ChatGPT.md` | Secondary (prior research, source-code grounded) | 2026-06 (local) | Service-shape integration, port 4747, token model, bind-mount secret warnings, effort/risk tables |
| `.backup/Внедрение-OntoIndex-Gemini.md` | Secondary (prior research, MCP-listing grounded) | 2026-06 (local) | MCP/stdio dev-tool framing, namespace-collision warning, compute-overhead caveat |
| Context7 `/websites/modelcontextprotocol_io` (MCP docs) | Primary | 2026-06-16 query | Canonical stdio `mcpServers {command,args}` config shape; SEP-1024 local-server consent requirement |
| Claude Code MCP docs (code.claude.com/docs/en/mcp) | Primary | 2026-06-16 (QA) | `.mcp.json` project scope, `claude mcp add` default = local scope, `--scope project`, `enableAllProjectMcpServers` / `enabledMcpjsonServers` |
| OpenAI Codex MCP docs (developers.openai.com/codex/mcp) | Primary | 2026-06-16 (QA) | Codex uses `~/.codex/config.toml` `[mcp_servers]` TOML, not `.mcp.json` |
| FOSSA / FSF / SPDX / choosealicense (AGPL-3.0) | Secondary | 2026-06-16 search | AGPL "mere use" vs conveying/network obligations for a non-distributed dev tool |
| Repo audit (subagent, Glob/Grep/Read) | Primary | 2026-06-16 worktree | Agent-runtime config layout, CI gates, `.gitignore`/turbo/lint interaction, docs i18n gate |
| `memory-bank/techContext.md` | Primary | 2026-06-15 | Canonical stack, node `>=22.6.0`, package naming, DB-layer status, CI check inventory |
| LobeHub `ontograph-ontoindex` listing (referenced by Gemini doc) | Tertiary | unstable mirror | Origin of the stale `port 3000` / `v1.9.4` claims — flagged as unreliable |

## Key Findings

### Tool identity and surface (facts, from primary README)

- OntoIndex is **graph-powered code intelligence for AI agents**, NOT a
  semantic-web/RDF/SPARQL engine and NOT a runtime/business-data search engine.
  It indexes **source code + markdown** into a local code graph (files, symbols,
  imports, calls, routes, docs sections, processes).
- Interfaces: CLI, **MCP stdio server** (`ontoindex mcp`), HTTP API
  (`ontoindex serve`), and a React/Vite web UI. Exposes 60+ facade / `gn_*` MCP
  tools (search/context, impact, diff review, docs evidence, refactor, audit).
- License: **AGPL-3.0-or-later** (verbatim). Node requirement: **`20 LTS` or
  `22 LTS`** plus `npm`, `git`; native parser build needs `python3`/`make`/`g++`
  on Linux. Repo node `>=22.6.0` satisfies this.
- Storage is **local-first**: graph in `.ontoindex/` (LadybugDB), global registry
  in `~/.ontoindex/` (metadata/paths only). Index never leaves the machine.
- MCP wiring is a documented one-liner: `claude mcp add ontoindex -- ontoindex mcp`
  and `codex mcp add ontoindex -- ontoindex mcp`. The plain client config is the
  standard stdio shape `{ "command": "ontoindex", "args": ["mcp"] }` (confirmed
  against Context7 MCP docs).
- The MCP server enforces a **project-scope guard**: if `ONTOINDEX_MCP_REPO` /
  `--repo` points outside `ONTOINDEX_MCP_PROJECT_CWD`, startup fails unless
  `ONTOINDEX_MCP_ALLOW_REPO_MISMATCH=1`. Relevant for multi-runtime agents.
- Key CLI verbs: `analyze` (build graph; `--force` rebuild), `detect-changes`
  (incremental pre-commit audit), `status`, `impact`, `review`, `setup`,
  `serve`, `wiki`, `query`, `ctx`. HTTP `serve` default port is **4747**.

### AGPL-3.0-or-later assessment (inference grounded in license sources)

- Running OntoIndex as a **separate, locally-invoked dev tool** (CLI/stdio MCP),
  not linked into shipped `@universo-react/*` packages and not exposed as a
  public network service to end users, is **"mere use"** — it does not trigger
  AGPL conveying or the §13 network-source-disclosure obligation.
- Obligations would attach only if the project (a) links/incorporates OntoIndex
  code into its own programs, (b) redistributes the tool, or (c) modifies it and
  offers it over a network. Phase A (local-only CLI/stdio) does none of these.
  **The project owner has confirmed AGPL compliance for this work (2026-06-16),
  so licensing is not a gate for Phase A.** Should a future Phase B ever expose
  OntoIndex over a network to external users, (c) would need re-checking — but
  that is out of scope here. **Not legal advice.**

### Repository integration reality (facts, from repo audit)

- **MCP is greenfield but pre-enabled for Claude.** No `.mcp.json` exists, yet
  `.claude/settings.json` already sets `"enableAllProjectMcpServers": true`
  (confirmed at line 34). So a **committed root `.mcp.json`** with a
  `mcpServers.ontoindex` stdio entry is the idiomatic, already-wired path for
  Claude Code: the setting auto-approves project servers, so no per-developer
  approval prompt is needed. The only in-repo `mcpServers` precedent is the
  example `tools/testing/e2e/playwright.mcp.client.example.json`.
- **CORRECTION (QA): the documented one-liner writes the wrong scope.**
  `claude mcp add ontoindex -- ontoindex mcp` defaults to **`local`** scope
  (writes to `~/.claude.json`, per-user, NOT committed). To produce the shared
  committed `.mcp.json`, either hand-author the file or run
  `claude mcp add --scope project ontoindex -- ontoindex mcp`. Project `.mcp.json`
  servers normally require an approval prompt, but `enableAllProjectMcpServers:
  true` pre-grants that repo-wide; `enabledMcpjsonServers` / `disabledMcpjsonServers`
  exist for per-server control if a narrower policy is ever wanted.
- **Codex/Gemini/Qoder MCP config is per-developer, not committed.** Codex reads
  `~/.codex/config.toml` `[mcp_servers.<name>]` **TOML** (not `.mcp.json`, which is
  Claude-Code-specific). The repo's `.gitignore` ignores `.codex/*` except a
  re-include of `.codex/agents/**`, so even a committed `.codex/config.toml`
  would be git-ignored. For these runtimes the path is **documentation** (the
  `codex mcp add ontoindex -- ontoindex mcp` one-liner), not committed config.
- **`check:agent-profiles` will NOT break.** `tools/agents/check-agent-profiles.mjs`
  reads only 4 named shared profiles × 6 runtimes (24 files) by constructed
  filename; it does not glob runtime dirs. A new `.mcp.json`, skill, or tool is
  invisible to it. It is also **not wired into any CI workflow**.
- **CI gates that DO apply** (`.github/workflows/`):
  - `main.yml` (push to main + all PRs): `pnpm lint` (`eslint "**/*.{js,jsx,ts,tsx}"`),
    `pnpm build`, plus `check:*` scripts and `lint-db-access.mjs`. ESLint extends
    `plugin:markdown/recommended`, so fenced code blocks in any new `.md` docs
    page are linted.
  - `docs-i18n-check.yml` (on `docs/en/**`, `docs/ru/**`, README changes):
    `docs:i18n:check` enforces EN/RU **line-count + heading/bullet/code-fence/
    image/table-row parity**, exactly one `SUMMARY.md` entry per locale, a
    screenshot policy (non-exempt page with no image fails), and stale-term /
    RU-prose-drift blocklists.
- **`.ontoindex/` must be gitignored.** No existing glob matches it; `clean:all`
  won't wipe it; turbo `globalDependencies` won't be invalidated by it. Risk:
  if `.ontoindex/` ever holds `.js`/`.ts` files and is not ignored, `pnpm lint`
  in `main.yml` could fail on generated content. Add it to `.gitignore` (and, if
  needed, `.eslintignore`/`.prettierignore`).
- **Docs home**: `docs/{en,ru}/contributing/` is the right neighbourhood
  (alongside `development-setup.md`, `coding-guidelines.md`, `creating-packages.md`).
  A new page requires BOTH locales line-for-line, BOTH `SUMMARY.md` files, and —
  because the new filename isn't yet in `screenshotExemptPages` — either an image
  or an added exemption in `tools/docs/check-i18n-docs.mjs`.
- **Skill convention**: a new `.agents/skills/ontoindex-code-intelligence` should
  use the **project-native** frontmatter (`name`, `metadata.version`,
  `metadata.scope`), must be registered in `.agents/skills/SOURCES.md` (manual
  ledger, not CI-enforced), and must NOT claim `file_policy: markdown-only` if it
  ships a wrapper script (precedent: `.agents/skills/autoreview` carries
  `scripts/`).
- **`.env.example`**: `packages/universo-react-core-backend/.env.example` exists
  and is the tracked-template convention; deferred Phase-B vars
  (`ONTOINDEX_BASE_URL`, `ONTOINDEX_HTTP_TOKEN`, `ONTOINDEX_REPO_NAME`) belong
  there as placeholders only.
- **Tooling**: any wrapper script is pnpm-only, run from root
  (`.kiro/steering/pnpm-not-npm.md`), and lives in `tools/` (e.g. `tools/ontoindex/`),
  not as a new `@universo-react/*` package.

### Why the fit is strong (inference, grounded in techContext + both docs)

- The repo is a large SQL-first Turbo monorepo where changes ripple
  `core-backend → feature-backend → api-client → feature-frontend`, and it is
  heavily AI-agent-developed. A precomputed code graph (impact, ctx,
  diff-to-symbol) directly targets the blast-radius blind spots techContext
  documents (e.g. three-tier DB executors, `recordBehavior`, entity-type
  resolver, module runtime contract).
- Local-first storage aligns with the repo's secret-handling posture
  (placeholder-only `.env`, live secrets out of VCS).

## Conflicts And Uncertainty

- **Version drift (resolved).** README `1.9.8`; latest tag `v1.9.10` (2026-06-14);
  Gemini doc cites install of `v1.9.4`; ChatGPT doc notes README `1.9.8` vs
  RU-README `1.9.5` vs `package.json` `1.9.3`. **Implication:** pin one exact
  version (npm tag or release tarball) in PLAN; do not trust README prose as the
  version source of truth.
- **Serve port (resolved).** Gemini doc says `3000` (from the LobeHub listing);
  primary README and ChatGPT doc say **`4747`**. `4747` is correct; `3000` is
  stale/wrong. Web UI is a separate port (ChatGPT doc: `4173`).
- **HTTP API contract is not a stable OpenAPI spec.** The ChatGPT doc's
  `POST /api/search`, `GET /api/file`, `/api/heartbeat`, `ONTOINDEX_HTTP_TOKEN`
  bearer model, and loopback CORS come from reading server source, not a
  published contract. Treat Phase-B endpoint shapes as **representative, not
  frozen** — verify against the pinned version before building a proxy.
- **SQL/DDL parse quality is unverified.** Gemini doc warns native parsers may
  not cleanly model the repo's SQL-first DDL / RLS policies. OntoIndex's
  first-class support is TypeScript/JS; quality of `DEFINES`/`CALLS` edges inside
  `supabase/` / raw-SQL is a pilot-validation item, not a guarantee.
- **Compute overhead unquantified.** No published benchmark for a monorepo this
  size; embeddings raise index cost. Mitigate with `detect-changes` incremental
  reindex rather than frequent full `analyze --force`.
- **SEP-1024 (MCP security).** Committing an auto-loaded `.mcp.json` means agents
  may launch `ontoindex` without a per-developer consent prompt. MCP guidance
  (SEP-1024) expects explicit consent + command transparency for local server
  launch. **Implication:** document what the committed config runs and why; keep
  the command transparent (`ontoindex mcp`, no opaque flags).
- **Context7 has no OntoIndex entry** and Habr/author article is bot-blocked
  (403); primary evidence is the GitHub README + repo audit. Freshness is
  same-day, but OntoIndex is a fast-moving niche tool — re-verify at PLAN time.

## Project Implications

- **Recommended scope = Phase A only for the MVP.** Local stdio MCP dev tool +
  skill + docs. It needs no `@universo-react/*` changes, no proxy, no UI, and
  carries the lowest AGPL and security surface. Phase B (proxy + admin UI) is a
  separate, larger effort (the ChatGPT doc's ~7–11 person-day estimate is a
  Phase-B figure and should not be read as the MVP cost).
- **Files/areas a Phase-A PLAN will touch** (all additive, no app code):
  - root `.mcp.json` (new) — Claude project-scoped stdio server entry.
  - root `.gitignore` — add `.ontoindex/`.
  - `.agents/skills/ontoindex-code-intelligence/` (new skill) + row in
    `.agents/skills/SOURCES.md`.
  - `docs/en/contributing/<page>.md` + `docs/ru/contributing/<page>.md` +
    both `SUMMARY.md` files + possible `screenshotExemptPages` entry in
    `tools/docs/check-i18n-docs.mjs`.
  - `README.md` + `README-RU.md` — one mirrored line each.
  - optional `tools/ontoindex/` wrapper + root `package.json` script.
- **Phase-B (deferred) additions** (per ChatGPT doc, verify at that time):
  `packages/universo-react-core-backend` proxy mount, `admin-backend`
  routes/services/guards, `api-client` `OntoIndexApi` + query keys,
  `admin-frontend`/`metapanel-frontend` search+preview page, `rest-docs` entry,
  `core-backend/.env.example` vars. Must use request-scoped executors and admin
  guards; token stays server-side, never in the browser.
- **CI obligations to bake into PLAN's checklist:** EN/RU docs lockstep
  (`docs-i18n-check.yml`), screenshot exemption, `pnpm lint`/`pnpm build`
  (`main.yml`), `.ontoindex/` ignore before first `analyze` run.

## Recommended Decision

Adopt OntoIndex via **Phase A (local stdio MCP dev tool)** — confirmed by the
user as the only scope for this implementation; Phase B is not pursued now.
Concretely:

1. Pin a specific OntoIndex version (prefer `v1.9.10` tag / matching npm) and
   record it; install per-developer (global npm or release tarball).
2. Commit a root `.mcp.json` with a transparent `mcpServers.ontoindex` stdio
   entry (`command: "ontoindex"`, `args: ["mcp"]`). Generate it via
   `claude mcp add --scope project ontoindex -- ontoindex mcp` (note the
   `--scope project` flag — the bare command defaults to local/per-user scope)
   or hand-author the file. `enableAllProjectMcpServers: true` already pre-approves
   it. Document Codex/Gemini/Qoder setup as per-developer
   (`codex mcp add ontoindex -- ontoindex mcp` → `~/.codex/config.toml`; their
   config is git-ignored and tool-specific, not shareable as `.mcp.json`).
3. Add `.ontoindex/` to `.gitignore` before the first `analyze`.
4. Author the `ontoindex-code-intelligence` skill (project-native frontmatter,
   namespace-collision warning, when-to-query guidance) and register it in
   `SOURCES.md`.
5. Add an EN+RU `contributing/` docs page (install, `analyze`, MCP setup,
   `detect-changes` reindex/stale handling) with both `SUMMARY.md` entries and a
   screenshot exemption; add one mirrored README/README-RU line.
6. Run a short pilot to validate retrieval quality on 8–10 known Universo code
   paths (metahub migrations, publication sync, three-tier DB executors, module
   runtime) and SQL/DDL edge quality before recommending Phase B.

This follows from the evidence: the tool's local-first stdio model matches the
repo's greenfield-but-Claude-enabled MCP state, avoids AGPL conveying/network
triggers, touches zero shipped packages, and is gated only by docs-i18n and
lint/build CI that the checklist above satisfies.

## Resolved Decisions (user, 2026-06-16)

- **Scope:** ship **Phase A only** now. Phase B (HTTP service + backend proxy +
  admin UI) is out of scope for this implementation.
- **Run location:** everything runs **locally** (per-developer machine). No
  hosted/networked deployment in this iteration.
- **AGPL:** explicitly **not a concern** for this work — the project owner
  confirms compliance. No further legal gate before PLAN.
- **`.mcp.json` policy:** "do what is correct for a first local integration."
  Interpreted as: commit a transparent project `.mcp.json` (Claude auto-approves
  via the existing `enableAllProjectMcpServers: true`); Codex/Gemini/Qoder via
  per-developer documented one-liners. Keep the command transparent
  (`ontoindex mcp`, no opaque flags) to honour SEP-1024 in spirit.

## Open Questions Before PLAN

- **Version pin:** `v1.9.10` (latest) or a different pinned release, and who owns
  bumping it (a `SOURCES.md` / skill version anchor like the PlayCanvas Editor
  pin)? — minor; PLAN can default to `v1.9.10`.
- **Reindex trigger:** manual `analyze`, a local git-hook `detect-changes`, or
  leave fully manual for the MVP? (Phase A is local-only, so the graph is never
  committed regardless.) — minor; PLAN can default to manual + documented
  `detect-changes`.

No blocking questions remain — scope, run location, and licensing are resolved.

## Sources

- https://github.com/ontograph/ontoindex
- https://code.claude.com/docs/en/mcp (Claude Code MCP: scopes, `.mcp.json`, settings)
- https://developers.openai.com/codex/mcp (Codex MCP via `~/.codex/config.toml`)
- https://modelcontextprotocol.io/docs/develop/build-server
- https://modelcontextprotocol.io/seps/1024-mcp-client-security-requirements-for-local-server-installation
- https://fossa.com/blog/open-source-software-licenses-101-agpl-license/
- https://www.fsf.org/bulletin/2021/fall/the-fundamentals-of-the-agplv3
- https://spdx.org/licenses/AGPL-3.0-or-later.html
- https://choosealicense.com/licenses/agpl-3.0/
- `.backup/Внедрение-OntoIndex-ChatGPT.md` (local prior research)
- `.backup/Внедрение-OntoIndex-Gemini.md` (local prior research)
</content>
