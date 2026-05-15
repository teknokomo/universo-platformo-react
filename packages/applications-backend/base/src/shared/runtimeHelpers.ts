import type { DbExecutor } from '@universo/utils'
import type { ApplicationLifecycleContract } from '@universo/types'
import { getVLCString } from '@universo/utils/vlc'
import {
    createLocalizedContent,
    resolveApplicationLifecycleContractFromConfig,
    resolvePlatformSystemFieldsContractFromConfig
} from '@universo/utils'
import type { Request, Response } from 'express'
import type { ApplicationRole, RolePermission } from '../routes/guards'
import { ensureApplicationAccess, resolveEffectiveRolePermissions } from '../routes/guards'
import { findApplicationSchemaInfo } from '../persistence/applicationsStore'
import type { RuntimeWorkspaceAccess } from '../services/applicationWorkspaces'
import { resolveRuntimeWorkspaceAccess, setRuntimeWorkspaceContext } from '../services/applicationWorkspaces'
import { getRequestDbExecutor, getRequestDbSession } from '../utils'

// ---------------------------------------------------------------------------
// Custom error class for transaction rollback signals
// ---------------------------------------------------------------------------

/**
 * Thrown inside `executor.transaction()` callbacks to signal a business-logic
 * failure that should trigger transaction rollback and a specific HTTP response.
 */
export class UpdateFailure extends Error {
    constructor(public readonly statusCode: number, public readonly body: Record<string, unknown>) {
        super('Update failed')
    }
}

// ---------------------------------------------------------------------------
// Security & identifier helpers
// ---------------------------------------------------------------------------

export const IDENTIFIER_REGEX = /^[a-z_][a-z0-9_]*$/
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const quoteIdentifier = (identifier: string): string => {
    if (!IDENTIFIER_REGEX.test(identifier)) {
        throw new Error(`Unsafe identifier: ${identifier}`)
    }
    return `"${identifier}"`
}

export const quoteUuidLiteral = (value: string): string => {
    if (!UUID_REGEX.test(value)) {
        throw new Error(`Unsafe UUID literal: ${value}`)
    }
    return `'${value.toLowerCase()}'::uuid`
}

// ---------------------------------------------------------------------------
// Locale helpers
// ---------------------------------------------------------------------------

export const normalizeLocale = (locale?: string): string => {
    if (!locale) return 'en'
    return locale.split('-')[0].split('_')[0].toLowerCase()
}

export const resolveRequestedRuntimeWorkspaceId = (
    requestedWorkspaceId: string | null | undefined,
    workspaceAccess: RuntimeWorkspaceAccess
): string | null => {
    const normalizedWorkspaceId =
        typeof requestedWorkspaceId === 'string' && requestedWorkspaceId.trim().length > 0 ? requestedWorkspaceId.trim() : null

    if (!normalizedWorkspaceId) {
        return workspaceAccess.defaultWorkspaceId
    }

    if (!workspaceAccess.allowedWorkspaceIds.includes(normalizedWorkspaceId)) {
        throw new UpdateFailure(403, { error: 'Requested workspace is not available for the current user' })
    }

    return normalizedWorkspaceId
}

// ---------------------------------------------------------------------------
// Presentation / VLC resolution helpers
// ---------------------------------------------------------------------------

export const resolvePresentationLocalizedField = (
    presentation: unknown,
    field: 'name' | 'codename',
    locale: string,
    fallback: string
): string => {
    if (!presentation || typeof presentation !== 'object') return fallback

    const presentationObj = presentation as {
        name?: {
            _primary?: string
            locales?: Record<string, { content?: string }>
        }
        codename?: {
            _primary?: string
            locales?: Record<string, { content?: string }>
        }
    }

    const localizedField = presentationObj[field]
    const locales = localizedField?.locales
    if (!locales || typeof locales !== 'object') return fallback

    const normalized = normalizeLocale(locale)
    const direct = locales[normalized]?.content
    if (typeof direct === 'string' && direct.trim().length > 0) return direct

    const primary = localizedField?._primary
    const primaryValue = primary ? locales[primary]?.content : undefined
    if (typeof primaryValue === 'string' && primaryValue.trim().length > 0) return primaryValue

    const first = Object.values(locales).find((entry) => typeof entry?.content === 'string' && entry.content.trim().length > 0)
    return first?.content ?? fallback
}

