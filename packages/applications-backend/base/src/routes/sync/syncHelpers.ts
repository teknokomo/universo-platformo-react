/**
 * Application Sync - Helper Functions
 *
 * Pure utility functions for schema sync operations.
 * No database access - only data transformation and validation.
 */

import { createHash } from 'crypto'

import { type Request, type Response, type RequestHandler } from 'express'
import stableStringify from 'json-stable-stringify'
import { assertCanonicalIdentifier, assertCanonicalSchemaName, quoteIdentifier } from '@universo/migrations-core'
import type { EntityDefinition, SchemaSnapshot } from '@universo/schema-ddl'
import {
    ApplicationSchemaStatus,
    FieldDefinitionDataType,
    type ApplicationLifecycleContract,
    type ApplicationLayoutWidget,
    type FieldDefinitionValidationRules,
    type VersionedLocalizedContent
} from '@universo/types'
import {
    createCodenameVLC,
    getCodenamePrimary,
    normalizeDashboardLayoutConfig,
    resolveApplicationLifecycleContractFromConfig,
    resolvePlatformSystemFieldsContractFromConfig,
    validateNumberOrThrow
} from '@universo/utils'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import { withWorkspaceContract } from '../../services/applicationWorkspaces'
import type { ApplicationSyncQueryBuilder } from '../../ddl'
import {
    EMPTY_VLC,
    RUNTIME_ENTITY_KINDS,
    RUNTIME_ENTITY_KIND_PATTERN,
    type SyncableApplicationRecord,
    type PersistedAppLayout,
    type PersistedAppLayoutZoneWidget,
    type SnapshotCatalogLayoutRow,
    type SnapshotCatalogLayoutWidgetOverrideRow,
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

const normalizeLayoutZone = (value: unknown): ApplicationLayoutWidget['zone'] => {
    return value === 'left' || value === 'right' || value === 'top' || value === 'bottom' || value === 'center' ? value : 'center'
}

// --- Core utilities ---

export const asyncHandler = (fn: (req: Request, res: Response) => Promise<Response | void>): RequestHandler => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res)).catch(next)
    }
}

export const runtimeCodenameTextSql = (columnRef: string): string =>
    `COALESCE(${columnRef}->'locales'->(${columnRef}->>'_primary')->>'content', ${columnRef}->'locales'->'en'->>'content', '')`

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

