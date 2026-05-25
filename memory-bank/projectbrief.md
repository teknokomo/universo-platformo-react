# Project Brief - Universo Platformo

> **Last Reviewed**: 2026-05-22 (refreshed: architecture, package list, version, and removed legacy UPDL-as-core framing)

## Mission & Strategic Vision

Universo Platformo is a configuration-first platform that lets organizations
build their own data and process applications on a small, fixed set of
**entity-type primitives** plus **embedded modules** — the same way
1C:Enterprise 8.x exposes a configuration model, but more flexible.

A **metahub** is the canonical configuration unit. From a metahub the
platform creates **applications**, and inside each published application
users work in **workspaces** that hold their real content. The
configuration model is intentionally generic so the same primitives can
host very different products (today the primary one is LMS).

The platform is also the foundation for two larger initiatives:

-   **Universo MMOOMM** — a massively multiplayer space sandbox built on
    top of the platform.
-   **Universo Kiberplano** (Cyberplan) — an integrated planning system
    that bridges digital plans, multi-agent orchestration, and real-world
    robotic execution.

**Key Strategic Goals:**

-   **Generic configuration platform**: a stable, opinionated set of entity
    types (Hub, Object, Page, Set, Enumeration, Ledger, Constants Library)
    plus the Entity Type Constructor cover most domain modeling needs.
-   **LMS as the first complete configuration**: drive the platform to
    iSpring-LMS-class functionality on the existing primitives, without
    LMS-specific runtime forks.
-   **Architectural transition to "everything is an Application"**: the
    current legacy feature packages (metahubs, applications list, admin,
    profile, start) become regular applications rendered through
    `packages/apps-template-mui`. The legacy packages are removed once
    the new applications cover their functionality.
-   **Universo MMOOMM**: massively multiplayer space MMO with production
    chains, territorial control, and real-world integration.
-   **Universo Kiberplano**: digital planning → multi-agent orchestration →
    robotic implementation across distributed nodes.
-   **Shared runtime DDL**: schema generation and migrations live in
    `@universo/schema-ddl` to avoid backend coupling.

## Current Status

-   **Repository version**: `upr-0.65.0-alpha`.
-   **Architecture status**: in active transition from a "feature packages
    on `universo-template-mui`" layout to an "everything is an Application
    on `apps-template-mui`" layout. Legacy packages remain functional and
    receive new work; they will be removed only after the corresponding
    application replaces them.
-   **Primary configuration in development**: LMS Learning Content,
    benchmarked against iSpring LMS.
-   **DB layer**: TypeORM was removed. Current path is Knex (connection
    management, transactions) plus raw SQL through `DbExecutor.query()`,
    with `@universo/schema-ddl` for runtime schema generation. The team
    treats this layer as work-in-progress; see
    `.kiro/steering/recommendations.md` § 2.10 for the future direction.

## Configuration Model

A small fixed set of platform-level entity type presets covers most
domain modeling. Templates curate which presets a new metahub starts
with.

### Platform-level entity type presets (7)

| Preset            | Codename                      | Role                                                                                                                             |
| ----------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Hub               | `hub` (`tree-entity`)         | Top-level hierarchy / nesting                                                                                                    |
| Object            | `object`                      | Core entity. Covers Catalog/Document/Register-style behavior via `recordBehavior` mode + `posting` / `ledgerSchema` capabilities |
| Page              | `page`                        | Editor.js-authored block content                                                                                                 |
| Set               | `set` (`value-group`)         | Typed fixed values (constants)                                                                                                   |
| Enumeration       | `enumeration` (`option-list`) | Closed list of named values                                                                                                      |
| Ledger            | `ledger`                      | Specialized append-only register; alternative to Object + `config.ledger`                                                        |
| Constants Library | `fixed-values-library`        | Set-style preset for typed constants without runtime publication widgets                                                         |

Plus cross-cutting capabilities: **attached modules** (TypeScript inside
isolated-vm, server or client) and **workspaces inside published
applications** (multi-tenant runtime isolation).

### Metahub templates (4)

| Template        | Codename     | Default presets                                                                             |
| --------------- | ------------ | ------------------------------------------------------------------------------------------- |
| Basic (default) | `basic`      | hub, page, object, set, enumeration                                                         |
| Basic Demo      | `basic-demo` | basic + sample data                                                                         |
| Empty           | `empty`      | _(none)_ — user picks via constructor                                                       |
| LMS             | `lms`        | basic preset set, plus seeded LMS objects (incl. ledger-style Objects with `config.ledger`) |

Future templates (planned) include a **1C-compatible** template that
exposes a full 1C:Enterprise metadata-object map.

The full architectural description lives in the project skill at
`.agents/skills/universo-platform-architecture/`.

## Three-Layer Workflow

```
Metahub                Application                Workspace
(canonical config)     (deployed instance)        (runtime isolation)
─────────────────      ────────────────────       ─────────────────────
Entity types,          Global settings:           Day-to-day end-user
relationships,         feature toggles,           content: created,
attached modules,      branding, defaults,        edited, copied, and
seeded content,        access policies            deleted by users
default layouts                                   with sufficient role
```

Each layer owns a different lifecycle. End-user content lives in
workspaces; the metahub and the control panel are not user-content
surfaces.

## Workspace Layout

The repository is a PNPM workspace orchestrated by Turbo. Active feature
packages today:

### Core shell

