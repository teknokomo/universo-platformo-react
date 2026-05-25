---
description: Explain how the PNPM monorepo is organized.
---

# Monorepo Structure

The workspace uses PNPM workspaces and Turborepo. Active React packages follow
the flat `packages/universo-react-<name>/package.json` layout, use matching
`@universo-react/<name>` package names, and are discovered with the single
`packages/*` workspace glob.

## Main Package Groups

-   Core shell packages: `@universo-react/core-backend`, `@universo-react/core-frontend`.
-   Feature packages: auth, start, profile, metahubs, applications, admin.
-   Infrastructure packages: database, schema-ddl, migrations, types, utils, i18n.
-   UI support packages: template-mui, apps-template-mui, store.
-   Documentation packages: rest-docs and the GitBook source under `docs/`.

## Cross-Package Rules

Use workspace package names for imports across package boundaries and run PNPM
commands from the repository root.