export const resolvePresentationName = (presentation: unknown, locale: string, fallback: string): string =>
    resolvePresentationLocalizedField(presentation, 'name', locale, fallback)

export const resolvePresentationCodename = (presentation: unknown, locale: string, fallback: string): string =>
    resolvePresentationLocalizedField(presentation, 'codename', locale, fallback)

// ---------------------------------------------------------------------------
// Runtime codename helpers
// ---------------------------------------------------------------------------

export const runtimeCodenameTextSql = (columnRef: string): string =>
    `COALESCE(${columnRef}->'locales'->(${columnRef}->>'_primary')->>'content', ${columnRef}->'locales'->'en'->>'content', '')`

export const runtimeStandardKindSql = (kindColumn = 'kind'): string => `COALESCE(${kindColumn}, '')`

export const runtimeRegistrarLedgerSql = (configColumn = 'config'): string => `(
    COALESCE((${configColumn}->'capabilities'->'ledgerSchema'->>'enabled')::boolean, false) = true
    AND jsonb_typeof(${configColumn}->'ledger') = 'object'
    AND COALESCE(${configColumn}->'ledger'->>'sourcePolicy', '') = 'registrar'
)`

export const runtimeObjectFilterSql = (kindColumn = 'kind', configColumn = 'config'): string => `(${runtimeStandardKindSql(
    kindColumn
)} NOT IN ('hub', 'set', 'enumeration', 'page', 'ledger')
    AND NOT ${runtimeRegistrarLedgerSql(configColumn)})`

export const runtimeLayoutCapableFilterSql = (configColumn = 'config'): string =>
    `COALESCE((${configColumn}->'capabilities'->'layoutConfig'->>'enabled')::boolean, false) = true`

export const resolveRuntimeCodenameText = (codename: unknown): string => {
    if (typeof codename === 'string') {
        return codename
    }

    if (codename && typeof codename === 'object') {
        const localized = codename as {
            _primary?: string
            locales?: Record<string, { content?: string }>
        }
        const primaryLocale = typeof localized._primary === 'string' ? localized._primary : 'en'
        const primaryValue = localized.locales?.[primaryLocale]?.content
        if (typeof primaryValue === 'string' && primaryValue.trim().length > 0) {
            return primaryValue
        }

        const englishValue = localized.locales?.en?.content
        if (typeof englishValue === 'string' && englishValue.trim().length > 0) {
            return englishValue
        }

        for (const entry of Object.values(localized.locales ?? {})) {
            if (typeof entry?.content === 'string' && entry.content.trim().length > 0) {
                return entry.content
            }
        }
    }

    return ''
}

export const formatRuntimeFieldLabel = (codename: unknown): string => resolveRuntimeCodenameText(codename) || 'field'

export const formatRuntimeFieldPath = (...codenames: unknown[]): string =>
    codenames.map((codename) => formatRuntimeFieldLabel(codename)).join('.')

// ---------------------------------------------------------------------------
// Runtime input/value helpers
// ---------------------------------------------------------------------------

export const getRuntimeInputValue = (data: Record<string, unknown>, columnName: string, codename: unknown) => {
    const codenameKey = resolveRuntimeCodenameText(codename)
    const hasCodenameValue = codenameKey.length > 0 && Object.prototype.hasOwnProperty.call(data, codenameKey)

    return {
        codenameKey,
        hasUserValue: Object.prototype.hasOwnProperty.call(data, columnName) || hasCodenameValue,
        value: data[columnName] ?? (codenameKey.length > 0 ? data[codenameKey] : undefined)
    }
}

