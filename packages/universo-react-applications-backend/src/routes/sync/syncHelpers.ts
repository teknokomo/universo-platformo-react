/**
 * Application Sync - Helper Functions
 *
 * Pure utility functions for schema sync operations.
 * No database access - only data transformation and validation.
 */

import { type Request, type Response, type RequestHandler } from 'express'
import stableStringify from 'json-stable-stringify'
import { assertCanonicalIdentifier, assertCanonicalSchemaName, quoteIdentifier } from '@universo-react/migrations-core'
import type { EntityDefinition, SchemaSnapshot } from '@universo-react/schema-ddl'
import {
    ApplicationSchemaStatus,
    ComponentDefinitionDataType,
    MARKETING_LAYOUT_ZONES,
    applicationTemplateKeySchema,
    getLayoutWidgetAllowedZones,
    getLayoutWidgetDefinition,
    marketingWidgetKeySchema,
    normalizeInterpretationNetworkHexColor,
    parseApplicationLayoutConfig,
    parseApplicationLayoutWidgetConfig,
    type ApplicationLifecycleContract,
    type ApplicationLayoutWidget,
    type ApplicationTemplateKey,
    type ComponentDefinitionValidationRules,
    type MenuWidgetConfig,
    type VersionedLocalizedContent
} from '@universo-react/types'
import {
    createCodenameVLC,
    getCodenamePrimary,
    normalizeDashboardLayoutConfig,
    normalizeMenuWidgetConfigTargets,
    resolveApplicationLifecycleContractFromConfig,
    resolvePlatformSystemFieldsContractFromConfig,
    validateNumberOrThrow,
    generateUuidV7
} from '@universo-react/utils'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import { withWorkspaceContract } from '../../services/applicationWorkspaces'
import { selectCanonicalLayoutCandidate } from '../../services/effectiveLayoutSelection'
import { stableLineageUuidV7 } from '../../shared/applicationLayoutWidgetLineage'
import type { ApplicationSyncQueryBuilder } from '../../ddl'
import {
    EMPTY_VLC,
    RUNTIME_ENTITY_KINDS,
    RUNTIME_ENTITY_KIND_PATTERN,
    type SyncableApplicationRecord,
    type PersistedAppLayout,
    type PersistedAppLayoutZoneWidget,
    type SnapshotScopedLayoutRow,
    type SnapshotLayoutWidgetOverrideRow,
    type SnapshotLayoutRow,
    type SnapshotWidgetRow,
    type EntityField
} from './syncTypes'

const buildDashboardWidgetVisibilityConfig = (items: Array<{ widgetKey: string; zone: string }>): Record<string, boolean> => {
    const active = new Set(items.map((item) => item.widgetKey))
    const centerActive = new Set(items.filter((item) => item.zone === 'center').map((item) => item.widgetKey))
    const hasLeftWidget = items.some((item) => item.zone === 'left')
    const hasRightWidget = items.some((item) => item.zone === 'right')

    return {
        showSideMenu: hasLeftWidget,
        showRightSideMenu: hasRightWidget,
        showAppNavbar: active.has('appNavbar'),
        showHeader: active.has('header'),
        showBreadcrumbs: active.has('breadcrumbs'),
        showSearch: active.has('search'),
        showDatePicker: active.has('datePicker'),
        showOptionsMenu: active.has('optionsMenu'),
        showLanguageSwitcher: active.has('languageSwitcher'),
        showOverviewTitle: centerActive.has('overviewTitle'),
        showOverviewCards: centerActive.has('overviewCards'),
        showSessionsChart: centerActive.has('sessionsChart'),
        showPageViewsChart: centerActive.has('pageViewsChart'),
        showDetailsTitle: centerActive.has('detailsTitle'),
        showDetailsTable: centerActive.has('detailsTable'),
        showColumnsContainer: centerActive.has('columnsContainer'),
        showProductTree: centerActive.has('productTree'),
        showUsersByCountryChart: centerActive.has('usersByCountryChart'),
        showFooter: active.has('footer')
    }
}

const DASHBOARD_LAYOUT_ZONE_SET = new Set<ApplicationLayoutWidget['zone']>(['left', 'top', 'right', 'bottom', 'center'])
const MARKETING_LAYOUT_ZONE_SET = new Set<ApplicationLayoutWidget['zone']>(MARKETING_LAYOUT_ZONES)

const normalizeLayoutZone = (value: unknown, templateKey: ApplicationTemplateKey): ApplicationLayoutWidget['zone'] => {
    const zones = templateKey === 'dashboard' ? DASHBOARD_LAYOUT_ZONE_SET : MARKETING_LAYOUT_ZONE_SET
    if (typeof value === 'string' && zones.has(value as ApplicationLayoutWidget['zone'])) {
        return value as ApplicationLayoutWidget['zone']
    }
    throw new Error(`[SchemaSync] Invalid ${templateKey} layout widget zone`)
}

/**
 * Validate the persisted application template discriminator at every sync
 * boundary. A missing/unknown key is data corruption, not permission to
 * silently reinterpret a marketing layout as a dashboard.
 */
export const parseApplicationTemplateKey = (value: unknown, context: string): ApplicationTemplateKey => {
    const parsed = applicationTemplateKeySchema.safeParse(value)
    if (!parsed.success) {
        throw new Error(`[SchemaSync] Invalid application template key in ${context}`)
    }
    return parsed.data
}

// --- Core utilities ---

export const asyncHandler = (fn: (req: Request, res: Response) => Promise<Response | void>): RequestHandler => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res)).catch(next)
    }
}

export const runtimeCodenameTextSql = (columnRef: string): string =>
    `COALESCE(${columnRef}->'locales'->(${columnRef}->>'_primary')->>'content', ${columnRef}->'locales'->'en'->>'content', ${columnRef} #>> '{}', '')`

export const buildDynamicRuntimeActiveRowSql = (contract: ApplicationLifecycleContract, platformConfig?: unknown): string => {
    const platformContract = resolvePlatformSystemFieldsContractFromConfig(platformConfig)
    const clauses: string[] = []

    if (platformContract.delete.enabled) {
        clauses.push('_upl_deleted = false')
    }
    if (contract.delete.mode === 'soft') {
        clauses.push('_app_deleted = false')
    }

    return clauses.length > 0 ? clauses.join(' AND ') : 'TRUE'
}

export const applyDynamicRuntimeActiveRowFilter = (
    qb: ApplicationSyncQueryBuilder,
    contract: ApplicationLifecycleContract,
    platformConfig?: unknown
): ApplicationSyncQueryBuilder => {
    const platformContract = resolvePlatformSystemFieldsContractFromConfig(platformConfig)

    if (platformContract.delete.enabled) {
        qb.where('_upl_deleted', false)
    }
    if (contract.delete.mode === 'soft') {
        qb.where('_app_deleted', false)
    }
    return qb
}

export const resolveEntityLifecycleContract = (entity: EntityDefinition): ApplicationLifecycleContract => {
    return resolveApplicationLifecycleContractFromConfig(entity.config)
}

export const toWorkspaceAwareSnapshot = (schemaSnapshot: unknown, workspacesEnabled: boolean): Record<string, unknown> | null =>
    withWorkspaceContract(schemaSnapshot as Record<string, unknown> | null | undefined, workspacesEnabled)

export const toWorkspaceAwareSchemaSnapshot = (
    schemaSnapshot: SchemaSnapshot | null | undefined,
    workspacesEnabled: boolean
): SchemaSnapshot | null =>
    withWorkspaceContract(
        schemaSnapshot as unknown as Record<string, unknown> | null | undefined,
        workspacesEnabled
    ) as unknown as SchemaSnapshot | null

// --- Field helpers ---

export function isVLCField(field: { dataType: ComponentDefinitionDataType; validationRules?: Record<string, unknown> }): boolean {
    if (field.dataType !== ComponentDefinitionDataType.STRING) {
        return false
    }
    const rules = field.validationRules as Partial<ComponentDefinitionValidationRules> | undefined
    return rules?.versioned === true || rules?.localized === true
}

