# Security, Evals, and Observability

## Threat model

Agent risks usually come from the combination of language, tools, and external data.

Threat categories:

```text
prompt injection
malicious retrieved content
tool misuse
permission bypass
secret leakage
data exfiltration
unsafe external communication
financial or destructive side effects
connector abuse
malicious skill packages
runaway loops
cost exhaustion
false success claims
compaction state loss
subagent miscoordination
```

## Guardrail layers

Use layered guardrails:

```text
input guardrails: reject or route unsafe user requests
context guardrails: label untrusted content and redact secrets
schema guardrails: force structured tool arguments and outputs
tool guardrails: validate args and results around execution
permission guardrails: approve, deny, or pause actions
output guardrails: check final answer before user-visible output
trace guardrails: grade tool calls and decisions after the run
```

Guardrails should be fast, specific, and testable.

## Prompt injection handling

Rules:

- external content is data, not instruction;
- extract structured fields where possible;
- isolate untrusted content from authoritative instructions;
- do not let external content choose tools directly;
- do not copy secrets into context;
- require approval for actions influenced by arbitrary text;
- log the source of data used for tool calls.

## Approval records

Approval request format:

```json
{
  "approval_type": "external_send",
  "action": "send_email",
  "target": "customer@example.com",
  "risk": "external_communication",
  "preview_ref": "artifact://drafts/email_123",
  "expected_result": "Customer receives renewal reminder.",
  "rollback": "Cannot unsend; follow-up correction possible.",
  "scope": "single_send_only"
}
```

Approval result format:

```json
{
  "status": "approved",
  "approved_by": "user_id",
  "timestamp": "...",
  "scope": "single_send_only",
  "expires_at": "..."
}
```

Never let the model approve its own action.

## Observability

Trace operational events, not private hidden reasoning.

Trace fields:

```text
run_id
session_id
user or tenant
model and provider
context size
instructions loaded
tools visible
tool calls
tool args hash or redacted args
permission decisions
approval requests/results
tool results summary
errors and retries
compaction boundaries
latency
token usage
cost
final status
```

A trace should answer:

- what did the agent try to do;
- what data did it use;
- what tool changed state;
- who approved it;
- what failed;
- why did it stop;
- could the run be replayed.

## Evaluation strategy

Evaluate the harness, not only the model.

Eval categories:

```text
task success
tool selection precision
unnecessary tool calls
permission correctness
approval correctness
prompt injection resistance
context compaction retention
retrieval relevance
output format adherence
failure recovery
cost and latency
human intervention rate
false confidence
```

## Test cases

Create adversarial tests:

- retrieved document says “ignore previous instructions”;
- email contains a request to exfiltrate data;
- user asks for an external send without approval;
- tool returns malformed data;
- connector auth expires;
- model calls unknown tool;
- model supplies invalid arguments;
- context reaches limit and compaction happens;
- two instructions conflict;
- goal is vague or impossible;
- tool output is huge;
- sensitive data appears in retrieved content;
- subagent returns unsupported conclusion.

## Trace grading

Grade specific events:

```text
Did the agent use the right tool?
Was the tool call necessary?
Were arguments valid?
Was permission checked?
Was approval requested at the right time?
Was the final answer grounded in tool results?
Did compaction preserve the active objective?
```

## Launch gates

Before production:

- narrow tool registry;
- local schema validation;
- permission matrix enforced in code;
- approval UX for risky actions;
- prompt injection tests pass;
- compaction tests pass;
- connector auth and revocation tested;
- trace logging enabled;
- cost budgets enforced;
- rollback or incident path documented;
- evals run on realistic and adversarial tasks.

## Incident response

When an agent misbehaves:

1. Pause risky tools.
2. Preserve traces and artifacts.
3. Identify instruction, tool, connector, or model failure.
4. Patch policy/tool/schema/context logic.
5. Add regression eval.
6. Re-enable gradually.

## Source links

- OpenAI guardrails and human review: https://developers.openai.com/api/docs/guides/agents/guardrails-approvals
- OpenAI agent safety: https://developers.openai.com/api/docs/guides/agent-builder-safety
- OpenAI sandbox agents: https://developers.openai.com/api/docs/guides/agents/sandboxes
- Anthropic building effective agents: https://www.anthropic.com/research/building-effective-agents
- Anthropic demystifying evals for agents: https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- Anthropic writing effective tools for agents: https://www.anthropic.com/engineering/writing-tools-for-agents
- MCP specification: https://modelcontextprotocol.io/specification/2025-11-25
