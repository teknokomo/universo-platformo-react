---
description: Coding guidelines for the current monorepo.
---

# Coding Guidelines

## General Rules

- Prefer TypeScript where the package already uses it.
- Use 2-space indentation and keep changes focused.
- Keep root and package documentation aligned with the real code.
- Do not reintroduce removed TypeORM-first patterns into new work.

## Package Rules

- Use workspace package names for cross-package imports.
- Backend database access must go through SQL-first stores or executor helpers.
- Frontend packages should fit the current React shell and shared UI patterns.
- Update English and Russian docs together when a translated pair exists.

Write changes that match the platform's modular and repository-first direction.