/**
 * Prepares a value for insertion into a JSONB column.
 * Knex handles object serialization automatically, but primitives need JSON.stringify.
 * PostgreSQL JSONB requires valid JSON: strings must be quoted, etc.
 */
export function prepareJsonbValue(value: unknown): unknown {
    if (value === undefined || value === null) {
        return null
    }
    // Objects and arrays: Knex serializes them automatically
    if (typeof value === 'object') {
        return value
    }
    // Primitives (string, number, boolean): wrap in JSON.stringify for valid JSONB
    // PostgreSQL JSONB requires: '"string"' not just 'string'
    return JSON.stringify(value)
}

export function normalizeSnapshotCodenameValue(value: unknown, context: string): VersionedLocalizedContent<string> {
    const codename =
        typeof value === 'string'
            ? createCodenameVLC('en', value)
            : isRecord(value)
            ? (value as unknown as VersionedLocalizedContent<string>)
            : null
    if (!codename) {
        throw new Error(`[SchemaSync] Invalid ${context} codename in snapshot`)
    }

    if (getCodenamePrimary(codename).trim().length === 0) {
        throw new Error(`[SchemaSync] Empty ${context} codename in snapshot`)
    }

    return codename
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

const resolveSnapshotEntityCodenameText = (value: unknown): string | null => {
    if (!isRecord(value)) return null
    const codename = getCodenamePrimary(value.codename as VersionedLocalizedContent<string> | string | undefined).trim()
    return codename.length > 0 ? codename : null
}

const resolveEntityDefinitionCodenameText = (entity: EntityDefinition): string | null => {
    const codename = getCodenamePrimary(entity.codename as VersionedLocalizedContent<string> | string | undefined).trim()
    return codename.length > 0 ? codename : null
}

export const remapSnapshotLayoutScopeEntityIds = (
    snapshot: PublishedApplicationSnapshot,
    entities: EntityDefinition[]
): PublishedApplicationSnapshot => {
    const snapshotEntities = isRecord(snapshot.entities) ? snapshot.entities : {}
    const snapshotCodenameById = new Map<string, string>()

    for (const [entityId, entity] of Object.entries(snapshotEntities)) {
        const codename = resolveSnapshotEntityCodenameText(entity)
        if (codename) {
            snapshotCodenameById.set(entityId, codename)
        }
    }

    if (snapshotCodenameById.size === 0) {
        return snapshot
    }

    const targetIdByCodename = new Map<string, string>()
    for (const entity of entities) {
        const codename = resolveEntityDefinitionCodenameText(entity)
        if (codename && typeof entity.id === 'string' && entity.id.length > 0) {
            targetIdByCodename.set(codename, entity.id)
        }
    }

    if (targetIdByCodename.size === 0) {
        return snapshot
    }

    const remapScopeEntityId = (scopeEntityId: unknown): unknown => {
        if (typeof scopeEntityId !== 'string' || scopeEntityId.length === 0) {
            return scopeEntityId
        }

        const codename = snapshotCodenameById.get(scopeEntityId)
        if (!codename) {
            return scopeEntityId
        }

        return targetIdByCodename.get(codename) ?? scopeEntityId
    }

    const remapLayoutRows = (rows: unknown): unknown => {
        if (!Array.isArray(rows)) return rows
        let changed = false
        const nextRows = rows.map((row) => {
            if (!isRecord(row)) return row
            const nextScopeEntityId = remapScopeEntityId(row.scopeEntityId)
            if (nextScopeEntityId === row.scopeEntityId) return row
            changed = true
            return { ...row, scopeEntityId: nextScopeEntityId }
        })
        return changed ? nextRows : rows
    }

    const nextLayouts = remapLayoutRows(snapshot.layouts)
    const nextScopedLayouts = remapLayoutRows(snapshot.scopedLayouts)

    if (nextLayouts === snapshot.layouts && nextScopedLayouts === snapshot.scopedLayouts) {
        return snapshot
    }

    return {
        ...snapshot,
        layouts: nextLayouts as PublishedApplicationSnapshot['layouts'],
        scopedLayouts: nextScopedLayouts as PublishedApplicationSnapshot['scopedLayouts']
    }
}

type RuntimeMenuSectionTargetRecord = { id: string; kind: 'section' | 'objectCollection' }
type RuntimeMenuHubTargetRecord = { id: string; kind: 'hub' | 'treeEntity' }
type RuntimeMenuTargetRecord = RuntimeMenuSectionTargetRecord | RuntimeMenuHubTargetRecord

const NON_OBJECT_RUNTIME_KINDS = new Set(['hub', 'set', 'enumeration', 'page', 'ledger'])

const isRuntimeObjectCollectionKind = (kind: unknown): boolean =>
    typeof kind === 'string' && kind.length > 0 && !NON_OBJECT_RUNTIME_KINDS.has(kind)

const resolveSnapshotRuntimeTargetKind = (entity: unknown): RuntimeMenuTargetRecord['kind'] | null => {
    if (!isRecord(entity)) return null
    const kind = typeof entity.kind === 'string' ? entity.kind : null
    if (kind === 'page') return 'section'
    if (kind === 'hub') return 'hub'
    if (kind === 'tree-entity') return 'treeEntity'
    if (isRuntimeObjectCollectionKind(kind)) return 'objectCollection'
    return null
}

const resolveEntityRuntimeTargetKind = (entity: EntityDefinition): RuntimeMenuTargetRecord['kind'] | null => {
    if (entity.kind === 'page') return 'section'
    if (entity.kind === 'hub') return 'hub'
    if (entity.kind === 'tree-entity') return 'treeEntity'
    if (isRuntimeObjectCollectionKind(entity.kind)) return 'objectCollection'
    return null
}

const addMenuTargetToken = <TTarget extends RuntimeMenuTargetRecord>(map: Map<string, TTarget>, token: unknown, target: TTarget): void => {
    if (typeof token !== 'string') return
    const trimmed = token.trim()
    if (trimmed.length === 0) return
    map.set(trimmed, target)
}

const isHubTargetRecord = (target: RuntimeMenuTargetRecord): target is RuntimeMenuHubTargetRecord =>
    target.kind === 'hub' || target.kind === 'treeEntity'

const addTargetToTypedMap = (
    sectionByToken: Map<string, RuntimeMenuSectionTargetRecord>,
    hubByToken: Map<string, RuntimeMenuHubTargetRecord>,
    token: unknown,
    target: RuntimeMenuTargetRecord
): void => {
    if (isHubTargetRecord(target)) {
        addMenuTargetToken(hubByToken, token, target)
        return
    }
    addMenuTargetToken(sectionByToken, token, target)
}

const buildRuntimeMenuTargetMaps = (snapshot: PublishedApplicationSnapshot, entities: EntityDefinition[]) => {
    const sectionByToken = new Map<string, RuntimeMenuSectionTargetRecord>()
    const hubByToken = new Map<string, RuntimeMenuHubTargetRecord>()
    const runtimeByCodename = new Map<string, RuntimeMenuTargetRecord>()

    for (const entity of entities) {
        if (typeof entity.id !== 'string' || entity.id.length === 0) continue
        const targetKind = resolveEntityRuntimeTargetKind(entity)
        if (!targetKind) continue
        const target: RuntimeMenuTargetRecord = { id: entity.id, kind: targetKind }
        const codename = resolveEntityDefinitionCodenameText(entity)
        addTargetToTypedMap(sectionByToken, hubByToken, entity.id, target)
        if (codename) {
            runtimeByCodename.set(codename, target)
            addTargetToTypedMap(sectionByToken, hubByToken, codename, target)
        }
    }

    const snapshotEntities = isRecord(snapshot.entities) ? snapshot.entities : {}
    for (const [snapshotId, snapshotEntity] of Object.entries(snapshotEntities)) {
        const snapshotKind = resolveSnapshotRuntimeTargetKind(snapshotEntity)
        const codename = resolveSnapshotEntityCodenameText(snapshotEntity)
        const runtimeTarget = codename ? runtimeByCodename.get(codename) : undefined
        if (!runtimeTarget || (snapshotKind && snapshotKind !== runtimeTarget.kind)) continue
        addTargetToTypedMap(sectionByToken, hubByToken, snapshotId, runtimeTarget)
        if (codename) {
            addTargetToTypedMap(sectionByToken, hubByToken, codename, runtimeTarget)
        }
    }

    return { sectionByToken, hubByToken }
}

export const remapSnapshotMenuWidgetTargets = (
    snapshot: PublishedApplicationSnapshot,
    entities: EntityDefinition[]
): PublishedApplicationSnapshot => {
    const targetMaps = buildRuntimeMenuTargetMaps(snapshot, entities)
    if (targetMaps.sectionByToken.size === 0 && targetMaps.hubByToken.size === 0) {
        return snapshot
    }

    const remapWidgets = (rows: unknown): unknown => {
        if (!Array.isArray(rows)) return rows
        let changed = false
        const nextRows = rows.map((row) => {
            if (!isRecord(row) || row.widgetKey !== 'menuWidget' || !isRecord(row.config)) return row
            const normalizedConfig = normalizeMenuWidgetConfigTargets(row.config as unknown as MenuWidgetConfig, targetMaps)
            if (compareStableValues(normalizedConfig, row.config)) return row
            changed = true
            return { ...row, config: normalizedConfig }
        })
        return changed ? nextRows : rows
    }

    const menuWidgetIds = new Set(
        (Array.isArray(snapshot.layoutZoneWidgets) ? snapshot.layoutZoneWidgets : [])
            .filter((row) => isRecord(row) && row.widgetKey === 'menuWidget' && typeof row.id === 'string' && row.id.length > 0)
            .map((row) => (row as { id: string }).id)
    )

    const remapWidgetOverrides = (rows: unknown): unknown => {
        if (!Array.isArray(rows)) return rows
        let changed = false
        const nextRows = rows.map((row) => {
            if (!isRecord(row) || typeof row.baseWidgetId !== 'string' || !menuWidgetIds.has(row.baseWidgetId) || !isRecord(row.config)) {
                return row
            }
            const normalizedConfig = normalizeMenuWidgetConfigTargets(row.config as unknown as MenuWidgetConfig, targetMaps)
            if (compareStableValues(normalizedConfig, row.config)) return row
            changed = true
            return { ...row, config: normalizedConfig }
        })
        return changed ? nextRows : rows
    }

    const nextLayoutZoneWidgets = remapWidgets(snapshot.layoutZoneWidgets)
    const nextLayoutWidgetOverrides = remapWidgetOverrides(snapshot.layoutWidgetOverrides)
    if (nextLayoutZoneWidgets === snapshot.layoutZoneWidgets && nextLayoutWidgetOverrides === snapshot.layoutWidgetOverrides) {
        return snapshot
    }

    return {
        ...snapshot,
        layoutZoneWidgets: nextLayoutZoneWidgets as PublishedApplicationSnapshot['layoutZoneWidgets'],
        layoutWidgetOverrides: nextLayoutWidgetOverrides as PublishedApplicationSnapshot['layoutWidgetOverrides']
    }
}

export function compareStableValues(left: unknown, right: unknown): boolean {
    return stableStringify(left) === stableStringify(right)
}

export function toStructuralSchemaSnapshot(snapshot: SchemaSnapshot | null): Pick<SchemaSnapshot, 'hasSystemTables' | 'entities'> | null {
    if (!snapshot) {
        return null
    }

    return {
        hasSystemTables: snapshot.hasSystemTables,
        entities: snapshot.entities
    }
}

export function quoteSchemaName(schemaName: string): string {
    assertCanonicalSchemaName(schemaName)
    return quoteIdentifier(schemaName)
}

export function quoteObjectName(identifier: string): string {
    assertCanonicalIdentifier(identifier)
    return quoteIdentifier(identifier)
}

// --- Normalization ---

export function normalizeRuntimeEntityKind(value: unknown): EntityDefinition['kind'] | null {
    if (typeof value !== 'string') {
        return null
    }

    if (RUNTIME_ENTITY_KINDS.has(value as EntityDefinition['kind'])) {
        return value as EntityDefinition['kind']
    }

    return RUNTIME_ENTITY_KIND_PATTERN.test(value) ? (value as EntityDefinition['kind']) : null
}

export function normalizeRuntimePresentation(value: unknown): EntityDefinition['presentation'] {
    if (isRecord(value) && isRecord(value.name)) {
        return value as unknown as EntityDefinition['presentation']
    }

    return {
        name: { ...EMPTY_VLC }
    }
}

export function resolveLocalizedPreviewText(value: unknown): string | null {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed.length > 0 ? trimmed : null
    }

    if (!isRecord(value)) return null

    const locales = value.locales
    const primary = value._primary
    if (!isRecord(locales)) return null

    if (typeof primary === 'string' && isRecord(locales[primary]) && typeof locales[primary].content === 'string') {
        const content = locales[primary].content.trim()
        if (content.length > 0) return content
    }

    for (const localeValue of Object.values(locales)) {
        if (isRecord(localeValue) && typeof localeValue.content === 'string') {
            const content = localeValue.content.trim()
            if (content.length > 0) return content
        }
    }

    return null
}

