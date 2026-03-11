---
description: Explain how the PNPM monorepo is organized.
---

# Monorepo Structure

The workspace uses PNPM workspaces and Turborepo. Most packages follow the
`packages/<name>/base` layout, while a small number of package roots such as
`packages/apps-template-mui` or `packages/universo-rest-docs` live without a
nested `base` layer.

## Main Package Groups

- Core shell packages: `@universo/core-backend`, `@universo/core-frontend`.
- Feature packages: auth, start, profile, metahubs, applications, admin.
- Infrastructure packages: database, schema-ddl, migrations, types, utils, i18n.
- UI support packages: template-mui, apps-template-mui, store.
- Documentation packages: rest-docs and the GitBook source under `docs/`.

## Cross-Package Rules

Use workspace package names for imports across package boundaries and run PNPM
commands from the repository root.
