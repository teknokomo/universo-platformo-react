import { readLocalizedTextValue } from '@universo-react/types'
import type { getLayoutWidgetDefinition, WidgetBindingTarget, validateWidgetBindings } from '@universo-react/types'
import type { EffectiveWidgetRuntimeCandidate } from './effectiveWidgetRuntimeDataContracts'

export const SEMANTIC_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u
export const UUID_TEXT_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

export type RuntimeRecord = Record<string, unknown>

export const positiveRuntimeRecordVersion = (value: unknown): number | undefined => {
    const version = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/u.test(value) ? Number(value) : undefined
    return typeof version === 'number' && Number.isSafeInteger(version) && version > 0 ? version : undefined
}

export const isRecord = (value: unknown): value is RuntimeRecord => Boolean(value && typeof value === 'object' && !Array.isArray(value))

export interface PreparedWidget {
    readonly candidate: EffectiveWidgetRuntimeCandidate
    readonly definition: NonNullable<ReturnType<typeof getLayoutWidgetDefinition>>
    readonly bindings: ReturnType<typeof validateWidgetBindings>
    readonly slotByKey: ReadonlyMap<string, NonNullable<NonNullable<ReturnType<typeof getLayoutWidgetDefinition>>['bindingSlots']>[number]>
    readonly targets: readonly { slot: string; target: WidgetBindingTarget }[]
}

export const semanticText = (value: unknown, locale: string, maximum: number): string => {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value).slice(0, maximum)
    if (typeof value === 'boolean') return String(value)
    return readLocalizedTextValue(value, locale)?.slice(0, maximum) ?? ''
}

export const runtimeTableCellText = (value: unknown, locale: string): string => {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return semanticText(value, locale, 2000)
    }
    if (isRecord(value)) {
        const label = semanticText(value.label, locale, 2000)
        if (label) return label
    }
    return ''
}

export const fieldLabel = (field: string): string =>
    field
        .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
        .replace(/[._-]+/gu, ' ')
        .replace(/\b\w/gu, (letter) => letter.toUpperCase())
        .slice(0, 120)
