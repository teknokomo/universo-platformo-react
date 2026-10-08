import type { TFunction } from 'i18next'
import type { DashboardLibraryTableWidgetConfig, EffectiveWidgetRuntimeData } from '@universo-react/types'

import type { AppDataResponse } from '../../api/api'
import type { RuntimeWorkspaceMember } from '../../api/workspaces'
import type { DashboardDetailsSlot, ZoneWidgetItem } from '../contracts'
import { findRuntimeSectionIdByCodename } from '../../utils/runtimeSections'
import { formatRuntimeSafeValue, isRuntimeTechnicalFieldName } from '../../utils/displayValue'

export type ReadyTableRuntimeData = Extract<EffectiveWidgetRuntimeData, { status: 'ready' }>['data'] & { kind: 'table' }
export type LibraryRow = ReadyTableRuntimeData['rows'][number]
export type LibraryRowAction = NonNullable<DashboardLibraryTableWidgetConfig['rowActions']>[number]
export type LibraryToggleAction = Extract<LibraryRowAction, { kind: 'library.toggle' }>
export type TargetFieldAction = Extract<LibraryRowAction, { kind: 'field.updateWithTarget' }>
export type TargetPickerConfig = NonNullable<DashboardLibraryTableWidgetConfig['restoreTarget']> | TargetFieldAction

export const PICKER_PAGE_SIZE = 100

const DEFAULT_TARGET_LABEL_FIELDS = ['Name', 'Title', 'DisplayName', 'name', 'title', 'displayName'] as const

/** Maps runtime states to localized user-facing content. */
export const runtimeStateMessage = (state: ZoneWidgetItem['runtimeData'], t: TFunction<'apps'>): string | null => {
    const status = state?.status ?? 'optional-unbound'
    if (status === 'optional-unbound') return null
    if (status === 'loading') return t('dashboard.widget.loading', 'Loading widget content')
    if (status === 'empty') return t('dashboard.widget.empty', 'No matching content was found.')
    const messages = {
        'required-missing': t('dashboard.widget.requiredMissing', 'A required content source is unavailable.'),
        'stale-source': t('dashboard.widget.staleSource', 'This content source is no longer available.'),
        'permission-denied': t('dashboard.widget.permissionDenied', 'You do not have access to this content.'),
        'malformed-config': t('dashboard.widget.malformedConfig', 'This widget is configured incorrectly.'),
        'network-error': t('dashboard.widget.networkError', 'Could not reach the content service.'),
        'server-error': t('dashboard.widget.serverError', 'The content service could not complete the request.')
    }
    return (
        messages[status as keyof typeof messages] ??
        t('dashboard.widget.serverError', 'The content service could not complete the request.')
    )
}

/** Checks whether a row's runtime target matches a configured filter. */
export const matchesTargetFilter = (
    row: LibraryRow,
    filter: NonNullable<DashboardLibraryTableWidgetConfig['targetFilters']>[number]
): boolean => {
    const target = row.target
    if (!target) return false
    const displayTypes = new Set((filter.targetDisplayTypes ?? []).map((value) => value.trim().toLowerCase()))
    const entityCodenames = new Set(
        [...(filter.targetSectionCodenames ?? []), ...(filter.targetObjectCollectionCodenames ?? [])].map((value) =>
            value.trim().toLowerCase()
        )
    )
    return (
        (displayTypes.size > 0 && displayTypes.has(target.displayType.trim().toLowerCase())) ||
        (entityCodenames.size > 0 && entityCodenames.has(target.entityCodename.trim().toLowerCase()))
    )
}

export const resolveTargetCodename = (target: TargetPickerConfig | undefined): string | undefined =>
    target?.targetSectionCodename ?? target?.targetObjectCollectionCodename

export const resolveTargetId = (target: TargetPickerConfig | undefined, details: DashboardDetailsSlot | undefined): string | undefined =>
    findRuntimeSectionIdByCodename(details, resolveTargetCodename(target))

const readOptionValue = (row: Record<string, unknown>, field: string): unknown => {
    if (Object.prototype.hasOwnProperty.call(row, field)) return row[field]
    const normalized = field.trim().toLowerCase()
    const matched = Object.entries(row).find(([key]) => key.trim().toLowerCase() === normalized)
    return matched?.[1]
}

/** Finds a safe localized label for a picker option without exposing technical fields. */
export const formatTargetOptionLabel = (
    row: Record<string, unknown>,
    config: TargetPickerConfig | undefined,
    columns: AppDataResponse['columns'] | undefined,
    locale: string,
    fallback: string
): string => {
    for (const field of config?.labelFields?.length ? config.labelFields : DEFAULT_TARGET_LABEL_FIELDS) {
        const value = formatRuntimeSafeValue(readOptionValue(row, field), locale)
        if (value) return value
    }
    for (const column of columns ?? []) {
        if (isRuntimeTechnicalFieldName(column.field) || isRuntimeTechnicalFieldName(column.codename)) continue
        const value = formatRuntimeSafeValue(readOptionValue(row, column.field || column.codename), locale)
        if (value) return value
    }
    return fallback
}

/** Formats a workspace member with safe user-facing identity fields. */
export const formatWorkspaceMemberLabel = (member: RuntimeWorkspaceMember, fallback: string, locale: string): string => {
    const name = formatRuntimeSafeValue(member.nickname, locale)
    const email = formatRuntimeSafeValue(member.email, locale)
    if (name && email) return name + ' (' + email + ')'
    return name || email || fallback
}

/** Chooses a readable row name for action labels and card headers. */
export const rowTitle = (row: LibraryRow, columns: ReadyTableRuntimeData['columns'], fallback: string): string => {
    const titleColumn =
        columns.find(({ key }) => key.trim().toLowerCase() === 'title') ?? columns.find(({ key }) => key !== 'type') ?? columns[0]
    return row.cells.find(({ key }) => key === titleColumn?.key)?.value || fallback
}
