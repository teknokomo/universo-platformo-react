---
name: thermos
description: Use as the Thermos review orchestrator. Synthesizes findings from both the correctness/security and maintainability review rubrics, presenting a unified review report.
metadata:
    version: '1.0.0'
    scope: 'thermos-orchestrator'
    file_policy: 'markdown-only'
---

# Thermos Orchestrator

Use this skill to coordinate correctness, security, and maintainability reviews, synthesizing a single unified review report.

## Required Output

When running a Thermos review, output:
- a summary of files reviewed;
- a list of correctness and security issues found (scored by severity);
- a list of maintainability and code quality issues (scored by impact);
- a clear PASS/FAIL recommendation with required action items.

## Workflow

1. Run the correctness/security check to identify critical bugs, vulnerabilities, and UUID v7 drift.
2. Run the maintainability check to flag oversized files, circular references, and code formatting/test issues.
3. Synthesize the findings into a clear, structured review markdown block.
4. Block merging if any CRITICAL correctness issues or REFACTOR_REQUIRED maintainability issues are discovered.

## Integration Commands

Run Thermos reviews via the `autoreview` tool:
```bash
# Correctness review only
autoreview --prompt-file .agents/skills/autoreview/rubrics/thermos-correctness.md

# Maintainability review only
autoreview --prompt-file .agents/skills/autoreview/rubrics/thermos-maintainability.md

# Synthesized review
autoreview --prompt-file .agents/skills/autoreview/rubrics/thermos.md
```
