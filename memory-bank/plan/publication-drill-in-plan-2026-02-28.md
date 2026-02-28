# Plan: Publications Drill-In Navigation & Create Dialog Rework

Date: 2026-02-28
Mode: PLAN (no implementation)
Complexity: Level 4 (Major)

> Key constraint: No legacy compatibility required, test DB will be recreated fresh.

---

## 1. Overview

Transform Publications from a flat list + modal-edit pattern into a **drill-in navigation** pattern (mirroring Catalogs). Inside a Publication, users will see two tabs: **Versions** and **Applications**. The create dialog is reworked to 2 tabs: **General** (with collapsible spoilers for version/application settings) and **Access**. A new option "Create application schema" is added.

**Current state:** PublicationList → click → opens EntityFormDialog (edit mode) with 4 tabs (General, Versions, Access, Applications). Versions and Applications are embedded tabs inside the dialog.

**Target state:** PublicationList → click → **navigates** to `/publication/:publicationId/versions` → inner view with 2 tabs (Versions, Applications), each showing a standalone list. Create dialog has 2 tabs with Collapse spoilers.

---

## 2. Analysis: Dependencies & Risks

### 2.1 Confirmed architectural constraints

- `@universo/metahubs-backend` depends on `@universo/applications-backend` (not reverse) → Connector/Application/ConnectorPublication entities can be used from publications routes.
- Publication CREATE handler already creates Application + Connector inside transaction.
- Schema sync is done lazily via `POST /application/:applicationId/sync` (separate route in applicationSyncRoutes.ts).
- The new "Create application schema" option will need to either:
  - (a) Call generateFullSchema in the same handler (preferred — avoids extra HTTP call) or
  - (b) Trigger sync via frontend after creation
- **Decision: Option (a)** — call DDL inline since snapshot is already available in scope.
- **IMPORTANT (QA fix):** DDL (`generateFullSchema`) uses Knex (separate connection pool) and **must NOT** run inside the TypeORM transaction to avoid deadlocks. The transaction returns all needed data, then DDL runs in a separate try/catch block **after** `ds.transaction()` commits.
- **IMPORTANT (QA fix):** The application-creation logic (Application + ApplicationUser + Connector + ConnectorPublication) must be extracted into a shared helper `createLinkedApplication(opts)` before adding the new endpoint, to avoid code duplication between the CREATE handler and the new POST .../applications endpoint.

### 2.2 Pattern to replicate: Catalog → AttributeList / ElementList

- CatalogList uses `navigate()` + `getRowLink` to drill into `/catalog/:catalogId/attributes`
- AttributeList and ElementList show hardcoded `<Tabs>` with mirror navigation:
  - AttributeList: `value='attributes'`, navigates to `/elements` on tab change
  - ElementList: `value='elements'`, navigates to `/attributes` on tab change
- Each "inner page" is a standalone React component with its own route, query hooks, create dialog
- Back navigation via sidebar menu / browser history (no explicit back button)

### 2.3 Spoiler/Collapse pattern (from AttributeFormFields)

- Uses MUI `<Collapse>` component (NOT `<Accordion>`)
- Clickable `<Box>` header with `ExpandMoreIcon`/`ExpandLessIcon`
- `useState(false)` — collapsed by default
- Content rendered inside `<Collapse in={isOpen}>` with `pl: 2` padding

### 2.4 Files to delete (legacy)

After implementing new pattern, remove:
- `VersionsPanel.tsx` (replaced by standalone VersionList)
- `ApplicationsPanel.tsx` (replaced by standalone PublicationApplicationList)
- `ApplicationsCreatePanel.tsx` (moved into create dialog inline)

### 2.5 Database schema — no DDL changes needed

Existing tables `metahubs.publications`, `metahubs.publications_versions`, `applications.connectors`, `applications.connectors_publications` are sufficient. Only the backend Zod schema needs a new optional field `createApplicationSchema: boolean`.

---

## 3. Affected Areas

### Frontend packages:
| Package | Changes |
|---------|---------|
| `metahubs-frontend` | Major: new VersionList, PublicationApplicationList components; refactored PublicationList, PublicationActions; new API functions, hooks, mutations; deleted panels; i18n keys |
| `universo-template-mui` | New routes in MainRoutesMUI.tsx for `/publication/:publicationId/versions` and `/publication/:publicationId/applications` |

### Backend packages:
| Package | Changes |
|---------|---------|
| `metahubs-backend` | Extended createPublicationSchema (new `createApplicationSchema` field), new endpoint `POST .../publication/:publicationId/applications` for creating app through publication, inline schema generation when `createApplicationSchema=true` |
| `applications-backend` | Possible: extract sync-core into a reusable function (optional; can be done via direct DDL call instead) |
| `schema-ddl` | No changes needed |

### Shared packages:
| Package | Changes |
|---------|---------|
| `universo-types` | Optional: add shared Publication/PublicationVersion interfaces (currently local) |
| `universo-i18n` | No changes (publication i18n stays in metahubs namespace) |

---

## 4. Plan Steps

### Phase R1: Backend — Extract helper, new endpoint, createApplicationSchema option

**R1.0** Extract `createLinkedApplication()` helper function **(QA fix — must be done first)**

Extract the application-creation logic (lines ~486-560 of publicationsRoutes.ts) into a reusable helper:

File: `packages/metahubs-backend/base/src/domains/publications/helpers/createLinkedApplication.ts`