export const resolveLocalizedContent = (value: unknown, locale: string, fallback: string): string => {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed.length > 0 ? trimmed : fallback
    }

    if (value && typeof value === 'object') {
        const normalizedLocale = normalizeLocale(locale)
        const localized = getVLCString(value as Record<string, unknown>, normalizedLocale)
        if (localized && localized.trim().length > 0) {
            return localized
        }

        const plain = value as Record<string, unknown>
        const direct = plain[normalizedLocale]
        if (typeof direct === 'string' && direct.trim().length > 0) {
            return direct
        }
        const en = plain.en
        if (typeof en === 'string' && en.trim().length > 0) {
            return en
        }
    }

    return fallback
}

// ---------------------------------------------------------------------------
// Runtime type aliases & value coercion
// ---------------------------------------------------------------------------

export type RuntimeDataType = 'BOOLEAN' | 'STRING' | 'NUMBER' | 'DATE' | 'REF' | 'JSON' | 'TABLE'

/**
 * pg returns NUMERIC columns as strings to avoid JS floating-point precision loss.
 * This helper coerces such values back to JS numbers for API responses.
 */
export const pgNumericToNumber = (value: unknown): unknown => {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
        const num = Number(value)
        return Number.isFinite(num) ? num : value
    }
    return value
}

export const resolveRuntimeValue = (value: unknown, dataType: RuntimeDataType, locale: string): unknown => {
    if (value === null || value === undefined) {
        // BOOLEAN null → false for correct checkbox rendering (no indeterminate state)
        return dataType === 'BOOLEAN' ? false : null
    }

    if (dataType === 'STRING') {
        if (typeof value === 'string') return value
        if (typeof value === 'object') {
            const localized = getVLCString(value as Record<string, unknown>, locale)
            if (localized) return localized
            try {
                return JSON.stringify(value)
            } catch {
                return ''
            }
        }
        return String(value)
    }

    // NUMBER: pg returns NUMERIC as string — coerce to JS number
    if (dataType === 'NUMBER') return pgNumericToNumber(value)

    // BOOLEAN, DATE, REF, JSON — return as-is
    return value
}

// ---------------------------------------------------------------------------
// Lifecycle & row condition helpers
// ---------------------------------------------------------------------------

export const isSoftDeleteLifecycle = (contract: ApplicationLifecycleContract): boolean => contract.delete.mode === 'soft'

export const buildRuntimeActiveRowCondition = (
    contract: ApplicationLifecycleContract,
    platformConfig?: unknown,
    alias?: string,
    workspaceId?: string | null
): string => {
    const prefix = alias ? `${alias}.` : ''
    const platformContract = resolvePlatformSystemFieldsContractFromConfig(platformConfig)
    const clauses: string[] = []

    if (platformContract.delete.enabled) {
        clauses.push(`${prefix}_upl_deleted = false`)
    }

    if (isSoftDeleteLifecycle(contract)) {
        clauses.push(`${prefix}_app_deleted = false`)
    }

    if (workspaceId) {
        clauses.push(`${prefix}workspace_id = ${quoteUuidLiteral(workspaceId)}`)
    }

    return clauses.length > 0 ? clauses.join(' AND ') : 'TRUE'
}

