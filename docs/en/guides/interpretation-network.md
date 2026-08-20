---
description: Conceptual overview and entry point for the Interpretation Network documentation.
---

# Interpretation Network

The **Interpretation Network** template adds a published application workspace for hierarchical concept matrices, typed interpretations, relations, materials, and reusable Matrix templates.

For the complete user workflow, use the dedicated GitBook guide:

-   [Interpretation Network User Guide](../interpretation-network/README.md)
-   [Getting Started](../interpretation-network/getting-started.md)
-   [Create And Publish](../interpretation-network/create-and-publish.md)
-   [Application Settings](../interpretation-network/application-settings.md)
-   [Workspace And Matrix](../interpretation-network/workspace-and-matrix.md)
-   [Cells And Materials](../interpretation-network/cells-and-materials.md)
-   [Templates](../interpretation-network/templates.md)
-   [Troubleshooting](../interpretation-network/troubleshooting.md)

## What It Provides

-   A predefined **Structure / Interpretation / Relation / Material** application model.
-   A Matrix workspace with one-system and multiple-Structure modes.
-   Peer Matrix views for table, horizontal hierarchy, and vertical hierarchy.
-   Materials attached to selected cells.
-   Workspace-scoped templates for reusing Matrix structures.
-   Application Settings controls for deployment-specific Matrix behavior.

## Operational Contract

Fixture updates are generated through Playwright and checked by contract scripts. The canonical snapshot provides the application model and start workspace; users author their own Structures, Matrix cells, Materials, and templates in the published application.

Use these checks when working on the feature:

```bash
pnpm run check:interpretation-network-fixture-contract
pnpm run docs:interpretation-network:check
pnpm run test:e2e:interpretation-network:verify:local-supabase
```

## Related Documentation

-   [Interpretation Network data model](../architecture/interpretation-network-data-model.md)
-   [Application layouts](application-layouts.md)
-   [Snapshot Export & Import](snapshot-export-import.md)
-   [Runtime UI UX Quality Gate](../contributing/runtime-ui-ux-quality-gate.md)