export function normalizeReferenceId(value: unknown): string | null {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed.length > 0 ? trimmed : null
    }
    if (!isRecord(value)) return null

    const directId = value.id
    if (typeof directId === 'string' && directId.trim().length > 0) {
        return directId.trim()
    }

    const nestedValue = value.value
    if (typeof nestedValue === 'string' && nestedValue.trim().length > 0) {
        return nestedValue.trim()
    }

    if (isRecord(nestedValue) && typeof nestedValue.id === 'string' && nestedValue.id.trim().length > 0) {
        return nestedValue.id.trim()
    }

    return null
}

export function normalizeRuntimeSnapshotValue(value: unknown, field: EntityDefinition['fields'][number]): unknown {
    if (value === undefined || value === null) {
        return null
    }

    if (field.dataType === ComponentDefinitionDataType.NUMBER && typeof value === 'string') {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : value
    }

    if (field.dataType === ComponentDefinitionDataType.DATE && value instanceof Date) {
        return value.toISOString()
    }

    return value
}

// --- Application state ---

export function applyApplicationSyncState(
    application: SyncableApplicationRecord,
    state: {
        schemaStatus: ApplicationSchemaStatus
        schemaError: string | null
        schemaSyncedAt: Date | null
        schemaSnapshot: Record<string, unknown> | null
        lastSyncedPublicationVersionId: string | null
        appStructureVersion: number | null
        installedReleaseMetadata?: Record<string, unknown> | null
    }
): void {
    application.schemaStatus = state.schemaStatus
    application.schemaError = state.schemaError
    application.schemaSyncedAt = state.schemaSyncedAt
    application.schemaSnapshot = state.schemaSnapshot
    application.lastSyncedPublicationVersionId = state.lastSyncedPublicationVersionId
    application.appStructureVersion = state.appStructureVersion
    application.installedReleaseMetadata = state.installedReleaseMetadata ?? application.installedReleaseMetadata ?? null
}

export function resolveApplicationReleaseVersion(input: {
    publicationVersionId?: string | null
    snapshot: PublishedApplicationSnapshot
    snapshotHash?: string | null
}): string {
    const candidates = [input.publicationVersionId, input.snapshot.versionEnvelope?.templateVersion, input.snapshotHash]
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate.trim()
        }
    }

    return 'unversioned-release'
}