export const buildRuntimeSoftDeleteSetClause = (
    deletedByParam: string,
    contract: ApplicationLifecycleContract,
    platformConfig?: unknown
): string => {
    if (!isSoftDeleteLifecycle(contract)) {
        throw new Error('Soft delete clause requested for hard-delete lifecycle')
    }

    const platformContract = resolvePlatformSystemFieldsContractFromConfig(platformConfig)
    const clauses = ['_upl_updated_at = now()', `_upl_updated_by = ${deletedByParam}`, '_app_deleted = true']

    if (platformContract.delete.enabled) {
        clauses.unshift('_upl_deleted = true')
        if (platformContract.delete.trackAt) {
            clauses.push('_upl_deleted_at = now()')
        }
        if (platformContract.delete.trackBy) {
            clauses.push(`_upl_deleted_by = ${deletedByParam}`)
        }
    }

    if (contract.delete.trackAt) {
        clauses.push('_app_deleted_at = now()')
    }
    if (contract.delete.trackBy) {
        clauses.push(`_app_deleted_by = ${deletedByParam}`)
    }

    return clauses.join(', ')
}

// ---------------------------------------------------------------------------
// Value coercion for writes
// ---------------------------------------------------------------------------

/** Supported runtime data types for write operations */
export const RUNTIME_WRITABLE_TYPES = new Set(['BOOLEAN', 'STRING', 'NUMBER', 'DATE', 'REF', 'JSON', 'TABLE'])

/**
 * Validates and coerces a value to match the expected runtime column type.
 * Returns the value to store or throws on type mismatch.
 */
export const coerceRuntimeValue = (value: unknown, dataType: string, validationRules?: Record<string, unknown>): unknown => {
    if (value === null || value === undefined) return null

    switch (dataType) {
        case 'BOOLEAN':
            if (typeof value !== 'boolean') throw new Error('Expected boolean value')
            return value
        case 'NUMBER': {
            let num: number
            if (typeof value === 'number') {
                num = value
            } else if (typeof value === 'string') {
                num = Number(value)
                if (!Number.isFinite(num)) throw new Error('Expected number value')
            } else {
                throw new Error('Expected number value')
            }
            if (validationRules) {
                if (validationRules.nonNegative === true && num < 0) {
                    throw new Error('Value must be non-negative')
                }
                if (typeof validationRules.min === 'number' && num < validationRules.min) {
                    throw new Error(`Value must be >= ${validationRules.min}`)
                }
                if (typeof validationRules.max === 'number' && num > validationRules.max) {
                    throw new Error(`Value must be <= ${validationRules.max}`)
                }
            }
            return num
        }
        case 'STRING': {
            const isVLC = Boolean(validationRules?.versioned) || Boolean(validationRules?.localized)
            if (isVLC) {
                if (typeof value === 'string') return createLocalizedContent('en', value)
                if (typeof value === 'object') {
                    const vlc = value as Record<string, unknown>
                    if (!vlc.locales || typeof vlc.locales !== 'object') {
                        throw new Error('VLC object must contain a locales property')
                    }
                    return value
                }
                throw new Error('Expected object or string value for VLC field')
            }
            if (typeof value !== 'string') throw new Error('Expected string value')
            return value
        }
        case 'DATE': {
            if (typeof value !== 'string') throw new Error('Expected ISO date string')
            const d = new Date(value)
            if (Number.isNaN(d.getTime())) throw new Error('Invalid date value')
            return value
        }
        case 'REF': {
            if (typeof value !== 'string') throw new Error('Expected UUID value')
            if (!UUID_REGEX.test(value)) throw new Error('Invalid UUID value')
            return value
        }
        case 'JSON':
            return typeof value === 'object' ? value : JSON.stringify(value)
        case 'TABLE':
            return null
        default:
            throw new Error(`Unsupported data type: ${dataType}`)
    }
}

export type RuntimeTableChildComponentMeta = {
    column_name: string
    data_type?: string | null
    validation_rules?: Record<string, unknown>
}

export const normalizeRuntimeTableChildInsertValue = (
    value: unknown,
    dataType: string | null | undefined,
    validationRules?: Record<string, unknown>
): unknown => {
    if (value === undefined || value === null) {
        return null
    }

    if (dataType === 'JSON') {
        return typeof value === 'string' ? value : JSON.stringify(value)
    }

    if (
        dataType === 'STRING' &&
        typeof value === 'object' &&
        (validationRules?.localized === true || validationRules?.versioned === true)
    ) {
        return JSON.stringify(value)
    }

    return value
}

