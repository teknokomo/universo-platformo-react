# Plan: Research-Aware Planning Workflow

> **Created**: 2026-05-16
> **Updated**: 2026-05-16
> **Status**: Implemented
> **Complexity**: Level 3-4 (workflow architecture, agent behavior, Memory Bank conventions, external Skills governance)
> **Goal**: Ensure the AI agent performs source-backed internet research from provided links and relevant external sources, writes a durable research document, and only then enters implementation planning.

---

## Overview

Introduce a research-aware workflow around project planning whenever a user provides links, asks for external investigation, or requests architecture decisions that depend on current external information. `VAN` should recommend standalone `RESEARCH` / `RPLAN` before `PLAN` when useful. If the user skips standalone research and enters `PLAN` directly, `PLAN` should still fulfill the request by obtaining the needed research inline or through a research-capable subagent when the environment supports subagents.

The recommended design is a new custom mode before `PLAN`, named `RESEARCH` or `RPLAN` (`Research + Plan`). Keeping research separate from `PLAN` is safer than overloading `PLAN`, because the existing `PLAN` contract is intentionally scoped to producing a structured implementation plan without code changes.

> **Closure update (2026-05-16):** implemented with both `RESEARCH` and `RPLAN` commands, VAN research recommendations, PLAN inline/delegated research handling, durable `memory-bank/research/` artifacts, imported `agents-best-practices`, a curated AI Research skill subset, and a local `research-before-plan` skill.

---

## External Research Summary

### Agent Skills Model

Agent Skills are intentionally designed as discoverable, on-demand folders with `SKILL.md` plus optional bundled resources. The specification emphasizes progressive disclosure: skill metadata is always available, the `SKILL.md` body is loaded only when triggered, and references/scripts are loaded only as needed. This supports using a small research-mode skill as the workflow entry point while keeping larger AI Research skills dormant unless the task requires them.

Relevant sources:

- Anthropic / Agent Skills specification overview: https://www.mintlify.com/anthropics/skills/spec/overview
- Claude Agent Skills documentation: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview

### Web Research Contract

OpenAI's web search tooling is explicitly designed for current information and citation-backed answers. The Responses API web search documentation describes web search call output, page opening, `find_in_page`, URL citations, domain filtering, and live internet access controls. The key product implication is that research mode should require visible citations and preserve a source list in the generated research artifact.

Relevant source:

- OpenAI Web Search documentation: https://developers.openai.com/api/docs/guides/tools-web-search

### Agent Runtime Safety

OpenAI Agents SDK guardrails separate input, output, and tool-level checks. The important lesson for this repository is that research mode should have explicit guardrails around source count, source type, citation requirements, stale-source warnings, and final handoff into `PLAN`.

Relevant source:

- OpenAI Agents SDK guardrails: https://openai.github.io/openai-agents-python/guardrails/

### External Skills Candidates

`agents-best-practices` is directly relevant to this workflow because it focuses on agent harness design, planning mode, context/memory, skills, connectors, observability, evals, and production readiness. It should be imported as a high-priority project skill before implementing the new mode.

Relevant source:

- agents-best-practices repository: https://github.com/DenisSergeevitch/agents-best-practices

`AI-Research-SKILLs` is broad: the repository presents 98 skills across 23 categories, including autoresearch, ideation, RAG, prompt engineering, observability, and paper writing. Only a curated subset should be activated for this project workflow. The full autonomous `autoresearch` skill should not become the default pre-PLAN behavior because it is designed for long-running autonomous research and may conflict with the repository's explicit `VAN` / `PLAN` / `IMPLEMENT` / `QA` mode sequence.

Relevant source:

- AI Research Skills repository: https://github.com/Orchestra-Research/AI-Research-SKILLs

---

## Recommended Workflow

### New Mode: `RESEARCH`

Add a new custom mode file:

```text
.gemini/rules/custom_modes/research_mode.md
```

Trigger examples:

- User message starts with `RESEARCH`
- User message starts with `RPLAN`
- User message starts with `PLAN` and contains links or asks to research current external information
- User explicitly says "search the internet", "research", "look up", "based on links", "latest", "current", "up-to-date"

Default behavior:

1. Acknowledge with `OK RESEARCH`.
2. Extract all user-provided links.
3. Determine whether current web research is required.
4. Read relevant local Memory Bank context and local custom mode rules.
5. Search/open the provided links and additional authoritative sources.
6. Produce a durable research document.
7. Summarize the research in chat.
8. Ask the user whether to proceed to `PLAN`.
9. Do not implement code changes in `RESEARCH`.

### Modified `PLAN`

Update `.gemini/rules/custom_modes/plan_mode.md` so `PLAN` handles research context:

- If a research document exists, load it before creating the plan.
- If the user provided external links or requested current external information and no fresh research document exists, continue PLAN by conducting the needed research inline or delegating it to a research-capable subagent when available.
- Save newly gathered research findings under `memory-bank/research/` unless the user explicitly requested chat-only output.
- If the topic is purely local and does not depend on current external facts, proceed with the existing `PLAN` flow.