export function extractInstalledReleaseMetadataString(
    installedReleaseMetadata: Record<string, unknown> | null | undefined,
    key: string
): string | null {
    if (!installedReleaseMetadata) {
        return null
    }

    const value = installedReleaseMetadata[key]
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

export function extractInstalledReleaseMetadataSchemaSnapshot(
    installedReleaseMetadata: Record<string, unknown> | null | undefined,
    key: 'baseSchemaSnapshot' | 'releaseSchemaSnapshot'
): SchemaSnapshot | null {
    if (!installedReleaseMetadata) {
        return null
    }

    const value = installedReleaseMetadata[key]
    if (!isRecord(value) || typeof value.version !== 'number' || !isRecord(value.entities)) {
        return null
    }

    return value as unknown as SchemaSnapshot
}

// --- Snapshot normalizers ---

type MaterializedSnapshotWidget = PersistedAppLayoutZoneWidget & {
    isActive: boolean
}

type NormalizedScopedLayout = PersistedAppLayout & {
    baseLayoutId: string | null
    compositionMode: 'overlay' | 'independent'
}

const stripLayoutCompositionMetadata = (config: Record<string, unknown>): Record<string, unknown> => {
    const { compositionMode: _compositionMode, baseLayoutId: _baseLayoutId, ...rendererConfig } = config
    return rendererConfig
}

const withLayoutCompositionMetadata = (
    config: Record<string, unknown>,
    compositionMode: 'overlay' | 'independent',
    baseLayoutId: string | null
): Record<string, unknown> => ({
    ...config,
    compositionMode,
    baseLayoutId
})

type NormalizedLayoutWidgetOverride = {
    layoutId: string
    baseWidgetId: string
    zone: string | null
    sortOrder: number | null
    config: Record<string, unknown> | null
    isActive: boolean | null
    isDeletedOverride: boolean
}

const isMarketingWidgetKey = (value: string): boolean => marketingWidgetKeySchema.safeParse(value).success

const isWidgetAllowedForTemplate = (templateKey: ApplicationTemplateKey, widgetKey: string, zone: string): boolean => {
    return Boolean(getLayoutWidgetAllowedZones(widgetKey, templateKey)?.includes(zone as never))
}

const readSnapshotRows = (value: unknown, field: string): unknown[] => {
    if (value === undefined) return []
    if (!Array.isArray(value)) {
        throw new Error(`[SchemaSync] Snapshot ${field} must be an array`)
    }
    return value
}

const readSnapshotRecord = (value: unknown, field: string, context: string): Record<string, unknown> => {
    if (!isRecord(value) || Array.isArray(value)) {
        throw new Error(`[SchemaSync] Snapshot ${context} ${field} must be an object`)
    }
    return value
}

const readOptionalSnapshotRecord = (
    value: unknown,
    field: string,
    context: string,
    options: { nullable?: boolean } = {}
): Record<string, unknown> | null | undefined => {
    if (value === undefined) return undefined
    if (options.nullable && value === null) return null
    return readSnapshotRecord(value, field, context)
}

const readOptionalSnapshotBoolean = (value: unknown, field: string, context: string, defaultValue: boolean): boolean => {
    if (value === undefined) return defaultValue
    if (typeof value !== 'boolean') {
        throw new Error(`[SchemaSync] Snapshot ${context} ${field} must be a boolean`)
    }
    return value
}

const readOptionalSnapshotInteger = (value: unknown, field: string, context: string, defaultValue: number): number => {
    if (value === undefined) return defaultValue
    if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
        throw new Error(`[SchemaSync] Snapshot ${context} ${field} must be an integer`)
    }
    return value
}

const readOptionalSnapshotString = (
    value: unknown,
    field: string,
    context: string,
    options: { nullable?: boolean; defaultValue?: string | null } = {}
): string | null | undefined => {
    if (value === undefined) return options.defaultValue
    if (options.nullable && value === null) return null
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`[SchemaSync] Snapshot ${context} ${field} must be a non-empty string`)
    }
    return value
}

const materializedWidgetInstanceKey = (widget: { widgetKey: string; config: Record<string, unknown> }): string => {
    const value = widget.config.instanceKey
    return typeof value === 'string' && value.length > 0 ? value : widget.widgetKey
}

const getSnapshotTemplateByLayoutId = (snapshot: PublishedApplicationSnapshot): Map<string, ApplicationTemplateKey> => {
    const templateByLayoutId = new Map<string, ApplicationTemplateKey>()
    for (const rawLayout of readSnapshotRows(snapshot.layouts, 'layouts')) {
        const layout = (rawLayout ?? {}) as SnapshotLayoutRow
        const id = readOptionalSnapshotString(layout.id, 'id', 'layout', { defaultValue: '' })
        if (!id) continue
        templateByLayoutId.set(id, parseApplicationTemplateKey(layout.templateKey, `layout ${id}`))
    }
    for (const rawLayout of readSnapshotRows(snapshot.scopedLayouts, 'scoped layouts')) {
        const layout = (rawLayout ?? {}) as SnapshotScopedLayoutRow
        const id = readOptionalSnapshotString(layout.id, 'id', 'scoped layout', { defaultValue: '' })
        if (!id) continue
        templateByLayoutId.set(id, parseApplicationTemplateKey(layout.templateKey, `scoped layout ${id}`))
    }
    return templateByLayoutId
}

const assertMaterializedWidgetIdentitySafety = (
    layoutId: string,
    templateKey: ApplicationTemplateKey,
    widgets: readonly { widgetKey: string; config: Record<string, unknown> }[]
): void => {
    const seenInstances = new Set<string>()
    const seenSingletons = new Set<string>()

    for (const widget of widgets) {
        const definition = getLayoutWidgetDefinition(widget.widgetKey)
        if (!definition || !definition.supportedTemplates.includes(templateKey)) {
            throw new Error(`[SchemaSync] Layout ${layoutId} contains an unsupported widget definition`)
        }

        if (templateKey === 'marketing-page') {
            const instanceKey = materializedWidgetInstanceKey(widget)
            if (seenInstances.has(instanceKey)) {
                throw new Error(`Layout ${layoutId} contains duplicate widget instance ${instanceKey}`)
            }
            seenInstances.add(instanceKey)
        }

        if (!definition.multiInstance) {
            if (seenSingletons.has(widget.widgetKey)) {
                throw new Error(`Layout ${layoutId} contains duplicate singleton widget ${widget.widgetKey}`)
            }
            seenSingletons.add(widget.widgetKey)
        }
    }
}

const normalizeSnapshotLayoutEntries = (snapshot: PublishedApplicationSnapshot): PersistedAppLayout[] => {
    const rows = readSnapshotRows(snapshot.layouts, 'layouts').map((layout) => {
        const normalizedLayout = (layout ?? {}) as SnapshotLayoutRow
        const layoutId = readOptionalSnapshotString(normalizedLayout.id, 'id', 'layout', { defaultValue: '' })
        if (!layoutId) {
            throw new Error('[SchemaSync] Snapshot global layout must have an id')
        }
        if (normalizedLayout.scopeEntityId !== undefined && normalizedLayout.scopeEntityId !== null) {
            throw new Error(`[SchemaSync] Global layout ${layoutId} cannot contain a scope entity`)
        }

        const templateKey = parseApplicationTemplateKey(normalizedLayout.templateKey, `layout ${layoutId}`)
        const rawConfig = (readOptionalSnapshotRecord(normalizedLayout.config, 'config', `layout ${layoutId}`) ?? {}) as Record<
            string,
            unknown
        >
        let config = stripLayoutCompositionMetadata(rawConfig)
        try {
            config = parseApplicationLayoutConfig(templateKey, config)
        } catch {
            throw new Error(`Layout ${layoutId} contains invalid ${templateKey} configuration`)
        }
        config = withLayoutCompositionMetadata(config, 'independent', null)

        return {
            id: layoutId,
            scopeEntityId: null,
            templateKey,
            name: (readOptionalSnapshotRecord(normalizedLayout.name, 'name', `layout ${layoutId}`) ?? {}) as Record<string, unknown>,
            description: (readOptionalSnapshotRecord(normalizedLayout.description, 'description', `layout ${layoutId}`, {
                nullable: true
            }) ?? null) as Record<string, unknown> | null,
            config,
            isActive: readOptionalSnapshotBoolean(normalizedLayout.isActive, 'isActive', `layout ${layoutId}`, false),
            isDefault: readOptionalSnapshotBoolean(normalizedLayout.isDefault, 'isDefault', `layout ${layoutId}`, false),
            sortOrder: readOptionalSnapshotInteger(normalizedLayout.sortOrder, 'sortOrder', `layout ${layoutId}`, 0)
        }
    })

    const desiredDefaultLayoutId = readOptionalSnapshotString(snapshot.defaultLayoutId, 'defaultLayoutId', 'snapshot', {
        nullable: true,
        defaultValue: null
    }) as string | null
    if (desiredDefaultLayoutId) {
        if (!rows.some((row) => row.id === desiredDefaultLayoutId)) {
            throw new Error(`[SchemaSync] Snapshot default layout ${desiredDefaultLayoutId} does not exist`)
        }
        for (const row of rows) {
            if (row.scopeEntityId === null) {
                row.isDefault = row.id === desiredDefaultLayoutId
            }
        }
    }

    return rows
}

