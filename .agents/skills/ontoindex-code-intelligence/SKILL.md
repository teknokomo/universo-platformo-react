---
name: ontoindex-code-intelligence
description: Use when an AI agent should consult the OntoIndex code graph before editing this monorepo — finding symbol usages, blast-radius/impact across packages, call/route/process context, or diff-to-symbol review. Covers the `ontoindex` MCP tools and CLI, the local-first index, the reindex/freshness rule, and the namespace-collision caveat (this is code intelligence over source, NOT OWL/RDF/SPARQL and NOT runtime/business-data search).
metadata:
    version: '1.9.10'
    scope: 'project-workflow'
    owner: 'Universo Platformo'
---

# OntoIndex Code Intelligence

Use this skill when working in `upstream-universo-platformo-react` and a change
benefits from a graph-level view of the codebase before editing: locating every
usage of a symbol, estimating the blast radius of a refactor across the
`core-backend → feature-backend → api-client → feature-frontend` chains, tracing
call/route/process context, or mapping a diff back to the symbols it touches.

OntoIndex ([`ontograph/ontoindex`](https://github.com/ontograph/ontoindex),
pinned `v1.9.10`) builds a **local-first** code graph and exposes it through a
stdio **MCP server** and a CLI. It is a developer/agent tool only — Phase A adds
no product feature, no UI, and no backend service.

## When To Apply

Apply this skill when:

-   a refactor or rename touches a shared symbol and you need its full cross-package usage;
-   you need the blast radius / impacted tests before changing a load-bearing module
    (e.g. three-tier DB executors, `recordBehavior`, the entity-type resolver, the module runtime contract);
-   you need call/route/process context that plain `grep` cannot assemble;
-   you want to map a diff to the graph symbols and flows it affects.

Do **not** apply this skill when:

-   you only need to read one known file — just read it;
-   you need product/runtime data (metahub rows, application records, user data) —
    OntoIndex indexes **source code and markdown**, not Supabase rows;
-   you expect OWL/RDF/SPARQL semantics (see the collision warning below).

## Critical: Namespace Collision

`ontograph/ontoindex` is a **code-AST graph tool for AI agents**. It is NOT:

-   the OWL/RDF/"OntoGraph" semantic-web family;
-   the unrelated Rust `ontoindex-*` crates (`ontoindex-core`, `ontoindex-lsp`).

Never `npm install` or `cargo install` a similarly named package expecting this
tool. Install only the pinned release described in the contributor docs.

## How To Query

CLI (wrapped by repo scripts; the wrapper warns if the installed version differs
from the pinned `1.9.10`):

-   `pnpm ontoindex:status` — index health, indexed `lastCommit` vs `HEAD`.
-   `pnpm ontoindex:analyze` — build/rebuild the graph (`.ontoindex/`).
-   `pnpm ontoindex:changes` — incremental `detect-changes` (pre-commit audit).
-   Direct verbs through the wrapper, e.g. `node tools/ontoindex/run-ontoindex.mjs impact <symbol> --depth 2`.

MCP (for agents): the `ontoindex` server is declared in the repo `.mcp.json`.
Claude Code auto-approves it (`enableAllProjectMcpServers: true`). Use the
server's search / context / impact / review tools to ask graph-level questions
before editing. Codex/Gemini/Qoder developers configure it per-developer (see the
contributor docs).

## Freshness Rule

The graph reflects the commit it was last analyzed at. After pulling significant
changes, re-run `pnpm ontoindex:analyze` (full) or `pnpm ontoindex:changes`
(incremental) so impact/context answers are not stale. `ontoindex:status`
compares the indexed `lastCommit` against `HEAD`.

## Local-Only Contract

The graph lives in `.ontoindex/` (gitignored) and the global registry in
`~/.ontoindex/`. The index never leaves the machine and must never be committed.
There are no secrets in the index; the wrapper reads no env secrets and makes no
network calls.

## References

-   [references/usage.md](references/usage.md) — golden Universo queries to copy.
-   Contributor docs: `docs/en/contributing/ontoindex-code-intelligence.md`
    (and `docs/ru/...`) — install, MCP setup, daily use, limitations.
