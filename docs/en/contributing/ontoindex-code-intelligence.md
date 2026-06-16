---
description: Local OntoIndex code-intelligence setup for developers and AI agents.
---

# OntoIndex Code Intelligence

OntoIndex builds a local graph of this repository and exposes it to developers
and AI agents through an MCP server and a CLI. It helps answer graph-level
questions before editing: where a symbol is used, the blast radius of a change,
and the call or route context around it.

## What It Is (And Is Not)

OntoIndex indexes source code and Markdown into a local graph. It is a developer
and agent tool, not a product feature.

-   It is code intelligence over source files, not a query engine for OWL, RDF, or SPARQL.
-   It is not a search tool over runtime data such as metahub records or user rows.
-   The package `ontograph/ontoindex` is unrelated to similarly named Rust crates.

Never install a similarly named package expecting this tool.

## Prerequisites

-   Node.js `>=22.6.0` (already required by this repository).
-   The `git` command line tool.
-   On Linux, `python3`, `make`, and a C++ compiler for native parser builds.

## Install

Install the pinned release per developer. It is an external tool, so it is not
added to the repository dependencies.

```bash
pnpm add -g https://github.com/ontograph/ontoindex/releases/download/v1.9.10/ontoindex-1.9.10.tgz
ontoindex --version
```

## First Index

Build the graph from the repository root. The wrapper script forwards commands
to the installed tool and prints a hint if it is missing.

```bash
pnpm ontoindex:analyze
pnpm ontoindex:status
```

The graph is stored in `.ontoindex/` and is ignored by git. The global registry
lives in `~/.ontoindex/` and tracks only repository paths and metadata.

## MCP Setup For Claude Code

The repository ships a project `.mcp.json` that declares the server. Claude Code
approves project servers automatically through the existing setting, so no extra
step is needed.

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

Confirm it is connected with `claude mcp list`.

## MCP Setup For Other Agents

Codex, Gemini, and Qoder use their own per-developer configuration formats and
are not committed to the repository. Add the server with the documented helper.

```bash
codex mcp add ontoindex -- ontoindex mcp
```

## Daily Use

Query the graph through the CLI or through the MCP tools in an agent session.

```bash
pnpm ontoindex:status
node tools/ontoindex/run-ontoindex.mjs impact validateUser --depth 2
pnpm ontoindex:changes
```

After pulling significant changes, rebuild so answers are not stale. Use
`pnpm ontoindex:analyze` for a full pass or `pnpm ontoindex:changes` for an
incremental update.

## Limitations

OntoIndex supports TypeScript and JavaScript as first-class inputs. This
repository is SQL-first, so the quality of edges inside raw SQL and DDL under
`supabase/` should be verified during use. Treat the tool as a strong aid for
TypeScript, route, and call-graph questions, and keep direct review for the
SQL layer.

## Troubleshooting

-   If the wrapper reports the tool is missing, reinstall the pinned release.
-   If results look outdated, run `pnpm ontoindex:analyze` again.
-   The `.ontoindex/` directory is local only and must never be committed.