const ensureScopedDefaultLayouts = (rows: PersistedAppLayout[]): PersistedAppLayout[] => {
    const rowsByScope = new Map<string, PersistedAppLayout[]>()

    for (const row of rows) {
        const scopeKey = row.scopeEntityId ?? '__global__'
        const bucket = rowsByScope.get(scopeKey) ?? []
        bucket.push(row)
        rowsByScope.set(scopeKey, bucket)
    }

    for (const bucket of rowsByScope.values()) {
        if (bucket.length === 0) continue
        const scopeEntityId = bucket[0]?.scopeEntityId ?? null
        const selected = selectCanonicalLayoutCandidate(bucket, scopeEntityId)
        if (!selected || selected.layout.scopeEntityId !== scopeEntityId) {
            const scope = bucket[0]?.scopeEntityId ?? 'global'
            throw new Error(`[SchemaSync] Scope ${scope} must contain exactly one active default layout`)
        }
        if (bucket.some((row) => row.isDefault && !row.isActive)) {
            const scope = bucket[0]?.scopeEntityId ?? 'global'
            throw new Error(`[SchemaSync] Scope ${scope} contains an inactive default layout`)
        }
    }

    return rows.sort((a, b) => {
        if ((a.scopeEntityId ?? '') !== (b.scopeEntityId ?? '')) {
            return (a.scopeEntityId ?? '').localeCompare(b.scopeEntityId ?? '')
        }
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
        return a.id.localeCompare(b.id)
    })
}

const normalizeSnapshotWidgetEntries = (
    snapshot: PublishedApplicationSnapshot,
    templateByLayoutId = getSnapshotTemplateByLayoutId(snapshot)
): MaterializedSnapshotWidget[] => {
    return readSnapshotRows(snapshot.layoutZoneWidgets, 'layout widgets').map((item) => {
        const normalizedItem = (item ?? {}) as SnapshotWidgetRow
        const id = readOptionalSnapshotString(normalizedItem.id, 'id', 'layout widget', { defaultValue: '' })
        const layoutId = readOptionalSnapshotString(normalizedItem.layoutId, 'layoutId', `layout widget ${id}`, { defaultValue: '' })
        const widgetKey = readOptionalSnapshotString(normalizedItem.widgetKey, 'widgetKey', `layout widget ${id}`, { defaultValue: '' })
        if (!id || !layoutId || !widgetKey) {
            throw new Error('[SchemaSync] Snapshot layout widget has an invalid identity')
        }
        const templateKey = templateByLayoutId.get(layoutId)
        if (!templateKey) {
            throw new Error('[SchemaSync] Snapshot layout widget references an unknown layout')
        }
        const zone = normalizeLayoutZone(normalizedItem.zone, templateKey)
        if (!isWidgetAllowedForTemplate(templateKey, widgetKey, zone)) {
            throw new Error(`[SchemaSync] Widget ${widgetKey} is not allowed in ${templateKey} zone ${zone}`)
        }
        const rawConfig = (readOptionalSnapshotRecord(normalizedItem.config, 'config', `layout widget ${id}`) ?? {}) as Record<
            string,
            unknown
        >
        let config = rawConfig
        try {
            config = parseApplicationLayoutWidgetConfig(widgetKey, rawConfig)
        } catch {
            throw new Error(`[SchemaSync] Invalid ${templateKey} widget config for ${widgetKey}`)
        }
        if (templateKey === 'marketing-page' && !isMarketingWidgetKey(widgetKey)) {
            throw new Error(`[SchemaSync] Invalid marketing widget key ${widgetKey}`)
        }
        return {
            id,
            layoutId,
            sourceBaseWidgetId: readOptionalSnapshotString(normalizedItem.sourceBaseWidgetId, 'sourceBaseWidgetId', `layout widget ${id}`, {
                nullable: true,
                defaultValue: null
            }) as string | null,
            ...(normalizedItem.sourceLineageKey === undefined
                ? {}
                : {
                      sourceLineageKey: readOptionalSnapshotString(
                          normalizedItem.sourceLineageKey,
                          'sourceLineageKey',
                          `layout widget ${id}`
                      ) as string
                  }),
            zone,
            widgetKey,
            sortOrder: readOptionalSnapshotInteger(normalizedItem.sortOrder, 'sortOrder', `layout widget ${id}`, 0),
            config,
            isActive: readOptionalSnapshotBoolean(normalizedItem.isActive, 'isActive', `layout widget ${id}`, true)
        }
    })
}

export const withWorkspaceRuntimeLayoutWidgets = (
    snapshot: PublishedApplicationSnapshot,
    workspacesEnabled: boolean
): PublishedApplicationSnapshot => {
    if (!workspacesEnabled) {
        return snapshot
    }

    const layouts = readSnapshotRows(snapshot.layouts, 'layouts')
    const widgets = normalizeSnapshotWidgetEntries(snapshot)
    const nextWidgets: PersistedAppLayoutZoneWidget[] = [...widgets]

    for (const rawLayout of layouts) {
        const layout = (rawLayout ?? {}) as SnapshotLayoutRow
        const layoutId = readOptionalSnapshotString(layout.id, 'id', 'workspace layout', { defaultValue: '' })
        const scopeEntityId = readOptionalSnapshotString(layout.scopeEntityId, 'scopeEntityId', `workspace layout ${layoutId}`, {
            nullable: true,
            defaultValue: null
        }) as string | null
        const templateKey = parseApplicationTemplateKey(layout.templateKey, `workspace layout ${layoutId}`)

        if (!layoutId || scopeEntityId || templateKey !== 'dashboard') {
            continue
        }

        const layoutLeftWidgets = nextWidgets.filter((widget) => widget.layoutId === layoutId && widget.zone === 'left')
        const hasWorkspaceSwitcher = layoutLeftWidgets.some((widget) => widget.widgetKey === 'workspaceSwitcher')
        if (hasWorkspaceSwitcher) {
            continue
        }

        const firstSortOrder = layoutLeftWidgets.reduce((minimum, widget) => Math.min(minimum, widget.sortOrder), 0)
        nextWidgets.push(
            {
                id: generateUuidV7(),
                layoutId,
                sourceLineageKey: `workspace:${layoutId}:workspaceSwitcher`,
                zone: 'left',
                widgetKey: 'workspaceSwitcher',
                sortOrder: firstSortOrder - 200,
                config: {},
                isActive: true
            },
            {
                id: generateUuidV7(),
                layoutId,
                sourceLineageKey: `workspace:${layoutId}:divider`,
                zone: 'left',
                widgetKey: 'divider',
                sortOrder: firstSortOrder - 199,
                config: {},
                isActive: true
            }
        )
    }

    const templateByLayoutId = getSnapshotTemplateByLayoutId(snapshot)
    const widgetsByLayoutId = new Map<string, PersistedAppLayoutZoneWidget[]>()
    for (const widget of nextWidgets) {
        const group = widgetsByLayoutId.get(widget.layoutId) ?? []
        group.push(widget)
        widgetsByLayoutId.set(widget.layoutId, group)
    }
    for (const [layoutId, layoutWidgets] of widgetsByLayoutId) {
        const templateKey = templateByLayoutId.get(layoutId)
        if (templateKey) assertMaterializedWidgetIdentitySafety(layoutId, templateKey, layoutWidgets)
    }

    return {
        ...snapshot,
        layoutZoneWidgets: nextWidgets
    }
}

