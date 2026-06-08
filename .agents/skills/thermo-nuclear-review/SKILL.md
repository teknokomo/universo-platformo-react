---
name: thermo-nuclear-review
description: Use for deep correctness and security review of code changes. Covers critical bugs, security vulnerabilities, breaking changes, data safety, concurrency, and UUID v7 validation.
metadata:
    version: '1.0.0'
    scope: 'thermos-correctness-security'
    file_policy: 'markdown-only'
---

# Thermo-Nuclear Review (Correctness & Security)

Use this skill to perform rigorous correctness, security, concurrency, and validation reviews of code modifications.

## Version Guard

- Rubric matches Thermos Correctness and Security Guidelines.
- UUID enforcement: All new identifiers must use UUID v7.

## Rubric Categories

1. **Critical Bugs:** Look for logic errors, off-by-one errors, null/undefined dereferences, unhandled exceptions, and edge case failures.
2. **Security:** Check for injection vulnerabilities, broken authentication, token leakage, CSRF/XSS, insecure configurations, and missing origin validations.
3. **Breaking Changes:** Verify API route compatibility, database schema modifications, protocol contracts, and dependency upgrades.
4. **Data Safety:** Prevent PII exposure, unvalidated inputs persistence, and debug logs carrying sensitive data.
5. **Concurrency:** Identify deadlocks, stale reads, lost updates, and double-processing race conditions.
6. **UUIDs:** Enforce that all new entity or snapshot identifiers use UUID v7 (ordered UUIDs) instead of UUID v4 to maintain indexing and database performance.

## Severity Scoring

- **CRITICAL:** Fix immediately; block merging.
- **HIGH:** Fix before merging.
- **MEDIUM:** Address in a follow-up task.
- **LOW/ADVISORY:** Suggested code improvements.
- **FALSE_POSITIVE:** Mark and explain if the finding is incorrect.

## Blocking Rules

- Do not let code containing unparameterized SQL or raw database calls pass.
- Do not allow any new UUID v4 generation in code paths handling entity identity.
- Do not let WebSocket upgrades bypass origin validation checks.
