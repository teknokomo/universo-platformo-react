import {
    applicationLayoutSourceKindSchema,
    applicationLayoutSyncStateSchema,
    applicationTemplateKeySchema,
    getLayoutWidgetAllowedZones,
    getLayoutWidgetDefinition,
    getLayoutZoneDefinition,
    layoutInstanceKeySchema,
    parseApplicationLayoutConfig,
    parseApplicationLayoutWidgetConfig,
    type ApplicationLayoutSyncState,
    type ApplicationTemplateKey,
    type EffectiveWidget
} from '@universo-react/types'
import { isValidSchemaName } from '@universo-react/schema-ddl'
import { isUuidV7, type DbExecutor } from '@universo-react/utils'
import { hashApplicationLayoutContent } from '../utils/applicationLayoutHash'
import { resolveEffectiveRolePermissions, type ApplicationRole } from '../routes/guards'
import { resolveRuntimeWorkspaceAccess, setRuntimeWorkspaceContext } from './applicationWorkspaces'
import {
    findEffectiveLayoutApplication,
    findEffectiveLayoutBaseWidgets,
    findEffectiveLayoutEntity,
    effectiveLayoutTablesExist,
    listEffectiveLayoutCandidates,
    listEffectiveLayoutWidgets,
    type EffectiveLayoutBaseWidgetRow,
    type EffectiveLayoutCandidateRow,
    type EffectiveLayoutEntityRow,
    type EffectiveLayoutWidgetRow
} from '../persistence/effectiveLayoutStore'
import {
    EffectiveLayoutError,
    failEffectiveLayout,
    normalizeRuntimeTarget,
    type EffectiveLayoutCompositionMode,
    type EffectiveLayoutSuccess,
    type EffectiveLayoutWidget,
    type RuntimeTarget
} from './effectiveLayoutContract'
import { selectCanonicalLayoutCandidate } from './effectiveLayoutSelection'

type RecordValue = Record<string, unknown>

export interface EffectiveLayoutAuthContext {
    applicationId: string
    userId: string
    role: ApplicationRole
}

interface InstalledMaterialization {
    snapshotHash: string
    publicationId: string | null
    publicationVersionId: string | null
    sourceKind: 'publication' | 'release_bundle'
}

interface ValidatedLayout {
    id: string
    scopeEntityId: string | null
    templateKey: ApplicationTemplateKey
    name: RecordValue
    description: RecordValue | null
    config: RecordValue
    rawConfig: RecordValue
    compositionHint: EffectiveLayoutCompositionMode | null
    baseLayoutId: string | null
    isActive: boolean
    isDefault: boolean
    sortOrder: number
    sourceKind: 'metahub' | 'application'
    sourceLayoutId: string | null
    sourceSnapshotHash: string | null
    sourceContentHash: string | null
    localContentHash: string | null
    syncState: ApplicationLayoutSyncState
    version: number
}

const isRecord = (value: unknown): value is RecordValue => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const isSha256 = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/iu.test(value)

const requireUuidV7 = (value: unknown): string => {
    if (!isUuidV7(value)) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    return value
}

const readNullableUuidV7 = (value: unknown): string | null => {
    if (value === undefined || value === null) return null
    return requireUuidV7(value)
}

const readNullableHash = (value: unknown): string | null => {
    if (value === undefined || value === null) return null
    if (!isSha256(value)) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    return value
}

const readRecord = (value: unknown): RecordValue => {
    if (!isRecord(value)) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    return value
}

const readNullableRecord = (value: unknown): RecordValue | null => {
    if (value === undefined || value === null) return null
    return readRecord(value)
}

const readBoolean = (value: unknown): boolean => {
    if (typeof value !== 'boolean') return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    return value
}

const readPositiveInteger = (value: unknown): number => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }
    return value
}

const readInteger = (value: unknown): number => {
    if (typeof value !== 'number' || !Number.isInteger(value)) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    return value
}

const readNonNegativeInteger = (value: unknown): number => {
    const integer = readInteger(value)
    if (integer < 0) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    return integer
}

