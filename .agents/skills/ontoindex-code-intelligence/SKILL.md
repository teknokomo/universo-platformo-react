---
name: ontoindex-code-intelligence
description: Universo-specific complement to the OntoIndex code-intelligence tool. Use alongside the generated `.claude/skills/ontoindex/*` skills when querying the code graph in this monorepo. Adds the three things those generated skills do NOT cover — the namespace-collision caveat (this is code intelligence over source, NOT OWL/RDF/SPARQL), this repo's pnpm wrapper and golden queries, and the SQL-first edge-quality limitation.
metadata:
    version: '2.0.10'
    scope: 'project-workflow'
    owner: 'Universo Platformo'
---

# OntoIndex Code Intelligence — Universo Complement

This skill is a **thin, project-specific complement**. The generated OntoIndex
skills under `.claude/skills/ontoindex/` are the source of truth for how to use
the tool (tools, resources, workflows, checklists, graph schema):

-   `.claude/skills/ontoindex/ontoindex-guide` — tools/resources/schema reference
-   `.claude/skills/ontoindex/ontoindex-exploring` — understand architecture
-   `.claude/skills/ontoindex/ontoindex-impact-analysis` — blast radius before edits
-   `.claude/skills/ontoindex/ontoindex-debugging` — trace bugs through the graph
-   `.claude/skills/ontoindex/ontoindex-refactoring` — safe rename/extract/split
-   `.claude/skills/ontoindex/ontoindex-cli` — `analyze`/`status`/`clean`/`wiki`

Read those for mechanics. This file adds only what is specific to
`universo-platformo-react` and is not in the generated set.

## Critical: Namespace Collision

`ontograph/ontoindex` is a **code-AST graph tool for AI agents**. It is NOT:

-   the OWL/RDF/"OntoGraph" semantic-web family;
-   the unrelated Rust `ontoindex-*` crates (`ontoindex-core`, `ontoindex-lsp`).

Never `npm`/`pnpm add`/`cargo install` a similarly named package expecting this
tool. Install only the pinned release described in the contributor docs
(`docs/en/contributing/ontoindex-code-intelligence.md`).

## This Repo: pnpm Wrapper, Not Bare `npx`

The generated skills call `npx ontoindex …`. In this monorepo, prefer the
committed wrapper and scripts (pnpm-only, run from the repo root):

-   `pnpm ontoindex:status` — index health, indexed `lastCommit` vs `HEAD`.
-   `pnpm ontoindex:analyze` — build/rebuild the graph (`.ontoindex/`).
-   `pnpm ontoindex:changes` — incremental `detect-changes` (pre-commit audit).
-   Other verbs: `node tools/ontoindex/run-ontoindex.mjs <verb> …` (the wrapper
    warns if the installed version differs from the pinned one).

The local graph lives in `.ontoindex/` (gitignored) and the global registry in
`~/.ontoindex/`; it never leaves the machine and is never committed.

## SQL-First Edge-Quality Limitation

OntoIndex treats TypeScript/JavaScript as first-class. This repo is SQL-first, so
the quality of `DEFINES`/`CALLS` edges inside raw SQL and DDL under `supabase/`
and the schema-DDL helpers should be verified in use. Treat the graph as a strong
aid for TypeScript, route, and call-graph questions, and keep direct review for
the SQL layer. Do not overclaim SQL coverage.

## References

-   [references/usage.md](references/usage.md) — golden Universo queries to copy
    (three-tier DB executors, publication sync, metahub migrations, module runtime).
-   Contributor docs: `docs/en/contributing/ontoindex-code-intelligence.md`
    (and `docs/ru/...`) — install, MCP setup, daily use, limitations.
