import {
    findEffectiveLayoutApplication,
    findEffectiveLayoutBaseWidgets,
    findEffectiveLayoutEntity,
    findEffectiveLayoutHomePages,
    effectiveLayoutTablesExist,
    listEffectiveLayoutCandidates,
    listEffectiveLayoutWidgets
} from '../../persistence/effectiveLayoutStore'
import {
    buildSingleTargetWidgetBinding,
    effectiveLayoutResultSchema,
    encodeLayoutWidgetConfigEnvelope,
    getLayoutWidgetDefinition,
    LAYOUT_WIDGET_DEFINITIONS,
    validateWidgetBindings
} from '@universo-react/types'
import { resolveEffectiveLayoutForPublicTransaction, resolveEffectiveLayoutForRequest } from '../../services/effectiveLayoutResolver'
import { resolveEffectiveLayoutStructureForRequest } from '../../services/effectiveLayoutResolverCore'
import { EffectiveLayoutError } from '../../services/effectiveLayoutContract'
import { createMockDbExecutor } from '../utils/dbMocks'
import { resolveRuntimeWorkspaceAccess, setRuntimeWorkspaceContext } from '../../services/applicationWorkspaces'
import * as runtimeWidgetData from '../../services/effectiveWidgetRuntimeDataResolver'
import { createApplicationLayoutWidgetSourceState } from '../../services/applicationLayoutWidgetSourceState'
import { getApplicationLayoutWidgetSourceBindingState } from '../../persistence/applicationLayoutStoreSupport'

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
    findEffectiveLayoutHomePages: jest.fn(),
    effectiveLayoutTablesExist: jest.fn(),
    listEffectiveLayoutCandidates: jest.fn(),
    listEffectiveLayoutWidgets: jest.fn()
}))

const mockFindApplication = findEffectiveLayoutApplication as jest.MockedFunction<typeof findEffectiveLayoutApplication>
const mockFindBaseWidgets = findEffectiveLayoutBaseWidgets as jest.MockedFunction<typeof findEffectiveLayoutBaseWidgets>
const mockFindEntity = findEffectiveLayoutEntity as jest.MockedFunction<typeof findEffectiveLayoutEntity>
const mockFindHomePages = findEffectiveLayoutHomePages as jest.MockedFunction<typeof findEffectiveLayoutHomePages>
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
const { executor, txExecutor } = createMockDbExecutor()
let hashBaseTemplateKey: 'dashboard' | 'marketing-page' = 'dashboard'

const mockHashContextQuery = async (sql: string): Promise<unknown[]> => {
    if (sql.includes('_app_objects')) return [{ kind: 'object', codename: 'Products' }]
    if (sql.includes('_app_layouts')) {
        return [
            {
                template_key: hashBaseTemplateKey,
                scope_entity_id: null,
                local_content_hash: snapshotHash,
                source_content_hash: snapshotHash
            }
        ]
    }
    return []
}

