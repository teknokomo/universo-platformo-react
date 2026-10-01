import type { ApplicationTemplateKey } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils/database'

export type CopyMetahubLayoutInput = {
    name?: string | Record<string, string>
    description?: string | Record<string, string>
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
    copyWidgets?: boolean
    deactivateAllWidgets?: boolean
    entityBindingCopyMode?: 'reuse' | 'omit'
    expectedVersion?: number
}

export type CopyMetahubLayoutParams = {
    executor: DbExecutor
    schemaName: string
    layoutId: string
    userId: string | null
    input: CopyMetahubLayoutInput
}

export type SourceWidgetRow = {
    id?: string
    zone?: string
    widget_key?: string
    sort_order?: number
    config?: unknown
    is_active?: boolean
}

export type SourceLayoutWidgetOverrideRow = {
    base_widget_id?: string
    zone?: string | null
    sort_order?: number | null
    config?: unknown
    is_active?: boolean | null
    is_deleted_override?: boolean
}

export type SourceBaseWidgetRow = SourceWidgetRow & { id: string }

export type LayoutCopyOwnership = {
    templateKey: ApplicationTemplateKey
    scopeEntityId: string | null
    baseLayoutId: string | null
    isScopedLayout: boolean
    isOverlayLayout: boolean
}

export type PreparedWidgetCopy = {
    widget: SourceWidgetRow
    config: Record<string, unknown>
    isActive: boolean
}

export type PreparedWidgetCopyGraph = {
    preparedWidgets: PreparedWidgetCopy[]
    copiedWidgetRows: Array<{ widgetKey?: unknown; isActive: boolean }>
    sourceOverrideByWidgetId: Map<string, SourceLayoutWidgetOverrideRow>
    boundInheritedWidgets: Set<string>
}

export type PreparedOverrideCopy = {
    baseWidgetId: string
    zone: string | null
    sortOrder: number | null
    config: Record<string, unknown> | null
    isActive: boolean | null
    isDeletedOverride: boolean
}

export type PreparedLayoutCopy = {
    name: unknown
    description: unknown
    config: Record<string, unknown>
    isActive: boolean
    sortOrder: number
}
