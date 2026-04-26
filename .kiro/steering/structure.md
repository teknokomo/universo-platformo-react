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
│   ├── */base/            # Most packages use base/ subdirectory
│   └── README.md          # Package documentation
├── docs/                  # Documentation (en/es/ru)
├── docker/                # Docker configurations
├── memory-bank/           # Project context and progress tracking
├── tools/                 # Build and testing utilities
└── .kiro/                 # Kiro IDE configuration and steering rules
```

## Package Categories

### Core Shell Packages

| Package | Role |
|---------|------|
| `universo-core-backend` | Main backend server and runtime integration shell |
| `universo-core-frontend` | Main React frontend shell that assembles feature packages |

### Feature Modules

| Package | Role |
|---------|------|
| `metahubs-backend` | Backend for metahubs, branches, publications, and domain flows |
| `metahubs-frontend` | Frontend module for metahub management interfaces |
| `applications-backend` | Backend for application entities, memberships, and publications |
| `applications-frontend` | Frontend module for application management views |
| `admin-backend` | Backend routes for platform-wide administration |
| `admin-frontend` | Frontend module for admin pages and UI flows |
| `auth-backend` | Passport and Supabase-based authentication toolkit |
| `auth-frontend` | Shared authentication UI primitives and session helpers |
| `profile-backend` | Backend for user profile data and settings |
| `profile-frontend` | Frontend module for user profile pages |
| `start-backend` | Backend routes for onboarding and start flows |
| `start-frontend` | Frontend onboarding wizard and start-page helpers |

### Infrastructure Packages

| Package | Role |
|---------|------|
| `universo-database` | Knex singleton, health checks, and executor factories |
| `schema-ddl` | Runtime schema generation, migration, and diff utilities |
| `universo-types` | Shared TypeScript domain types and interfaces |
| `universo-utils` | Shared validators, serialization helpers, and utilities |
| `universo-i18n` | Centralized i18n runtime and namespace registration |
| `universo-api-client` | Shared TypeScript API client utilities |
| `universo-migrations-core` | Core migration runtime and execution helpers |
| `universo-migrations-catalog` | Catalog storage for migration history |
| `universo-migrations-platform` | Platform-wide migration registry and CLI |
| `migration-guard-shared` | Shared migration-status helpers and guard components |

### UI Support Packages

| Package | Role |
|---------|------|
| `universo-template-mui` | Shared MUI template components for React shell |
| `apps-template-mui` | Shared MUI application scaffolding for frontend packages |
| `universo-store` | Shared Redux and ability-helper package |
| `metapanel-frontend` | Metapanel frontend module |

### Scripting & Extensions

| Package | Role |
|---------|------|
| `scripting-engine` | Server-side scripting with isolated-vm |
| `extension-sdk` | SDK for building extensions |

### Documentation

| Package | Role |
|---------|------|
| `universo-rest-docs` | Modular OpenAPI and Swagger documentation server |

## Package Structure Convention

Most packages follow this structure:

```
packages/{package-name}/
└── base/                 # Core functionality
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
    ├── package.json      # Dependencies and scripts
    ├── tsconfig.json     # TypeScript config
    └── README.md         # Package documentation
```

**Exceptions:**
- `apps-template-mui` and `universo-rest-docs` are package roots without a `base/` layer

## Workspace Configuration

- **pnpm-workspace.yaml**: Defines workspace packages
- **turbo.json**: Build pipeline configuration
- **package.json**: Root dependencies and scripts

## Key Conventions

- Use `pnpm` not `npm`
- Frontend apps end with `-frontend`, backend with `-backend`
- Most packages use `packages/*/base/` structure
- Cross-package imports use workspace package names (e.g., `@universo/types`)
- Never use relative paths (`../`) to import across package boundaries

## Integration Points

- Apps integrate with the main shell via workspace dependencies
- Backend packages export as `@universo/{package-name}`
- Frontend packages integrate into main UI via dynamic imports
- Shared types are centralized in `@universo/types`

## Development Workflow

1. Work in individual package directories
2. Use `pnpm --filter {package-name} dev` for development
3. Build specific packages with `pnpm --filter {package-name} build`
4. Root `pnpm build` builds entire workspace
5. Run linting with `pnpm --filter {package-name} lint`
