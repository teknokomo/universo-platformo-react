# Universo Platformo Packages

This directory contains the runtime applications, shared libraries, templates, and documentation services that make up the current Universo Platformo monorepo.

## Layout Rules

-   Most workspaces use the `packages/<name>/base` structure.
-   `packages/apps-template-mui` and `packages/universo-rest-docs` are package roots without a `base` layer.
-   Cross-package imports should use workspace package names such as `@universo/types`, not relative paths.
-   Package README files should exist in synchronized English and Russian versions.

## Package Map

| Directory | Package | Role |
| --- | --- | --- |
| `admin-backend` | `@universo/admin-backend` | Backend routes and services for platform-wide administration. |
| `admin-frontend` | `@universo/admin-frontend` | Frontend module for admin pages and admin UI flows. |
| `applications-backend` | `@universo/applications-backend` | Backend for application entities, memberships, connectors, and publication links. |
| `applications-frontend` | `@universo/applications-frontend` | Frontend module for application management views and actions. |
| `apps-template-mui` | `@universo/apps-template-mui` | Shared MUI application scaffolding for newer frontend packages. |
| `auth-backend` | `@universo/auth-backend` | Passport and Supabase-based authentication toolkit for the backend. |
| `auth-frontend` | `@universo/auth-frontend` | Shared authentication UI primitives and session-aware frontend helpers. |
| `universo-block-editor` | `@universo/block-editor` | Shared Editor.js block-content authoring primitives reused by administrative and published-app UIs. |
| `metahubs-backend` | `@universo/metahubs-backend` | Backend for metahubs, branches, publications, and related domain flows. |
| `metahubs-frontend` | `@universo/metahubs-frontend` | Frontend module for metahub management interfaces. |
| `migration-guard-shared` | `@universo/migration-guard-shared` | Shared migration-status helpers and guard shell components. |
| `profile-backend` | `@universo/profile-backend` | Backend for user profile data and settings. |
| `profile-frontend` | `@universo/profile-frontend` | Frontend module for user profile pages and profile UX. |
| `schema-ddl` | `@universo/schema-ddl` | Runtime schema generation, migration, and diff utilities for PostgreSQL. |
| `start-backend` | `@universo/start-backend` | Backend routes and services for onboarding and start flows. |
| `start-frontend` | `@universo/start-frontend` | Frontend onboarding wizard, cookie UX, and start-page helpers. |
| `universo-api-client` | `@universo/api-client` | Shared TypeScript API client utilities for frontend packages. |
| `universo-core-backend` | `@universo/core-backend` | Main backend server and runtime integration shell. |
| `universo-core-frontend` | `@universo/core-frontend` | Main React frontend shell that assembles shared and feature packages. |
| `universo-database` | `@universo/database` | Knex singleton, health checks, and executor factories. |
| `universo-i18n` | `@universo/i18n` | Centralized i18n runtime and namespace registration utilities. |
| `universo-migrations-catalog` | `@universo/migrations-catalog` | Catalog storage for migration history and definition registry artifacts. |
| `universo-migrations-core` | `@universo/migrations-core` | Core migration runtime, identifiers, validation, and execution helpers. |
| `universo-migrations-platform` | `@universo/migrations-platform` | Platform-wide migration registry, planning, diff, export, and CLI entry points. |
| `universo-rest-docs` | `@universo/rest-docs` | Modular OpenAPI and Swagger documentation server. |
| `universo-store` | `@universo/store` | Shared Redux and ability-helper package used by the current frontend shell. |
| `universo-template-mui` | `@universo/template-mui` | Shared MUI template components used by the React shell and feature modules. |
| `universo-types` | `@universo/types` | Shared TypeScript domain types and cross-package interfaces. |
| `universo-utils` | `@universo/utils` | Shared validators, serialization helpers, and backend/frontend utilities. |

## How to Read This Directory

-   **Core shell** packages provide the main backend and frontend application frame.
-   **Feature modules** add business capabilities such as admin, auth, onboarding, profile, metahubs, and applications.
-   **Infrastructure packages** handle database access, migrations, schema DDL, i18n, API clients, shared types, and utilities.
-   **UI support packages** provide shared state, templates, and application scaffolding for React-based frontends.
-   **Documentation packages** expose OpenAPI and related REST documentation assets.

## Development Notes

-   Run package management and full builds from the repository root with `pnpm build`.
-   Use targeted commands such as `pnpm --filter <package> lint` or `pnpm --filter <package> test` for focused validation.
-   When documenting or importing packages, prefer the actual workspace package name over historical aliases or removed directory names.

For package-specific details, open the README inside the corresponding package directory.