const normalizeSnapshotScopedLayouts = (snapshot: PublishedApplicationSnapshot): NormalizedScopedLayout[] => {
    const rows = readSnapshotRows(snapshot.scopedLayouts, 'scoped layouts').map((rawLayout) => {
        const layout = (rawLayout ?? {}) as SnapshotScopedLayoutRow
        const id = readOptionalSnapshotString(layout.id, 'id', 'scoped layout', { defaultValue: '' })
        const scopeEntityId = readOptionalSnapshotString(layout.scopeEntityId, 'scopeEntityId', `scoped layout ${id}`, {
            defaultValue: ''
        })
        if (!id || !scopeEntityId) {
            throw new Error('[SchemaSync] Scoped layout must have both id and scope entity id')
        }
        const baseLayoutId = readOptionalSnapshotString(layout.baseLayoutId, 'baseLayoutId', `scoped layout ${id}`, {
            nullable: true,
            defaultValue: null
        }) as string | null
        const compositionMode = layout.compositionMode
        if (compositionMode !== 'overlay' && compositionMode !== 'independent') {
            throw new Error(`[SchemaSync] Scoped layout ${id} has an invalid composition mode`)
        }
        if (compositionMode === 'overlay' && !baseLayoutId) {
            throw new Error(`[SchemaSync] Overlay layout ${id} must reference a base layout`)
        }
        if (compositionMode === 'independent' && baseLayoutId) {
            throw new Error(`[SchemaSync] Independent layout ${id} cannot reference a base layout`)
        }
        const templateKey = parseApplicationTemplateKey(layout.templateKey, `scoped layout ${id}`)
        const rawConfig = (readOptionalSnapshotRecord(layout.config, 'config', `scoped layout ${id}`) ?? {}) as Record<string, unknown>
        let config = stripLayoutCompositionMetadata(rawConfig)
        try {
            config = parseApplicationLayoutConfig(templateKey, config)
        } catch {
            throw new Error(`Scoped layout ${id} contains invalid ${templateKey} configuration`)
        }
        return {
            id,
            scopeEntityId,
            baseLayoutId,
            compositionMode,
            templateKey,
            name: (readOptionalSnapshotRecord(layout.name, 'name', `scoped layout ${id}`) ?? {}) as Record<string, unknown>,
            description: (readOptionalSnapshotRecord(layout.description, 'description', `scoped layout ${id}`, {
                nullable: true
            }) ?? null) as Record<string, unknown> | null,
            config,
            isActive: readOptionalSnapshotBoolean(layout.isActive, 'isActive', `scoped layout ${id}`, true),
            isDefault: readOptionalSnapshotBoolean(layout.isDefault, 'isDefault', `scoped layout ${id}`, false),
            sortOrder: readOptionalSnapshotInteger(layout.sortOrder, 'sortOrder', `scoped layout ${id}`, 0)
        }
    })
    return rows as NormalizedScopedLayout[]
}

const normalizeSnapshotLayoutWidgetOverrides = (snapshot: PublishedApplicationSnapshot): NormalizedLayoutWidgetOverride[] => {
    return readSnapshotRows(snapshot.layoutWidgetOverrides, 'widget overrides').map((rawRow) => {
        const row = (rawRow ?? {}) as SnapshotLayoutWidgetOverrideRow
        const layoutId = readOptionalSnapshotString(row.layoutId, 'layoutId', 'widget override', { defaultValue: '' })
        const baseWidgetId = readOptionalSnapshotString(row.baseWidgetId, 'baseWidgetId', `widget override ${layoutId}`, {
            defaultValue: ''
        })
        if (!layoutId || !baseWidgetId) {
            throw new Error('[SchemaSync] Snapshot widget override has an invalid identity')
        }
        const zone = readOptionalSnapshotString(row.zone, 'zone', `widget override ${layoutId}`, {
            nullable: true,
            defaultValue: null
        }) as string | null
        const config = readOptionalSnapshotRecord(row.config, 'config', `widget override ${layoutId}`, { nullable: true })
        const isActive =
            row.isActive === undefined || row.isActive === null
                ? null
                : readOptionalSnapshotBoolean(row.isActive, 'isActive', `widget override ${layoutId}`, false)
        const isDeletedOverride =
            row.isDeletedOverride === undefined
                ? false
                : readOptionalSnapshotBoolean(row.isDeletedOverride, 'isDeletedOverride', `widget override ${layoutId}`, false)
        return {
            layoutId,
            baseWidgetId,
            zone,
            sortOrder:
                row.sortOrder === undefined || row.sortOrder === null
                    ? null
                    : readOptionalSnapshotInteger(row.sortOrder, 'sortOrder', `widget override ${layoutId}`, 0),
            config: config === undefined ? null : config,
            isActive,
            isDeletedOverride
        }
    })
}

