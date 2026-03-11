---
description: Package creation rules for new frontend or backend modules.
---

# Creating Packages

## Shared Rules

- Put new work under `packages/` and follow existing naming conventions.
- Use workspace package names for imports across package boundaries.
- Add synchronized English and Russian README files.

## Frontend Packages

New frontend packages should use TypeScript or TSX and fit the current build
pattern for dual-format outputs when they are intended for reuse.

## Backend Packages

New backend packages should use SQL-first stores, `DbExecutor`-style access,
platform migration definitions, and root-level registration where required.

Package creation is an architectural task with runtime and integration consequences.