export const normalizeRuntimeTableChildInsertValueByMeta = (
    value: unknown,
    childAttrMeta?: RuntimeTableChildComponentMeta | null
): unknown => {
    return normalizeRuntimeTableChildInsertValue(value, childAttrMeta?.data_type, childAttrMeta?.validation_rules)
}

// ---------------------------------------------------------------------------
// Row limit helpers
// ---------------------------------------------------------------------------

export const parseRowLimit = (value: unknown): number | null => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    const normalized = Math.floor(value)
    return normalized >= 0 ? normalized : null
}

export const getTableRowLimits = (validationRules?: Record<string, unknown>): { minRows: number | null; maxRows: number | null } => {
    const minRows = parseRowLimit(validationRules?.minRows)
    const maxRows = parseRowLimit(validationRules?.maxRows)
    return { minRows, maxRows }
}

export const getTableRowCountError = (
    rowCount: number,
    tableCodename: string,
    limits: { minRows: number | null; maxRows: number | null }
): string | null => {
    if (limits.minRows !== null && rowCount < limits.minRows) {
        return `TABLE ${tableCodename} requires at least ${limits.minRows} row(s)`
    }
    if (limits.maxRows !== null && rowCount > limits.maxRows) {
        return `TABLE ${tableCodename} allows at most ${limits.maxRows} row(s)`
    }
    return null
}

// ---------------------------------------------------------------------------
// Enum presentation & set constant helpers
// ---------------------------------------------------------------------------

export const getEnumPresentationMode = (uiConfig?: Record<string, unknown>): 'select' | 'radio' | 'label' => {
    const mode = uiConfig?.enumPresentationMode
    if (mode === 'radio' || mode === 'label') return mode
    return 'select'
}

export const getDefaultEnumValueId = (uiConfig?: Record<string, unknown>): string | null => {
    const defaultValueId = uiConfig?.defaultEnumValueId
    if (typeof defaultValueId === 'string' && UUID_REGEX.test(defaultValueId)) {
        return defaultValueId
    }
    return null
}

export type SetConstantUiConfig = {
    id: string
    codename?: string
    dataType?: string
    value?: unknown
    name?: unknown
}

export const getSetConstantConfig = (uiConfig?: Record<string, unknown>): SetConstantUiConfig | null => {
    if (!uiConfig || typeof uiConfig !== 'object') return null
    const candidate = uiConfig.setConstantRef
    if (!candidate || typeof candidate !== 'object') return null
    const typed = candidate as Record<string, unknown>
    if (typeof typed.id !== 'string' || !UUID_REGEX.test(typed.id)) return null
    return {
        id: typed.id,
        codename: typeof typed.codename === 'string' ? typed.codename : undefined,
        dataType: typeof typed.dataType === 'string' ? typed.dataType : undefined,
        value: typed.value,
        name: typed.name
    }
}

export const resolveSetConstantLabel = (config: SetConstantUiConfig, locale: string): string => {
    if (config.value === null || config.value === undefined) {
        return config.codename ?? config.id
    }

    if (config.dataType === 'STRING' && typeof config.value === 'object') {
        const localized = resolveLocalizedContent(config.value, locale, '')
        if (localized.trim().length > 0) return localized
    }

    if (config.dataType === 'DATE' && typeof config.value === 'string') {
        const parsed = new Date(config.value)
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toLocaleString(locale)
        }
    }

    if (typeof config.value === 'string' || typeof config.value === 'number' || typeof config.value === 'boolean') {
        return String(config.value)
    }

    const localizedName = resolveLocalizedContent(config.name, locale, '')
    if (localizedName.trim().length > 0) return localizedName

    if (config.value && typeof config.value === 'object') {
        try {
            return JSON.stringify(config.value)
        } catch {
            return config.codename ?? config.id
        }
    }

    return config.codename ?? config.id
}