export const materializeSnapshotLayoutsAndWidgets = (
    snapshot: PublishedApplicationSnapshot
): {
    layouts: PersistedAppLayout[]
    widgets: PersistedAppLayoutZoneWidget[]
} => {
    const globalLayouts = normalizeSnapshotLayoutEntries(snapshot)
    const templateByLayoutId = getSnapshotTemplateByLayoutId(snapshot)
    const rawWidgets = normalizeSnapshotWidgetEntries(snapshot, templateByLayoutId)
    const scopedLayouts = normalizeSnapshotScopedLayouts(snapshot)
    const overrideRows = normalizeSnapshotLayoutWidgetOverrides(snapshot)
    const knownLayoutIds = new Set(templateByLayoutId.keys())
    for (const widget of rawWidgets) {
        if (!knownLayoutIds.has(widget.layoutId)) {
            throw new Error(`[SchemaSync] Widget ${widget.id} references an unknown layout ${widget.layoutId}`)
        }
    }
    const independentLayoutIds = new Set(
        scopedLayouts.filter((layout) => layout.compositionMode === 'independent').map((layout) => layout.id)
    )
    const scopedLayoutById = new Map(scopedLayouts.map((layout) => [layout.id, layout]))
    const baseWidgetById = new Map<string, MaterializedSnapshotWidget>()
    for (const widget of rawWidgets) {
        if (baseWidgetById.has(widget.id)) {
            throw new Error(`[SchemaSync] Snapshot contains duplicate layout widget id ${widget.id}`)
        }
        baseWidgetById.set(widget.id, widget)
    }
    const overrideTargets = new Set<string>()
    for (const override of overrideRows) {
        const scopedLayout = scopedLayoutById.get(override.layoutId)
        if (!scopedLayout) {
            throw new Error(`[SchemaSync] Widget override ${override.layoutId}:${override.baseWidgetId} must target a scoped layout`)
        }
        if (independentLayoutIds.has(override.layoutId)) {
            throw new Error(`[SchemaSync] Independent layout ${override.layoutId} cannot contain widget overrides`)
        }
        if (!scopedLayout.baseLayoutId) {
            throw new Error(`[SchemaSync] Overlay layout ${override.layoutId} must reference a base layout`)
        }
        const baseWidget = baseWidgetById.get(override.baseWidgetId)
        if (!baseWidget) {
            throw new Error(`[SchemaSync] Widget override references a missing base widget ${override.baseWidgetId}`)
        }
        if (baseWidget.layoutId !== scopedLayout.baseLayoutId) {
            throw new Error(
                `[SchemaSync] Widget override ${override.layoutId}:${override.baseWidgetId} references a widget outside base layout ${scopedLayout.baseLayoutId}`
            )
        }
        const target = `${override.layoutId}:${override.baseWidgetId}`
        if (overrideTargets.has(target)) {
            throw new Error(`[SchemaSync] Snapshot contains duplicate widget override target ${target}`)
        }
        overrideTargets.add(target)
    }
    const widgetsByLayoutId = new Map<string, MaterializedSnapshotWidget[]>()
    for (const widget of rawWidgets) {
        const bucket = widgetsByLayoutId.get(widget.layoutId) ?? []
        bucket.push(widget)
        widgetsByLayoutId.set(widget.layoutId, bucket)
    }

    for (const [layoutId, widgets] of widgetsByLayoutId) {
        const templateKey = templateByLayoutId.get(layoutId)
        if (!templateKey) continue
        assertMaterializedWidgetIdentitySafety(layoutId, templateKey, widgets)
    }

    if (scopedLayouts.length === 0) {
        const layouts = ensureScopedDefaultLayouts(globalLayouts)
        const allowedLayoutIds = new Set(layouts.map((layout) => layout.id))
        const widgets = rawWidgets
            .filter((item) => allowedLayoutIds.has(item.layoutId))
            .sort((a, b) => {
                if (a.layoutId !== b.layoutId) return a.layoutId.localeCompare(b.layoutId)
                if (a.zone !== b.zone) return a.zone.localeCompare(b.zone)
                if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                return a.id.localeCompare(b.id)
            })

        return { layouts, widgets }
    }

    const baseLayoutMap = new Map(globalLayouts.map((layout) => [layout.id, layout]))

    const overrideMap = new Map<string, NormalizedLayoutWidgetOverride>()
    for (const override of overrideRows) {
        overrideMap.set(`${override.layoutId}:${override.baseWidgetId}`, override)
    }

    const materializedLayouts: PersistedAppLayout[] = [...globalLayouts]
    const materializedWidgets: MaterializedSnapshotWidget[] = rawWidgets.filter((item) => baseLayoutMap.has(item.layoutId))

    for (const scopedLayout of scopedLayouts) {
        if (scopedLayout.compositionMode === 'independent') {
            const ownedWidgets = (widgetsByLayoutId.get(scopedLayout.id) ?? []).map((item) => ({
                ...item,
                layoutId: scopedLayout.id,
                sourceBaseWidgetId: null
            }))
            materializedLayouts.push({
                id: scopedLayout.id,
                scopeEntityId: scopedLayout.scopeEntityId,
                templateKey: scopedLayout.templateKey,
                name: scopedLayout.name,
                description: scopedLayout.description,
                config: withLayoutCompositionMetadata(scopedLayout.config, 'independent', null),
                isActive: scopedLayout.isActive,
                isDefault: scopedLayout.isDefault,
                sortOrder: scopedLayout.sortOrder
            })
            materializedWidgets.push(...ownedWidgets)
            continue
        }

        const baseLayoutId = scopedLayout.baseLayoutId
        if (!baseLayoutId) {
            throw new Error(`Overlay layout ${scopedLayout.id} must reference a base layout`)
        }
        const baseLayout = baseLayoutMap.get(baseLayoutId)
        if (!baseLayout) {
            throw new Error(`Scoped layout ${scopedLayout.id} references a missing base layout`)
        }

        const scopedTemplateKey = parseApplicationTemplateKey(scopedLayout.templateKey, `scoped layout ${scopedLayout.id}`)
        if (scopedTemplateKey !== baseLayout.templateKey) {
            throw new Error(`Scoped layout ${scopedLayout.id} must use the same template as its base layout`)
        }

        const ownedWidgetsForLayout = widgetsByLayoutId.get(scopedLayout.id) ?? []
        const materializedScopedWidgets: MaterializedSnapshotWidget[] = []

        const baseWidgets = widgetsByLayoutId.get(baseLayoutId) ?? []
        const ownedWidgets = ownedWidgetsForLayout.map((item) => ({
            ...item,
            layoutId: scopedLayout.id
        }))
        for (const baseWidget of baseWidgets) {
            const override = overrideMap.get(`${scopedLayout.id}:${baseWidget.id}`)
            if (override?.isDeletedOverride) {
                continue
            }
            const inheritedZone = normalizeLayoutZone(override?.zone ?? baseWidget.zone, scopedTemplateKey)
            if (!isWidgetAllowedForTemplate(scopedTemplateKey, baseWidget.widgetKey, inheritedZone)) {
                throw new Error(`Widget ${baseWidget.widgetKey} is not allowed in scoped layout ${scopedLayout.id}`)
            }
            const inheritedIsActive = override?.isActive ?? baseWidget.isActive
            let inheritedConfig = override?.config ?? baseWidget.config
            try {
                inheritedConfig = parseApplicationLayoutWidgetConfig(baseWidget.widgetKey, inheritedConfig)
            } catch {
                throw new Error(`Scoped layout ${scopedLayout.id} contains invalid widget configuration`)
            }
            if (
                scopedTemplateKey === 'marketing-page' &&
                materializedWidgetInstanceKey({ widgetKey: baseWidget.widgetKey, config: inheritedConfig }) !==
                    materializedWidgetInstanceKey(baseWidget)
            ) {
                throw new Error(`Scoped layout ${scopedLayout.id} cannot change a marketing widget instance key`)
            }
            materializedScopedWidgets.push({
                // The physical application row is allocated by sync persistence.
                // This projection only needs a fresh UUID-v7 placeholder; the
                // source lineage is the stable logical identity.
                id: generateUuidV7(),
                layoutId: scopedLayout.id,
                zone: inheritedZone,
                widgetKey: baseWidget.widgetKey,
                sortOrder: override?.sortOrder ?? baseWidget.sortOrder,
                config: inheritedConfig,
                sourceBaseWidgetId: baseWidget.sourceLineageKey
                    ? stableLineageUuidV7(baseWidget.layoutId, baseWidget.sourceLineageKey)
                    : baseWidget.id,
                isActive: inheritedIsActive
            })
        }

        materializedLayouts.push({
            id: scopedLayout.id,
            scopeEntityId: scopedLayout.scopeEntityId,
            templateKey: scopedTemplateKey,
            name: Object.keys(scopedLayout.name).length > 0 ? scopedLayout.name : baseLayout.name,
            description: scopedLayout.description ?? baseLayout.description,
            config: withLayoutCompositionMetadata(
                scopedTemplateKey === 'dashboard'
                    ? {
                          ...baseLayout.config,
                          ...buildDashboardWidgetVisibilityConfig(
                              [...materializedScopedWidgets, ...ownedWidgets]
                                  .filter((item) => item.isActive !== false)
                                  .map((item) => ({ widgetKey: item.widgetKey, zone: item.zone }))
                          ),
                          ...scopedLayout.config
                      }
                    : { ...baseLayout.config, ...scopedLayout.config },
                'overlay',
                baseLayoutId
            ),
            isActive: scopedLayout.isActive,
            isDefault: scopedLayout.isDefault,
            sortOrder: scopedLayout.sortOrder
        })

        materializedWidgets.push(...materializedScopedWidgets, ...ownedWidgets)
    }

    for (const scopedLayout of scopedLayouts) {
        const widgets = materializedWidgets.filter((widget) => widget.layoutId === scopedLayout.id)
        assertMaterializedWidgetIdentitySafety(scopedLayout.id, scopedLayout.templateKey, widgets)
    }

    const layouts = ensureScopedDefaultLayouts(materializedLayouts)
    const allowedLayoutIds = new Set(layouts.map((layout) => layout.id))
    const widgets = materializedWidgets
        .filter((item) => allowedLayoutIds.has(item.layoutId))
        .sort((a, b) => {
            if (a.layoutId !== b.layoutId) return a.layoutId.localeCompare(b.layoutId)
            if (a.zone !== b.zone) return a.zone.localeCompare(b.zone)
            if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
            return a.id.localeCompare(b.id)
        })

    return { layouts, widgets }
}

export function normalizeSnapshotLayouts(snapshot: PublishedApplicationSnapshot): PersistedAppLayout[] {
    return materializeSnapshotLayoutsAndWidgets(snapshot).layouts
}

export function normalizeSnapshotLayoutZoneWidgets(snapshot: PublishedApplicationSnapshot): PersistedAppLayoutZoneWidget[] {
    return materializeSnapshotLayoutsAndWidgets(snapshot).widgets
}

// --- Seeding helpers ---

export function extractSetConstantRefConfig(
    uiConfig: unknown
): { id: string; codename?: string; dataType?: string; value?: unknown; name?: unknown } | null {
    if (!isRecord(uiConfig)) return null
    const candidate = uiConfig.setConstantRef
    if (!isRecord(candidate)) return null
    if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) return null

    return {
        id: candidate.id.trim(),
        codename: typeof candidate.codename === 'string' ? candidate.codename : undefined,
        dataType: typeof candidate.dataType === 'string' ? candidate.dataType : undefined,
        value: candidate.value,
        name: candidate.name
    }
}