export function isVLCField(field: { dataType: FieldDefinitionDataType; validationRules?: Record<string, unknown> }): boolean {
    if (field.dataType !== FieldDefinitionDataType.STRING) {
        return false
    }
    const rules = field.validationRules as Partial<FieldDefinitionValidationRules> | undefined
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

    if (field.dataType === FieldDefinitionDataType.NUMBER && typeof value === 'string') {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : value
    }

    if (field.dataType === FieldDefinitionDataType.DATE && value instanceof Date) {
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

type NormalizedCatalogLayout = PersistedAppLayout & {
    baseLayoutId: string
}

type NormalizedCatalogWidgetOverride = {
    catalogLayoutId: string
    baseWidgetId: string
    zone: string | null
    sortOrder: number | null
    config: Record<string, unknown> | null
    isActive: boolean | null
    isDeletedOverride: boolean
}

const CATALOG_LAYOUT_WIDGET_NAMESPACE = 'catalog-layout-widget'
const WORKSPACE_SWITCHER_WIDGET_NAMESPACE = 'workspace-switcher-widget'
const WORKSPACE_SWITCHER_DIVIDER_NAMESPACE = 'workspace-switcher-divider-widget'

const buildSyntheticUuid = (namespace: string, left: string, right: string): string => {
    const digest = createHash('sha1').update(`${namespace}:${left}:${right}`).digest('hex').slice(0, 32).split('')
    digest[12] = '5'
    digest[16] = ['8', '9', 'a', 'b'][parseInt(digest[16] ?? '0', 16) % 4]
    const hex = digest.join('')

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

const normalizeSnapshotLayoutEntries = (snapshot: PublishedApplicationSnapshot): PersistedAppLayout[] => {
    const rows = (Array.isArray(snapshot.layouts) ? snapshot.layouts : [])
        .map((layout) => {
            const normalizedLayout = (layout ?? {}) as SnapshotLayoutRow

            return {
                id: String(normalizedLayout.id ?? ''),
                linkedCollectionId:
                    typeof normalizedLayout.linkedCollectionId === 'string' && normalizedLayout.linkedCollectionId.length > 0
                        ? normalizedLayout.linkedCollectionId
                        : null,
                templateKey:
                    typeof normalizedLayout.templateKey === 'string' && normalizedLayout.templateKey.length > 0
                        ? normalizedLayout.templateKey
                        : 'dashboard',
                name: isRecord(normalizedLayout.name) ? normalizedLayout.name : {},
                description: isRecord(normalizedLayout.description) ? normalizedLayout.description : null,
                config: isRecord(normalizedLayout.config) ? normalizedLayout.config : {},
                isActive: Boolean(normalizedLayout.isActive),
                isDefault: Boolean(normalizedLayout.isDefault),
                sortOrder: typeof normalizedLayout.sortOrder === 'number' ? normalizedLayout.sortOrder : 0
            }
        })
        .filter((layout) => layout.id.length > 0)

    const desiredDefaultLayoutId = typeof snapshot.defaultLayoutId === 'string' ? snapshot.defaultLayoutId : null
    if (desiredDefaultLayoutId) {
        for (const row of rows) {
            if (row.linkedCollectionId === null) {
                row.isDefault = row.id === desiredDefaultLayoutId
            }
        }
    }

    return rows
}

const ensureScopedDefaultLayouts = (rows: PersistedAppLayout[]): PersistedAppLayout[] => {
    const rowsByScope = new Map<string, PersistedAppLayout[]>()

    for (const row of rows) {
        const scopeKey = row.linkedCollectionId ?? '__global__'
        const bucket = rowsByScope.get(scopeKey) ?? []
        bucket.push(row)
        rowsByScope.set(scopeKey, bucket)
    }

    for (const bucket of rowsByScope.values()) {
        if (bucket.length === 0) continue
        if (bucket.some((row) => row.isDefault)) continue
        const fallback = bucket.find((row) => row.isActive) ?? bucket[0]
        fallback.isDefault = true
    }

    return rows.sort((a, b) => {
        if ((a.linkedCollectionId ?? '') !== (b.linkedCollectionId ?? '')) {
            return (a.linkedCollectionId ?? '').localeCompare(b.linkedCollectionId ?? '')
        }
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
        return a.id.localeCompare(b.id)
    })
}

const normalizeSnapshotWidgetEntries = (snapshot: PublishedApplicationSnapshot): MaterializedSnapshotWidget[] => {
    return (Array.isArray(snapshot.layoutZoneWidgets) ? snapshot.layoutZoneWidgets : [])
        .map((item) => (item ?? {}) as SnapshotWidgetRow)
        .map((item) => ({
            id: String(item.id ?? ''),
            layoutId: String(item.layoutId ?? ''),
            zone: normalizeLayoutZone(item.zone),
            widgetKey: typeof item.widgetKey === 'string' ? item.widgetKey : '',
            sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0,
            config: isRecord(item.config) ? item.config : {},
            isActive: item.isActive !== false
        }))
        .filter((item) => item.id.length > 0 && item.layoutId.length > 0 && item.widgetKey.length > 0)
}

export const withWorkspaceRuntimeLayoutWidgets = (
    snapshot: PublishedApplicationSnapshot,
    workspacesEnabled: boolean
): PublishedApplicationSnapshot => {
    if (!workspacesEnabled || !Array.isArray(snapshot.layouts)) {
        return snapshot
    }

    const widgets = normalizeSnapshotWidgetEntries(snapshot)
    const nextWidgets: PersistedAppLayoutZoneWidget[] = [...widgets]

    for (const rawLayout of snapshot.layouts) {
        const layout = (rawLayout ?? {}) as SnapshotLayoutRow
        const layoutId = typeof layout.id === 'string' && layout.id.length > 0 ? layout.id : ''
        const linkedCollectionId =
            typeof layout.linkedCollectionId === 'string' && layout.linkedCollectionId.length > 0 ? layout.linkedCollectionId : null

        if (!layoutId || linkedCollectionId) {
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
                id: buildSyntheticUuid(WORKSPACE_SWITCHER_WIDGET_NAMESPACE, layoutId, 'workspaceSwitcher'),
                layoutId,
                zone: 'left',
                widgetKey: 'workspaceSwitcher',
                sortOrder: firstSortOrder - 200,
                config: {},
                isActive: true
            },
            {
                id: buildSyntheticUuid(WORKSPACE_SWITCHER_DIVIDER_NAMESPACE, layoutId, 'workspaceSwitcher-divider'),
                layoutId,
                zone: 'left',
                widgetKey: 'divider',
                sortOrder: firstSortOrder - 199,
                config: {},
                isActive: true
            }
        )
    }

    return {
        ...snapshot,
        layoutZoneWidgets: nextWidgets
    }
}

const normalizeSnapshotCatalogLayouts = (snapshot: PublishedApplicationSnapshot): NormalizedCatalogLayout[] => {
    return (Array.isArray(snapshot.catalogLayouts) ? snapshot.catalogLayouts : [])
        .map((layout) => (layout ?? {}) as SnapshotCatalogLayoutRow)
        .map((layout) => ({
            id: String(layout.id ?? ''),
            linkedCollectionId:
                typeof layout.linkedCollectionId === 'string' && layout.linkedCollectionId.length > 0 ? layout.linkedCollectionId : null,
            baseLayoutId: typeof layout.baseLayoutId === 'string' && layout.baseLayoutId.length > 0 ? layout.baseLayoutId : '',
            templateKey: typeof layout.templateKey === 'string' && layout.templateKey.length > 0 ? layout.templateKey : 'dashboard',
            name: isRecord(layout.name) ? layout.name : {},
            description: isRecord(layout.description) ? layout.description : null,
            config: isRecord(layout.config) ? layout.config : {},
            isActive: layout.isActive !== false,
            isDefault: Boolean(layout.isDefault),
            sortOrder: typeof layout.sortOrder === 'number' ? layout.sortOrder : 0
        }))
        .filter(
            (layout) => layout.id.length > 0 && layout.linkedCollectionId && layout.baseLayoutId.length > 0
        ) as NormalizedCatalogLayout[]
}

const normalizeSnapshotCatalogLayoutWidgetOverrides = (snapshot: PublishedApplicationSnapshot): NormalizedCatalogWidgetOverride[] => {
    return (Array.isArray(snapshot.catalogLayoutWidgetOverrides) ? snapshot.catalogLayoutWidgetOverrides : [])
        .map((row) => (row ?? {}) as SnapshotCatalogLayoutWidgetOverrideRow)
        .map((row) => ({
            catalogLayoutId: typeof row.catalogLayoutId === 'string' && row.catalogLayoutId.length > 0 ? row.catalogLayoutId : '',
            baseWidgetId: typeof row.baseWidgetId === 'string' && row.baseWidgetId.length > 0 ? row.baseWidgetId : '',
            zone: typeof row.zone === 'string' && row.zone.length > 0 ? row.zone : null,
            sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : null,
            config: null,
            isActive: typeof row.isActive === 'boolean' ? row.isActive : null,
            isDeletedOverride: row.isDeletedOverride === true
        }))
        .filter((row) => row.catalogLayoutId.length > 0 && row.baseWidgetId.length > 0)
}

const materializeSnapshotLayoutsAndWidgets = (
    snapshot: PublishedApplicationSnapshot
): {
    layouts: PersistedAppLayout[]
    widgets: PersistedAppLayoutZoneWidget[]
} => {
    const globalLayouts = normalizeSnapshotLayoutEntries(snapshot)
    const rawWidgets = normalizeSnapshotWidgetEntries(snapshot)
    const catalogLayouts = normalizeSnapshotCatalogLayouts(snapshot)
    const overrideRows = normalizeSnapshotCatalogLayoutWidgetOverrides(snapshot)

    if (catalogLayouts.length === 0) {
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
    const widgetsByLayoutId = new Map<string, MaterializedSnapshotWidget[]>()
    for (const widget of rawWidgets) {
        const bucket = widgetsByLayoutId.get(widget.layoutId) ?? []
        bucket.push(widget)
        widgetsByLayoutId.set(widget.layoutId, bucket)
    }

    const overrideMap = new Map<string, NormalizedCatalogWidgetOverride>()
    for (const override of overrideRows) {
        overrideMap.set(`${override.catalogLayoutId}:${override.baseWidgetId}`, override)
    }

    const materializedLayouts: PersistedAppLayout[] = [...globalLayouts]
    const materializedWidgets: MaterializedSnapshotWidget[] = rawWidgets.filter((item) => baseLayoutMap.has(item.layoutId))

    for (const catalogLayout of catalogLayouts) {
        const baseLayout = baseLayoutMap.get(catalogLayout.baseLayoutId)
        if (!baseLayout || !catalogLayout.linkedCollectionId) {
            continue
        }

        const materializedCatalogWidgets: MaterializedSnapshotWidget[] = []

        const baseWidgets = widgetsByLayoutId.get(catalogLayout.baseLayoutId) ?? []
        const ownedWidgets = (widgetsByLayoutId.get(catalogLayout.id) ?? []).map((item) => ({
            ...item,
            layoutId: catalogLayout.id
        }))

        for (const baseWidget of baseWidgets) {
            const override = overrideMap.get(`${catalogLayout.id}:${baseWidget.id}`)
            if (override?.isDeletedOverride) {
                continue
            }

            materializedCatalogWidgets.push({
                id: buildSyntheticUuid(CATALOG_LAYOUT_WIDGET_NAMESPACE, catalogLayout.id, baseWidget.id),
                layoutId: catalogLayout.id,
                zone: normalizeLayoutZone(override?.zone ?? baseWidget.zone),
                widgetKey: baseWidget.widgetKey,
                sortOrder: override?.sortOrder ?? baseWidget.sortOrder,
                config: baseWidget.config,
                isActive: override?.isActive ?? baseWidget.isActive
            })
        }

        materializedLayouts.push({
            id: catalogLayout.id,
            linkedCollectionId: catalogLayout.linkedCollectionId,
            templateKey: catalogLayout.templateKey || baseLayout.templateKey,
            name: Object.keys(catalogLayout.name).length > 0 ? catalogLayout.name : baseLayout.name,
            description: catalogLayout.description ?? baseLayout.description,
            config: {
                ...baseLayout.config,
                ...catalogLayout.config,
                ...buildDashboardWidgetVisibilityConfig(
                    [...materializedCatalogWidgets, ...ownedWidgets]
                        .filter((item) => item.isActive !== false)
                        .map((item) => ({ widgetKey: item.widgetKey, zone: item.zone }))
                )
            },
            isActive: catalogLayout.isActive,
            isDefault: catalogLayout.isDefault,
            sortOrder: catalogLayout.sortOrder
        })

        materializedWidgets.push(...materializedCatalogWidgets, ...ownedWidgets)
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
        dataType: FieldDefinitionDataType
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
    if (isVLCField(field)) return prepareJsonbValue(value)
    if (field.dataType === FieldDefinitionDataType.JSON) return prepareJsonbValue(value)
    if (field.dataType === FieldDefinitionDataType.NUMBER) {
        return validateNumericValue({
            value,
            field: { codename, validationRules: field.validationRules },
            tableName,
            elementId
        })
    }
    if (field.dataType === FieldDefinitionDataType.REF) {
        if (field.targetEntityKind === 'set') {
            return resolveSetReferenceId(value, field)
        }
        return normalizeReferenceId(value)
    }
    return value
}

export function resolveCatalogSeedingOrder(entities: EntityDefinition[]): string[] {
    const catalogs = entities.filter((entity) => entity.kind === 'catalog')
    const catalogById = new Map(catalogs.map((entity) => [entity.id, entity]))
    const adjacency = new Map<string, Set<string>>()
    const indegree = new Map<string, number>()

    for (const entity of catalogs) {
        adjacency.set(entity.id, new Set())
        indegree.set(entity.id, 0)
    }

    for (const entity of catalogs) {
        for (const field of entity.fields ?? []) {
            if (field.dataType !== FieldDefinitionDataType.REF) continue
            if (field.targetEntityKind !== 'catalog') continue
            const targetId = field.targetEntityId
            if (typeof targetId !== 'string' || targetId.length === 0 || targetId === entity.id) continue
            if (!catalogById.has(targetId)) continue

            const neighbors = adjacency.get(targetId)
            if (!neighbors || neighbors.has(entity.id)) continue
            neighbors.add(entity.id)
            indegree.set(entity.id, (indegree.get(entity.id) ?? 0) + 1)
        }
    }

    const queue = catalogs
        .filter((entity) => (indegree.get(entity.id) ?? 0) === 0)
        .map((entity) => entity.id)
        .sort((a, b) => {
            const aEntity = catalogById.get(a)
            const bEntity = catalogById.get(b)
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
            const aEntity = catalogById.get(a)
            const bEntity = catalogById.get(b)
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
                    const aEntity = catalogById.get(a)
                    const bEntity = catalogById.get(b)
                    if (!aEntity || !bEntity) return a.localeCompare(b)
                    const codenameCmp = aEntity.codename.localeCompare(bEntity.codename)
                    return codenameCmp !== 0 ? codenameCmp : a.localeCompare(b)
                })
            }
        }
    }

    const unprocessed = catalogs.map((entity) => entity.id).filter((id) => !ordered.includes(id))
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

    const rules = field.validationRules as Partial<FieldDefinitionValidationRules> | undefined

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
        fields.find((field) => field.isDisplayAttribute) ??
        fields.find((field) => field.dataType === FieldDefinitionDataType.STRING) ??
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
    return normalizeDashboardLayoutConfig(snapshot.layoutConfig as Record<string, unknown> | undefined) as unknown as Record<
        string,
        unknown
    >
}
