# Thermos Code Quality Review

Thermos is the codebase quality gate and automated review framework designed to enforce correctness, security, and maintainability across the Universo platform. It defines strict review rubrics and scoring standards for both human and AI reviewers.

## The Review Rubrics

Thermos splits code verification into two specialized pipelines:

### 1. Correctness & Security (Thermo-Nuclear Review)
Focuses on preventing critical issues, security holes, and data leaks.
- **UUID v7 Enforcement:** All new entities and snapshot identifiers must use ordered UUID v7. UUID v4 is blocked for entity identities.
- **SQL Safety:** All queries must use parameterized bind parameters. No unparameterized raw SQL concatenation is allowed.
- **Origin Validation:** WebSocket upgrades and critical routes must validate header origins.
- **Data Protection:** No PII, passwords, or credentials can be logged or leaked.

### 2. Maintainability & Code Quality
Focuses on code health, complexity, and testing.
- **File and Function Size:** Large monolithic files and complex functions are flagged for decomposition.
- **Circular References:** Detects and blocks package-level or file-level circular imports.
- **Test Sufficiency:** Verifies that new logic has corresponding Vitest or Playwright test files.
- **Workspace Boundaries:** Cross-package imports must use workspace package coordinates, never relative paths.

---

## Severity Levels & Verdicts

Issues found are classified as:
- **CRITICAL:** High-risk bugs/vulnerabilities. Blocks merging immediately.
- **HIGH:** Style violations, missing tests, or package boundaries drift. Must be fixed before merge.
- **MEDIUM:** Backlog items to fix in subsequent iterations.
- **LOW / ADVISORY:** Clean code suggestions.

### Verdict Output
- **PASS:** The code has no CRITICAL or HIGH severity findings.
- **FAIL:** The code contains at least one CRITICAL correctness issue or HIGH/BLOCKER maintainability issue. Merging is blocked until fixed.

---

## Integration with `autoreview`

You can run Thermos reviews locally using the vendored `autoreview` script with custom prompt rubrics:

```bash
# Full Thermos Review
.agents/skills/autoreview/scripts/autoreview --mode local --prompt-file .agents/skills/autoreview/rubrics/thermos.md

# Correctness & Security only
.agents/skills/autoreview/scripts/autoreview --mode local --prompt-file .agents/skills/autoreview/rubrics/thermos-correctness.md

# Maintainability & Code Quality only
.agents/skills/autoreview/scripts/autoreview --mode local --prompt-file .agents/skills/autoreview/rubrics/thermos-maintainability.md
```
