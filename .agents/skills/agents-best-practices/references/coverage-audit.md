# Coverage Audit

This file maps the required agent-harness knowledge areas to the Markdown files in this skill. Use it to confirm that no major design topic was omitted before applying the skill to a real agent architecture.

## Required coverage map

| Topic | Covered in | Notes |
|---|---|---|
| General-purpose agent harness | `SKILL.md`, `architecture.md` | Treats coding as one domain among many. |
| Agent-legible environment and feedback loops | `agent-legibility-feedback-loops.md`, `architecture.md` | Covers source-of-truth knowledge bases, validation signals, mechanical invariants, throughput, and entropy cleanup. |
| Agentic loop | `agentic-loop.md` | Includes canonical loop, invariants, budgets, retries, provider-neutral variants, and termination. |
| Goal-like loop | `agentic-loop.md`, `planning-and-goals.md` | Includes objective, done condition, budget, checkpoints, progress log, validation, and stop rules. |
| Planning mode | `planning-and-goals.md` | Covers read-only planning, plan artifact, approval, execution after approval, and plan-validate-execute. |
| Auto context and compaction | `context-memory-compaction.md` | Covers context tiers, scoped instruction loading, retrieval, compaction triggers, handoff summaries, and rehydration. |
| Prompt caching and cost control | `prompt-caching-and-cost.md`, `context-memory-compaction.md`, `provider-api-patterns.md` | Covers stable-prefix design, deterministic serialization, provider cache fields, TTL/retention notes, compaction/cache tradeoffs, and monitoring. |
| Skills attachment | `skills-and-connectors.md`, `SKILL.md` | Covers Agent Skills structure, progressive disclosure, trigger descriptions, governance, and evals. |
| MCP and external connectors | `skills-and-connectors.md` | Covers resources/prompts/tools, staged loading, namespacing, authorization, deferred tool loading, and code-execution patterns. |
| System prompts and instructions | `system-prompts-instructions.md` | Covers authority hierarchy, runtime reminders, injection boundaries, and prompt templates. |
| Tool design | `tools-and-permissions.md` | Covers schemas, risk taxonomy, structured outputs, result limits, errors, sandboxing, secrets, and tool visibility. |
| Permissions and approvals | `tools-and-permissions.md`, `security-evals-observability.md` | Covers permission matrix, draft/commit split, approval records, and policy enforcement. |
| Provider API differences | `provider-api-patterns.md` | Covers OpenAI Responses-style APIs, Chat Completions-style/OpenAI-compatible APIs, Anthropic APIs, hosted tools, adapters, streaming, and state. |
| Security | `security-evals-observability.md` | Covers threat model, guardrails, prompt injection, approvals, launch gates, and incidents. |
| Observability | `security-evals-observability.md` | Covers traces, events, token/cost/latency, and replay. |
| Evals | `security-evals-observability.md`, `checklists.md` | Covers task success, tool precision, adversarial tests, trace grading, and regression tests. |
| Implementation checklist | `checklists.md` | Includes design, tool, permission, context, planning, goal, skill, connector, eval, and rollout checklists. |

## Required language and scope checks

- The skill is provider-neutral.
- The skill refers to OpenAI, Anthropic, and OpenAI-compatible APIs only where provider-specific API patterns matter.
- The skill does not depend on coding-agent-specific assumptions.
- The skill contains only Markdown files.
- The skill includes prompt-cache architecture and cache-hit monitoring.
- The skill includes agent-legibility, knowledge-base, feedback-loop, and entropy-management practices.
- The skill uses progressive disclosure: `SKILL.md` is the entry point; detailed guidance is in focused reference files.

## Minimum file set

```text
agents-best-practices/
  SKILL.md
  references/
    architecture.md
    agent-legibility-feedback-loops.md
    agentic-loop.md
    tools-and-permissions.md
    context-memory-compaction.md
    prompt-caching-and-cost.md
    planning-and-goals.md
    skills-and-connectors.md
    system-prompts-instructions.md
    provider-api-patterns.md
    security-evals-observability.md
    checklists.md
    coverage-audit.md
```


## MVP agent blueprint generation

Covered in `SKILL.md`, `references/mvp-agent-blueprint.md`, `references/architecture.md`, and `references/checklists.md`. The skill now explicitly instructs assistants to produce a domain-specific MVP harness blueprint when the user asks to make or build an agent. The blueprint includes agentic loop, tool registry, permissions, context and memory, auto-compaction, planning mode, goal-like loop criteria, skills, MCP/external connectors, prompt caching, cost-aware context, observability, evals, and launch path.