export const resolveRefId = (value: unknown): string | null => {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
    if (!value || typeof value !== 'object') return null
    const typed = value as Record<string, unknown>
    const direct = typed.id
    if (typeof direct === 'string' && direct.trim().length > 0) return direct.trim()
    const nested = typed.value
    if (typeof nested === 'string' && nested.trim().length > 0) return nested.trim()
    if (nested && typeof nested === 'object') {
        const nestedId = (nested as Record<string, unknown>).id
        if (typeof nestedId === 'string' && nestedId.trim().length > 0) return nestedId.trim()
    }
    return null
}

export const ensureEnumerationValueBelongsToTarget = async (
    manager: DbExecutor,
    schemaIdent: string,
    enumValueId: string,
    targetOptionListId: string
): Promise<void> => {
    const rows = (await manager.query(
        `
        SELECT id
        FROM ${schemaIdent}._app_values
        WHERE id = $1
          AND object_id = $2
          AND _upl_deleted = false
          AND _app_deleted = false
        LIMIT 1
    `,
        [enumValueId, targetOptionListId]
    )) as Array<{ id: string }>

    if (rows.length === 0) {
        throw new Error('Enumeration value does not belong to target enumeration')
    }
}

// ---------------------------------------------------------------------------
// Runtime schema resolution
// ---------------------------------------------------------------------------

export type RuntimeRefOption = {
    id: string
    label: string
    codename?: unknown
    isDefault?: boolean
    sortOrder?: number
}