const application = {
    id: applicationId,
    name: {},
    description: null,
    settings: null,
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
    config: { __layout: { composition: { mode: 'independent', baseLayoutId: null } } },
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

const widgetRow = (overrides: Record<string, unknown> = {}) => {
    const row = {
        id: globalWidgetId,
        layout_id: globalLayoutId,
        zone: 'top',
        widget_key: 'header',
        instance_key: 'widget-main',
        parent_widget_id: null,
        slot_key: null,
        sort_order: 0,
        config: {},
        source_config: null,
        source_widget_id: globalWidgetId,
        source_base_widget_id: null,
        is_customized: false,
        is_active: true,
        version: 1,
        ...overrides
    }
    let sourceState: ReturnType<typeof createApplicationLayoutWidgetSourceState> | null = null
    if (row.source_config !== null && row.source_config !== undefined) {
        try {
            const inheritsMarketingBindings = row.source_base_widget_id !== null && row.source_base_widget_id !== undefined
            sourceState = createApplicationLayoutWidgetSourceState(
                'marketing-page',
                String(row.widget_key),
                {
                    zone: String(row.zone),
                    sortOrder: Number(row.sort_order),
                    isActive: row.is_active === true,
                    config: row.source_config,
                    instanceKey: String(row.instance_key),
                    parentWidgetId: row.parent_widget_id === null ? null : String(row.parent_widget_id),
                    slotKey: row.slot_key === null ? null : String(row.slot_key)
                },
                inheritsMarketingBindings ? { requireBindings: false, rejectBindings: true } : undefined
            )
        } catch {
            sourceState = null
        }
    }
    return { ...row, source_state: sourceState }
}

const resolverInput = (targetKind: 'page' | 'object' = 'object') => ({
    applicationId,
    targetKind,
    entityTypeId: entityId,
    locale: 'en'
})

const heroDefinition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
if (!heroDefinition) throw new Error('The marketing hero widget must be registered')

const heroBinding = (semanticKey: string) =>
    buildSingleTargetWidgetBinding(heroDefinition, 'content', {
        entityKind: 'object',
        entityCodename: 'MarketingPageHero',
        semanticKey
    })

const heroSourceConfig = (semanticKey: string) =>
    encodeLayoutWidgetConfigEnvelope(
        {
            rendererConfig: { showLeadForm: true },
            neutral: { bindings: heroBinding(semanticKey) }
        },
        { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
    )

const heroOverlayConfig = (showLeadForm: boolean) =>
    encodeLayoutWidgetConfigEnvelope(
        { rendererConfig: { showLeadForm } },
        { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
    )

const relationBuilderConfig = () => {
    const rendererConfig = {
        panels: [
            {
                slotKey: 'panel:items',
                title: { en: 'Items', ru: 'Элементы' },
                parentFieldCodename: 'CourseId',
                sortOrderFieldCodename: 'SortOrder',
                enableRowReordering: true
            }
        ]
    }
    const definition = getLayoutWidgetDefinition('relationBuilder', rendererConfig)
    if (!definition?.bindingSlots) throw new Error('Expected relationBuilder binding slots')
    const bindings = validateWidgetBindings(definition, {
        version: 1,
        slots: definition.bindingSlots.map((slot) => ({
            slot: slot.key,
            targets: [
                {
                    entityKind: 'object',
                    entityCodename: slot.key === 'parent' ? 'Courses' : 'CourseItems',
                    selector: slot.key === 'parent' ? { kind: 'record-set' } : { kind: 'relation-set', parentSlot: 'parent' },
                    projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                }
            ]
        }))
    })

    return encodeLayoutWidgetConfigEnvelope(
        { rendererConfig, neutral: { bindings } },
        { templateKey: 'dashboard', widgetKey: 'relationBuilder', zone: 'center' }
    )
}

beforeEach(() => {
    jest.clearAllMocks()
    hashBaseTemplateKey = 'dashboard'
    executor.query.mockImplementation(mockHashContextQuery)
    txExecutor.query.mockImplementation(mockHashContextQuery)
    mockFindApplication.mockResolvedValue(application as never)
    mockFindEntity.mockResolvedValue([{ id: entityId, kind: 'object', codename: 'Products' }])
    mockFindHomePages.mockResolvedValue([])
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
    it('resolves structural Dashboard layouts without loading widget runtime data', async () => {
        const runtimeDataSpy = jest.spyOn(runtimeWidgetData, 'resolveEffectiveWidgetRuntimeData').mockResolvedValue(new Map())
        mockListCandidates.mockResolvedValue([layoutRow()])
        mockListWidgets.mockResolvedValue([widgetRow()])

        const result = await resolveEffectiveLayoutStructureForRequest(
            executor,
            { applicationId, userId: 'member-user-id', role: 'member' },
            resolverInput()
        )

        expect(result.widgets).toHaveLength(1)
        expect(result.widgets[0]).not.toHaveProperty('runtimeData')
        expect(runtimeDataSpy).not.toHaveBeenCalled()
        runtimeDataSpy.mockRestore()
    })

    it('keeps validated relation bindings internal on an authenticated, role-scoped structure read', async () => {
        const workspaceId = '0190a9b5-3cde-7abc-8def-0123456789d5'
        const runtimeDataSpy = jest.spyOn(runtimeWidgetData, 'resolveEffectiveWidgetRuntimeData').mockResolvedValue(new Map())
        mockFindApplication.mockResolvedValue({ ...application, workspacesEnabled: true } as never)
        mockResolveWorkspaceAccess.mockResolvedValue({
            membershipState: 'joined' as never,
            defaultWorkspaceId: workspaceId,
            allowedWorkspaceIds: [workspaceId]
        })
        mockListCandidates.mockResolvedValue([layoutRow()])
        mockListWidgets.mockResolvedValue([
            widgetRow({ zone: 'center', widget_key: 'relationBuilder', instance_key: 'course-items', config: relationBuilderConfig() })
        ])

        const result = await resolveEffectiveLayoutStructureForRequest(
            executor,
            { applicationId, userId: 'member-user-id', role: 'member' },
            { ...resolverInput(), workspaceId }
        )

        expect(getApplicationLayoutWidgetSourceBindingState(result.widgets[0])?.bindings).toEqual(
            expect.objectContaining({ version: 1, slots: expect.any(Array) })
        )
        expect(Object.keys(result.widgets[0]!)).not.toContain('bindings')
        expect(JSON.stringify(result)).not.toContain('bindings')
        expect(result.widgets[0]).not.toHaveProperty('runtimeData')
        expect(runtimeDataSpy).not.toHaveBeenCalled()
        expect(mockFindEntity).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            'object',
            { kind: 'id', value: entityId },
            'authenticated'
        )
        expect(mockListCandidates).toHaveBeenCalledWith(expect.anything(), schemaName, entityId, 'authenticated')
        expect(mockListWidgets).toHaveBeenCalledWith(expect.anything(), schemaName, globalLayoutId, 'authenticated')
        expect(mockResolveWorkspaceAccess).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ userId: 'member-user-id', allowUnassigned: false })
        )
        expect(mockSetWorkspaceContext).toHaveBeenCalledWith(expect.anything(), workspaceId)
        expect(txExecutor.query.mock.calls.every(([sql]) => !sql.includes(`FROM "${schemaName}"."products"`))).toBe(true)
        runtimeDataSpy.mockRestore()
    })

    it('passes authenticated user identity and effective role permissions to Dashboard widget reads', async () => {
        const runtimeDataSpy = jest.spyOn(runtimeWidgetData, 'resolveEffectiveWidgetRuntimeData').mockResolvedValue(new Map())
        mockListCandidates.mockResolvedValue([layoutRow()])
        mockListWidgets.mockResolvedValue([widgetRow()])

        await resolveEffectiveLayoutForRequest(executor, { applicationId, userId: 'member-user-id', role: 'member' }, resolverInput())

        expect(runtimeDataSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                schemaName,
                workspaceId: null,
                workspacesEnabled: false,
                currentUserId: 'member-user-id',
                permissions: {
                    manageMembers: false,
                    manageApplication: false,
                    createContent: false,
                    editContent: false,
                    deleteContent: false,
                    readReports: false
                }
            }),
            expect.any(Array),
            'en'
        )
        runtimeDataSpy.mockRestore()
    })

    it('passes an explicit anonymous deny context to public Dashboard widget reads', async () => {
        const runtimeDataSpy = jest.spyOn(runtimeWidgetData, 'resolveEffectiveWidgetRuntimeData').mockResolvedValue(new Map())
        mockListCandidates.mockResolvedValue([layoutRow()])
        mockListWidgets.mockResolvedValue([widgetRow()])

        await resolveEffectiveLayoutForPublicTransaction(executor, resolverInput(), null)

        expect(runtimeDataSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                schemaName,
                workspaceId: null,
                workspacesEnabled: false,
                currentUserId: null,
                permissions: {
                    manageMembers: false,
                    manageApplication: false,
                    createContent: false,
                    editContent: false,
                    deleteContent: false,
                    readReports: false
                }
            }),
            expect.any(Array),
            'en'
        )
        runtimeDataSpy.mockRestore()
    })

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
                config: { themeMode: 'system', __layout: { composition: { mode: 'independent', baseLayoutId: null } } },
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
                          instance_key: 'hero',
                          config: { showLeadForm: true },
                          source_config: heroSourceConfig('independent-scoped'),
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
        expect(result.layout.zoneSettings).toEqual({ 'marketing-header': { position: 'fixed' } })
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

    it('fails closed when a persisted source widget envelope is malformed', async () => {
        mockListCandidates.mockResolvedValue([layoutRow({ template_key: 'marketing-page' })] as never)
        mockListWidgets.mockResolvedValue([
            widgetRow({
                zone: 'marketing-main',
                widget_key: 'marketing.hero',
                instance_key: 'hero',
                config: { showLeadForm: true },
                source_config: { unexpected: true }
            })
        ])

        await expect(
            resolveEffectiveLayoutForRequest(
                executor,
                { applicationId, userId: 'user-1', role: 'member' },
                { applicationId, targetKind: null, locale: 'en' }
            )
        ).rejects.toMatchObject<Partial<EffectiveLayoutError>>({ code: 'LAYOUT_PERSISTED_INVALID' })
    })

    it('fails closed when a persisted layout uses legacy root composition fields', async () => {
        mockListCandidates.mockResolvedValue([layoutRow({ config: { compositionMode: 'independent', baseLayoutId: null } })] as never)

        await expect(
            resolveEffectiveLayoutForRequest(
                executor,
                { applicationId, userId: 'user-1', role: 'member' },
                { applicationId, targetKind: null, locale: 'en' }
            )
        ).rejects.toMatchObject<Partial<EffectiveLayoutError>>({ code: 'LAYOUT_PERSISTED_INVALID' })
    })

    it('fails closed when persisted neutral layout metadata contains unsupported fields', async () => {
        mockListCandidates.mockResolvedValue([
            layoutRow({
                config: {
                    __layout: {
                        composition: { mode: 'independent', baseLayoutId: null },
                        unsupported: true
                    }
                }
            })
        ] as never)

        await expect(
            resolveEffectiveLayoutForRequest(
                executor,
                { applicationId, userId: 'user-1', role: 'member' },
                { applicationId, targetKind: null, locale: 'en' }
            )
        ).rejects.toMatchObject<Partial<EffectiveLayoutError>>({ code: 'LAYOUT_PERSISTED_INVALID' })
    })

    it('accepts negative sort orders reserved for injected workspace widgets', async () => {
        mockListCandidates.mockResolvedValue([layoutRow()] as never)
        mockListWidgets.mockResolvedValue([
            widgetRow({
                zone: 'left',
                widget_key: 'workspaceSwitcher',
                sort_order: -200,
                source_config: null,
                source_widget_id: null
            })
        ])

        const result = await resolveEffectiveLayoutForRequest(
            executor,
            { applicationId, userId: 'user-1', role: 'member' },
            { applicationId, targetKind: null, locale: 'en' }
        )

        expect(result.widgets).toEqual([
            expect.objectContaining({
                widgetKey: 'workspaceSwitcher',
                sortOrder: -200
            })
        ])
    })

    it('keeps the root target on the global layout when generated navigation has no persisted content selector', async () => {
        mockListCandidates.mockResolvedValue([layoutRow()] as never)
        mockListWidgets.mockResolvedValue([
            widgetRow({ zone: 'left', widget_key: 'menuWidget', config: { variant: 'generated' }, source_widget_id: null })
        ] as never)

        const result = await resolveEffectiveLayoutForRequest(
            executor,
            { applicationId, userId: 'user-1', role: 'member' },
            { applicationId, targetKind: null, locale: 'en' }
        )

        expect(result.scope).toBe('global')
        expect(result.layout.id).toBe(globalLayoutId)
        expect(result.widgets[0]?.widgetKey).toBe('menuWidget')
        expect(mockFindEntity).not.toHaveBeenCalled()
    })

    it('resolves the root target to the unique home Page and its scoped layout', async () => {
        mockFindHomePages.mockResolvedValue([{ id: entityId, kind: 'page', codename: 'LearnerHome' }])
        mockListCandidates.mockResolvedValue([
            layoutRow(),
            layoutRow({
                id: scopedLayoutId,
                scope_entity_id: entityId,
                source_kind: 'application',
                source_layout_id: null,
                source_snapshot_hash: null,
                source_content_hash: null,
                local_content_hash: null
            })
        ] as never)
        mockListWidgets.mockResolvedValue([])

        const result = await resolveEffectiveLayoutForRequest(
            executor,
            { applicationId, userId: 'user-1', role: 'member' },
            { applicationId, targetKind: null, locale: 'en' }
        )

        expect(mockFindHomePages).toHaveBeenCalledTimes(2)
        expect(result.target.targetKind).toBeNull()
        expect(result.resolvedEntityTypeId).toBe(entityId)
        expect(result.scope).toBe('entity')
        expect(result.layout.id).toBe(scopedLayoutId)
    })

    it('fails closed when an application has multiple active home Pages', async () => {
        mockFindHomePages.mockResolvedValue([
            { id: entityId, kind: 'page', codename: 'LearnerHome' },
            { id: scopedLayoutId, kind: 'page', codename: 'AnotherHome' }
        ])

        await expect(
            resolveEffectiveLayoutForRequest(
                executor,
                { applicationId, userId: 'user-1', role: 'member' },
                { applicationId, targetKind: null, locale: 'en' }
            )
        ).rejects.toMatchObject<Partial<EffectiveLayoutError>>({ code: 'LAYOUT_DEFAULT_INVALID', httpStatus: 409 })
        expect(mockListCandidates).not.toHaveBeenCalled()
    })

    it('resolves a Page target with the same scoped-template precedence as an Object target', async () => {
        mockFindEntity.mockResolvedValue([{ id: entityId, kind: 'page', codename: 'LandingPage' }])
        mockListCandidates.mockResolvedValue([
            layoutRow(),
            layoutRow({
                id: scopedLayoutId,
                scope_entity_id: entityId,
                template_key: 'marketing-page',
                config: { themeMode: 'system', __layout: { composition: { mode: 'independent', baseLayoutId: null } } },
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
                          instance_key: 'page-hero',
                          config: { showLeadForm: false },
                          source_config: heroSourceConfig('page-scoped'),
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

        expect(mockFindEntity).toHaveBeenCalledWith(expect.anything(), schemaName, 'page', { kind: 'id', value: entityId }, 'authenticated')
        expect(result.resolvedEntityTypeId).toBe(entityId)
        expect(result.layout.templateKey).toBe('marketing-page')
        expect(result.scope).toBe('entity')
    })

    it('retains the trusted source binding through local presentation overrides without exposing binding metadata', async () => {
        const resolveBoundHero = async (semanticKey: string) => {
            mockListCandidates.mockResolvedValue([
                layoutRow({
                    template_key: 'marketing-page',
                    config: {
                        themeMode: 'system',
                        __layout: { composition: { mode: 'independent', baseLayoutId: null } }
                    }
                })
            ] as never)
            mockListWidgets.mockResolvedValue([
                widgetRow({
                    zone: 'marketing-main',
                    widget_key: 'marketing.hero',
                    instance_key: 'page-hero',
                    config: { showLeadForm: false },
                    source_config: heroSourceConfig(semanticKey),
                    source_widget_id: null
                })
            ] as never)

            return resolveEffectiveLayoutForRequest(
                executor,
                { applicationId, userId: 'user-1', role: 'member' },
                { applicationId, targetKind: null, locale: 'en' }
            )
        }

        const first = await resolveBoundHero('default')
        const second = await resolveBoundHero('campaign')
        const firstHero = first.widgets.find(({ widgetKey }) => widgetKey === 'marketing.hero')

        expect(firstHero?.instanceKey).toBe('page-hero')
        expect(firstHero?.config).toEqual({ showLeadForm: false })
        expect(firstHero?.sourceConfig).toBeUndefined()
        expect(JSON.stringify(first)).not.toContain('bindings')
        expect(first.effectiveHash).not.toBe(second.effectiveHash)
        expect(effectiveLayoutResultSchema.safeParse(first).success).toBe(true)
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
                config: { __layout: { composition: { mode: 'overlay', baseLayoutId: globalLayoutId } } }
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
                config: { __layout: { composition: { mode: 'overlay', baseLayoutId: globalLayoutId } } }
            })
        ] as never)
        mockListWidgets.mockResolvedValue([
            widgetRow({
                id: scopedWidgetId,
                layout_id: scopedLayoutId,
                zone: 'left',
                widget_key: 'menuWidget',
                instance_key: 'menu-main',
                config: { variant: 'generated' },
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
                widget_key: 'menuWidget',
                instance_key: 'menu-main',
                parent_widget_id: null,
                slot_key: null,
                zone: 'left',
                config: { variant: 'generated' },
                source_config: { variant: 'generated' }
            }
        ])

        const result = await resolveEffectiveLayoutForRequest(
            executor,
            { applicationId, userId: 'user-1', role: 'member' },
            resolverInput()
        )

        expect(result.layout.compositionMode).toBe('overlay')
        expect(result.widgets[0]?.sourceBaseWidgetId).toBeUndefined()
        expect(JSON.stringify(result)).not.toContain('sourceBaseWidgetId')
    })

    it('resolves inherited host widgets without attaching Entity bindings', async () => {
        const hostSourceConfig = encodeLayoutWidgetConfigEnvelope(
            { rendererConfig: { variant: 'compact' } },
            { templateKey: 'dashboard', widgetKey: 'workspaceSwitcher', zone: 'left' }
        )
        const hostSourceState = createApplicationLayoutWidgetSourceState('dashboard', 'workspaceSwitcher', {
            zone: 'left',
            sortOrder: 0,
            isActive: true,
            config: hostSourceConfig,
            instanceKey: 'workspace-switcher',
            parentWidgetId: null,
            slotKey: null
        })
        mockListCandidates.mockResolvedValue([
            layoutRow(),
            layoutRow({
                id: scopedLayoutId,
                scope_entity_id: entityId,
                config: { __layout: { composition: { mode: 'overlay', baseLayoutId: globalLayoutId } } }
            })
        ] as never)
        mockListWidgets.mockResolvedValue([
            {
                ...widgetRow({
                    id: scopedWidgetId,
                    layout_id: scopedLayoutId,
                    zone: 'left',
                    widget_key: 'workspaceSwitcher',
                    instance_key: 'workspace-switcher',
                    config: { variant: 'compact' },
                    source_config: hostSourceConfig,
                    source_widget_id: globalWidgetId,
                    source_base_widget_id: globalWidgetId
                }),
                source_state: hostSourceState
            }
        ])
        mockFindBaseWidgets.mockResolvedValue([
            {
                id: globalWidgetId,
                layout_id: globalLayoutId,
                source_widget_id: globalWidgetId,
                source_base_widget_id: null,
                template_key: 'dashboard',
                scope_entity_id: null,
                widget_key: 'workspaceSwitcher',
                instance_key: 'workspace-switcher',
                parent_widget_id: null,
                slot_key: null,
                zone: 'left',
                config: { variant: 'compact' },
                source_config: null
            }
        ])

        const result = await resolveEffectiveLayoutForRequest(
            executor,
            { applicationId, userId: 'user-1', role: 'member' },
            resolverInput()
        )

        expect(result.layout.compositionMode).toBe('overlay')
        expect(result.widgets).toHaveLength(1)
        expect(result.widgets[0]?.widgetKey).toBe('workspaceSwitcher')
        expect(getApplicationLayoutWidgetSourceBindingState(result.widgets[0])).toBeUndefined()
        expect(JSON.stringify(result)).not.toContain('bindings')
    })

    it('attaches only the validated base Marketing binding to a binding-free overlay delta', async () => {
        hashBaseTemplateKey = 'marketing-page'
        mockListCandidates.mockResolvedValue([
            layoutRow({
                template_key: 'marketing-page',
                config: { __layout: { composition: { mode: 'independent', baseLayoutId: null } } }
            }),
            layoutRow({
                id: scopedLayoutId,
                scope_entity_id: entityId,
                template_key: 'marketing-page',
                config: { __layout: { composition: { mode: 'overlay', baseLayoutId: globalLayoutId } } }
            })
        ] as never)
        mockListWidgets.mockResolvedValue([
            widgetRow({
                id: scopedWidgetId,
                layout_id: scopedLayoutId,
                zone: 'marketing-main',
                widget_key: 'marketing.hero',
                instance_key: 'page-hero',
                config: heroOverlayConfig(false),
                source_config: heroOverlayConfig(true),
                source_widget_id: globalWidgetId,
                source_base_widget_id: globalWidgetId
            })
        ] as never)
        mockFindBaseWidgets.mockResolvedValue([
            {
                id: globalWidgetId,
                layout_id: globalLayoutId,
                source_widget_id: globalWidgetId,
                source_base_widget_id: null,
                template_key: 'marketing-page',
                scope_entity_id: null,
                widget_key: 'marketing.hero',
                instance_key: 'page-hero',
                parent_widget_id: null,
                slot_key: null,
                zone: 'marketing-main',
                config: heroSourceConfig('config-binding'),
                source_config: heroSourceConfig('trusted-base-binding')
            }
        ] as never)

        const result = await resolveEffectiveLayoutForRequest(
            executor,
            { applicationId, userId: 'user-1', role: 'member' },
            resolverInput()
        )
        const resolvedHero = result.widgets.find(({ widgetKey }) => widgetKey === 'marketing.hero')

        expect(resolvedHero?.instanceKey).toBe('page-hero')
        expect(resolvedHero?.config).toEqual({ showLeadForm: false })
        expect(resolvedHero?.sourceConfig).toBeUndefined()
        expect(getApplicationLayoutWidgetSourceBindingState(resolvedHero)).toEqual(
            expect.objectContaining({ bindings: heroBinding('trusted-base-binding') })
        )
        expect(JSON.stringify(result)).not.toContain('bindings')
    })

    it('rejects a persisted binding in an inherited Marketing overlay source config', async () => {
        mockListCandidates.mockResolvedValue([
            layoutRow({
                template_key: 'marketing-page',
                config: { __layout: { composition: { mode: 'independent', baseLayoutId: null } } }
            }),
            layoutRow({
                id: scopedLayoutId,
                scope_entity_id: entityId,
                template_key: 'marketing-page',
                config: { __layout: { composition: { mode: 'overlay', baseLayoutId: globalLayoutId } } }
            })
        ] as never)
        mockListWidgets.mockResolvedValue([
            widgetRow({
                id: scopedWidgetId,
                layout_id: scopedLayoutId,
                zone: 'marketing-main',
                widget_key: 'marketing.hero',
                config: heroOverlayConfig(false),
                source_config: heroSourceConfig('forbidden-overlay-binding'),
                source_widget_id: globalWidgetId,
                source_base_widget_id: globalWidgetId
            })
        ] as never)

        await expect(
            resolveEffectiveLayoutForRequest(executor, { applicationId, userId: 'user-1', role: 'member' }, resolverInput())
        ).rejects.toMatchObject<Partial<EffectiveLayoutError>>({ code: 'LAYOUT_PERSISTED_INVALID', httpStatus: 409 })
    })

    it('allows a valid overlay whose inherited widgets are all hidden', async () => {
        mockListCandidates.mockResolvedValue([
            layoutRow(),
            layoutRow({
                id: scopedLayoutId,
                scope_entity_id: entityId,
                config: { __layout: { composition: { mode: 'overlay', baseLayoutId: globalLayoutId } } }
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

    it('keeps application-owned scoped layouts that pass the public lifecycle filter', async () => {
        mockListCandidates.mockResolvedValue([
            layoutRow({
                template_key: 'marketing-page',
                name: { en: 'Published marketing' },
                config: { themeMode: 'system', __layout: { composition: { mode: 'independent', baseLayoutId: null } } }
            }),
            layoutRow({
                id: scopedLayoutId,
                scope_entity_id: entityId,
                template_key: 'marketing-page',
                name: { en: 'Published local marketing' },
                config: { themeMode: 'system', __layout: { composition: { mode: 'independent', baseLayoutId: null } } },
                source_kind: 'application',
                source_layout_id: null,
                source_snapshot_hash: null,
                source_content_hash: null,
                local_content_hash: null
            })
        ] as never)
        mockListWidgets.mockResolvedValue([])

        const result = await resolveEffectiveLayoutForPublicTransaction(executor, resolverInput(), null)

        expect(result.layout.id).toBe(scopedLayoutId)
        expect(result.publicationIdentity).toBeNull()
        expect(mockFindEntity).toHaveBeenCalledWith(executor, schemaName, 'object', { kind: 'id', value: entityId }, 'public')
        expect(mockListCandidates).toHaveBeenCalledWith(executor, schemaName, entityId, 'public')
        expect(mockListWidgets).toHaveBeenCalledWith(executor, schemaName, scopedLayoutId, 'public')
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
