import {
    findEffectiveLayoutApplication,
    findEffectiveLayoutBaseWidgets,
    findEffectiveLayoutEntity,
    effectiveLayoutTablesExist,
    listEffectiveLayoutCandidates,
    listEffectiveLayoutWidgets
} from '../../persistence/effectiveLayoutStore'
import { effectiveLayoutResultSchema } from '@universo-react/types'
import { resolveEffectiveLayoutForRequest } from '../../services/effectiveLayoutResolver'
import { EffectiveLayoutError } from '../../services/effectiveLayoutContract'
import { createMockDbExecutor } from '../utils/dbMocks'
import { resolveRuntimeWorkspaceAccess, setRuntimeWorkspaceContext } from '../../services/applicationWorkspaces'

jest.mock('../../services/applicationWorkspaces', () => ({
    __esModule: true,
    resolveRuntimeWorkspaceAccess: jest.fn(),
    setRuntimeWorkspaceContext: jest.fn()
}))

jest.mock('../../persistence/effectiveLayoutStore', () => ({
    __esModule: true,
    findEffectiveLayoutApplication: jest.fn(),
    findEffectiveLayoutBaseWidgets: jest.fn(),
    findEffectiveLayoutEntity: jest.fn(),
    effectiveLayoutTablesExist: jest.fn(),
    listEffectiveLayoutCandidates: jest.fn(),
    listEffectiveLayoutWidgets: jest.fn()
}))

const mockFindApplication = findEffectiveLayoutApplication as jest.MockedFunction<typeof findEffectiveLayoutApplication>
const mockFindBaseWidgets = findEffectiveLayoutBaseWidgets as jest.MockedFunction<typeof findEffectiveLayoutBaseWidgets>
const mockFindEntity = findEffectiveLayoutEntity as jest.MockedFunction<typeof findEffectiveLayoutEntity>
const mockTablesExist = effectiveLayoutTablesExist as jest.MockedFunction<typeof effectiveLayoutTablesExist>
const mockListCandidates = listEffectiveLayoutCandidates as jest.MockedFunction<typeof listEffectiveLayoutCandidates>
const mockListWidgets = listEffectiveLayoutWidgets as jest.MockedFunction<typeof listEffectiveLayoutWidgets>
const mockResolveWorkspaceAccess = resolveRuntimeWorkspaceAccess as jest.MockedFunction<typeof resolveRuntimeWorkspaceAccess>
const mockSetWorkspaceContext = setRuntimeWorkspaceContext as jest.MockedFunction<typeof setRuntimeWorkspaceContext>

const applicationId = '018f8a78-7b8f-7c1d-a111-222233334444'
const entityId = '0190a9b5-3cde-7abc-8def-0123456789ad'
const globalLayoutId = '0190a9b5-3cde-7abc-8def-0123456789ae'
const scopedLayoutId = '0190a9b5-3cde-7abc-8def-0123456789af'
const globalWidgetId = '0190a9b5-3cde-7abc-8def-0123456789b0'
const scopedWidgetId = '0190a9b5-3cde-7abc-8def-0123456789b1'
const publicationId = '0190a9b5-3cde-7abc-8def-0123456789b2'
const publicationVersionId = '0190a9b5-3cde-7abc-8def-0123456789b3'
const schemaName = 'app_018f8a787b8f7c1da111222233334444'
const snapshotHash = 'a'.repeat(64)
const { executor } = createMockDbExecutor()

const application = {
    id: applicationId,
    name: {},
    description: null,
    settings: null,
    slug: null,
    isPublic: false,
    workspacesEnabled: false,
    schemaName,
    schemaStatus: 'ready',
    schemaSyncedAt: null,
    schemaError: null,
    version: 1,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    updatedBy: null,
    schemaSnapshot: null,
    appStructureVersion: null,
    lastSyncedPublicationVersionId: publicationVersionId,
    installedReleaseMetadata: {
        kind: 'application_release_installation',
        bundleVersion: 1,
        sourceKind: 'publication',
        applicationKey: 'application',
        releaseVersion: 'release-1',
        installedAt: new Date(0).toISOString(),
        snapshotHash,
        bootstrapChecksum: 'bootstrap',
        incrementalChecksum: 'incremental',
        baseSchemaSnapshot: null,
        releaseSchemaSnapshot: {},
        publicationId,
        publicationVersionId
    }
}