```typescript
import { EntityManager } from 'typeorm'
import { Application, ApplicationUser, Connector, ConnectorPublication } from '../../...' // entities
import { generateSchemaName } from '../../ddl'
import type { VersionedLocalizedContent } from '@universo/types'

interface CreateLinkedApplicationOpts {
    manager: EntityManager
    publicationId: string
    publicationName: VersionedLocalizedContent<string> | null
    publicationDescription?: VersionedLocalizedContent<string> | null
    metahubName: VersionedLocalizedContent<string> | null
    metahubDescription?: VersionedLocalizedContent<string> | null
    userId: string
}

interface CreateLinkedApplicationResult {
    application: Application
    connector: Connector
    connectorPublication: ConnectorPublication
    appSchemaName: string
}

export async function createLinkedApplication(opts: CreateLinkedApplicationOpts): Promise<CreateLinkedApplicationResult> {
    const { manager, publicationId, publicationName, publicationDescription, metahubName, metahubDescription, userId } = opts

    const applicationRepo = manager.getRepository(Application)
    const appUserRepo = manager.getRepository(ApplicationUser)
    const connectorRepo = manager.getRepository(Connector)
    const connectorPublicationRepo = manager.getRepository(ConnectorPublication)

    // 1. Create Application
    const application = applicationRepo.create({
        name: publicationName!,
        description: publicationDescription ?? undefined,
        slug: `pub-${publicationId.slice(0, 8)}`,
        _uplCreatedBy: userId,
        _uplUpdatedBy: userId
    })
    await applicationRepo.save(application)

    // 2. Set schemaName using raw update to avoid version increment
    const appSchemaName = generateSchemaName(application.id)
    application.schemaName = appSchemaName
    await applicationRepo.createQueryBuilder()
        .update(Application).set({ schemaName: appSchemaName })
        .where('id = :id', { id: application.id }).execute()

    // 3. Create ApplicationUser (owner)
    const appUser = appUserRepo.create({
        applicationId: application.id, userId, role: 'owner',
        _uplCreatedBy: userId, _uplUpdatedBy: userId
    })
    await appUserRepo.save(appUser)

    // 4. Create Connector
    const connector = connectorRepo.create({
        applicationId: application.id,
        name: metahubName, description: metahubDescription ?? undefined,
        sortOrder: 0, _uplCreatedBy: userId, _uplUpdatedBy: userId
    })
    await connectorRepo.save(connector)

    // 5. Create ConnectorPublication
    const connectorPublication = connectorPublicationRepo.create({
        connectorId: connector.id, publicationId,
        sortOrder: 0, _uplCreatedBy: userId, _uplUpdatedBy: userId
    })
    await connectorPublicationRepo.save(connectorPublication)

    return { application, connector, connectorPublication, appSchemaName }
}
```

Then **refactor the existing CREATE handler** (lines ~486-560) to call `createLinkedApplication()` instead of inline code.

**R1.1** Add `createApplicationSchema` field to `createPublicationSchema` Zod schema

```typescript
// publicationsRoutes.ts — Zod schema
const createPublicationSchema = z.object({
    // ... existing fields ...
    autoCreateApplication: z.boolean().optional().default(false),
    createApplicationSchema: z.boolean().optional().default(false),  // NEW
    // ... version fields ...
})
```

**R1.2** Implement schema generation **AFTER transaction** in CREATE handler **(QA fix)**

The DDL generation uses Knex (separate connection pool) and **must not run inside** the TypeORM transaction. Restructure the CREATE handler:

```typescript
// 1. Transaction returns all data needed for DDL
const result = await ds.transaction(async (manager) => {
    // ... existing publication + version creation ...
    let applicationData: { application: Application; appSchemaName: string } | null = null

    if (autoCreateApplication && metahub) {
        const linked = await createLinkedApplication({
            manager, publicationId: publication.id,
            publicationName: publication.name, publicationDescription: publication.description,
            metahubName: metahub.name, metahubDescription: metahub.description,
            userId
        })
        applicationData = { application: linked.application, appSchemaName: linked.appSchemaName }
    }

    // ... create first version ...

    return { publication, firstVersion, applicationData, snapshot, snapshotHash }
})

// 2. DDL generation OUTSIDE transaction (QA fix: avoids Knex/TypeORM deadlock)
if (createApplicationSchema && result.applicationData) {
    try {
        const { generator, migrationManager } = getDDLServices()
        const serializer = new SnapshotSerializer(objectsService, attributesService)
        const catalogDefs = serializer.deserializeSnapshot(result.snapshot)

        const genResult = await generator.generateFullSchema(
            result.applicationData.appSchemaName,
            catalogDefs,
            {
                recordMigration: true,
                migrationDescription: 'initial_schema_from_publication',
                migrationManager,
                migrationMeta: {
                    publicationSnapshotHash: result.snapshotHash,
                    publicationId: result.publication.id,
                    publicationVersionId: result.firstVersion.id
                }
            }
        )

        if (genResult.success) {
            const applicationRepo = ds.getRepository(Application)
            await applicationRepo.createQueryBuilder()
                .update(Application)
                .set({
                    schemaStatus: ApplicationSchemaStatus.SYNCED,
                    schemaSyncedAt: new Date(),
                    schemaSnapshot: generator.generateSnapshot(catalogDefs),
                    appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
                    lastSyncedPublicationVersionId: result.firstVersion.id,
                    _uplUpdatedBy: userId
                })
                .where('id = :id', { id: result.applicationData.application.id })
                .execute()
        }
        // If genResult is not successful, application exists with schemaStatus=DRAFT
        // User can trigger sync manually later
    } catch (ddlError) {
        // Non-fatal: publication + application created successfully,
        // but schema not generated. Log and continue.
        console.error('DDL schema generation failed (non-fatal):', ddlError)
    }
}
```

