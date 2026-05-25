# Universo Platformo Packages

This directory contains the runtime applications, shared libraries, templates, and documentation services that make up the current Universo Platformo monorepo.

## Layout Rules

-   Every workspace package uses the flat `packages/universo-react-<name>/package.json` structure.
-   `pnpm-workspace.yaml` discovers package roots with the single `packages/*` glob.
-   Cross-package imports should use workspace package names such as `@universo-react/types`, not relative paths.
-   Package README files should exist in synchronized English and Russian versions.

## Package Map

| Directory                               | Package                                  | Role                                                                                                |
| --------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `universo-react-admin-backend`          | `@universo-react/admin-backend`          | Backend routes and services for platform-wide administration.                                       |
| `universo-react-admin-frontend`         | `@universo-react/admin-frontend`         | Frontend module for admin pages and admin UI flows.                                                 |
| `universo-react-applications-backend`   | `@universo-react/applications-backend`   | Backend for application entities, memberships, connectors, and publication links.                   |
| `universo-react-applications-frontend`  | `@universo-react/applications-frontend`  | Frontend module for application management views and actions.                                       |
| `universo-react-apps-template-mui`      | `@universo-react/apps-template-mui`      | Shared MUI application scaffolding for newer frontend packages.                                     |
| `universo-react-auth-backend`           | `@universo-react/auth-backend`           | Passport and Supabase-based authentication toolkit for the backend.                                 |
| `universo-react-auth-frontend`          | `@universo-react/auth-frontend`          | Shared authentication UI primitives and session-aware frontend helpers.                             |
| `universo-react-block-editor`           | `@universo-react/block-editor`           | Shared Editor.js block-content authoring primitives reused by administrative and published-app UIs. |
| `universo-react-metahubs-backend`       | `@universo-react/metahubs-backend`       | Backend for metahubs, branches, publications, and related domain flows.                             |
| `universo-react-metahubs-frontend`      | `@universo-react/metahubs-frontend`      | Frontend module for metahub management interfaces.                                                  |
| `universo-react-migration-guard-shared` | `@universo-react/migration-guard-shared` | Shared migration-status helpers and guard shell components.                                         |
| `universo-react-profile-backend`        | `@universo-react/profile-backend`        | Backend for user profile data and settings.                                                         |
| `universo-react-profile-frontend`       | `@universo-react/profile-frontend`       | Frontend module for user profile pages and profile UX.                                              |
| `universo-react-schema-ddl`             | `@universo-react/schema-ddl`             | Runtime schema generation, migration, and diff utilities for PostgreSQL.                            |
| `universo-react-start-backend`          | `@universo-react/start-backend`          | Backend routes and services for onboarding and start flows.                                         |
| `universo-react-start-frontend`         | `@universo-react/start-frontend`         | Frontend onboarding wizard, cookie UX, and start-page helpers.                                      |
| `universo-react-api-client`             | `@universo-react/api-client`             | Shared TypeScript API client utilities for frontend packages.                                       |
| `universo-react-core-backend`           | `@universo-react/core-backend`           | Main backend server and runtime integration shell.                                                  |
| `universo-react-core-frontend`          | `@universo-react/core-frontend`          | Main React frontend shell that assembles shared and feature packages.                               |
| `universo-react-database`               | `@universo-react/database`               | Knex singleton, health checks, and executor factories.                                              |
| `universo-react-extension-sdk`          | `@universo-react/extension-sdk`          | Module SDK primitives for metahub extensions.                                                       |
| `universo-react-i18n`                   | `@universo-react/i18n`                   | Centralized i18n runtime and namespace registration utilities.                                      |
| `universo-react-migrations-catalog`     | `@universo-react/migrations-catalog`     | Catalog storage for migration history and definition registry artifacts.                            |
| `universo-react-migrations-core`        | `@universo-react/migrations-core`        | Core migration runtime, identifiers, validation, and execution helpers.                             |
| `universo-react-migrations-platform`    | `@universo-react/migrations-platform`    | Platform-wide migration registry, planning, diff, export, and CLI entry points.                     |
| `universo-react-metapanel-frontend`     | `@universo-react/metapanel-frontend`     | Authenticated metapanel dashboard frontend module.                                                  |
| `universo-react-modules-engine`         | `@universo-react/modules-engine`         | Compiler and runtime host for metahub modules.                                                      |
| `universo-react-rest-docs`              | `@universo-react/rest-docs`              | Modular OpenAPI and Swagger documentation server.                                                   |
| `universo-react-store`                  | `@universo-react/store`                  | Shared Redux and ability-helper package used by the current frontend shell.                         |
| `universo-react-template-mui`           | `@universo-react/template-mui`           | Shared MUI template components used by the React shell and feature modules.                         |
| `universo-react-types`                  | `@universo-react/types`                  | Shared TypeScript domain types and cross-package interfaces.                                        |
| `universo-react-utils`                  | `@universo-react/utils`                  | Shared validators, serialization helpers, and backend/frontend utilities.                           |

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