const queryOrFail = async <T>(query: () => Promise<T>): Promise<T> => {
    try {
        return await query()
    } catch (error) {
        if (error instanceof EffectiveLayoutError) throw error
        throw new EffectiveLayoutError('LAYOUT_RUNTIME_QUERY_FAILED')
    }
}

const parseInstalledMaterialization = (
    application: Awaited<ReturnType<typeof findEffectiveLayoutApplication>>
): InstalledMaterialization | null => {
    if (!application) return failEffectiveLayout('LAYOUT_TARGET_NOT_FOUND')
    if (application.installedReleaseMetadata === null || application.installedReleaseMetadata === undefined) {
        if (application.lastSyncedPublicationVersionId !== null && application.lastSyncedPublicationVersionId !== undefined) {
            return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        }
        return null
    }
    if (!isRecord(application.installedReleaseMetadata)) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')

    const metadata = application.installedReleaseMetadata
    if (metadata.kind !== 'application_release_installation' || metadata.bundleVersion !== 1) {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }
    if (metadata.sourceKind !== 'publication' && metadata.sourceKind !== 'release_bundle') {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }
    if (!isSha256(metadata.snapshotHash)) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')

    const publicationId = readNullableUuidV7(metadata.publicationId)
    const publicationVersionId = readNullableUuidV7(metadata.publicationVersionId)
    const lastSyncedPublicationVersionId = readNullableUuidV7(application.lastSyncedPublicationVersionId)
    if (Boolean(publicationId) !== Boolean(publicationVersionId)) {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }
    if (metadata.sourceKind === 'publication' && (!publicationId || !publicationVersionId)) {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }
    if (publicationVersionId && lastSyncedPublicationVersionId !== publicationVersionId) {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }
    if (lastSyncedPublicationVersionId && !publicationVersionId) {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }

    return {
        snapshotHash: metadata.snapshotHash,
        publicationId,
        publicationVersionId,
        sourceKind: metadata.sourceKind
    }
}

const parseCompositionHint = (value: unknown): EffectiveLayoutCompositionMode | null => {
    if (value === undefined || value === null) return null
    if (value === 'overlay' || value === 'independent') return value
    return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
}

const parseOptionalBaseLayoutId = (value: unknown): { value: string | null; present: boolean } => {
    const present = value !== undefined
    if (!present || value === null) return { value: null, present }
    return { value: requireUuidV7(value), present }
}

const validateLayoutRow = (row: EffectiveLayoutCandidateRow): ValidatedLayout => {
    const id = requireUuidV7(row.id)
    const scopeEntityId = readNullableUuidV7(row.scope_entity_id)
    const templateKeyResult = applicationTemplateKeySchema.safeParse(row.template_key)
    if (!templateKeyResult.success) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    const sourceKindResult = applicationLayoutSourceKindSchema.safeParse(row.source_kind)
    if (!sourceKindResult.success) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    const syncStateResult = applicationLayoutSyncStateSchema.safeParse(row.sync_state)
    if (!syncStateResult.success) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')

    const isActive = readBoolean(row.is_active)
    const isDefault = readBoolean(row.is_default)
    if (!isActive) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    if (readBoolean(row.is_source_excluded)) return failEffectiveLayout('LAYOUT_CONFLICT')

    const rawConfig = readRecord(row.config)
    const compositionHint = parseCompositionHint(rawConfig.compositionMode)
    const baseLayout = parseOptionalBaseLayoutId(rawConfig.baseLayoutId)
    const rendererConfig = { ...rawConfig }
    delete rendererConfig.compositionMode
    delete rendererConfig.baseLayoutId

    let config: RecordValue
    try {
        config = parseApplicationLayoutConfig(templateKeyResult.data, rendererConfig)
    } catch {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }

    return {
        id,
        scopeEntityId,
        templateKey: templateKeyResult.data,
        name: readRecord(row.name),
        description: readNullableRecord(row.description),
        config,
        rawConfig,
        compositionHint,
        baseLayoutId: baseLayout.value,
        isActive,
        isDefault,
        sortOrder: readNonNegativeInteger(row.sort_order),
        sourceKind: sourceKindResult.data,
        sourceLayoutId: readNullableUuidV7(row.source_layout_id),
        sourceSnapshotHash: readNullableHash(row.source_snapshot_hash),
        sourceContentHash: readNullableHash(row.source_content_hash),
        localContentHash: readNullableHash(row.local_content_hash),
        syncState: syncStateResult.data,
        version: readPositiveInteger(row.version)
    }
}

