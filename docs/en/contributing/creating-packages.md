---
description: Add new packages to the monorepo.
---

# Creating Packages

{% hint style="info" %}
**This page is under development.** Detailed package creation guide will be added soon.
{% endhint %}

## Overview

New packages follow a standard structure under `packages/`. Frontend packages use TypeScript (TSX) with dual CJS/ESM builds. Backend packages use TypeORM for database access.

## Package Structure

```
packages/your-package/base/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Key Rules

* Frontend packages must compile to both CommonJS and ES Modules
* Backend packages must use the TypeORM Repository pattern
* All packages must register entities and migrations centrally
* Use pnpm workspace package names for cross-package imports

## Documentation

Coming soon.
