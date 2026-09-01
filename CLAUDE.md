<!-- ontoindex:start -->

# OntoIndex — Code Intelligence

This project is indexed by OntoIndex as **universo-platformo-react** (68709 symbols, 111634 relationships, 300 execution flows). Use the OntoIndex MCP tools to understand code, assess impact, and navigate safely.

> The graph index is commit-based. If any OntoIndex tool warns the index is stale, or current HEAD differs from the indexed commit, coordinate first; exactly one process must run `ontoindex analyze` before graph-backed claims. Never silently assume dirty or uncommitted worktree changes are represented in the graph — verify current source or the diff for those changes.

## Always Do

Use OntoIndex in this order:

1. **Explore/search** — MCP `search({action: "semantic", repo: "universo-platformo-react", query: "concept"})` to find execution flows instead of grepping.
2. **Inspect context** — MCP `inspect({action: "context", repo: "universo-platformo-react", target: "symbolName"})` for a symbol's callers, callees, and execution flows.
3. **Impact before edits** — MCP `impact({action: "symbol", repo: "universo-platformo-react", target: "symbolName", direction: "upstream"})` or CLI `ontoindex impact --repo universo-platformo-react <symbol>`; report the blast radius and MUST warn on HIGH or CRITICAL risk before editing.
4. **gn_verify_diff before commit** — MCP `gn_verify_diff({repo: "universo-platformo-react", scope: "all"})` or CLI `ontoindex detect-changes --repo universo-platformo-react` to confirm only expected symbols and execution flows changed.

## Never Do

-   NEVER edit a function, class, or method without first running MCP `impact` or CLI `ontoindex impact` on it.
-   NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
-   NEVER rename symbols with find-and-replace — use MCP `refactor({action: "rename", ...})` which understands the call graph.
-   NEVER commit changes without running MCP `gn_verify_diff` or CLI `ontoindex detect-changes` to check affected scope.

## Resources

| Resource                                                   | Use for                                  |
| ---------------------------------------------------------- | ---------------------------------------- |
| `ontoindex://repo/universo-platformo-react/context`        | Codebase overview, check index freshness |
| `ontoindex://repo/universo-platformo-react/clusters`       | All functional areas                     |
| `ontoindex://repo/universo-platformo-react/processes`      | All execution flows                      |
| `ontoindex://repo/universo-platformo-react/process/{name}` | Step-by-step execution trace             |

## CLI

| Task                                         | Read this skill file                                          |
| -------------------------------------------- | ------------------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/ontoindex/ontoindex-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/ontoindex/ontoindex-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/ontoindex/ontoindex-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/ontoindex/ontoindex-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/ontoindex/ontoindex-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/ontoindex/ontoindex-cli/SKILL.md`             |

<!-- ontoindex:end -->
