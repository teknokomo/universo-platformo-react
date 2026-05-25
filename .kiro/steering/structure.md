---
inclusion: always
---

# Project Structure

## Monorepo Architecture

This is a PNPM workspace with Turbo build orchestration. The project extends an inherited upstream shell with modular applications and shared infrastructure packages.

## Root Structure

```
universo-platformo-react/
├── packages/              # All workspace packages
│   ├── */                 # Flat workspace packages
│   └── README.md          # Package documentation
├── docs/                  # Documentation (en/es/ru)
├── docker/                # Docker configurations
├── memory-bank/           # Project context and progress tracking
├── tools/                 # Build and testing utilities
└── .kiro/                 # Kiro IDE configuration and steering rules
```

## Package Categories

### Core Shell Packages

| Package                        | Role                                                      |
| ------------------------------ | --------------------------------------------------------- |
| `universo-react-core-backend`  | Main backend server and runtime integration shell         |
| `universo-react-core-frontend` | Main React frontend shell that assembles feature packages |

### Feature Modules

| Package                                | Role                                                            |
| -------------------------------------- | --------------------------------------------------------------- |
| `universo-react-metahubs-backend`      | Backend for metahubs, branches, publications, and domain flows  |
| `universo-react-metahubs-frontend`     | Frontend module for metahub management interfaces               |
| `universo-react-applications-backend`  | Backend for application entities, memberships, and publications |
| `universo-react-applications-frontend` | Frontend module for application management views                |
| `universo-react-admin-backend`         | Backend routes for platform-wide administration                 |
| `universo-react-admin-frontend`        | Frontend module for admin pages and UI flows                    |
| `universo-react-auth-backend`          | Passport and Supabase-based authentication toolkit              |
| `universo-react-auth-frontend`         | Shared authentication UI primitives and session helpers         |
| `universo-react-profile-backend`       | Backend for user profile data and settings                      |
| `universo-react-profile-frontend`      | Frontend module for user profile pages                          |
| `universo-react-start-backend`         | Backend routes for onboarding and start flows                   |
| `universo-react-start-frontend`        | Frontend onboarding wizard and start-page helpers               |

### Infrastructure Packages

| Package                                 | Role                                                     |
| --------------------------------------- | -------------------------------------------------------- |
| `universo-react-database`               | Knex singleton, health checks, and executor factories    |
| `universo-react-schema-ddl`             | Runtime schema generation, migration, and diff utilities |
| `universo-react-types`                  | Shared TypeScript domain types and interfaces            |
| `universo-react-utils`                  | Shared validators, serialization helpers, and utilities  |
| `universo-react-i18n`                   | Centralized i18n runtime and namespace registration      |
| `universo-react-api-client`             | Shared TypeScript API client utilities                   |
| `universo-react-migrations-core`        | Core migration runtime and execution helpers             |
| `universo-react-migrations-catalog`     | Catalog storage for migration history                    |
| `universo-react-migrations-platform`    | Platform-wide migration registry and CLI                 |
| `universo-react-migration-guard-shared` | Shared migration-status helpers and guard components     |

### UI Support Packages

| Package                             | Role                                                     |
| ----------------------------------- | -------------------------------------------------------- |
| `universo-react-template-mui`       | Shared MUI template components for React shell           |
| `universo-react-apps-template-mui`  | Shared MUI application scaffolding for frontend packages |
| `universo-react-store`              | Shared Redux and ability-helper package                  |
| `universo-react-metapanel-frontend` | Metapanel frontend module                                |

### Modules & Extensions

| Package                         | Role                                 |
| ------------------------------- | ------------------------------------ |
| `universo-react-modules-engine` | Server-side modules with isolated-vm |
| `universo-react-extension-sdk`  | SDK for building extensions          |

### Documentation

| Package                    | Role                                             |
| -------------------------- | ------------------------------------------------ |
| `universo-react-rest-docs` | Modular OpenAPI and Swagger documentation server |

## Package Structure Convention

Workspace packages follow this structure:

```
packages/{package-name}/
├── src/              # Source code
│   ├── api/          # API clients (frontend)
│   ├── components/   # React components (frontend)
│   ├── controllers/  # Express controllers (backend)
│   ├── domains/      # Domain modules
│   ├── i18n/         # Internationalization
│   ├── routes/       # Express routes (backend)
│   ├── services/     # Business logic (backend)
│   └── index.ts      # Entry point
├── dist/             # Compiled output
├── package.json      # Dependencies and modules
├── tsconfig.json     # TypeScript config
└── README.md         # Package documentation
```

All active workspace packages use the flat `packages/universo-react-<name>/package.json` layout.

## Package Naming Convention

All active React workspace packages use the same directory and npm naming scheme:

-   **Directory**: `packages/universo-react-<name>/`
-   **npm package name**: `@universo-react/<name>`

When a legacy package directory already had a `universo-` prefix, the prefix is
replaced rather than stacked. In other words, a legacy
`packages/universo-<name>/` directory becomes `packages/universo-react-<name>/`,
and the package moves to `@universo-react/<name>` without adding `universo-` to
the package name.

Do not add compatibility aliases, symlink packages, or re-export packages under
the old scope. Cross-package imports must use the package name from the target
package's `package.json`.

## Workspace Configuration

-   **pnpm-workspace.yaml**: Defines workspace packages
-   **turbo.json**: Build pipeline configuration
-   **package.json**: Root dependencies and modules

## Key Conventions

-   Use `pnpm` not `npm`
-   Frontend apps end with `-frontend`, backend with `-backend`
-   All active packages use `packages/universo-react-*/` structure
-   Cross-package imports use workspace package names (e.g., `@universo-react/types`)
-   Never use relative paths (`../`) to import across package boundaries

## Integration Points

-   Apps integrate with the main shell via workspace dependencies
-   Backend packages export as `@universo-react/{package-name}`
-   Frontend packages integrate into main UI via dynamic imports
-   Shared types are centralized in `@universo-react/types`

## Development Workflow

1. Work in individual package directories
2. Use `pnpm --filter {package-name} dev` for development
3. Build specific packages with `pnpm --filter {package-name} build`
4. Root `pnpm build` builds entire workspace
5. Run linting with `pnpm --filter {package-name} lint`
