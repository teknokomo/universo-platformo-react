---
name: thermo-nuclear-code-quality-review
description: Use for maintainability and code quality reviews. Covers file size limitations, abstraction quality, code structure simplification, naming conventions, test coverage, and documentation quality.
metadata:
    version: '1.0.0'
    scope: 'thermos-maintainability'
    file_policy: 'markdown-only'
---

# Thermo-Nuclear Code Quality Review (Maintainability)

Use this skill to review code maintainability, clean abstractions, size constraints, testing coverage, and architectural health.

## Version Guard

- Rubric matches Thermos Maintainability Guidelines.
- Hard file limit: Files must not exceed 1,000 lines.

## Rubric Categories

1. **File Size:** Any file exceeding 1,000 lines must have a decomposition plan to be refactored into smaller focused modules.
2. **Abstraction Quality:** Prevent god objects, tight coupling, circular dependencies, and duplicate abstractions.
3. **Code Judo:** Simplify complex conditional flows, reduce nesting, and restructure code for elegance.
4. **Naming:** Enforce clear, self-documenting naming conventions. Reject misleading names or inconsistent abbreviations.
5. **Test Coverage:** Ensure critical paths, utilities, routes, and edge cases are backed by Vitest or Playwright test suites.
6. **Documentation:** Require inline comments (JSDoc format for functions/classes) and update package README files when features are added or changed.

## Scoring

- **REFACTOR_REQUIRED:** Code structure must be cleaned up before merging.
- **IMPROVEMENT_SUGGESTED:** Recommended styling or readability improvements.
- **PASSED:** Code is clean and fits style conventions.

## Blocking Rules

- Do not let a new source file exceed 1,000 lines without a decomposition plan.
- Do not let undocumented public API exports pass.
- Do not let complex features be introduced without accompanying unit or integration tests.