**R1.3** Add new endpoint: `POST /metahub/:metahubId/publication/:publicationId/applications`

This endpoint reuses `createLinkedApplication()` (extracted in R1.0):

```typescript
router.post('/metahub/:metahubId/publication/:publicationId/applications', async (req, res) => {
    // Zod schema: { name, description, namePrimaryLocale, descriptionPrimaryLocale, createApplicationSchema }
    // 1. Validate publication belongs to metahub
    // 2. Get active version snapshot (for DDL if requested)
    // 3. Transaction: createLinkedApplication()
    // 4. AFTER transaction: if createApplicationSchema, run generateFullSchema
    //    (same pattern as R1.2 — DDL outside transaction)
    // 5. Return { application, connector }
})
```

> **Note:** The same DDL-after-transaction pattern from R1.2 applies here.
> TODO: Consider propagating publication's `accessMode` to the application in future versions.

**R1.4** Build & validate backend

```bash
pnpm build --filter metahubs-backend
```

---

### Phase R2: Frontend — New drill-in routes & lazy imports

**R2.1** Add new routes in `MainRoutesMUI.tsx`

Add inside the `metahub/:metahubId` route group, after existing publication route:

```tsx
// Lazy imports (named re-export pattern from @universo/metahubs-frontend)
const PublicationVersionList = Loadable(
    lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.PublicationVersionList })))
)
const PublicationApplicationList = Loadable(
    lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.PublicationApplicationList })))
)

// Routes — add after the /publications route:
{ path: 'publication/:publicationId/versions', element: <PublicationVersionList /> },
{ path: 'publication/:publicationId/applications', element: <PublicationApplicationList /> },
```

**R2.2** Export new components from `metahubs-frontend/index.ts`

```typescript
export { PublicationVersionList } from './domains/publications/ui/PublicationVersionList'
export { PublicationApplicationList } from './domains/publications/ui/PublicationApplicationList'
```

---

### Phase R3: Frontend — Copy & Refactor → PublicationVersionList

**Strategy:** MANDATORY file copy approach — copy `AttributeList.tsx` as the shell (tabs + ViewHeader + FlowListTable), then refactor the domain-specific parts to use version data from `VersionsPanel.tsx`.

**R3.0** Copy source files **(MANDATORY — must be executed as shell commands)** (QA fix)

```bash
# Step 1: Copy AttributeList as the base shell for PublicationVersionList
cp packages/metahubs-frontend/base/src/domains/attributes/ui/AttributeList.tsx \
   packages/metahubs-frontend/base/src/domains/publications/ui/PublicationVersionList.tsx

# Step 2: Copy VersionsPanel as reference for version-specific logic (keep as reference, delete later)
cp packages/metahubs-frontend/base/src/domains/publications/ui/VersionsPanel.tsx \
   packages/metahubs-frontend/base/src/domains/publications/ui/VersionsPanel.ref.tsx
```

**R3.0.1** Refactor `PublicationVersionList.tsx` — systematic replacement checklist:
- [ ] Rename component: `AttributeList` → `PublicationVersionList`
- [ ] Replace params: `{ metahubId, hubId, catalogId }` → `{ metahubId, publicationId }`
- [ ] Replace tab logic: `handleCatalogTabChange('attributes'/'elements')` → `handlePublicationTabChange('versions'/'applications')`
- [ ] Replace tab values: `value='attributes'` → `value='versions'`, tab labels → versions/applications
- [ ] Replace data queries: `useAttributes` → `usePublicationVersions` (new hook, R3.2)
- [ ] Replace mutations: attribute mutations → version mutations (new, R3.3)
- [ ] Replace columns: attribute-specific columns → version columns (versionNumber, name, branch, date, status)
- [ ] Replace create dialog: attribute form → version create form (name, description, branch selector)
- [ ] Replace ViewHeader title: `t('attributes.title')` → `t('publications.versions.title')`
- [ ] Add publication name in header via `usePublicationDetails` hook (R3.2a)
- [ ] Remove all attribute-specific imports (AttributeFormFields, ChildAttributeList, etc.)
- [ ] Remove TABLE expand logic, drag-drop ordering, codename validation
- [ ] Add version-specific actions: Activate, Edit (using BaseEntityMenu)
- [ ] Delete reference file: `rm VersionsPanel.ref.tsx`

**R3.1** Final structure of `PublicationVersionList.tsx`

File: `packages/metahubs-frontend/base/src/domains/publications/ui/PublicationVersionList.tsx`

File: `packages/metahubs-frontend/base/src/domains/publications/ui/PublicationVersionList.tsx`