const validateWidgetRow = (row: EffectiveLayoutWidgetRow, layout: ValidatedLayout): EffectiveLayoutWidget => {
    const id = requireUuidV7(row.id)
    const layoutId = requireUuidV7(row.layout_id)
    if (layoutId !== layout.id) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    if (typeof row.zone !== 'string' || typeof row.widget_key !== 'string') {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }
    const definition = getLayoutWidgetDefinition(row.widget_key)
    const allowedZones = getLayoutWidgetAllowedZones(row.widget_key, layout.templateKey)
    if (!definition || !definition.supportedTemplates.includes(layout.templateKey) || !allowedZones?.some((zone) => zone === row.zone)) {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }
    const zoneDefinition = getLayoutZoneDefinition(row.zone as EffectiveWidget['zone'], layout.templateKey)
    if (!zoneDefinition) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    const config = readRecord(row.config)
    let parsedConfig: RecordValue
    try {
        parsedConfig = parseApplicationLayoutWidgetConfig(row.widget_key, config)
    } catch {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }

    const sourceConfig = row.source_config === undefined || row.source_config === null ? null : readRecord(row.source_config)
    const sourceWidgetId = readNullableUuidV7(row.source_widget_id)
    const sourceBaseWidgetId = readNullableUuidV7(row.source_base_widget_id)
    const instanceKey = parsedConfig.instanceKey
    if (instanceKey !== undefined && !layoutInstanceKeySchema.safeParse(instanceKey).success) {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }

    return {
        id,
        layoutId,
        zone: row.zone as EffectiveLayoutWidget['zone'],
        semanticRegion: zoneDefinition.semanticRegion,
        widgetKey: row.widget_key as EffectiveLayoutWidget['widgetKey'],
        ...(typeof instanceKey === 'string' ? { instanceKey } : {}),
        sortOrder: readInteger(row.sort_order),
        config: parsedConfig,
        sourceConfig,
        sourceWidgetId,
        sourceBaseWidgetId,
        isCustomized: readBoolean(row.is_customized),
        isActive: readBoolean(row.is_active),
        version: readPositiveInteger(row.version)
    }
}

const validateEffectiveWidgetMultiplicity = (widgets: readonly EffectiveLayoutWidget[]): void => {
    const seenSingletons = new Set<string>()
    for (const widget of widgets) {
        const definition = getLayoutWidgetDefinition(widget.widgetKey)
        if (!definition || definition.multiInstance) continue
        if (seenSingletons.has(widget.widgetKey)) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        seenSingletons.add(widget.widgetKey)
    }
}

