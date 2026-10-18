import type { DbExecutor } from '@universo-react/utils'
import { qSchemaTable } from '@universo-react/database'
import { acquireAdvisoryXactLock } from '@universo-react/utils/database'
import { resolveLocalizedContent, resolveRuntimeCodenameText } from '../../shared/runtimeHelpers'
import type { GuestAssessmentAccessLink } from './accessLinkTypes'

export const ACTIVE_ROW_SQL = '_upl_deleted = false AND _app_deleted = false'

export const normalizeAccessLinkDate = (value: unknown): string | null => {
    if (typeof value === 'string') {
        const timestamp = new Date(value).getTime()
        return Number.isNaN(timestamp) ? null : value
    }
    if (value instanceof Date) {
        const timestamp = value.getTime()
        return Number.isNaN(timestamp) ? null : value.toISOString()
    }
    return null
}

export const normalizeAccessLinkNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value
    }
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : null
    }
    return null
}

export type AccessLinkRecord = GuestAssessmentAccessLink

export const lockPublicGuestRuntimeKey = async (executor: DbExecutor, key: string): Promise<void> => {
    await acquireAdvisoryXactLock(executor, key)
}

export const indexByCodename = <T extends { codename: unknown }>(items: T[]) =>
    Object.fromEntries(items.map((item) => [resolveRuntimeCodenameText(item.codename), item]))

export const readAttrValue = (row: Record<string, unknown> | null, columnName: string): unknown => row?.[columnName] ?? null

export const normalizeEnumCodename = (value: unknown): string => {
    const codename = resolveRuntimeCodenameText(value)
    return codename
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase()
}

export const isEnumerationRefComponent = (component: {
    data_type?: string
    target_object_kind?: string | null
    target_object_id?: string | null
}) => component.data_type === 'REF' && component.target_object_kind === 'enumeration' && typeof component.target_object_id === 'string'

export const loadEnumerationValueCodeMaps = async (
    executor: DbExecutor,
    schemaName: string,
    components: Array<{ data_type?: string; target_object_kind?: string | null; target_object_id?: string | null }>
) => {
    const optionListIds = Array.from(
        new Set(components.filter(isEnumerationRefComponent).map((component) => String(component.target_object_id)))
    )

    const maps = new Map<string, Map<string, string>>()
    if (optionListIds.length === 0) {
        return maps
    }

    const valuesTable = qSchemaTable(schemaName, '_app_values')
    const rows = await executor.query<{ id: string; object_id: string; codename: unknown }>(
        `
        SELECT id, object_id, codename
        FROM ${valuesTable}
        WHERE object_id = ANY($1::uuid[])
          AND ${ACTIVE_ROW_SQL}
        ORDER BY object_id ASC, sort_order ASC, codename ASC
        `,
        [optionListIds]
    )

    for (const row of rows) {
        const optionMap = maps.get(row.object_id) ?? new Map<string, string>()
        optionMap.set(row.id, normalizeEnumCodename(row.codename))
        maps.set(row.object_id, optionMap)
    }

    return maps
}

export const resolveEnumerationRefValue = (
    component: { data_type?: string; target_object_kind?: string | null; target_object_id?: string | null } | undefined,
    value: unknown,
    enumValueCodeMaps: Map<string, Map<string, string>>
) => {
    if (typeof value !== 'string' || !component || !isEnumerationRefComponent(component)) {
        return typeof value === 'string' ? value : ''
    }

    return enumValueCodeMaps.get(String(component.target_object_id))?.get(value) ?? value
}

export const normalizeOptions = (value: unknown, locale: string): Array<{ id: string; label: string; isCorrect: boolean }> => {
    if (!Array.isArray(value)) return []
    return value
        .map((entry) => {
            if (!entry || typeof entry !== 'object') return null
            const raw = entry as Record<string, unknown>
            const id = typeof raw.id === 'string' ? raw.id : null
            const label = resolveLocalizedContent(raw.label ?? raw.text ?? '', locale, '')
            if (!id) return null
            return {
                id,
                label,
                isCorrect: raw.is_correct === true || raw.isCorrect === true
            }
        })
        .filter((entry): entry is { id: string; label: string; isCorrect: boolean } => entry !== null)
}

export const normalizeQuestionRows = (
    rows: Array<Record<string, unknown>>,
    columns: Record<string, string>,
    options?: {
        locale?: string
        questionTypeComponent?: { data_type?: string; target_object_kind?: string | null; target_object_id?: string | null }
        enumValueCodeMaps?: Map<string, Map<string, string>>
    }
) =>
    rows.map((row) => ({
        id: String(row.id),
        prompt: resolveLocalizedContent(row[columns.prompt], options?.locale ?? 'en', ''),
        description: resolveLocalizedContent(row[columns.description], options?.locale ?? 'en', ''),
        questionType: resolveEnumerationRefValue(
            options?.questionTypeComponent,
            row[columns.questionType],
            options?.enumValueCodeMaps ?? new Map<string, Map<string, string>>()
        ),
        explanation: resolveLocalizedContent(row[columns.explanation], options?.locale ?? 'en', ''),
        sortOrder: normalizeAccessLinkNumber(row[columns.sortOrder]) ?? 0,
        blockKey:
            typeof row[columns.blockKey] === 'string' && String(row[columns.blockKey]).trim() ? String(row[columns.blockKey]).trim() : null,
        options: normalizeOptions(row[columns.options], options?.locale ?? 'en')
    }))

export const deriveGuestContentProgress = (
    contentItems: Array<{ id: string }>,
    action: 'view' | 'complete' | 'recalculate',
    contentItemId?: string,
    currentLastAccessedItemIndex?: number
): { status: 'in_progress' | 'completed'; progressPercent: number; lastAccessedItemIndex: number } | null => {
    if (contentItems.length === 0) {
        return {
            status: action === 'complete' ? 'completed' : 'in_progress',
            progressPercent: action === 'complete' ? 100 : 0,
            lastAccessedItemIndex: 0
        }
    }

    if (action === 'complete') {
        return {
            status: 'completed',
            progressPercent: 100,
            lastAccessedItemIndex: contentItems.length - 1
        }
    }

    const requestedIndex =
        typeof contentItemId === 'string'
            ? contentItems.findIndex((item) => item.id === contentItemId)
            : action === 'view'
            ? 0
            : typeof currentLastAccessedItemIndex === 'number'
            ? currentLastAccessedItemIndex
            : -1
    if (typeof contentItemId === 'string' && requestedIndex < 0) {
        return null
    }
    const boundedIndex = requestedIndex >= 0 ? Math.min(requestedIndex, contentItems.length - 1) : 0
    const progressPercent = Math.min(100, Math.max(0, Math.round(((boundedIndex + 1) / contentItems.length) * 100)))

    return {
        status: progressPercent >= 100 ? 'completed' : 'in_progress',
        progressPercent,
        lastAccessedItemIndex: boundedIndex
    }
}