export function resolveSetReferenceId(
    value: unknown,
    field: { targetConstantId?: string | null; uiConfig?: Record<string, unknown> }
): string | null {
    if (typeof field.targetConstantId === 'string' && field.targetConstantId.trim().length > 0) {
        return field.targetConstantId.trim()
    }

    const setConstantRef = extractSetConstantRefConfig(field.uiConfig)
    if (setConstantRef?.id) {
        return setConstantRef.id
    }

    return normalizeReferenceId(value)
}

/**
 * Normalize a child field value for TABLE row seeding.
 * Applies the same type-specific handling as parent seed logic.
 */
export function normalizeChildFieldValue(
    value: unknown,
    field: {
        dataType: ComponentDefinitionDataType
        validationRules?: Record<string, unknown>
        targetEntityKind?: string | null
        targetConstantId?: string | null
        uiConfig?: Record<string, unknown>
    },
    codename: string,
    tableName: string,
    elementId: string
): unknown {
    if (value === null || value === undefined) return null
    if (field.dataType === ComponentDefinitionDataType.STRING && field.validationRules?.format === 'hexColor') {
        try {
            return normalizeInterpretationNetworkHexColor(value)
        } catch {
            throw new Error('Invalid configured colour value')
        }
    }
    if (isVLCField(field)) return prepareJsonbValue(value)
    if (field.dataType === ComponentDefinitionDataType.JSON) return prepareJsonbValue(value)
    if (field.dataType === ComponentDefinitionDataType.NUMBER) {
        return validateNumericValue({
            value,
            field: { codename, validationRules: field.validationRules },
            tableName,
            elementId
        })
    }
    if (field.dataType === ComponentDefinitionDataType.REF) {
        if (field.targetEntityKind === 'set') {
            return resolveSetReferenceId(value, field)
        }
        return normalizeReferenceId(value)
    }
    return value
}

export function resolveObjectSeedingOrder(entities: EntityDefinition[]): string[] {
    const objects = entities.filter((entity) => entity.kind === 'object')
    const objectById = new Map(objects.map((entity) => [entity.id, entity]))
    const adjacency = new Map<string, Set<string>>()
    const indegree = new Map<string, number>()

    for (const entity of objects) {
        adjacency.set(entity.id, new Set())
        indegree.set(entity.id, 0)
    }

    for (const entity of objects) {
        for (const field of entity.fields ?? []) {
            if (field.dataType !== ComponentDefinitionDataType.REF) continue
            if (field.targetEntityKind !== 'object') continue
            const targetId = field.targetEntityId
            if (typeof targetId !== 'string' || targetId.length === 0 || targetId === entity.id) continue
            if (!objectById.has(targetId)) continue

            const neighbors = adjacency.get(targetId)
            if (!neighbors || neighbors.has(entity.id)) continue
            neighbors.add(entity.id)
            indegree.set(entity.id, (indegree.get(entity.id) ?? 0) + 1)
        }
    }

    const queue = objects
        .filter((entity) => (indegree.get(entity.id) ?? 0) === 0)
        .map((entity) => entity.id)
        .sort((a, b) => {
            const aEntity = objectById.get(a)
            const bEntity = objectById.get(b)
            if (!aEntity || !bEntity) return a.localeCompare(b)
            const codenameCmp = aEntity.codename.localeCompare(bEntity.codename)
            return codenameCmp !== 0 ? codenameCmp : a.localeCompare(b)
        })

    const ordered: string[] = []
    while (queue.length > 0) {
        const current = queue.shift()
        if (!current) continue
        ordered.push(current)

        const nextIds = Array.from(adjacency.get(current) ?? []).sort((a, b) => {
            const aEntity = objectById.get(a)
            const bEntity = objectById.get(b)
            if (!aEntity || !bEntity) return a.localeCompare(b)
            const codenameCmp = aEntity.codename.localeCompare(bEntity.codename)
            return codenameCmp !== 0 ? codenameCmp : a.localeCompare(b)
        })
        for (const nextId of nextIds) {
            const nextDegree = (indegree.get(nextId) ?? 0) - 1
            indegree.set(nextId, nextDegree)
            if (nextDegree === 0) {
                queue.push(nextId)
                queue.sort((a, b) => {
                    const aEntity = objectById.get(a)
                    const bEntity = objectById.get(b)
                    if (!aEntity || !bEntity) return a.localeCompare(b)
                    const codenameCmp = aEntity.codename.localeCompare(bEntity.codename)
                    return codenameCmp !== 0 ? codenameCmp : a.localeCompare(b)
                })
            }
        }
    }

    const unprocessed = objects.map((entity) => entity.id).filter((id) => !ordered.includes(id))
    return [...ordered, ...unprocessed]
}

/**
 * Validates numeric values against NUMERIC(precision, scale) constraints.
 * Throws an error if the value is invalid or overflows.
 *
 * This ensures data integrity - if data passed metahub validation,
 * it should pass application sync too. Any overflow indicates
 * validation was bypassed during element creation.
 */
export function validateNumericValue(options: {
    value: unknown
    field: { codename: string; validationRules?: Record<string, unknown> }
    tableName: string
    elementId: string
}): number | null {
    const { value, field, tableName, elementId } = options

    if (value === undefined || value === null) {
        return null
    }

    if (typeof value !== 'number') {
        // Let DB handle type mismatch
        return value as unknown as number
    }

    const rules = field.validationRules as Partial<ComponentDefinitionValidationRules> | undefined

    try {
        return validateNumberOrThrow(
            value,
            {
                precision: rules?.precision,
                scale: rules?.scale,
                min: rules?.min ?? undefined,
                max: rules?.max ?? undefined,
                nonNegative: rules?.nonNegative
            },
            {
                fieldName: field.codename,
                elementId
            }
        )
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(
            `[SchemaSync] Failed to sync element ${elementId} to ${tableName}: ${message}. ` +
                `This indicates the element contains invalid data that bypassed metahub validation.`
        )
    }
}

export function resolveFieldDefaultEnumValueId(field: EntityDefinition['fields'][number]): string | null {
    if (!isRecord(field.uiConfig)) return null
    const candidate = field.uiConfig.defaultEnumValueId
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : null
}

// --- Preview / diff helpers ---

export function resolveElementPreviewLabel(entity: EntityDefinition, data: Record<string, unknown>): string | null {
    const fields = entity.fields ?? []
    const displayField =
        fields.find((field) => field.isDisplayComponent) ??
        fields.find((field) => field.dataType === ComponentDefinitionDataType.STRING) ??
        fields[0]

    if (!displayField) return null
    const rawValue = data[displayField.codename]
    if (rawValue === null || rawValue === undefined) return null

    const localized = resolveLocalizedPreviewText(rawValue)
    if (localized) return localized

    if (typeof rawValue === 'string') return rawValue
    if (typeof rawValue === 'number' || typeof rawValue === 'boolean') return String(rawValue)
    return null
}

export function resolveSetConstantPreviewValue(field: EntityField, fallbackRefId: string): unknown {
    const setConstantRef = extractSetConstantRefConfig(field.uiConfig)
    if (!setConstantRef) return fallbackRefId

    const value = setConstantRef.value
    if (value === null || value === undefined) {
        const localizedName = resolveLocalizedPreviewText(setConstantRef.name)
        return localizedName ?? setConstantRef.codename ?? setConstantRef.id
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value
    }

    const localizedValue = resolveLocalizedPreviewText(value)
    if (localizedValue) return localizedValue

    const localizedName = resolveLocalizedPreviewText(setConstantRef.name)
    if (localizedName) return localizedName

    try {
        return JSON.stringify(value)
    } catch {
        return setConstantRef.codename ?? setConstantRef.id
    }
}

export function buildMergedDashboardLayoutConfig(snapshot: PublishedApplicationSnapshot): Record<string, unknown> {
    if (snapshot.layoutConfig !== undefined && !isRecord(snapshot.layoutConfig)) {
        throw new Error('[SchemaSync] Snapshot layoutConfig must be an object')
    }
    const parsed = parseApplicationLayoutConfig('dashboard', snapshot.layoutConfig ?? {})
    return normalizeDashboardLayoutConfig(parsed) as unknown as Record<string, unknown>
}