const layoutRow = (overrides: Record<string, unknown> = {}) => ({
    id: globalLayoutId,
    scope_entity_id: null,
    template_key: 'dashboard',
    name: { en: 'Dashboard' },
    description: null,
    config: { compositionMode: 'independent', baseLayoutId: null },
    is_active: true,
    is_default: true,
    sort_order: 0,
    source_kind: 'metahub',
    source_layout_id: globalLayoutId,
    source_snapshot_hash: snapshotHash,
    source_content_hash: snapshotHash,
    local_content_hash: snapshotHash,
    sync_state: 'clean',
    is_source_excluded: false,
    source_deleted_at: null,
    source_deleted_by: null,
    version: 1,
    ...overrides
})

const widgetRow = (overrides: Record<string, unknown> = {}) => ({
    id: globalWidgetId,
    layout_id: globalLayoutId,
    zone: 'top',
    widget_key: 'header',
    sort_order: 0,
    config: {},
    source_config: {},
    source_widget_id: globalWidgetId,
    source_base_widget_id: null,
    is_customized: false,
    is_active: true,
    version: 1,
    ...overrides
})

const resolverInput = (targetKind: 'page' | 'object' = 'object') => ({
    applicationId,
    targetKind,
    entityTypeId: entityId,
    locale: 'en'
})

beforeEach(() => {
    jest.clearAllMocks()
    mockFindApplication.mockResolvedValue(application as never)
    mockFindEntity.mockResolvedValue([{ id: entityId, kind: 'object', codename: 'Products' }])
    mockTablesExist.mockResolvedValue(true)
    mockFindBaseWidgets.mockResolvedValue([])
    mockResolveWorkspaceAccess.mockResolvedValue({
        membershipState: 'joined' as never,
        defaultWorkspaceId: null,
        allowedWorkspaceIds: []
    })
    mockSetWorkspaceContext.mockResolvedValue(undefined)
})

