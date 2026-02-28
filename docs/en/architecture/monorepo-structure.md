---
description: How packages are organized in the monorepo.
---

# Monorepo Structure

{% hint style="info" %}
**This page is under development.** Detailed documentation will be added soon.
{% endhint %}

## Overview

The project is organized as a pnpm monorepo with Turborepo for build orchestration. All feature packages live under `packages/`, each containing a `base/` directory for the default implementation.

## Package Categories

* **Core packages** — `flowise-core-backend`, `flowise-core-frontend`, `flowise-components`
* **Feature packages** — paired backend/frontend packages (e.g., `spaces-backend`, `spaces-frontend`)
* **Shared packages** — `universo-types`, `universo-utils`, `schema-ddl`, `api-client`
* **Template packages** — `universo-template-mui`, `flowise-template-mui`, `template-mmoomm`

## Documentation

Coming soon.