const validateBaseLineage = (
    widgets: readonly EffectiveLayoutWidget[],
    baseRows: readonly EffectiveLayoutBaseWidgetRow[],
    layout: ValidatedLayout,
    availableLayouts: readonly ValidatedLayout[]
): void => {
    const inheritedIds = widgets.map((widget) => widget.sourceBaseWidgetId).filter((id): id is string => typeof id === 'string')
    const uniqueInheritedIds = new Set(inheritedIds)
    if (uniqueInheritedIds.size !== inheritedIds.length) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    if (inheritedIds.length > 0 && (!layout.scopeEntityId || !layout.baseLayoutId)) {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }
    if (layout.baseLayoutId !== null) {
        const baseLayout = availableLayouts.find((candidate) => candidate.id === layout.baseLayoutId)
        if (!baseLayout || baseLayout.scopeEntityId !== null || baseLayout.templateKey !== layout.templateKey) {
            return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        }
    }

    const rowsByReference = new Map<string, EffectiveLayoutBaseWidgetRow>()
    for (const row of baseRows) {
        const id = requireUuidV7(row.id)
        const layoutId = requireUuidV7(row.layout_id)
        const scopeEntityId = readNullableUuidV7(row.scope_entity_id)
        if (inheritedIds.length > 0 && (layoutId !== layout.baseLayoutId || scopeEntityId !== null)) {
            return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        }
        const references = [id, readNullableUuidV7(row.source_widget_id), readNullableUuidV7(row.source_base_widget_id)].filter(
            (reference): reference is string => reference !== null
        )
        for (const reference of references) {
            const existing = rowsByReference.get(reference)
            if (existing && existing.id !== row.id) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
            rowsByReference.set(reference, row)
        }
    }

    const matchedBaseRows = new Set<string>()
    for (const widget of widgets) {
        const baseId = widget.sourceBaseWidgetId
        if (!baseId) continue
        const base = rowsByReference.get(baseId)
        if (!base || base.template_key !== layout.templateKey || base.widget_key !== widget.widgetKey) {
            return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        }
        if (widget.sourceWidgetId !== baseId) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        matchedBaseRows.add(requireUuidV7(base.id))
    }
    if (matchedBaseRows.size !== uniqueInheritedIds.size) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
}

const resolveCompositionMode = (layout: ValidatedLayout, widgets: readonly EffectiveLayoutWidget[]): EffectiveLayoutCompositionMode => {
    const hasInheritedWidgets = widgets.some((widget) => widget.sourceBaseWidgetId !== null)
    if (layout.compositionHint === null) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    const compositionMode = layout.compositionHint

    if (layout.scopeEntityId === null && compositionMode === 'overlay') {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }
    if (compositionMode === 'independent' && hasInheritedWidgets) {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }
    if (compositionMode === 'independent' && layout.baseLayoutId !== null) {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }
    if (compositionMode === 'overlay' && layout.baseLayoutId === null) {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }

    return compositionMode
}

const buildPrecedence = (layout: ValidatedLayout, scope: 'global' | 'entity'): EffectiveLayoutSuccess['precedence'] => {
    const scopePrecedence: 'application-entity' | 'application-global' = scope === 'entity' ? 'application-entity' : 'application-global'
    if (layout.sourceKind === 'metahub') {
        return ['published-publication', scopePrecedence, 'metahub-provenance']
    }
    return layout.sourceLayoutId ? [scopePrecedence, 'metahub-provenance'] : [scopePrecedence]
}

const validateLineage = (
    layout: ValidatedLayout,
    materialization: InstalledMaterialization | null
): { publicationIdentity: EffectiveLayoutSuccess['publicationIdentity'] } => {
    if (layout.syncState !== 'clean' && layout.syncState !== 'local_modified') {
        return failEffectiveLayout('LAYOUT_CONFLICT')
    }

    if (layout.sourceKind === 'metahub') {
        if (!layout.sourceLayoutId || !layout.sourceSnapshotHash) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        if (!materialization || !materialization.publicationId || !materialization.publicationVersionId) {
            return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        }
        if (layout.sourceSnapshotHash !== materialization.snapshotHash) {
            return failEffectiveLayout('LAYOUT_CONFLICT')
        }
        return {
            publicationIdentity: {
                publicationId: materialization.publicationId,
                publicationVersionId: materialization.publicationVersionId,
                snapshotHash: materialization.snapshotHash
            }
        }
    }

    if (layout.sourceSnapshotHash !== null) return failEffectiveLayout('LAYOUT_CONFLICT')
    return { publicationIdentity: null }
}