export interface RuntimeSchemaContext {
    schemaName: string
    schemaIdent: string
    manager: DbExecutor
    userId: string
    role: ApplicationRole
    permissions: Record<RolePermission, boolean>
    currentWorkspaceId: string | null
    workspacesEnabled: boolean
    applicationSettings: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Query helper factory
// ---------------------------------------------------------------------------

/**
 * Creates a query helper that uses the request session (if available) or falls back to the base executor.
 */
export const createQueryHelper = (getDbExecutor: () => DbExecutor) => {
    return <TRow = unknown>(req: Request, sql: string, parameters: unknown[] = []): Promise<TRow[]> => {
        const session = getRequestDbSession(req)
        if (session && !session.isReleased()) {
            return session.query<TRow>(sql, parameters)
        }
        return getDbExecutor().query<TRow>(sql, parameters)
    }
}

// ---------------------------------------------------------------------------
// User ID resolution
// ---------------------------------------------------------------------------

interface RequestUser {
    id?: string
    sub?: string
    user_id?: string
    userId?: string
}

export const resolveUserId = (req: Request): string | undefined => {
    const user = (req as Request & { user?: RequestUser }).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

// ---------------------------------------------------------------------------
// Application helpers
// ---------------------------------------------------------------------------

export const buildDefaultCopyNameInput = (name: unknown): Record<string, string> => {
    const locales = (name as { locales?: Record<string, { content?: string }> } | undefined)?.locales ?? {}
    const entries = Object.entries(locales)
        .map(([locale, value]) => [normalizeLocale(locale), typeof value?.content === 'string' ? value.content.trim() : ''] as const)
        .filter(([, content]) => content.length > 0)

    if (entries.length === 0) {
        return { en: 'Copy (copy)' }
    }

    const result: Record<string, string> = {}
    for (const [locale, content] of entries) {
        const suffix = locale === 'ru' ? ' (копия)' : ' (copy)'
        result[locale] = `${content}${suffix}`
    }
    return result
}

export const buildCopiedApplicationSlugCandidate = (sourceSlug: string, attempt: number): string => {
    const copySuffix = '-copy'
    const maxBaseLength = Math.max(1, 100 - copySuffix.length)
    const baseSlug = `${sourceSlug.slice(0, maxBaseLength)}${copySuffix}`
    const attemptSuffix = attempt <= 1 ? '' : `-${attempt}`
    const maxSlugLength = Math.max(1, 100 - attemptSuffix.length)
    return `${baseSlug.slice(0, maxSlugLength)}${attemptSuffix}`
}

// ---------------------------------------------------------------------------
// Tabular context resolution
// ---------------------------------------------------------------------------

export interface TabularContext {
    error: null
    object: {
        id: string
        codename: string
        table_name: string
        config?: Record<string, unknown> | null
    }
    lifecycleContract: ApplicationLifecycleContract
    tableAttr: {
        id: string
        codename: string
        column_name: string
        data_type: string
        validation_rules?: Record<string, unknown>
    }
    tabTableName: string
    tabTableIdent: string
    parentTableIdent: string
    childAttrs: Array<{
        id: string
        codename: string
        column_name: string
        data_type: string
        is_required: boolean
        validation_rules?: Record<string, unknown>
        target_object_id?: string | null
        target_object_kind?: string | null
        ui_config?: Record<string, unknown>
    }>
}

export type TabularContextResult = TabularContext | { error: string }

/**
 * Resolve a TABLE component and its child table for tabular CRUD operations.
 */
export const resolveTabularContext = async (
    manager: DbExecutor,
    schemaIdent: string,
    objectCollectionId: string,
    componentId: string
): Promise<TabularContextResult> => {
    if (!UUID_REGEX.test(objectCollectionId) || !UUID_REGEX.test(componentId)) {
        return { error: 'Invalid object or component ID format' }
    }

    const objects = (await manager.query(
        `
        SELECT id, codename, table_name, config
        FROM ${schemaIdent}._app_objects
        WHERE id = $1 AND kind = 'object'
          AND _upl_deleted = false
          AND _app_deleted = false
    `,
        [objectCollectionId]
    )) as Array<{
        id: string
        codename: string
        table_name: string
        config?: Record<string, unknown> | null
    }>

    if (objects.length === 0) return { error: 'Object not found' }

    const object = objects[0]
    if (!IDENTIFIER_REGEX.test(object.table_name)) return { error: 'Invalid table name' }
    const lifecycleContract = resolveApplicationLifecycleContractFromConfig(object.config)

    const tableAttrs = (await manager.query(
        `
        SELECT id, codename, column_name, data_type, validation_rules
        FROM ${schemaIdent}._app_components
        WHERE id = $1 AND object_id = $2 AND data_type = 'TABLE'
          AND parent_component_id IS NULL
          AND _upl_deleted = false
          AND _app_deleted = false
    `,
        [componentId, objectCollectionId]
    )) as Array<{
        id: string
        codename: string
        column_name: string
        data_type: string
        validation_rules?: Record<string, unknown>
    }>

    if (tableAttrs.length === 0) return { error: 'TABLE component not found' }

    const tableAttr = tableAttrs[0]
    const { generateChildTableName } = await import('@universo/schema-ddl')
    const fallbackTabTableName = generateChildTableName(tableAttr.id)
    const tabTableName =
        typeof tableAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tableAttr.column_name)
            ? tableAttr.column_name
            : fallbackTabTableName
    if (!IDENTIFIER_REGEX.test(tabTableName)) return { error: 'Invalid tabular table name' }

    const childAttrs = (await manager.query(
        `
        SELECT id, codename, column_name, data_type, is_required, validation_rules,
               target_object_id, target_object_kind, ui_config
        FROM ${schemaIdent}._app_components
        WHERE parent_component_id = $1
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST
    `,
        [componentId]
    )) as Array<{
        id: string
        codename: string
        column_name: string
        data_type: string
        is_required: boolean
        validation_rules?: Record<string, unknown>
        target_object_id?: string | null
        target_object_kind?: string | null
        ui_config?: Record<string, unknown>
    }>

    return {
        error: null,
        object,
        lifecycleContract,
        tableAttr,
        tabTableName,
        tabTableIdent: `${schemaIdent}.${quoteIdentifier(tabTableName)}`,
        parentTableIdent: `${schemaIdent}.${quoteIdentifier(object.table_name)}`,
        childAttrs
    }
}

// ---------------------------------------------------------------------------
// Runtime schema resolution (shared between runtime controllers)
// ---------------------------------------------------------------------------

/**
 * Validate an application, resolve its runtime schema, and return the
 * schema context needed for all runtime CRUD operations.
 *
 * Returns null and sends an error response when validation fails.
 */
export const resolveRuntimeSchema = async (
    getDbExecutor: () => DbExecutor,
    queryHelper: <TRow = unknown>(req: Request, sql: string, parameters?: unknown[]) => Promise<TRow[]>,
    req: Request,
    res: Response,
    applicationId: string
): Promise<RuntimeSchemaContext | null> => {
    if (!UUID_REGEX.test(applicationId)) {
        res.status(400).json({ error: 'Invalid application ID format' })
        return null
    }

    const ds = getRequestDbExecutor(req, getDbExecutor())
    const userId = resolveUserId(req)
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' })
        return null
    }