-   `universo-core-backend`, `universo-core-frontend`

### Legacy feature packages (in scope for app migration)

-   `metahubs-backend`, `metahubs-frontend`
-   `applications-backend`, `applications-frontend`
-   `admin-backend`, `admin-frontend`
-   `profile-backend`, `profile-frontend`
-   `start-backend`, `start-frontend`
-   `auth-backend`, `auth-frontend`

### UI templates

-   `universo-template-mui` (legacy template; used by the feature packages above)
-   `apps-template-mui` (new published-application template; **kept isolated** from `universo-template-mui` and from the legacy feature packages — duplication is intentional)

### Infrastructure

-   `universo-database` — Knex singleton, three-tier executors
-   `universo-types` — shared domain types
-   `universo-utils` — validators, serializers
-   `universo-i18n` — centralized i18n runtime
-   `universo-api-client` — shared API client
-   `universo-block-editor` — Editor.js wrapper
-   `universo-store` — shared Redux + abilities
-   `universo-rest-docs` — OpenAPI / Swagger surface

### DDL and migrations

-   `schema-ddl` — runtime schema generation, migration, diff utilities
-   `universo-migrations-core` — core migration runtime
-   `universo-migrations-platform` — platform-wide migration registry
-   `universo-migrations-catalog` — catalog storage for migration history

This list will shrink over time as legacy feature packages are replaced
by applications shipped through `apps-template-mui`.

## Pseudo-App Bootstrap (transitional)

While the metahub authoring surface cannot yet model itself, the platform
uses a manual **pseudo-app pattern**: hand-built base snapshots → file
migrations → first-run install. The implementations were created some
time ago and the likely future direction is to switch to JSON-snapshot
configurations in the same shape as
`tools/fixtures/metahubs-*-snapshot.json`.

A **Setup Wizard** is planned for the first launch: it will list
required and recommended system applications (Applications list,
Metahubs, Admin, etc.) and let the user choose additional applications
from the bundled set or from a central marketplace. The wizard is
planned, not yet implemented.

## Technical Foundation

### Core Technologies

-   **Node.js** (>=22.6.0; 22.22.2 recommended) — required for isolated-vm 6.x
-   **PNPM** (>=10) — **IMPORTANT: Use PNPM, not npm.**
-   **TypeScript** for type safety
-   **React** with Material-UI components
-   **Express** for HTTP backend
-   **Supabase** for authentication and PostgreSQL hosting
-   **Knex** + raw SQL through `DbExecutor.query()` for data access
-   **TanStack Query** for frontend data fetching
-   **Playwright** for E2E testing; **Vitest** for unit tests
-   **Operational reliability**: pool budgets aligned with Supabase Pool Size; pool error telemetry enabled

### Essential Commands

```bash
# Installation
pnpm install

# Build all applications
pnpm build

# Development mode (heavy — let the user run this manually)
pnpm dev

# Build a specific package
pnpm --filter @universo/metahubs-frontend build
```

### Environment Setup

Create `.env` in `packages/universo-core-backend/`:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_JWT_SECRET=your_supabase_jwt_secret
DATABASE_URL=your_postgres_url
```

After refactoring, Supabase configuration is consolidated to
`packages/universo-core-backend/`.

## Coding Standards & Guidelines

-   **Language**: concise English comments for code; preserve existing patterns.
-   **Efficiency**: fewer lines is better when readability is preserved.
-   **Compatibility**: maintain backwards compatibility with the inherited upstream shell where required.
-   **Package management**: PNPM workspaces only, no npm/yarn.
-   **Workspace imports**: use full package names (`@universo/types`), never relative cross-package paths.
-   **Data access**: three-tier executor pattern + `DbExecutor.query()` parameterized SQL.
-   **UI**: reuse existing MUI dashboard / app-template primitives; do not introduce LMS-only forks for generic problems.

## Legacy Product Surface (historical context)

Earlier versions of the platform shipped a UPDL system (Universal
Description Platform Language) for AR.js and PlayCanvas applications.
The corresponding packages (`updl/`, `publish-frontend/`,
`publish-backend/`, `analytics-frontend/`) have been removed from the
active workspace. The current architectural focus is the metahub
configuration model described above; UPDL is no longer the core
architecture.

## Key Resources & Documentation

-   **Project Repository**: [universo-platformo-react](https://github.com/teknokomo/universo-platformo-react)
-   **Detailed Packages Structure**: [packages/README.md](../packages/README.md)
-   **Technical Context**: [memory-bank/techContext.md](techContext.md)
-   **System Patterns**: [memory-bank/systemPatterns.md](systemPatterns.md)
-   **Progress Timeline**: [memory-bank/progress.md](progress.md)
-   **Current Tasks**: [memory-bank/tasks.md](tasks.md)
-   **Architectural Skill**: `.agents/skills/universo-platform-architecture/`
-   **Steering**: `.kiro/steering/recommendations.md`, `.kiro/steering/tech.md`

## License Information

**Dual Licensing Structure:**

-   **Original upstream code** (`packages/` directory): Apache License 2.0
-   **Universo Platformo Extensions** (`packages/` directory): Omsk Open License

The Omsk Open License is similar to MIT but adds provisions for creating
meaningful public domain while protecting traditional values.

---

_This document is the primary context file for the Universo Platformo
Memory Bank system. It provides the strategic and architectural baseline
that AI-assisted development needs to make informed decisions._