const buildResult = (
    target: RuntimeTarget,
    resolvedEntityTypeId: string | null,
    selected: { layout: ValidatedLayout; scope: 'global' | 'entity' },
    widgets: EffectiveLayoutWidget[],
    materialization: InstalledMaterialization | null,
    publicationIdentity: EffectiveLayoutSuccess['publicationIdentity'],
    compositionMode: EffectiveLayoutCompositionMode
): EffectiveLayoutSuccess => {
    const { layout, scope } = selected
    const effectiveHash = hashApplicationLayoutContent({
        layout: {
            templateKey: layout.templateKey,
            name: layout.name,
            description: layout.description,
            config: {
                ...layout.config,
                compositionMode,
                baseLayoutId: layout.baseLayoutId
            },
            isActive: true,
            isDefault: true,
            sortOrder: layout.sortOrder,
            scopeEntityId: layout.scopeEntityId
        },
        widgets: [...widgets]
    })

    const layoutMetadata = {
        id: layout.id,
        scopeKind: scope,
        scopeEntityId: layout.scopeEntityId,
        templateKey: layout.templateKey,
        sourceKind: layout.sourceKind,
        sourceLayoutId: layout.sourceLayoutId,
        sourceSnapshotHash: layout.sourceSnapshotHash,
        sourceContentHash: layout.sourceContentHash,
        localContentHash: layout.localContentHash,
        syncState: layout.syncState,
        name: layout.name,
        description: layout.description,
        config: layout.config,
        isActive: true as const,
        isDefault: true as const,
        sortOrder: layout.sortOrder,
        version: layout.version
    }
    const resolvedLayout =
        compositionMode === 'overlay'
            ? { ...layoutMetadata, compositionMode: 'overlay' as const, baseLayoutId: layout.baseLayoutId as string }
            : { ...layoutMetadata, compositionMode: 'independent' as const, baseLayoutId: null }

    return {
        status: 'ok',
        target,
        resolvedEntityTypeId,
        scope,
        layout: resolvedLayout,
        widgets,
        precedence: buildPrecedence(layout, scope),
        publicationIdentity,
        ...(materialization ? { materializationHash: materialization.snapshotHash } : {}),
        effectiveHash
    }
}

const resolveWorkspace = async (
    executor: DbExecutor,
    application: Awaited<ReturnType<typeof findEffectiveLayoutApplication>>,
    authContext: EffectiveLayoutAuthContext,
    target: RuntimeTarget
): Promise<void> => {
    if (!application) return failEffectiveLayout('LAYOUT_TARGET_NOT_FOUND')
    if (typeof application.workspacesEnabled !== 'boolean') return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    if (!application.workspacesEnabled) {
        if (target.workspaceId) return failEffectiveLayout('LAYOUT_TARGET_FORBIDDEN')
        return
    }

    const settings = application.settings === null ? null : readRecord(application.settings)
    const permissions = resolveEffectiveRolePermissions(authContext.role, settings)
    const schemaName = application.schemaName
    if (typeof schemaName !== 'string' || !isValidSchemaName(schemaName)) {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }
    const access = await queryOrFail(() =>
        resolveRuntimeWorkspaceAccess(executor, {
            schemaName,
            workspacesEnabled: true,
            userId: authContext.userId,
            actorUserId: authContext.userId,
            ensurePersonalWorkspace: false,
            allowUnassigned: permissions.manageApplication === true
        })
    )
    const currentWorkspaceId = target.workspaceId ?? access.defaultWorkspaceId
    if (!currentWorkspaceId || !access.allowedWorkspaceIds.includes(currentWorkspaceId)) {
        return failEffectiveLayout('LAYOUT_TARGET_FORBIDDEN')
    }
    await queryOrFail(() => setRuntimeWorkspaceContext(executor, currentWorkspaceId))
}

