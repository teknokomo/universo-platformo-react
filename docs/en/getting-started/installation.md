---
description: Install the monorepo dependencies and prepare the local workspace.
---

# Installation

## Prerequisites

- Node.js 18.15.x, 20.x, or another version allowed by the root package rules.
- PNPM 9 or newer.
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
