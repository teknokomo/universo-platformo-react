import {
    applicationLayoutSourceKindSchema,
    applicationLayoutSyncStateSchema,
    applicationTemplateKeySchema,
    decodeLayoutConfigEnvelope,
    encodeLayoutConfigEnvelope,
    getLayoutWidgetDefaultPlacement,
    getLayoutWidgetAllowedZones,
    getLayoutWidgetDefinition,
    getLayoutZoneDefinition,
    layoutInstanceKeySchema,
    parseApplicationLayoutConfig,
    type ApplicationLayoutSyncState,
    type ApplicationTemplateKey,
    type LayoutZoneSettings,
    type PersistedLayoutNeutralMetadata,
    type PersistedWidgetNeutralMetadata
} from '@universo-react/types'
import stableStringify from 'json-stable-stringify'
import { isValidSchemaName } from '@universo-react/schema-ddl'
import { isUuidV7, type DbExecutor } from '@universo-react/utils'
import { hashApplicationLayoutContentFromStore } from '../persistence/applicationLayoutHashContext'
import {
    attachApplicationLayoutWidgetSourceBindingState,
    copyApplicationLayoutWidgetSourceBindingState,
    getApplicationLayoutWidgetSourceBindingState
} from '../persistence/applicationLayoutStoreSupport'
import {
    applicationLayoutWidgetSourceStatesEqual,
    createApplicationLayoutWidgetSourceState,
    isApplicationLayoutWidgetCustomized,
    parseApplicationLayoutWidgetSourceState
} from './applicationLayoutWidgetSourceState'
import { resolveEffectiveRolePermissions, type ApplicationRole, type RolePermission } from '../routes/guards'
import { resolveRuntimeWorkspaceAccess, setRuntimeWorkspaceContext } from './applicationWorkspaces'
import type { EffectiveLayoutRuntimeDataResolver, EffectiveWidgetRuntimeReadScope } from './effectiveWidgetRuntimeDataContracts'
import {
    classifyPlacementLineage,
    decodePlacementWidgetConfigEnvelope,
    resolvePlacementBindingPolicy,
    resolvePlacementBindingValidation,
    resolvePlacementRegistryDefinition
} from '../persistence/applicationLayoutWidgetPlacement'
import {
    findEffectiveLayoutApplication,
    findEffectiveLayoutBaseWidgets,
    findEffectiveLayoutEntity,
    findEffectiveLayoutHomePages,
    effectiveLayoutTablesExist,
    listEffectiveLayoutCandidates,
    listEffectiveLayoutWidgets,
    type EffectiveLayoutBaseWidgetRow,
    type EffectiveLayoutCandidateRow,
    type EffectiveLayoutEntityRow,
    type EffectiveLayoutReadVisibility,
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
import { projectEffectiveRuntimeWidgets, resolveEffectiveZoneSettings } from './effectiveLayoutProjection'
import {
    isRecord,
    isSha256,
    readBoolean,
    readInteger,
    readNonNegativeInteger,
    readNullableHash,
    readNullableRecord,
    readNullableUuidV7,
    readPositiveInteger,
    readRecord,
    requireUuidV7,
    type RecordValue
} from './effectiveLayoutReadValidation'

const PUBLIC_RUNTIME_PERMISSIONS: Record<RolePermission, boolean> = {
    manageMembers: false,
    manageApplication: false,
    createContent: false,
    editContent: false,
    deleteContent: false,
    readReports: false
}

interface ResolvedEffectiveWidget {
    id: string
    layoutId: string
    instanceKey: string
    parentWidgetId: string | null
    slotKey: string | null
    zone: string
    semanticRegion: string
    widgetKey: string
    sortOrder: number
    config: RecordValue
    sourceConfig: RecordValue | null
    sourceWidgetId: string | null
    sourceBaseWidgetId: string | null
    isCustomized: boolean
    isActive: boolean
    version: number
    placement?: 'start' | 'end'
}

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
    neutral: PersistedLayoutNeutralMetadata
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
    let config: RecordValue
    let neutral: PersistedLayoutNeutralMetadata
    let compositionHint: EffectiveLayoutCompositionMode | null
    let baseLayoutId: string | null
    try {
        const decoded = decodeLayoutConfigEnvelope(rawConfig, { templateKey: templateKeyResult.data })
        if (!decoded.neutral.composition) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        neutral = decoded.neutral
        config = parseApplicationLayoutConfig(templateKeyResult.data, decoded.rendererConfig)
        compositionHint = decoded.neutral.composition.mode
        baseLayoutId = decoded.neutral.composition.mode === 'overlay' ? decoded.neutral.composition.baseLayoutId : null
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
        neutral,
        compositionHint,
        baseLayoutId,
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

const validateWidgetRow = (row: EffectiveLayoutWidgetRow, layout: ValidatedLayout): ResolvedEffectiveWidget => {
    const id = requireUuidV7(row.id)
    const layoutId = requireUuidV7(row.layout_id)
    if (layoutId !== layout.id) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    const instanceKey = layoutInstanceKeySchema.safeParse(row.instance_key)
    if (!instanceKey.success) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    const parentWidgetId = readNullableUuidV7(row.parent_widget_id)
    const slotKey = row.slot_key === null ? null : typeof row.slot_key === 'string' ? row.slot_key.trim() : null
    if ((parentWidgetId === null) !== (slotKey === null) || (slotKey !== null && (slotKey.length === 0 || slotKey.length > 128))) {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }
    const sourceWidgetId = readNullableUuidV7(row.source_widget_id)
    const sourceBaseWidgetId = readNullableUuidV7(row.source_base_widget_id)
    const lineage = classifyPlacementLineage(sourceWidgetId, sourceBaseWidgetId)
    const bindingsInheritedFromBase = sourceBaseWidgetId !== null
    if (typeof row.zone !== 'string' || typeof row.widget_key !== 'string') {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }
    const registryDefinition = resolvePlacementRegistryDefinition(row.widget_key)
    const definition = getLayoutWidgetDefinition(row.widget_key)
    const allowedZones = getLayoutWidgetAllowedZones(row.widget_key, layout.templateKey)
    if (
        !registryDefinition ||
        !definition ||
        !registryDefinition.supportedTemplates.includes(layout.templateKey) ||
        !allowedZones?.some((zone) => zone === row.zone)
    ) {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }
    const zoneDefinition = getLayoutZoneDefinition(row.zone as EffectiveLayoutWidget['zone'], layout.templateKey)
    if (!zoneDefinition) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    const config = readRecord(row.config)
    const bindingValidation = resolvePlacementBindingValidation(
        row.widget_key,
        config,
        lineage.kind === 'source-linked',
        bindingsInheritedFromBase
    )
    let parsedConfig: RecordValue
    let placement: 'start' | 'end' | undefined
    let configBindings: PersistedWidgetNeutralMetadata['bindings']
    try {
        const decoded = decodePlacementWidgetConfigEnvelope(config, {
            templateKey: layout.templateKey,
            widgetKey: row.widget_key,
            zone: row.zone,
            instanceKey: instanceKey.data,
            requireBindings: bindingValidation.requireBindings && (row.source_config === undefined || row.source_config === null)
        })
        if (bindingValidation.rejectBindings && decoded.neutral.bindings !== undefined) {
            return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        }
        configBindings = decoded.neutral.bindings
        parsedConfig = decoded.rendererConfig
        placement =
            decoded.neutral.placement ??
            getLayoutWidgetDefaultPlacement({
                templateKey: layout.templateKey,
                widgetKey: row.widget_key,
                zone: row.zone,
                rendererConfig: parsedConfig
            })
    } catch {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }

    let sourceConfig: RecordValue | null = null
    let sourceBindings: PersistedWidgetNeutralMetadata['bindings']
    if (row.source_config !== undefined && row.source_config !== null) {
        try {
            const rawSourceConfig = readRecord(row.source_config)
            const sourceValidation = resolvePlacementBindingValidation(
                row.widget_key,
                rawSourceConfig,
                lineage.kind === 'source-linked',
                bindingsInheritedFromBase
            )
            const decoded = decodePlacementWidgetConfigEnvelope(rawSourceConfig, {
                templateKey: layout.templateKey,
                widgetKey: row.widget_key,
                zone: row.zone,
                instanceKey: instanceKey.data,
                requireBindings: sourceValidation.requireBindings
            })
            if (sourceValidation.rejectBindings && decoded.neutral.bindings !== undefined) {
                return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
            }
            if (
                !bindingsInheritedFromBase &&
                configBindings !== undefined &&
                stableStringify(configBindings) !== stableStringify(decoded.neutral.bindings)
            ) {
                return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
            }
            sourceConfig = decoded.rendererConfig
            if (!bindingsInheritedFromBase) sourceBindings = decoded.neutral.bindings
        } catch {
            return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        }
    }
    let isCustomized = false
    if (row.source_state !== undefined && row.source_state !== null) {
        if (row.source_config === undefined || row.source_config === null) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        try {
            const sourceState = parseApplicationLayoutWidgetSourceState(row.source_state, layout.templateKey, row.widget_key)
            const sourceConfigState = createApplicationLayoutWidgetSourceState(
                layout.templateKey,
                row.widget_key,
                {
                    zone: sourceState.zone,
                    sortOrder: sourceState.sortOrder,
                    isActive: sourceState.isActive,
                    config: row.source_config,
                    instanceKey: sourceState.instanceKey,
                    parentWidgetId: sourceState.parentWidgetId,
                    slotKey: sourceState.slotKey
                },
                bindingValidation
            )
            if (!applicationLayoutWidgetSourceStatesEqual(sourceState, sourceConfigState)) {
                return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
            }
            isCustomized = isApplicationLayoutWidgetCustomized(
                layout.templateKey,
                {
                    widgetKey: row.widget_key,
                    zone: row.zone,
                    sortOrder: readInteger(row.sort_order),
                    isActive: readBoolean(row.is_active),
                    config: parsedConfig,
                    instanceKey: instanceKey.data,
                    parentWidgetId,
                    slotKey,
                    placement: placement ?? null
                },
                sourceState
            )
        } catch {
            return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        }
    } else if (row.source_config !== undefined && row.source_config !== null) {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    } else {
        sourceBindings = configBindings
    }

    const widget = {
        id,
        layoutId,
        instanceKey: instanceKey.data,
        parentWidgetId,
        slotKey,
        zone: row.zone as EffectiveLayoutWidget['zone'],
        semanticRegion: zoneDefinition.semanticRegion,
        widgetKey: row.widget_key as EffectiveLayoutWidget['widgetKey'],
        sortOrder: readInteger(row.sort_order),
        config: parsedConfig,
        sourceConfig,
        sourceWidgetId,
        sourceBaseWidgetId,
        isCustomized,
        isActive: readBoolean(row.is_active),
        version: readPositiveInteger(row.version),
        ...(placement === undefined ? {} : { placement })
    } satisfies ResolvedEffectiveWidget
    if (bindingValidation.rejectBindings) return widget
    return attachApplicationLayoutWidgetSourceBindingState(widget, {
        persistedApplicationRow: true,
        ...(sourceBindings === undefined ? {} : { bindings: sourceBindings })
    })
}

const validateEffectiveWidgetMultiplicity = (widgets: readonly ResolvedEffectiveWidget[]): void => {
    const seenSingletons = new Set<string>()
    for (const widget of widgets) {
        const definition = getLayoutWidgetDefinition(widget.widgetKey)
        if (!definition || definition.multiInstance) continue
        if (seenSingletons.has(widget.widgetKey)) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        seenSingletons.add(widget.widgetKey)
    }
}

const validateBaseLineage = (
    widgets: readonly ResolvedEffectiveWidget[],
    baseRows: readonly EffectiveLayoutBaseWidgetRow[],
    layout: ValidatedLayout,
    availableLayouts: readonly ValidatedLayout[]
): Map<string, EffectiveLayoutBaseWidgetRow> => {
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
    const baseRowsByInheritedWidgetId = new Map<string, EffectiveLayoutBaseWidgetRow>()
    for (const widget of widgets) {
        const baseId = widget.sourceBaseWidgetId
        if (!baseId) continue
        const base = rowsByReference.get(baseId)
        if (!base || base.template_key !== layout.templateKey || base.widget_key !== widget.widgetKey) {
            return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        }
        if (widget.sourceWidgetId !== baseId) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        matchedBaseRows.add(requireUuidV7(base.id))
        baseRowsByInheritedWidgetId.set(widget.id, base)
    }
    if (matchedBaseRows.size !== uniqueInheritedIds.size) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    return baseRowsByInheritedWidgetId
}

const attachValidatedSourceOverlayBindings = (
    widgets: readonly ResolvedEffectiveWidget[],
    baseRowsByInheritedWidgetId: ReadonlyMap<string, EffectiveLayoutBaseWidgetRow>,
    layout: ValidatedLayout
): ResolvedEffectiveWidget[] =>
    widgets.map((widget) => {
        if (widget.sourceBaseWidgetId === null) return widget
        const lineage = classifyPlacementLineage(widget.sourceWidgetId, widget.sourceBaseWidgetId)
        const policy = resolvePlacementBindingPolicy(widget.widgetKey, widget.config)
        if (lineage.kind !== 'source-linked' || policy.sourceAuthority !== 'metahub-source') {
            return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        }
        const base = baseRowsByInheritedWidgetId.get(widget.id)
        if (!base || typeof base.zone !== 'string') return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        let bindings: PersistedWidgetNeutralMetadata['bindings']
        try {
            const authoritativeConfig = base.source_config ?? base.config
            const baseInstanceKey = layoutInstanceKeySchema.parse(base.instance_key)
            const decoded = decodePlacementWidgetConfigEnvelope(readRecord(authoritativeConfig), {
                templateKey: layout.templateKey,
                widgetKey: widget.widgetKey,
                zone: base.zone,
                instanceKey: baseInstanceKey,
                requireBindings: policy.sourceMode === 'required'
            })
            if ((policy.sourceMode === 'none' || policy.sourceMode === 'specialized') && decoded.neutral.bindings !== undefined) {
                return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
            }
            bindings = decoded.neutral.bindings
        } catch {
            return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        }
        // Source placement can be inherited even when host widgets do not inherit Entity bindings.
        if (!policy.inheritBindings) return widget
        return attachApplicationLayoutWidgetSourceBindingState(widget, {
            persistedApplicationRow: true,
            ...(bindings === undefined ? {} : { bindings })
        })
    })

const resolveCompositionMode = (layout: ValidatedLayout, widgets: readonly ResolvedEffectiveWidget[]): EffectiveLayoutCompositionMode => {
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

const buildResult = async (
    tx: DbExecutor,
    schemaName: string,
    target: RuntimeTarget,
    resolvedEntityTypeId: string | null,
    selected: { layout: ValidatedLayout; scope: 'global' | 'entity' },
    widgets: ResolvedEffectiveWidget[],
    materialization: InstalledMaterialization | null,
    publicationIdentity: EffectiveLayoutSuccess['publicationIdentity'],
    compositionMode: EffectiveLayoutCompositionMode,
    effectiveZoneSettings: Record<string, Record<string, unknown>>,
    runtimeReadScope: EffectiveWidgetRuntimeReadScope,
    runtimeDataResolver?: EffectiveLayoutRuntimeDataResolver
): Promise<EffectiveLayoutSuccess> => {
    const { layout, scope } = selected
    const hashConfig = encodeLayoutConfigEnvelope(
        {
            rendererConfig: layout.config,
            neutral: {
                composition:
                    compositionMode === 'overlay'
                        ? { mode: 'overlay', baseLayoutId: layout.baseLayoutId as string }
                        : { mode: 'independent', baseLayoutId: null },
                zoneSettings: effectiveZoneSettings as LayoutZoneSettings
            }
        },
        { templateKey: layout.templateKey }
    )
    const effectiveHash = await hashApplicationLayoutContentFromStore(tx, schemaName, {
        layout: {
            templateKey: layout.templateKey,
            name: layout.name,
            description: layout.description,
            config: hashConfig,
            isActive: true,
            isDefault: true,
            sortOrder: layout.sortOrder,
            scopeEntityId: layout.scopeEntityId,
            sourceComposition:
                compositionMode === 'overlay'
                    ? { mode: 'overlay', baseLayoutId: layout.baseLayoutId as string }
                    : { mode: 'independent', baseLayoutId: null }
        },
        widgets: widgets.map((widget) =>
            copyApplicationLayoutWidgetSourceBindingState(widget, {
                ...widget,
                zone: widget.zone as import('@universo-react/types').ApplicationLayoutWidget['zone'],
                widgetKey: widget.widgetKey as import('@universo-react/types').ApplicationLayoutWidget['widgetKey']
            })
        )
    })
    const runtimeDataByWidgetId =
        layout.templateKey === 'dashboard' && runtimeDataResolver
            ? await runtimeDataResolver(
                  tx,
                  runtimeReadScope,
                  widgets.map((widget) => ({
                      id: widget.id,
                      widgetKey: widget.widgetKey,
                      config: widget.config,
                      isActive: widget.isActive,
                      bindings: getApplicationLayoutWidgetSourceBindingState(widget)?.bindings
                  })),
                  target.locale
              )
            : new Map()
    const runtimeWidgets = projectEffectiveRuntimeWidgets(layout.templateKey, widgets, runtimeDataByWidgetId)

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

    const resolvedLayoutWithZoneSettings = { ...resolvedLayout, zoneSettings: effectiveZoneSettings }

    return {
        status: 'ok',
        target,
        resolvedEntityTypeId,
        scope,
        layout: resolvedLayoutWithZoneSettings,
        widgets: runtimeWidgets,
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
): Promise<Omit<EffectiveWidgetRuntimeReadScope, 'schemaName'>> => {
    if (!application) return failEffectiveLayout('LAYOUT_TARGET_NOT_FOUND')
    if (typeof application.workspacesEnabled !== 'boolean') return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    const settings = application.settings === null ? null : readRecord(application.settings)
    const permissions = resolveEffectiveRolePermissions(authContext.role, settings)
    if (!application.workspacesEnabled) {
        if (target.workspaceId) return failEffectiveLayout('LAYOUT_TARGET_FORBIDDEN')
        return {
            workspaceId: null,
            workspacesEnabled: false,
            currentUserId: authContext.userId,
            role: authContext.role,
            permissions
        }
    }

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
    return {
        workspaceId: currentWorkspaceId,
        workspacesEnabled: true,
        currentUserId: authContext.userId,
        role: authContext.role,
        permissions
    }
}

type EffectiveLayoutWorkspaceResolver = (
    executor: DbExecutor,
    application: Awaited<ReturnType<typeof findEffectiveLayoutApplication>>,
    target: RuntimeTarget
) => Promise<Omit<EffectiveWidgetRuntimeReadScope, 'schemaName'>>

/**
 * Core resolver for callers that already own the database transaction and the
 * authorization/workspace decision. Keeping transaction ownership outside this
 * function lets anonymous published reads bind RLS state and load renderer data
 * on the exact same connection without fabricating a user membership.
 */
const resolveEffectiveLayoutInTransaction = async (
    tx: DbExecutor,
    target: RuntimeTarget,
    resolveWorkspaceContext: EffectiveLayoutWorkspaceResolver,
    visibility: EffectiveLayoutReadVisibility = 'authenticated',
    runtimeDataResolver?: EffectiveLayoutRuntimeDataResolver
): Promise<EffectiveLayoutSuccess> => {
    const application = await queryOrFail(() => findEffectiveLayoutApplication(tx, target.applicationId))
    if (!application) return failEffectiveLayout('LAYOUT_TARGET_NOT_FOUND')
    if (application.id !== target.applicationId || !isUuidV7(application.id)) {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }
    if (typeof application.schemaName !== 'string' || !isValidSchemaName(application.schemaName)) {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }
    const materialization = parseInstalledMaterialization(application)

    // Workspace/RLS context must be established before any entity/layout read.
    const workspaceScope = await resolveWorkspaceContext(tx, application, target)

    let resolvedEntityTypeId: string | null = null
    let resolvedFromHomePage = false
    if (target.targetKind !== null) {
        const selectorValue = target.entityTypeId ?? target.entityTypeCodename
        if (!selectorValue) return failEffectiveLayout('LAYOUT_REQUEST_INVALID')
        const selector = target.entityTypeId
            ? { kind: 'id' as const, value: selectorValue }
            : { kind: 'codename' as const, value: selectorValue }
        const entities = await queryOrFail(() =>
            findEffectiveLayoutEntity(tx, application.schemaName!, target.targetKind, selector, visibility)
        )
        if (entities.length === 0) return failEffectiveLayout('LAYOUT_TARGET_NOT_FOUND')
        if (entities.length > 1) return failEffectiveLayout('LAYOUT_DEFAULT_INVALID')
        const entity = entities[0] as EffectiveLayoutEntityRow
        if (target.targetKind === 'page' && entity.kind !== 'page') return failEffectiveLayout('LAYOUT_TARGET_NOT_FOUND')
        resolvedEntityTypeId = requireUuidV7(entity.id)
    } else {
        const homePages = await queryOrFail(() => findEffectiveLayoutHomePages(tx, application.schemaName!, visibility))
        if (homePages.length > 1) return failEffectiveLayout('LAYOUT_DEFAULT_INVALID')
        if (homePages.length === 1) {
            const homePage = homePages[0] as EffectiveLayoutEntityRow
            if (homePage.kind !== 'page') return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
            resolvedEntityTypeId = requireUuidV7(homePage.id)
            resolvedFromHomePage = true
        }
    }

    const tablesExist = await queryOrFail(() => effectiveLayoutTablesExist(tx, application.schemaName!))
    if (!tablesExist) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')

    const candidateRows = await queryOrFail(() =>
        listEffectiveLayoutCandidates(tx, application.schemaName!, resolvedEntityTypeId, visibility)
    )
    const layouts = candidateRows.map(validateLayoutRow)
    const selected = selectCanonicalLayoutCandidate(layouts, resolvedEntityTypeId)
    if (!selected) return failEffectiveLayout('LAYOUT_DEFAULT_INVALID')

    const widgetRows = await queryOrFail(() => listEffectiveLayoutWidgets(tx, application.schemaName!, selected.layout.id, visibility))
    let widgets = widgetRows.map((row) => validateWidgetRow(row, selected.layout))
    validateEffectiveWidgetMultiplicity(widgets)
    const inheritedIds = widgets.map((widget) => widget.sourceBaseWidgetId).filter((id): id is string => typeof id === 'string')
    const baseRows = await queryOrFail(() => findEffectiveLayoutBaseWidgets(tx, application.schemaName!, inheritedIds, visibility))
    const baseRowsByInheritedWidgetId = validateBaseLineage(widgets, baseRows, selected.layout, layouts)
    widgets = attachValidatedSourceOverlayBindings(widgets, baseRowsByInheritedWidgetId, selected.layout)
    const compositionMode = resolveCompositionMode(selected.layout, widgets)
    const { publicationIdentity } = validateLineage(selected.layout, materialization)

    const currentApplication = await queryOrFail(() => findEffectiveLayoutApplication(tx, target.applicationId))
    if (!currentApplication || currentApplication.version !== application.version) {
        return failEffectiveLayout('LAYOUT_CONFLICT')
    }
    if (resolvedFromHomePage) {
        const currentHomePages = await queryOrFail(() => findEffectiveLayoutHomePages(tx, application.schemaName!, visibility))
        if (currentHomePages.length !== 1 || requireUuidV7(currentHomePages[0]?.id) !== resolvedEntityTypeId) {
            return failEffectiveLayout('LAYOUT_CONFLICT')
        }
    }
    const currentCandidateRows = await queryOrFail(() =>
        listEffectiveLayoutCandidates(tx, application.schemaName!, resolvedEntityTypeId, visibility)
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

    const baseLayout =
        compositionMode === 'overlay' && selected.layout.baseLayoutId
            ? layouts.find((candidate) => candidate.id === selected.layout.baseLayoutId) ?? null
            : null
    if (compositionMode === 'overlay' && !baseLayout) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    const effectiveZoneSettings = resolveEffectiveZoneSettings(
        selected.layout.templateKey,
        baseLayout ? [baseLayout, selected.layout] : [selected.layout]
    )
    return buildResult(
        tx,
        application.schemaName!,
        target,
        resolvedEntityTypeId,
        selected,
        widgets,
        materialization,
        publicationIdentity,
        compositionMode,
        effectiveZoneSettings,
        {
            applicationId: target.applicationId,
            applicationSettings: application.settings === null ? null : readRecord(application.settings),
            schemaName: application.schemaName!,
            ...workspaceScope
        },
        runtimeDataResolver
    )
}

export async function resolveEffectiveLayoutForPublicTransactionWithRuntimeData(
    executor: DbExecutor,
    input: unknown,
    publicWorkspaceId: string | null,
    runtimeDataResolver: EffectiveLayoutRuntimeDataResolver
): Promise<EffectiveLayoutSuccess> {
    const target = normalizeRuntimeTarget(input)
    if (target.workspaceId) return failEffectiveLayout('LAYOUT_REQUEST_INVALID')

    return resolveEffectiveLayoutInTransaction(
        executor,
        target,
        async (tx, application) => {
            if (!application) return failEffectiveLayout('LAYOUT_TARGET_NOT_FOUND')
            if (typeof application.workspacesEnabled !== 'boolean') return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')

            if (!application.workspacesEnabled) {
                if (publicWorkspaceId !== null) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
                await queryOrFail(() => setRuntimeWorkspaceContext(tx, null))
                return {
                    workspaceId: null,
                    workspacesEnabled: false,
                    currentUserId: null,
                    role: null,
                    permissions: PUBLIC_RUNTIME_PERMISSIONS
                }
            }

            if (!publicWorkspaceId || !isUuidV7(publicWorkspaceId)) {
                return failEffectiveLayout('LAYOUT_TARGET_NOT_FOUND')
            }
            await queryOrFail(() => setRuntimeWorkspaceContext(tx, publicWorkspaceId))
            return {
                workspaceId: publicWorkspaceId,
                workspacesEnabled: true,
                currentUserId: null,
                role: null,
                permissions: PUBLIC_RUNTIME_PERMISSIONS
            }
        },
        'public',
        runtimeDataResolver
    )
}

const resolveEffectiveLayoutForRequestInternal = async (
    executor: DbExecutor,
    authContext: EffectiveLayoutAuthContext,
    input: unknown,
    runtimeDataResolver?: EffectiveLayoutRuntimeDataResolver
): Promise<EffectiveLayoutSuccess> => {
    const target = normalizeRuntimeTarget(input)
    if (!authContext.userId) return failEffectiveLayout('UNAUTHORIZED')
    if (authContext.applicationId !== target.applicationId) return failEffectiveLayout('LAYOUT_TARGET_FORBIDDEN')

    return executor.transaction((tx) =>
        resolveEffectiveLayoutInTransaction(
            tx,
            target,
            (innerTx, application, innerTarget) => resolveWorkspace(innerTx, application, authContext, innerTarget),
            'authenticated',
            runtimeDataResolver
        )
    )
}

export async function resolveEffectiveLayoutStructureForRequest(
    executor: DbExecutor,
    authContext: EffectiveLayoutAuthContext,
    input: unknown
): Promise<EffectiveLayoutSuccess> {
    return resolveEffectiveLayoutForRequestInternal(executor, authContext, input)
}

export async function resolveEffectiveLayoutForRequestWithRuntimeData(
    executor: DbExecutor,
    authContext: EffectiveLayoutAuthContext,
    input: unknown,
    runtimeDataResolver: EffectiveLayoutRuntimeDataResolver
): Promise<EffectiveLayoutSuccess> {
    return resolveEffectiveLayoutForRequestInternal(executor, authContext, input, runtimeDataResolver)
}