const readStartupTargetToken = (config: RecordValue): string | null => {
    const startTarget = config.startTarget
    if (isRecord(startTarget)) {
        if (startTarget.kind === 'section' && typeof startTarget.sectionId === 'string' && startTarget.sectionId.trim()) {
            return startTarget.sectionId.trim()
        }
        if (
            startTarget.kind === 'objectCollection' &&
            typeof startTarget.objectCollectionId === 'string' &&
            startTarget.objectCollectionId.trim()
        ) {
            return startTarget.objectCollectionId.trim()
        }
    }

    const startPage = typeof config.startPage === 'string' ? config.startPage.trim() : ''
    if (!startPage) return null

    const items = Array.isArray(config.items) ? config.items : []
    const matchedItem = items.find((item) => isRecord(item) && item.id === startPage)
    if (isRecord(matchedItem)) {
        for (const key of ['sectionId', 'objectCollectionId']) {
            const value = matchedItem[key]
            if (typeof value === 'string' && value.trim()) return value.trim()
        }
    }

    return startPage
}

const resolveStartupEntityId = async (
    executor: DbExecutor,
    schemaName: string,
    globalWidgets: readonly EffectiveLayoutWidgetRow[]
): Promise<string | null> => {
    const menuWidgets = globalWidgets.filter((row) => row.widget_key === 'menuWidget')
    for (const menuWidget of menuWidgets) {
        const config = isRecord(menuWidget.config) ? menuWidget.config : null
        const token = config ? readStartupTargetToken(config) : null
        if (!token) continue

        const selector = isUuidV7(token) ? { kind: 'id' as const, value: token } : { kind: 'codename' as const, value: token }
        for (const targetKind of ['page', 'object'] as const) {
            const entities = await queryOrFail(() => findEffectiveLayoutEntity(executor, schemaName, targetKind, selector))
            if (entities.length > 1) return failEffectiveLayout('LAYOUT_DEFAULT_INVALID')
            const entity = entities[0]
            if (entity) return requireUuidV7(entity.id)
        }
    }

    return null
}