Structure:
```tsx
export const PublicationVersionList: React.FC = () => {
    const { metahubId, publicationId } = useParams<{ metahubId: string; publicationId: string }>()
    const navigate = useNavigate()
    const { t } = useTranslation(['metahubs', 'common'])
    const tc = useCommonTranslations()
    
    // Tabs — hardcoded to 'versions'
    const handlePublicationTabChange = (_event: unknown, nextTab: string) => {
        if (nextTab === 'applications') {
            navigate(`/metahub/${metahubId}/publication/${publicationId}/applications`)
        }
    }
    
    // Query: versions list
    const { data: versionsResponse, isLoading } = usePublicationVersions(metahubId!, publicationId!)
    
    // Mutations: create version, activate version, update version
    const createMutation = useCreatePublicationVersion()
    const activateMutation = useActivatePublicationVersion()
    const updateMutation = useUpdatePublicationVersion()
    
    // Create dialog state
    const [isDialogOpen, setDialogOpen] = useState(false)
    
    // Column definitions for FlowListTable
    const versionColumns = useMemo(() => [
        { id: 'version', label: t('publications.versions.list.version'), width: '15%', render: ... },
        { id: 'name', label: tc('table.name'), width: '35%' },
        { id: 'branch', label: t('publications.versions.branch'), width: '20%' },
        { id: 'createdAt', label: t('publications.versions.list.date'), width: '15%' },
        { id: 'status', label: t('publications.versions.list.status'), width: '15%' },
    ], [t, tc])
    
    return (
        <MainCard>
            <Tabs value='versions' onChange={handlePublicationTabChange}>
                <Tab value='versions' label={t('publications.versions.title')} />
                <Tab value='applications' label={t('publications.applications.title')} />
            </Tabs>
            
            <ViewHeader title={t('publications.versions.title')}>
                <ToolbarControls primaryAction={{ label: tc('create'), onClick: () => setDialogOpen(true) }} />
            </ViewHeader>
            
            {/* Loading / Empty / Table with versions */}
            <FlowListTable data={...} customColumns={versionColumns} />
            
            {/* Create Version Dialog */}
            <EntityFormDialog
                open={isDialogOpen}
                hideDefaultFields
                tabs={buildCreateVersionTabs}
                onSave={handleCreateVersion}
            />
            
            {/* Activate Confirmation Dialog */}
            {/* Edit Version Dialog */}
        </MainCard>
    )
}
```

**R3.2** Create version-specific query hooks

File: `packages/metahubs-frontend/base/src/domains/publications/hooks/usePublicationVersions.ts`

```typescript
// Query: list versions
export function usePublicationVersions(metahubId: string, publicationId: string) {
    return useQuery({
        queryKey: metahubsQueryKeys.publicationVersionsList(metahubId, publicationId),
        queryFn: () => listPublicationVersions(metahubId, publicationId),
        staleTime: 30_000,
        enabled: Boolean(metahubId && publicationId)
    })
}
```

**R3.2a** Create `usePublicationDetails` hook **(QA fix — needed for inner view header context)**

Both PublicationVersionList and PublicationApplicationList need to show the publication name in the ViewHeader. The API function `getPublicationById` already exists in `publications.ts`.

File: `packages/metahubs-frontend/base/src/domains/publications/hooks/usePublicationDetails.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { metahubsQueryKeys } from '../../shared'
import { getPublicationById } from '../api'

export function usePublicationDetails(metahubId: string, publicationId: string) {
    return useQuery({
        queryKey: metahubsQueryKeys.publicationDetail(metahubId, publicationId),
        queryFn: () => getPublicationById(metahubId, publicationId),
        staleTime: 60_000,
        enabled: Boolean(metahubId && publicationId)
    })
}
```

Usage in both inner pages:
```tsx
const { data: publication } = usePublicationDetails(metahubId!, publicationId!)
const publicationName = publication ? getVLCString(publication.name, i18n.language) : ''

// In ViewHeader:
<ViewHeader title={`${publicationName} — ${t('publications.versions.title')}`}>
```

**R3.3** Create version-specific mutations

File: `packages/metahubs-frontend/base/src/domains/publications/hooks/versionMutations.ts`

```typescript
export function useCreatePublicationVersion() { ... }
export function useActivatePublicationVersion() { ... }
export function useUpdatePublicationVersion() { ... }
```

> **QA note (legacy key transition):** The existing `VersionsPanel.tsx` uses literal query keys `['publication-versions', publicationId]` instead of `metahubsQueryKeys`. New mutations must invalidate **both** the new key (`metahubsQueryKeys.publicationVersionsList(...)`) and the old literal key (`['publication-versions', publicationId]`) to avoid stale data during the transition period (R3 → R8). Once R8 deletes VersionsPanel, the old key invalidation can be removed.

**R3.4** Add version-specific API functions

File: `packages/metahubs-frontend/base/src/domains/publications/api/publicationVersions.ts`

```typescript
export const listPublicationVersions = async (metahubId: string, publicationId: string) => { ... }
export const createPublicationVersion = async (metahubId: string, publicationId: string, payload: CreateVersionPayload) => { ... }
export const updatePublicationVersion = async (metahubId: string, publicationId: string, versionId: string, payload: UpdateVersionPayload) => { ... }
export const activatePublicationVersion = async (metahubId: string, publicationId: string, versionId: string) => { ... }
```

**R3.5** Add query keys for versions and applications

In `queryKeys.ts`:
```typescript
publicationVersionsList: (metahubId: string, publicationId: string) =>
    [...metahubsQueryKeys.publicationDetail(metahubId, publicationId), 'versions', 'list'] as const,
publicationApplicationsList: (metahubId: string, publicationId: string) =>
    [...metahubsQueryKeys.publicationDetail(metahubId, publicationId), 'applications', 'list'] as const,
```

---

### Phase R4: Frontend — Copy & Refactor → PublicationApplicationList

**R4.0** Copy source file **(MANDATORY — must be executed as shell command)** (QA fix)

```bash
# Copy ElementList as the base shell for PublicationApplicationList
cp packages/metahubs-frontend/base/src/domains/elements/ui/ElementList.tsx \
   packages/metahubs-frontend/base/src/domains/publications/ui/PublicationApplicationList.tsx
```