    const accessContext = await ensureApplicationAccess(ds, userId, applicationId)
    const role = (accessContext.membership.role || 'member') as ApplicationRole

    const application = await findApplicationSchemaInfo(
        {
            query: <TRow = unknown>(sql: string, parameters?: unknown[]) => queryHelper<TRow>(req, sql, parameters ?? [])
        },
        applicationId
    )
    if (!application) {
        res.status(404).json({ error: 'Application not found' })
        return null
    }
    if (!application.schemaName) {
        res.status(400).json({ error: 'Application schema is not configured' })
        return null
    }
    const permissions = resolveEffectiveRolePermissions(role, application.settings ?? {})

    const schemaName = application.schemaName
    if (!IDENTIFIER_REGEX.test(schemaName)) {
        res.status(400).json({ error: 'Invalid application schema name' })
        return null
    }

    const requestedWorkspaceId = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : null
    if (requestedWorkspaceId && !UUID_REGEX.test(requestedWorkspaceId)) {
        res.status(400).json({ error: 'Invalid workspace ID format' })
        return null
    }

    let currentWorkspaceId: string | null = null
    if (application.workspacesEnabled) {
        try {
            const workspaceAccess = await resolveRuntimeWorkspaceAccess(ds, {
                schemaName,
                workspacesEnabled: application.workspacesEnabled,
                userId,
                actorUserId: userId
            })

            currentWorkspaceId = resolveRequestedRuntimeWorkspaceId(requestedWorkspaceId, workspaceAccess)
        } catch (error) {
            if (error instanceof UpdateFailure) {
                res.status(error.statusCode).json(error.body)
                return null
            }
            throw error
        }

        if (!currentWorkspaceId) {
            res.status(403).json({ error: 'No active workspace is available for the current user' })
            return null
        }

        await setRuntimeWorkspaceContext(ds, currentWorkspaceId)
    }

    return {
        schemaName,
        schemaIdent: quoteIdentifier(schemaName),
        manager: ds,
        userId,
        role,
        permissions,
        currentWorkspaceId,
        workspacesEnabled: application.workspacesEnabled,
        applicationSettings: application.settings ?? {}
    }
}

// ---------------------------------------------------------------------------
// Runtime permission check
// ---------------------------------------------------------------------------

/**
 * Check that the runtime context has the required permission.
 * Returns true if allowed, otherwise sends 403 and returns false.
 */
export const ensureRuntimePermission = (
    res: Response,
    ctx: { permissions: Record<RolePermission, boolean> },
    permission: RolePermission
): boolean => {
    if (ctx.permissions[permission]) {
        return true
    }

    res.status(403).json({ error: 'Insufficient permissions for this action' })
    return false
}
