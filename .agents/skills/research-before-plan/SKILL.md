---
name: research-before-plan
description: Use when a task includes external links, current information, architecture discovery, or the user asks to research around planning. Produces a cited Memory Bank research document before or during PLAN mode.
metadata:
  version: "1.0.0"
  scope: "project-workflow"
  owner: "Universo Platformo"
---

# Research Before Or During PLAN

Use this skill to run source-backed research around implementation planning. The project custom mode `.gemini/rules/custom_modes/research_mode.md` is authoritative for standalone RESEARCH behavior; PLAN mode may also use this skill inline or through a research-capable subagent when no fresh research artifact exists.

## When to Apply

Apply this skill when:

- The user starts with `RESEARCH` or `RPLAN`.
- The user provides links that should influence a decision.
- The user asks for current/latest/up-to-date information.
- The task depends on third-party APIs, tools, libraries, models, pricing, legal/security guidance, standards, or external Skills.
- `VAN` detects that research is recommended before PLAN.
- `PLAN` detects that research is useful but no fresh research artifact exists.

Do not apply this skill for purely local planning where repository files and Memory Bank context are sufficient.

## Workflow

1. Define the research question and the repository decision it supports.
2. Open every user-provided link.
3. Search for additional authoritative sources when the decision is non-trivial.
4. Prefer primary sources over commentary.
5. Record source freshness and uncertainty.
6. Write a durable English research artifact under `memory-bank/research/`.
7. If running in standalone RESEARCH mode, stop before PLAN unless the user explicitly asks to continue.
8. If running inside PLAN mode, return findings to PLAN and continue planning.

## References

- [Research artifact template](references/research-artifact-template.md)
- [Source quality rubric](references/source-quality-rubric.md)
- [Handoff to PLAN checklist](references/handoff-to-plan-checklist.md)