This keeps `PLAN` deterministic while still allowing simple local planning without unnecessary web research.

---

## Research Artifact Format

Recommended path pattern:

```text
memory-bank/research/<topic-slug>-research-YYYY-MM-DD.md
```

If a new `memory-bank/research/` directory is considered too much, use:

```text
memory-bank/currentResearch.md
```

However, a per-topic document is preferable because it keeps source-backed decisions durable and reviewable.

Recommended artifact template:

```markdown
# Research: <Topic>

> Created: YYYY-MM-DD
> Status: Draft | Reviewed | Superseded
> Trigger: <user command or request>
> Follow-up plan: ../plan/<planned-plan-file>.md

## Research Question

## Source Inventory

| Source | Type | Date / Freshness | Why It Matters |
|--------|------|------------------|----------------|

## Key Findings

## Conflicts And Uncertainty

## Project Implications

## Recommended Decision

## Open Questions Before PLAN

## Sources
```

Research documents must be written in English, following Memory Bank rules.

---

## Skill Strategy

### Add `agents-best-practices`

Import as:

```text
.agents/skills/agents-best-practices/
```

Use it when designing or auditing the research-before-plan workflow, because it directly covers agent loops, planning mode, context compaction, skills/connectors, permissions, and observability.

### Add a Local `research-before-plan` Skill

Create a project-local skill:

```text
.agents/skills/research-before-plan/SKILL.md
.agents/skills/research-before-plan/references/research-artifact-template.md
.agents/skills/research-before-plan/references/source-quality-rubric.md
```

Purpose:

- Decide when research is mandatory.
- Define source quality requirements.
- Define the research artifact template.
- Define the handoff contract into `PLAN`.
- Prevent implementation before research review.

Suggested `SKILL.md` frontmatter:

```yaml
---
name: research-before-plan
description: Use when a task includes external links, current information, architecture discovery, or the user asks to research around planning. Produces a cited Memory Bank research document before or during PLAN mode.
---
```

### Curated AI Research Skills

Do not activate the full `AI-Research-SKILLs` repository by default. Start with a curated subset:

- `21-research-ideation/brainstorming-research-ideas`
- `21-research-ideation/creative-thinking-for-research`
- `16-prompt-engineering/instructor`
- `16-prompt-engineering/dspy`
- `17-observability/langsmith`
- `20-ml-paper-writing/ml-paper-writing` only if long-form research reports become common

Keep `0-autoresearch-skill` disabled for this workflow unless the user explicitly approves a separate autonomous research mode.

---

## Implementation Plan

### Phase 1: Decide Mode Semantics

- [x] Choose command name: `RESEARCH`, `RPLAN`, or both.
- [x] Decide whether `PLAN` should auto-defer to `RESEARCH` when links are present.
- [x] Define "fresh enough" for research documents, with a default of same-day for fast-moving technologies and up to 30 days for stable architecture topics.
- [x] Define the minimum source policy:
  - [x] At least all user-provided links must be opened.
  - [x] At least 2 additional authoritative sources for non-trivial architecture decisions.
  - [x] Prefer primary sources: official docs, standards, repositories, release notes, papers.
  - [x] Use community posts only as secondary evidence.

### Phase 2: Add Research Mode Rules

- [x] Create `.gemini/rules/custom_modes/research_mode.md`.
- [x] Add `RESEARCH` and optionally `RPLAN` to `AGENTS.md` custom mode routing.
- [x] Define the exact research workflow:
  - [x] Load local context.
  - [x] Extract links and claims.
  - [x] Search/open sources.
  - [x] Build source inventory.
  - [x] Identify consensus, conflicts, and stale information.
  - [x] Write research artifact.
  - [x] Stop before `PLAN`.
- [x] Include a rule that research mode must never make code changes except writing the approved research artifact.

### Phase 3: Update PLAN Mode

- [x] Update `.gemini/rules/custom_modes/plan_mode.md` to handle research context without blocking PLAN.
- [x] Add a section "Research prerequisite" before plan generation.
- [x] Require the agent to load the latest matching research artifact when present.
- [x] Require explicit user approval before moving from research into implementation planning if the research produced unresolved decisions.

### Phase 4: Add Project Skill Support

- [x] Import `agents-best-practices` as a project-local skill.
- [x] Create `.agents/skills/research-before-plan/SKILL.md`.
- [x] Add concise references:
  - [x] `research-artifact-template.md`
  - [x] `source-quality-rubric.md`
  - [x] `handoff-to-plan-checklist.md`
- [x] Add a note that the skill complements `.gemini/rules/custom_modes/research_mode.md`; the custom mode is authoritative for command behavior.

### Phase 5: Add Research Artifact Location

- [x] Choose between `memory-bank/research/` and `memory-bank/currentResearch.md`.
- [x] Recommended: create `memory-bank/research/` for durable per-topic research.
- [x] Keep `memory-bank/currentResearch.md` as a rolling index/summary if it already exists or is added later.
- [x] Add a naming convention:
  - [x] `<topic-slug>-research-YYYY-MM-DD.md`
  - [x] `<topic-slug>-research-YYYY-MM-DD-v2.md` when revising the same day

