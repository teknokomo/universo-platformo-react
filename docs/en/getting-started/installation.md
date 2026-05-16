---
description: Install the monorepo dependencies and prepare the local workspace.
---

# Installation

## Prerequisites

- Node.js 22.22.2 recommended; Node.js >=22.6.0 is required by the root package rules.
- PNPM 10.x is required; the workspace is pinned to pnpm 10.33.2.
- Access to a Supabase (PostgreSQL) environment for backend startup.

## Workspace Bootstrap

```bash
git clone https://github.com/teknokomo/universo-platformo-react.git
cd universo-platformo-react
pnpm install
```

## Validation Step

Run the root build after installation.

```bash
pnpm build
```

This repository uses PNPM workspaces and Turborepo, so install and build from
the repository root rather than from nested package directories.