export async function resolveEffectiveLayoutForRequest(
    executor: DbExecutor,
    authContext: EffectiveLayoutAuthContext,
    input: unknown
): Promise<EffectiveLayoutSuccess> {
    const target = normalizeRuntimeTarget(input)
    if (!authContext.userId) return failEffectiveLayout('UNAUTHORIZED')
    if (authContext.applicationId !== target.applicationId) return failEffectiveLayout('LAYOUT_TARGET_FORBIDDEN')

    return executor.transaction(async (tx) => {
        const application = await queryOrFail(() => findEffectiveLayoutApplication(tx, target.applicationId))
        if (!application) return failEffectiveLayout('LAYOUT_TARGET_NOT_FOUND')
        if (application.id !== target.applicationId || !isUuidV7(application.id)) {
            return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        }
        if (typeof application.schemaName !== 'string' || !isValidSchemaName(application.schemaName)) {
            return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        }
        const materialization = parseInstalledMaterialization(application)

        // Establish the request workspace context before resolving an entity.
        // Entity metadata is RLS-scoped in deployments that enable workspaces;
        // doing this after the entity lookup would turn a forbidden workspace
        // into an existence oracle.
        await resolveWorkspace(tx, application, authContext, target)

        let resolvedEntityTypeId: string | null = null
        if (target.targetKind !== null) {
            const selectorValue = target.entityTypeId ?? target.entityTypeCodename
            if (!selectorValue) return failEffectiveLayout('LAYOUT_REQUEST_INVALID')
            const selector = target.entityTypeId
                ? { kind: 'id' as const, value: selectorValue }
                : { kind: 'codename' as const, value: selectorValue }
            const entities = await queryOrFail(() => findEffectiveLayoutEntity(tx, application.schemaName!, target.targetKind, selector))
            if (entities.length === 0) return failEffectiveLayout('LAYOUT_TARGET_NOT_FOUND')
            if (entities.length > 1) return failEffectiveLayout('LAYOUT_DEFAULT_INVALID')
            const entity = entities[0] as EffectiveLayoutEntityRow
            if (target.targetKind === 'page' && entity.kind !== 'page') return failEffectiveLayout('LAYOUT_TARGET_NOT_FOUND')
            resolvedEntityTypeId = requireUuidV7(entity.id)
        }

        const tablesExist = await queryOrFail(() => effectiveLayoutTablesExist(tx, application.schemaName!))
        if (!tablesExist) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')

        let candidateRows = await queryOrFail(() => listEffectiveLayoutCandidates(tx, application.schemaName!, resolvedEntityTypeId))
        const layouts = candidateRows.map(validateLayoutRow)
        let selected = selectCanonicalLayoutCandidate(layouts, resolvedEntityTypeId)
        if (!selected) return failEffectiveLayout('LAYOUT_DEFAULT_INVALID')

        // The root application route has no entity selector. Resolve its
        // startup menu target so a page/object-specific layout is rendered
        // before the first navigation click, matching the runtime data route.
        if (target.targetKind === null && selected.scope === 'global') {
            const globalLayout = selected
            const globalWidgetRows = await queryOrFail(() =>
                listEffectiveLayoutWidgets(tx, application.schemaName!, globalLayout.layout.id)
            )
            const startupEntityId = await resolveStartupEntityId(tx, application.schemaName!, globalWidgetRows)
            if (startupEntityId) {
                resolvedEntityTypeId = startupEntityId
                candidateRows = await queryOrFail(() => listEffectiveLayoutCandidates(tx, application.schemaName!, resolvedEntityTypeId))
                const startupLayouts = candidateRows.map(validateLayoutRow)
                selected = selectCanonicalLayoutCandidate(startupLayouts, resolvedEntityTypeId)
                if (!selected) return failEffectiveLayout('LAYOUT_DEFAULT_INVALID')
            }
        }
        if (!selected) return failEffectiveLayout('LAYOUT_DEFAULT_INVALID')

        const widgetRows = await queryOrFail(() => listEffectiveLayoutWidgets(tx, application.schemaName!, selected.layout.id))
        const widgets = widgetRows.map((row) => validateWidgetRow(row, selected.layout))
        validateEffectiveWidgetMultiplicity(widgets)
        const inheritedIds = widgets.map((widget) => widget.sourceBaseWidgetId).filter((id): id is string => typeof id === 'string')
        const baseRows = await queryOrFail(() => findEffectiveLayoutBaseWidgets(tx, application.schemaName!, inheritedIds))
        validateBaseLineage(widgets, baseRows, selected.layout, layouts)
        const compositionMode = resolveCompositionMode(selected.layout, widgets)
        const { publicationIdentity } = validateLineage(selected.layout, materialization)

        // Layout and widget mutations advance the layout version. Re-read the
        // application and candidate set before returning so a READ COMMITTED
        // transaction cannot publish a torn layout assembled across commits.
        const currentApplication = await queryOrFail(() => findEffectiveLayoutApplication(tx, target.applicationId))
        if (!currentApplication || currentApplication.version !== application.version) {
            return failEffectiveLayout('LAYOUT_CONFLICT')
        }
        const currentCandidateRows = await queryOrFail(() =>
            listEffectiveLayoutCandidates(tx, application.schemaName!, resolvedEntityTypeId)
        )
        const currentLayouts = currentCandidateRows.map(validateLayoutRow)
        const currentSelected = selectCanonicalLayoutCandidate(currentLayouts, resolvedEntityTypeId)
        if (
            !currentSelected ||
            currentSelected.layout.id !== selected.layout.id ||
            currentSelected.layout.version !== selected.layout.version ||
            currentSelected.scope !== selected.scope
        ) {
            return failEffectiveLayout('LAYOUT_CONFLICT')
        }
        if (selected.layout.baseLayoutId) {
            const currentBase = currentLayouts.find((layout) => layout.id === selected.layout.baseLayoutId)
            const initialBase = layouts.find((layout) => layout.id === selected.layout.baseLayoutId)
            if (!currentBase || !initialBase || currentBase.version !== initialBase.version) {
                return failEffectiveLayout('LAYOUT_CONFLICT')
            }
        }

        return buildResult(target, resolvedEntityTypeId, selected, widgets, materialization, publicationIdentity, compositionMode)
    })
}