**R4.0.1** Refactor `PublicationApplicationList.tsx` — systematic replacement checklist:
- [ ] Rename component: `ElementList` → `PublicationApplicationList`
- [ ] Replace params: `{ metahubId, hubId, catalogId }` → `{ metahubId, publicationId }`
- [ ] Replace tab logic: `handleCatalogTabChange('attributes'/'elements')` → `handlePublicationTabChange('versions'/'applications')`
- [ ] Replace tab values: `value='elements'` → `value='applications'`, tab labels → versions/applications
- [ ] Replace data queries: `useElements` → `usePublicationApplications` (new hook)
- [ ] Replace mutations: element mutations → application create mutation (new, R4.2)
- [ ] Replace columns: element-specific columns → application columns (name, description, slug, createdAt)
- [ ] Replace create dialog: element form → application create form (name, description, createApplicationSchema toggle)
- [ ] Replace ViewHeader title: add publication name via `usePublicationDetails` (from R3.2a)
- [ ] Remove all element-specific imports (InlineTableEditor, ReferenceFieldAutocomplete, DynamicEntityFormDialog, etc.)
- [ ] Remove element-specific styled components and types
- [ ] Remove inline editing logic, enum autocomplete, etc.

**R4.1** Final structure of `PublicationApplicationList.tsx`

File: `packages/metahubs-frontend/base/src/domains/publications/ui/PublicationApplicationList.tsx`

Copy shell from ElementList (tabs, ViewHeader), but content is the application list.

Structure:
```tsx
export const PublicationApplicationList: React.FC = () => {
    const { metahubId, publicationId } = useParams<{ metahubId: string; publicationId: string }>()
    const navigate = useNavigate()
    
    // Tabs — hardcoded to 'applications'
    const handlePublicationTabChange = (_event: unknown, nextTab: string) => {
        if (nextTab === 'versions') {
            navigate(`/metahub/${metahubId}/publication/${publicationId}/versions`)
        }
    }
    
    // Query: linked applications
    const { data, isLoading } = usePublicationApplications(metahubId!, publicationId!)
    
    // Mutations
    const createAppMutation = useCreatePublicationApplication()
    
    // Create dialog state
    const [isDialogOpen, setDialogOpen] = useState(false)
    
    // Columns
    const appColumns = useMemo(() => [
        { id: 'name', label: tc('table.name'), width: '35%' },
        { id: 'description', label: tc('table.description'), width: '35%' },
        { id: 'slug', label: 'Slug', width: '15%' },
        { id: 'createdAt', label: tc('table.createdAt'), width: '15%' },
    ], [tc])
    
    return (
        <MainCard>
            <Tabs value='applications' onChange={handlePublicationTabChange}>
                <Tab value='versions' label={t('publications.versions.title')} />
                <Tab value='applications' label={t('publications.applications.title')} />
            </Tabs>
            
            <ViewHeader title={t('publications.applications.title')}>
                <ToolbarControls primaryAction={{ label: tc('create'), onClick: () => setDialogOpen(true) }} />
            </ViewHeader>
            
            <FlowListTable data={...} customColumns={appColumns} />
            
            {/* Create Application Dialog: Name, Description, "Create application schema" toggle */}
            <EntityFormDialog
                open={isDialogOpen}
                hideDefaultFields
                tabs={buildCreateApplicationTabs}
                onSave={handleCreateApplication}
            />
        </MainCard>
    )
}
```

**R4.2** Create application-specific API, hooks, mutations

File: `packages/metahubs-frontend/base/src/domains/publications/api/publicationApplications.ts`

```typescript
export const listPublicationApplications = async (metahubId: string, publicationId: string) => { ... }
// Reuse existing getPublicationApplications
export const createPublicationApplication = async (
    metahubId: string,
    publicationId: string,
    payload: { name: SimpleLocalizedInput; description?: SimpleLocalizedInput; namePrimaryLocale?: string; descriptionPrimaryLocale?: string; createApplicationSchema?: boolean }
) => {
    const response = await apiClient.post(`/metahub/${metahubId}/publication/${publicationId}/applications`, payload)
    return response.data
}
```

---

### Phase R5: Frontend — Refactor PublicationList + Create Dialog

**R5.1** Modify `PublicationList.tsx` — add drill-in navigation

Replace card/table row clicks to navigate into the publication instead of opening edit dialog:

```tsx
// Add goToPublication function (like goToCatalog)
const goToPublication = (publication: Publication) => {
    navigate(`/metahub/${metahubId}/publication/${publication.id}/versions`)
}

// In FlowListTable:
getRowLink={(row: any) =>
    row?.id ? `/metahub/${metahubId}/publication/${row.id}/versions` : undefined
}

// In ItemCard:
onClick={() => goToPublication(publication)}
```

**R5.2** Rework create dialog — 2 tabs with Collapse spoilers

Replace the existing 4-tab `buildCreateTabs` with a new 2-tab structure:

```tsx
const buildCreateTabs = ({ values, setValue, isLoading, errors }): TabConfig[] => [
    {
        id: 'general',
        label: t('publications.tabs.general'),
        content: (
            <Stack spacing={2}>
                {/* Name + Description fields (same as before) */}
                <PublicationFormFields values={values} setValue={setValue} ... />
                
                {/* "Create version" toggle — always ON and disabled */}
                <FormControlLabel
                    control={<Switch checked disabled />}
                    label={t('publications.create.createVersion')}
                />
                
                {/* Version Settings spoiler */}
                <CollapsibleSection
                    label={t('publications.create.versionSettings')}
                    defaultOpen={false}
                >
                    <Stack spacing={2} sx={{ pl: 2 }}>
                        <LocalizedInlineField
                            name='versionNameVlc'
                            label={t('publications.versions.name')}
                            value={values.versionNameVlc}
                            onChange={(v) => setValue('versionNameVlc', v)}
                        />
                        <LocalizedInlineField
                            name='versionDescriptionVlc'
                            label={t('publications.versions.description')}
                            value={values.versionDescriptionVlc}
                            onChange={(v) => setValue('versionDescriptionVlc', v)}
                            multiline rows={2}
                        />
                        <FormControl fullWidth size='small'>
                            <InputLabel>{t('publications.versions.branch')}</InputLabel>
                            <Select value={values.versionBranchId} onChange={...}>
                                {branches.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Stack>
                </CollapsibleSection>
                
                {/* Application Settings spoiler */}
                <CollapsibleSection
                    label={t('publications.create.applicationSettings')}
                    defaultOpen={false}
                >
                    <Stack spacing={2} sx={{ pl: 2 }}>
                        {/* "Create application" toggle */}
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={values.autoCreateApplication ?? false}
                                    onChange={(e) => {
                                        const checked = e.target.checked
                                        setValue('autoCreateApplication', checked)
                                        if (!checked) {
                                            setValue('createApplicationSchema', false)
                                        }
                                    }}
                                />
                            }
                            label={t('publications.create.createApplication')}
                        />
                        
                        {/* "Create application schema" toggle — disabled when autoCreateApplication=false */}
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={values.createApplicationSchema ?? false}
                                    onChange={(e) => setValue('createApplicationSchema', e.target.checked)}
                                    disabled={!values.autoCreateApplication}
                                />
                            }
                            label={t('publications.create.createApplicationSchema')}
                        />
                        
                        {/* Info text about what will be created */}
                        {values.autoCreateApplication && (
                            <Alert severity='info' sx={{ mt: 1 }}>
                                {t('publications.create.applicationWillBeCreated')}
                            </Alert>
                        )}
                    </Stack>
                </CollapsibleSection>
            </Stack>
        )
    },
    {
        id: 'access',
        label: t('publications.tabs.access'),
        content: <AccessPanel accessMode={values.accessMode} onChange={(mode) => setValue('accessMode', mode)} />
    }
]
```

**R5.3** Extract `CollapsibleSection` component

File: `packages/universo-template-mui/base/src/components/CollapsibleSection.tsx`

Reusable component matching the existing pattern from `AttributeFormFields.tsx`:

```tsx
interface CollapsibleSectionProps {
    label: string
    defaultOpen?: boolean
    children: React.ReactNode
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
    label, defaultOpen = false, children
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen)
    
    return (
        <Box>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    py: 1,
                    '&:hover': { color: 'primary.main' }
                }}
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? <ExpandLessIcon fontSize='small' /> : <ExpandMoreIcon fontSize='small' />}
                <Typography variant='body2' sx={{ ml: 0.5, fontWeight: 500 }}>
                    {label}
                </Typography>
            </Box>
            <Collapse in={isOpen}>
                <Box sx={{ pt: 1 }}>{children}</Box>
            </Collapse>
        </Box>
    )
}
```

**R5.4** Update `handleCreatePublication` payload

Add `createApplicationSchema` to the mutation payload:

```typescript
const handleCreatePublication = async (data: Record<string, any>) => {
    // ... existing VLC extraction ...
    await createPublicationMutation.mutateAsync({
        metahubId: metahubId!,
        data: {
            // ... existing fields ...
            autoCreateApplication: data.autoCreateApplication ?? false,
            createApplicationSchema: data.createApplicationSchema ?? false,  // NEW
        }
    })
}
```

**R5.5** Refactor `AttributeFormFields.tsx` to use `CollapsibleSection` **(QA fix — consistency)**

After creating `CollapsibleSection` in R5.3, refactor the existing inline Collapse pattern in `AttributeFormFields.tsx` (lines ~393-413) to use the new shared component. This ensures consistency across the codebase.

```tsx
// BEFORE (inline in AttributeFormFields.tsx):
{hasTypeSettings && (
    <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', py: 1, '&:hover': { color: 'primary.main' } }}
             onClick={() => setShowTypeSettings(!showTypeSettings)}>
            {showTypeSettings ? <ExpandLessIcon fontSize='small' /> : <ExpandMoreIcon fontSize='small' />}
            <Typography variant='body2' sx={{ ml: 0.5 }}>{typeSettingsLabel}</Typography>
        </Box>
        <Collapse in={showTypeSettings}>
            <Box sx={{ pl: 2, pt: 1 }}>{renderTypeSettings()}</Box>
        </Collapse>
    </Box>
)}

// AFTER (using CollapsibleSection):
{hasTypeSettings && (
    <CollapsibleSection label={typeSettingsLabel} defaultOpen={false}>
        <Box sx={{ pl: 2 }}>{renderTypeSettings()}</Box>
    </CollapsibleSection>
)}
```

Remove unused imports: `ExpandMoreIcon`, `ExpandLessIcon`, `Collapse` (if no other usage in file), and `showTypeSettings` state.

---

### Phase R6: Frontend — Refactor PublicationActions (Edit dialog)

**R6.1** Simplify edit dialog — remove Versions and Applications tabs

The edit dialog now only needs 2 tabs: **General** and **Access** (since Versions and Applications are now separate pages).