### Phase 6: Source Quality And Safety Gates

- [x] Add a source rubric:
  - [x] Primary: official docs, source repositories, standards, release notes, academic papers.
  - [x] Secondary: vendor blogs, credible engineering writeups.
  - [x] Tertiary: Reddit, forums, personal blogs, social media.
- [x] Require conflict notes when sources disagree.
- [x] Require "unknowns" rather than confident claims when evidence is weak.
- [x] Require date/freshness notes for APIs, models, packages, pricing, legal/security guidance, and current product capabilities.
- [x] Require visible source URLs in the research artifact.

### Phase 7: Validate The Workflow Structure

- [x] Verify that `RESEARCH` / `RPLAN` mode rules require opening user-provided links, writing a research artifact, and stopping before PLAN when run standalone.
- [x] Verify that `PLAN` mode checks for a fresh matching research artifact before planning from external links or current facts.
- [x] Verify that local-only `PLAN` requests can still proceed without unnecessary internet research.
- [x] Verify that the research artifact template, source rubric, and PLAN handoff checklist exist in the local skill.
- [x] Verify that imported Skills and source attribution are present in `.agents/skills/`.
- [x] Note that full end-to-end activation should be exercised in the next Codex session after the new skills are discovered.

### Phase 8: Documentation And Memory Bank Traceability

- [x] Update `memory-bank/tasks.md` with a concise implementation task if this plan is approved.
- [x] Update `memory-bank/systemPatterns.md` with the new research-before-plan workflow after implementation.
- [x] Update `memory-bank/progress.md` after validation.
- [x] Add source attribution for imported external skills and any copied MIT-licensed content.

---

## Design Notes

### Preferred Mode Flow

```text
User request with links/current info
  -> RESEARCH
  -> memory-bank/research/<topic>-research-YYYY-MM-DD.md
  -> user review / approval
  -> PLAN
  -> memory-bank/plan/<topic>-plan-YYYY-MM-DD.md
  -> IMPLEMENT
  -> QA
  -> REFLECT / ARCHIVE
```

### Why Not Put Everything Inside PLAN?

Keeping research in a separate mode makes the workflow easier to reason about:

- `RESEARCH` answers "what is true externally and what does it imply?"
- `PLAN` answers "what should we change in this repository?"
- `IMPLEMENT` answers "make the approved change."

This separation also creates a reusable research artifact that survives context compaction and can be reviewed independently.

### When PLAN Can Skip RESEARCH

`PLAN` can skip `RESEARCH` when all of these are true:

- The task is purely local.
- No links are provided.
- No current external facts are needed.
- The plan can be derived from repository files and Memory Bank context.

### When RESEARCH Is Mandatory

`RESEARCH` should be mandatory when any of these are true:

- The user provides URLs as decision inputs.
- The user asks for current/latest/up-to-date information.
- The task involves external APIs, tools, libraries, model capabilities, pricing, security guidance, licensing, standards, or legal/compliance claims.
- The plan depends on third-party skill repositories or docs not already vendored into this repository.

---

## Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| Research mode becomes too slow for small tasks | Let `VAN` recommend standalone research, but allow `PLAN` to perform only the missing research needed for the plan. |
| Research artifacts become long and noisy | Use a fixed template with source inventory, key findings, implications, and open questions. |
| External skills override repository workflow | Keep `.gemini/rules/custom_modes/*` authoritative; use skills as supporting workflows only. |
| Autonomous research skill conflicts with user approval gates | Do not enable `autoresearch` by default; require explicit user approval. |
| Sources become stale | Record research date and source freshness; require rerun for unstable topics. |
| Citation quality varies | Prefer primary sources and require conflict/uncertainty sections. |

---

## Approval Questions

1. Should the new command be `RESEARCH`, `RPLAN`, or both? **Decision: both.**
2. Should `PLAN` automatically stop and require `RESEARCH` when links are present? **Decision updated: no. `VAN` recommends `RESEARCH`; `PLAN` continues by using an existing artifact or performing/delegating missing research.**
3. Should research artifacts live in `memory-bank/research/` or only in `memory-bank/currentResearch.md`? **Decision: durable per-topic files in `memory-bank/research/`, with `currentResearch.md` only for concise traceability.**
4. Should `agents-best-practices` be imported before implementing this workflow? **Decision: yes, imported as a complete repo-local skill.**
5. Which AI Research skills should be allowed initially, if any? **Decision: curated subset only; `autoresearch` remains disabled by default.**

---

## Recommended Decision

Use a new `RESEARCH` mode plus VAN research recommendations and PLAN research handling. Store durable research documents under `memory-bank/research/`, import `agents-best-practices`, create a small local `research-before-plan` skill, and only add a curated subset of `AI-Research-SKILLs`. Keep `autoresearch` disabled unless the user explicitly requests long-running autonomous research.