describe('effectiveLayoutResolver', () => {
    it('establishes workspace access before entity lookup and hides entity existence for forbidden workspaces', async () => {
        mockFindApplication.mockResolvedValue({ ...application, workspacesEnabled: true } as never)
        const forbiddenWorkspaceId = '0190a9b5-3cde-7abc-8def-0123456789c1'
        mockResolveWorkspaceAccess.mockResolvedValue({
            membershipState: 'joined' as never,
            defaultWorkspaceId: null,
            allowedWorkspaceIds: []
        })

        await expect(
            resolveEffectiveLayoutForRequest(
                executor,
                { applicationId, userId: 'user-1', role: 'member' },
                { applicationId, targetKind: 'object', entityTypeId: entityId, workspaceId: forbiddenWorkspaceId, locale: 'en' }
            )
        ).rejects.toMatchObject<Partial<EffectiveLayoutError>>({ code: 'LAYOUT_TARGET_FORBIDDEN', httpStatus: 403 })

        expect(mockResolveWorkspaceAccess).toHaveBeenCalled()
        expect(mockSetWorkspaceContext).not.toHaveBeenCalled()
        expect(mockFindEntity).not.toHaveBeenCalled()
    })

    it('selects an independent scoped layout before global without merging templates', async () => {
        mockListCandidates.mockResolvedValue([
            layoutRow(),
            layoutRow({
                id: scopedLayoutId,
                scope_entity_id: entityId,
                template_key: 'marketing-page',
                name: { en: 'Marketing' },
                config: { themeMode: 'system', compositionMode: 'independent', baseLayoutId: null },
                source_kind: 'application',
                source_layout_id: globalLayoutId,
                source_snapshot_hash: null,
                source_content_hash: null,
                local_content_hash: null
            })
        ] as never)
        mockListWidgets.mockImplementation(async (_executor, _schemaName, layoutId) =>
            layoutId === scopedLayoutId
                ? [
                      widgetRow({
                          id: scopedWidgetId,
                          layout_id: scopedLayoutId,
                          zone: 'marketing-main',
                          widget_key: 'marketing.hero',
                          config: {
                              instanceKey: 'hero',
                              source: { entityKind: 'object', entityCodename: 'MarketingPageSiteSettings' },
                              showLeadForm: true
                          },
                          source_widget_id: scopedWidgetId
                      })
                  ]
                : [widgetRow()]
        )

        const result = await resolveEffectiveLayoutForRequest(
            executor,
            { applicationId, userId: 'user-1', role: 'member' },
            resolverInput()
        )

        expect(result.scope).toBe('entity')
        expect(result.layout.id).toBe(scopedLayoutId)
        expect(result.layout.templateKey).toBe('marketing-page')
        expect(result.layout.compositionMode).toBe('independent')
        expect(result.layout.scopeKind).toBe('entity')
        expect(result.layout.baseLayoutId).toBeNull()
        expect(result.widgets).toHaveLength(1)
        expect(result.widgets[0]?.id).toBe(scopedWidgetId)
        expect(result.widgets[0]?.semanticRegion).toBe('main')
        expect(result.widgets.some((widget) => widget.id === globalWidgetId)).toBe(false)
        expect(result.publicationIdentity).toBeNull()
        expect(result.layout.sourceLayoutId).toBe(globalLayoutId)
        expect(result.materializationHash).toBe(snapshotHash)
        expect(result.precedence).toEqual(['application-entity', 'metahub-provenance'])
        expect(effectiveLayoutResultSchema.safeParse(result).success).toBe(true)
    })

    it('falls back deterministically to the global default when the entity has no default', async () => {
        mockListCandidates.mockResolvedValue([layoutRow()] as never)
        mockListWidgets.mockResolvedValue([widgetRow()])

        const result = await resolveEffectiveLayoutForRequest(
            executor,
            { applicationId, userId: 'user-1', role: 'member' },
            resolverInput()
        )

        expect(result.scope).toBe('global')
        expect(result.layout.id).toBe(globalLayoutId)
        expect(result.publicationIdentity).toEqual({ publicationId, publicationVersionId, snapshotHash })
        expect(result.precedence).toEqual(['published-publication', 'application-global', 'metahub-provenance'])
    })

    it('resolves a Page target with the same scoped-template precedence as an Object target', async () => {
        mockFindEntity.mockResolvedValue([{ id: entityId, kind: 'page', codename: 'LandingPage' }])
        mockListCandidates.mockResolvedValue([
            layoutRow(),
            layoutRow({
                id: scopedLayoutId,
                scope_entity_id: entityId,
                template_key: 'marketing-page',
                config: { themeMode: 'system', compositionMode: 'independent', baseLayoutId: null },
                source_kind: 'application',
                source_layout_id: null,
                source_snapshot_hash: null,
                source_content_hash: null,
                local_content_hash: null
            })
        ] as never)
        mockListWidgets.mockImplementation(async (_executor, _schemaName, layoutId) =>
            layoutId === scopedLayoutId
                ? [
                      widgetRow({
                          id: scopedWidgetId,
                          layout_id: scopedLayoutId,
                          zone: 'marketing-main',
                          widget_key: 'marketing.hero',
                          config: {
                              instanceKey: 'page-hero',
                              source: { entityKind: 'object', entityCodename: 'MarketingPageSiteSettings', fieldMap: {} },
                              showLeadForm: false
                          },
                          source_widget_id: null
                      })
                  ]
                : []
        )

        const result = await resolveEffectiveLayoutForRequest(
            executor,
            { applicationId, userId: 'user-1', role: 'member' },
            resolverInput('page')
        )

        expect(mockFindEntity).toHaveBeenCalledWith(expect.anything(), schemaName, 'page', { kind: 'id', value: entityId })
        expect(result.resolvedEntityTypeId).toBe(entityId)
        expect(result.layout.templateKey).toBe('marketing-page')
        expect(result.scope).toBe('entity')
    })

    it('resolves a custom layout-capable object kind as an object target', async () => {
        mockFindEntity.mockResolvedValue([{ id: entityId, kind: 'product', codename: 'Products' }])
        mockListCandidates.mockResolvedValue([layoutRow()] as never)
        mockListWidgets.mockResolvedValue([widgetRow()])

        const result = await resolveEffectiveLayoutForRequest(
            executor,
            { applicationId, userId: 'user-1', role: 'member' },
            resolverInput()
        )

        expect(result.resolvedEntityTypeId).toBe(entityId)
        expect(result.scope).toBe('global')
    })

    it('fails closed on stale publication lineage instead of using another source', async () => {
        mockListCandidates.mockResolvedValue([layoutRow({ source_snapshot_hash: 'b'.repeat(64) })] as never)
        mockListWidgets.mockResolvedValue([])

        await expect(
            resolveEffectiveLayoutForRequest(
                executor,
                { applicationId, userId: 'user-1', role: 'member' },
                { applicationId, targetKind: null, locale: 'en' }
            )
        ).rejects.toMatchObject<Partial<EffectiveLayoutError>>({ code: 'LAYOUT_CONFLICT', httpStatus: 409 })
    })

    it('fails closed when the parent layout version changes during the two-step read', async () => {
        mockListCandidates
            .mockResolvedValueOnce([layoutRow({ version: 1 })] as never)
            .mockResolvedValueOnce([layoutRow({ version: 2 })] as never)
        mockListWidgets.mockResolvedValue([widgetRow()])

        await expect(
            resolveEffectiveLayoutForRequest(
                executor,
                { applicationId, userId: 'user-1', role: 'member' },
                { applicationId, targetKind: null, locale: 'en' }
            )
        ).rejects.toMatchObject<Partial<EffectiveLayoutError>>({ code: 'LAYOUT_CONFLICT', httpStatus: 409 })
    })

    it('rejects missing same-template base lineage for an overlay', async () => {
        mockListCandidates.mockResolvedValue([
            layoutRow(),
            layoutRow({
                id: scopedLayoutId,
                scope_entity_id: entityId,
                config: { compositionMode: 'overlay', baseLayoutId: globalLayoutId }
            })
        ] as never)
        mockListWidgets.mockResolvedValue([
            widgetRow({
                id: scopedWidgetId,
                layout_id: scopedLayoutId,
                source_widget_id: globalWidgetId,
                source_base_widget_id: globalWidgetId
            })
        ])
        mockFindBaseWidgets.mockResolvedValue([])

        await expect(
            resolveEffectiveLayoutForRequest(executor, { applicationId, userId: 'user-1', role: 'member' }, resolverInput())
        ).rejects.toMatchObject<Partial<EffectiveLayoutError>>({ code: 'LAYOUT_PERSISTED_INVALID', httpStatus: 409 })
    })

    it('resolves synchronized overlay lineage through the logical source widget id', async () => {
        mockListCandidates.mockResolvedValue([
            layoutRow(),
            layoutRow({
                id: scopedLayoutId,
                scope_entity_id: entityId,
                config: { compositionMode: 'overlay', baseLayoutId: globalLayoutId }
            })
        ] as never)
        mockListWidgets.mockResolvedValue([
            widgetRow({
                id: scopedWidgetId,
                layout_id: scopedLayoutId,
                source_widget_id: globalWidgetId,
                source_base_widget_id: globalWidgetId
            })
        ])
        mockFindBaseWidgets.mockResolvedValue([
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789b4',
                layout_id: globalLayoutId,
                source_widget_id: globalWidgetId,
                source_base_widget_id: null,
                template_key: 'dashboard',
                scope_entity_id: null,
                widget_key: 'header'
            }
        ])

        const result = await resolveEffectiveLayoutForRequest(
            executor,
            { applicationId, userId: 'user-1', role: 'member' },
            resolverInput()
        )

        expect(result.layout.compositionMode).toBe('overlay')
        expect(result.widgets[0]?.sourceBaseWidgetId).toBe(globalWidgetId)
    })

    it('allows a valid overlay whose inherited widgets are all hidden', async () => {
        mockListCandidates.mockResolvedValue([
            layoutRow(),
            layoutRow({
                id: scopedLayoutId,
                scope_entity_id: entityId,
                config: { compositionMode: 'overlay', baseLayoutId: globalLayoutId }
            })
        ] as never)
        mockListWidgets.mockResolvedValue([])

        const result = await resolveEffectiveLayoutForRequest(
            executor,
            { applicationId, userId: 'user-1', role: 'member' },
            resolverInput()
        )

        expect(result.layout.id).toBe(scopedLayoutId)
        expect(result.layout.compositionMode).toBe('overlay')
        expect(result.layout.baseLayoutId).toBe(globalLayoutId)
        expect(result.widgets).toEqual([])
    })

    it('resolves an application-owned layout without fabricated publication metadata', async () => {
        mockFindApplication.mockResolvedValue({
            ...application,
            lastSyncedPublicationVersionId: null,
            installedReleaseMetadata: null
        } as never)
        mockListCandidates.mockResolvedValue([
            layoutRow({
                source_kind: 'application',
                source_layout_id: null,
                source_snapshot_hash: null,
                source_content_hash: null,
                local_content_hash: null
            })
        ] as never)
        mockListWidgets.mockResolvedValue([widgetRow({ source_widget_id: null, source_base_widget_id: null })])

        const result = await resolveEffectiveLayoutForRequest(
            executor,
            { applicationId, userId: 'user-1', role: 'member' },
            { applicationId, targetKind: null, locale: 'en' }
        )

        expect(result.publicationIdentity).toBeNull()
        expect(result.materializationHash).toBeUndefined()
        expect(result.precedence).toEqual(['application-global'])
    })
})
