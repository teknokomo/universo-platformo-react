# @universo-react/types

> 🔧 Core protocol and ECS domain types for Universo Platformo

## Package Information

| Field            | Value                                 |
| ---------------- | ------------------------------------- |
| **Package Name** | `@universo-react/types`               |
| **Version**      | See `package.json`                    |
| **Type**         | TypeScript-first (Types & Interfaces) |
| **Build**        | ES module with type definitions       |
| **Purpose**      | Core protocol and ECS domain types    |

## 🚀 Key Features

-   🔧 **ECS Components** - Entity-Component-System type system
-   🌐 **Networking DTO** - Intent/Ack/Snapshot/Delta/Event protocols
-   ❌ **Error Codes** - Standardized error code definitions
-   📦 **Protocol Versioning** - Protocol version control
-   📋 **Strict Typing** - Full TypeScript support
-   🔄 **Backward Compatibility** - Version compatibility preservation
-   🧾 **Record Behavior Types** - Shared Object numbering, lifecycle, and posting contracts
-   📊 **Ledger Types** - Shared append-only Ledger configuration, field roles, source policies, and projections
-   🎓 **LMS Platform Primitives** - Generic resource, Learning Content project/reference, sequence, workflow action, role policy, report definition, union datasource, and acceptance-matrix contracts
-   🧭 **Interpretation Network Layout Contract** - Shared peer Matrix views, allowed/default settings, coherence validation, and boundary normalization for the metahub, Application control panel, and published runtime

## Description

Base protocol types and ECS domain types for Universo Platformo.

### Scope:

-   ECS components
-   Networking DTO (Intent/Ack/Snapshot/Delta/Event)
-   Error codes
-   Protocol version
-   Metahub entity component manifests
-   Object `recordBehavior` and Ledger configuration contracts
-   Generic LMS-like platform primitives that remain reusable outside LMS configurations, including workspace-authored Learning Content references, projects, sharing, recents, stars, trash, course/track policies, player presets, and column presets
-   Strict `interpretationNetworkWorkspace` layout configuration, including `matrixMode`, `allowedMatrixViews`, and `defaultMatrixView`

### Out of scope:

-   UPDL design-time types
-   Publication types (kept in their respective packages)

## Compatibility Rules

-   **Do not rename** existing fields or change their semantics
-   **Only add new fields** as optional to preserve backward compatibility
-   **Extend** component and event unions by adding new keys

## Object And Ledger Contracts

`common/recordBehavior` defines the shared metadata contract that turns a standard Object into a reference, transactional, or hybrid collection.
It covers identity fields, atomic numbering, effective dates, lifecycle states, posting target ledgers, and posted-row immutability.

`common/ledgers` defines the standard Ledger configuration.
The code-facing kind is `ledger`; the Russian UI label is "Регистры".
Ledgers classify ordinary field definitions through `fieldRoles` and use source policies to distinguish manual writes from registrar-owned posting writes.

## Interpretation Network Matrix View Contract

`common/applicationLayouts` is the authoritative cross-package contract for the `interpretationNetworkWorkspace` widget:

-   `matrixMode` describes data semantics: `hierarchicalCells` or `independentRows`.
-   `allowedMatrixViews` is a non-empty subset of the peer views `table`, `horizontalRows`, and `verticalTree`.
-   `defaultMatrixView` must be present in the allowed set.
-   `tableProjection` is `hierarchicalPath` by default and may be changed to `independentAxes` for the secondary row/column table.
-   `breadcrumbDepth` defaults to the full path; finite `last` depth is restricted to the shared allowlist.
-   `toolbarLayout` defaults to `horizontal`; `vertical` is an opt-in display setting.
-   `showHierarchicalTableHeaders` defaults to `false`; the hierarchical-path table can show the current-level/cell column headers only when enabled explicitly.
-   `showHierarchicalTableHeaderCard` defaults to `true`; the focused parent cell stays as a separated card above the row table before moving into breadcrumbs.
-   `colorBreadcrumbsByCell` defaults to `true`; breadcrumb boxes use the same configured cell fill color while preserving a distinct hover/focus treatment.
-   `verticalTree` is rejected for `independentRows`; `table` and `horizontalRows` remain compatible.
-   `normalizeInterpretationNetworkMatrixViewSettings()` is used at UI and runtime boundaries for untrusted or incomplete values; persisted widget configuration is validated by the strict Zod schema.
-   `normalizeInterpretationNetworkTableSettings()` repairs table projection, breadcrumb depth, toolbar layout, optional headers, the focused parent card, total tree-cell counter, and breadcrumb coloring consistently across template, Application Settings, and runtime parsing.

This contract changes widget configuration only. It does not add a database schema migration or require a metahub template version bump.

## Install (workspace)

This package lives at `packages/universo-react-types` and is consumed via `workspace:*` by other packages in the monorepo.

## Testing

Run the type-level regression tests with Vitest:

```bash
pnpm --filter @universo-react/types test
```

## Contributing

When contributing to this package:

1. Follow TypeScript best practices and maintain strict typing
2. Document all exported types with JSDoc comments
3. Ensure type definitions match backend schemas
4. Update both EN and RU documentation
5. Follow the project's coding standards
6. Add tests for complex type guards and utilities

## Related Documentation

-   [Main package index](../../README.md)
-   [Core Backend](../universo-react-core-backend/README.md)
-   [Core Frontend](../universo-react-core-frontend/README.md)
-   [TypeScript Documentation](https://www.typescriptlang.org/docs/)

## License

Omsk Open License

---

_Universo Platformo | Types Package_