```tsx
// PublicationActions.tsx — buildFormTabs
const buildFormTabs = (ctx, metahubId): TabConfig[] => [
    {
        id: 'general',
        label: t('publications.tabs.general'),
        content: <PublicationEditFields ... />
    },
    {
        id: 'access',
        label: t('publications.tabs.access'),
        content: <AccessPanel ... />
    }
]
```

**R6.2** Remove imports of VersionsPanel, ApplicationsPanel from PublicationActions

---

### Phase R7: Frontend — i18n keys

**R7.1** Add new i18n keys to `metahubs.json` (EN + RU)

```json
// EN
"publications.create.createVersion": "Create version",
"publications.create.versionSettings": "Version settings",
"publications.create.applicationSettings": "Application settings",
"publications.create.createApplication": "Create application",
"publications.create.createApplicationSchema": "Create application schema",
"publications.create.applicationWillBeCreated": "An application with the same name and a connector linked to the Metahub will be created.",
"publications.applications.title": "Applications",
"publications.applications.createTitle": "Create Application",
"publications.applications.createDescription": "Create a new application linked to this publication",
"publications.applications.empty": "No applications linked yet",
"publications.applications.emptyDescription": "Create an application to start using published data",
"publications.applications.openApp": "Open application",
"publications.versions.branch": "Branch for version"
```

```json
// RU
"publications.create.createVersion": "Создать версию",
"publications.create.versionSettings": "Настройки версии",
"publications.create.applicationSettings": "Настройки приложения",
"publications.create.createApplication": "Создать приложение",
"publications.create.createApplicationSchema": "Создать схему приложения",
"publications.create.applicationWillBeCreated": "Будет создано приложение с таким же названием и коннектор, связанный с Метахабом.",
"publications.applications.title": "Приложения",
"publications.applications.createTitle": "Создание приложения",
"publications.applications.createDescription": "Создание нового приложения, связанного с этой публикацией",
"publications.applications.empty": "Нет связанных приложений",
"publications.applications.emptyDescription": "Создайте приложение для использования опубликованных данных",
"publications.applications.openApp": "Открыть приложение",
"publications.versions.branch": "Ветка для версии"
```

---

### Phase R8: Cleanup — Remove legacy panels

**R8.1** Delete files:
- `packages/metahubs-frontend/base/src/domains/publications/ui/VersionsPanel.tsx`
- `packages/metahubs-frontend/base/src/domains/publications/ui/ApplicationsPanel.tsx`
- `packages/metahubs-frontend/base/src/domains/publications/ui/ApplicationsCreatePanel.tsx`

**R8.2** Remove imports referencing these files from:
- `PublicationActions.tsx`
- `PublicationList.tsx`
- Any re-export barrel files (`index.ts`)

---

### Phase R9: Build & Verify

**R9.1** Full build
```bash
pnpm build
```

**R9.2** Verify all 66/66 packages build successfully

**R9.3** Check no stale imports or dead code references

---

## 5. File Change Summary

### New files (10):
| File | Description |
|------|-------------|
| `metahubs-backend/.../publications/helpers/createLinkedApplication.ts` | Shared helper for creating Application+Connector+ConnectorPublication (QA fix) |
| `metahubs-frontend/.../publications/ui/PublicationVersionList.tsx` | Standalone versions page (~500-600 lines, **copied from AttributeList.tsx**) |
| `metahubs-frontend/.../publications/ui/PublicationApplicationList.tsx` | Standalone applications page (~400-500 lines, **copied from ElementList.tsx**) |
| `metahubs-frontend/.../publications/api/publicationVersions.ts` | API functions for versions CRUD |
| `metahubs-frontend/.../publications/api/publicationApplications.ts` | API functions for applications CRUD via publication |
| `metahubs-frontend/.../publications/hooks/usePublicationVersions.ts` | Query hooks for versions |
| `metahubs-frontend/.../publications/hooks/usePublicationDetails.ts` | Query hook for publication detail (QA fix — inner view context) |
| `metahubs-frontend/.../publications/hooks/versionMutations.ts` | Mutation hooks for version create/activate/update |
| `metahubs-frontend/.../publications/hooks/applicationMutations.ts` | Mutation hooks for create application via publication |
| `universo-template-mui/.../components/CollapsibleSection.tsx` | Reusable Collapse spoiler component |

### Modified files (10+):
| File | Changes |
|------|---------|
| `metahubs-backend/.../publications/routes/publicationsRoutes.ts` | Extended Zod schema + DDL after transaction (QA fix) + refactored to use createLinkedApplication helper + new POST .../applications endpoint |
| `metahubs-frontend/.../publications/ui/PublicationList.tsx` | Drill-in navigation, reworked create dialog (2 tabs + spoilers) |
| `metahubs-frontend/.../publications/ui/PublicationActions.tsx` | Simplified edit dialog (2 tabs), removed VersionsPanel/ApplicationsPanel imports |
| `metahubs-frontend/.../attributes/ui/AttributeFormFields.tsx` | Refactored inline Collapse to use CollapsibleSection (QA fix — consistency) |
| `metahubs-frontend/.../publications/hooks/index.ts` | Re-export new hooks |
| `metahubs-frontend/.../publications/api/index.ts` | Re-export new API modules |
| `metahubs-frontend/.../domains/shared/queryKeys.ts` | New query keys for versions/applications lists |
| `metahubs-frontend/base/src/index.ts` | Export PublicationVersionList, PublicationApplicationList |
| `metahubs-frontend/.../i18n/locales/en/metahubs.json` | New i18n keys |
| `metahubs-frontend/.../i18n/locales/ru/metahubs.json` | New i18n keys |
| `universo-template-mui/.../routes/MainRoutesMUI.tsx` | New routes for version/application inner pages |
| `universo-template-mui/.../components/index.ts` | Export CollapsibleSection |

