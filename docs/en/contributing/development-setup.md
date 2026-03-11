---
description: Local setup and validation workflow for contributors.
---

# Development Setup

## Local Workflow

1. Install dependencies from the repository root with `pnpm install`.
2. Configure local backend and optional frontend env files.
3. Validate with `pnpm build` from the root.
4. Run targeted package tests or lint where needed.

## Repository Rules

- Prefer root-level PNPM commands.
- Use `pnpm --filter <package> lint` for package-scoped linting.
- Avoid using `pnpm dev` unless you truly need live development servers.
- Keep English docs canonical and mirror Russian docs with matching structure.

This workflow keeps package boundaries and generated artifacts consistent.
