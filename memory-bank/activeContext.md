# Active Context

> **Last Updated**: 2026-01-11
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

---

## Current Focus: QA Fixes Complete (2026-01-11)

**Just Completed**:
- **Catalog Deletion Bug**: Added direct DELETE endpoint for catalogs without hub association
  - New endpoint: `DELETE /metahubs/:metahubId/catalogs/:catalogId`
  - Frontend API + mutation updated to handle optional hubId
- **SQL Injection Fix**: escapeLikeWildcards applied to loadMembers in campaigns/clusters backends
- **getRequestManager Centralization**: Removed 19 local definitions across 8 backend packages
  - All route handlers now import from `../utils` → `@universo/utils/database`
  - admin-backend tsconfig updated to moduleResolution: node16
- Full monorepo build: SUCCESS (61 tasks)

**Files Changed Summary**:
- `packages/metahubs-backend/base/src/routes/catalogsRoutes.ts` — new DELETE endpoint
- `packages/metahubs-frontend/base/src/api/catalogs.ts` — deleteCatalogDirect function
- `packages/metahubs-frontend/base/src/hooks/mutations.ts` — optional hubId
- `packages/metahubs-frontend/base/src/pages/CatalogList.tsx` — updated deleteEntity
- `packages/campaigns-backend/base/src/routes/campaignsRoutes.ts` — escapeLikeWildcards
- `packages/clusters-backend/base/src/routes/clustersRoutes.ts` — escapeLikeWildcards
- 8 backend packages: parserUtils.ts updated with getRequestManager re-export
- 19 route files: local getRequestManager replaced with import

**Next Steps**:
- [ ] Manual QA: delete catalog without hubs — confirm it works
- [ ] Manual QA: test search with special characters (%, _) — confirm escaping
- [ ] Consider QA mode for comprehensive verification

---

## Session Notes

### Data Model (Current State)

```
Hub (container for domain-specific data)
  └── CatalogHub (junction table for N:M relationship)
        └── Catalog (reusable data structure, with isRequiredHub/isSingleHub flags)
              ├── Attribute (field definitions)
              └── Record (data entries)
```

### Key Routes (Catalog-Centric)

- `/metahub/:id/catalogs` — Global catalog list
- `/metahub/:id/catalogs/:catalogId/attributes` — Attributes for catalog
- `/metahub/:id/catalogs/:catalogId/records` — Records for catalog
- `/metahub/:id/hub/:hubId/catalogs` — Hub-scoped catalog list