### Deleted files (3):
| File | Reason |
|------|--------|
| `metahubs-frontend/.../publications/ui/VersionsPanel.tsx` | Replaced by standalone PublicationVersionList |
| `metahubs-frontend/.../publications/ui/ApplicationsPanel.tsx` | Replaced by standalone PublicationApplicationList |
| `metahubs-frontend/.../publications/ui/ApplicationsCreatePanel.tsx` | Merged into create dialog inline |

---

## 6. Potential Challenges & Mitigations

### Challenge 1: Schema generation inside transaction (RESOLVED via QA)

**Risk:** `generateFullSchema` uses Knex (separate connection pool). Running it inside the TypeORM transaction causes deadlocks.
**Resolution (QA fix):** DDL generation runs **AFTER** `ds.transaction()` commits, in a separate try/catch. If DDL fails, Publication + Application exist with `schemaStatus=DRAFT` — user can trigger sync manually. See R1.2 for implementation details.

### Challenge 2: Navigation breadcrumbs / context (RESOLVED via QA)

**Risk:** When inside `/metahub/:metahubId/publication/:publicationId/versions`, user loses context of which publication they're in.
**Resolution (QA fix):** New `usePublicationDetails` hook (R3.2a) fetches publication name and displays it in ViewHeader title of both inner pages.

### Challenge 3: Application creation from ApplicationsPanel needs backend endpoint

**Risk:** Current backend only creates applications during publication creation (`autoCreateApplication`). No standalone "create app via publication" endpoint exists.
**Mitigation:** Phase R1.3 adds `POST .../publication/:publicationId/applications` endpoint that reuses `createLinkedApplication()` helper (R1.0).

### Challenge 4: "Create application schema" depends on active version existing

**Risk:** During publication creation, the first version has just been created but the snapshot is ephemeral.
**Mitigation:** The snapshot is returned from the transaction result. It is passed directly to `generateFullSchema` in the post-transaction DDL block without needing to re-fetch.

### Challenge 5: Stale VersionsPanel logic vs new VersionList

**Risk:** VersionsPanel uses `CompactListTable` (smaller, fits in a dialog). New VersionList uses `FlowListTable` (full-page table).
**Mitigation:** Intentional design change — full-page table provides better UX. Version actions (edit/activate) will use BaseEntityMenu pattern or inline action buttons.

### Challenge 6: Legacy query key coexistence during transition (NEW — QA)

**Risk:** VersionsPanel uses literal keys `['publication-versions', publicationId]` while new code uses `metahubsQueryKeys.publicationVersionsList(...)`. During the R3→R8 transition, both components may coexist.
**Mitigation:** New version mutations (R3.3) invalidate **both** old and new keys. Old key invalidation is removed when VersionsPanel is deleted in R8.

### Challenge 7: Code duplication in application creation (RESOLVED via QA)

**Risk:** The existing CREATE handler (lines ~486-560) and the new POST .../applications endpoint both need the same Application+Connector creation logic.
**Resolution (QA fix):** R1.0 extracts `createLinkedApplication()` helper function, used by both handlers. No code duplication.

---

## 7. Implementation Order & Dependencies

```
R1.0 (Extract Helper) ──→ R1.1-R1.4 (Backend) ───────┐
                                                       ├──→ R9 (Build & Verify)
R2 (Routes)  ──→ R3 (VersionList) ──→ R4 (AppList) ──→ R5 + R5.5 (Rework Lists + Refactor) ──→ R6 (Edit Dialog) ──→ R7 (i18n) ──→ R8 (Cleanup) ──┘
```

**R1.0** must be done first — it extracts `createLinkedApplication()` helper that R1.2 and R1.3 depend on.
R1.1-R1.4 and R2 can then be done in parallel since backend and frontend routes are independent.
R3 depends on R2 (routes must exist for navigation). R3.0 starts with explicit `cp` from AttributeList.
R4 depends on R3 (shared tab pattern). R4.0 starts with explicit `cp` from ElementList.
R5 depends on R3+R4 (the drill-in replaces current behavior). R5.5 adds CollapsibleSection refactor to AttributeFormFields.
R6 depends on R5 (edit dialog simplification after create rework).
R7 can be done incrementally throughout R3-R6 but is listed separately for tracking.
R8 (cleanup) must be last — only after all new code is confirmed working. Legacy query key dual-invalidation is removed here.
R9 (build) is the final gate.

---

## 8. Estimated Effort

| Phase | Effort | Description |
|-------|--------|-------------|
| R1.0 | 30 min | Extract `createLinkedApplication()` helper |
| R1.1-R1.4 | 2-3 hours | Backend changes (Zod + DDL after tx + new endpoint) |
| R2 | 30 min | Routes + lazy imports |
| R3 | 3.5-4.5 hours | PublicationVersionList (cp + refactor + hooks + usePublicationDetails + API) |
| R4 | 2.5-3.5 hours | PublicationApplicationList (cp + refactor + create dialog) |
| R5 + R5.5 | 2.5-3.5 hours | PublicationList rework + CollapsibleSection + AttributeFormFields refactor |
| R6 | 1 hour | Edit dialog simplification |
| R7 | 30 min | i18n keys (EN + RU) |
| R8 | 30 min | Cleanup legacy files + remove legacy query key dual-invalidation |
| R9 | 30 min | Full build + verify |
| **Total** | **~14-18 hours** | |
