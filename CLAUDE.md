<!-- ontoindex:start -->
# OntoIndex — Code Intelligence

This project is indexed by OntoIndex as **universo-platformo-react** (59965 symbols, 99041 relationships, 300 execution flows). Use the OntoIndex MCP tools to understand code, assess impact, and navigate safely.

> If any OntoIndex tool warns the index is stale, coordinate first; exactly one process should run `ontoindex analyze`.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run MCP `impact({action: "symbol", repo: "universo-platformo-react", target: "symbolName", direction: "upstream"})` or CLI `ontoindex impact --repo universo-platformo-react <symbol>`, then report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run MCP `gn_verify_diff({repo: "universo-platformo-react", scope: "all"})` or CLI `ontoindex detect-changes --repo universo-platformo-react` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use MCP `search({action: "semantic", repo: "universo-platformo-react", query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use MCP `inspect({action: "context", repo: "universo-platformo-react", target: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running MCP `impact` or CLI `ontoindex impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use MCP `refactor({action: "rename", ...})` which understands the call graph.
- NEVER commit changes without running MCP `gn_verify_diff` or CLI `ontoindex detect-changes` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `ontoindex://repo/universo-platformo-react/context` | Codebase overview, check index freshness |
| `ontoindex://repo/universo-platformo-react/clusters` | All functional areas |
| `ontoindex://repo/universo-platformo-react/processes` | All execution flows |
| `ontoindex://repo/universo-platformo-react/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/ontoindex/ontoindex-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/ontoindex/ontoindex-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/ontoindex/ontoindex-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/ontoindex/ontoindex-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/ontoindex/ontoindex-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/ontoindex/ontoindex-cli/SKILL.md` |

<!-- ontoindex:end -->
