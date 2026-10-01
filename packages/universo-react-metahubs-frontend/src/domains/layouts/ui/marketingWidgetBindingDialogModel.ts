import type {
    DynamicEntityFormFieldError,
    DynamicFieldConfig,
    DynamicFieldValidationRules
} from '@universo-react/template-mui/components/dialogs'
import {
    getLayoutWidgetDefinition,
    validateWidgetBindings,
    type EntityRecordPolicyConditionalRequired,
    type MarketingActionSectionTarget,
    type MarketingWidgetKey,
    type MarketingWidgetRecordCopyIntent,
    type WidgetBindingSlotDefinition,
    type WidgetEntityBindingEnvelope,
    type WidgetBindingSelector
} from '@universo-react/types'
import { getCodenamePrimary } from '@universo-react/utils'
import type { ApplicationLayoutZone } from '@universo-react/types'
import type { LayoutZoneWidgetBindingReadItem, WidgetBindingSelectorInput, WidgetBindingSelectorKind } from '../api'
import type { Component } from '../../../types'
import { getVLCString } from '../../../types'

export type DraftBinding = {
    sourceKey: string
    sourceName: string
    selectorKind: WidgetBindingSelectorKind
    semanticKey?: string
    selectionLabel?: string
}

export type MarketingWidgetBindingDialogProps = {
    open: boolean
    metahubId: string
    layoutId: string
    widgetKey: MarketingWidgetKey
    zone: ApplicationLayoutZone
    widgetId: string | null
    sourceWidgetId?: string | null
    duplicateMode?: boolean
    rendererConfigPending?: boolean
    openSelectedRecordOnOpen?: boolean
    widgetVersion?: number | null
    rendererConfig: Record<string, unknown>
    sectionTargets?: readonly MarketingActionSectionTarget[]
    locale: string
    canManageLayouts: boolean
    canEditContent: boolean
    onClose: () => void
    onBindingSaved?: () => Promise<void>
    onSelection: (selection: {
        bindings: WidgetEntityBindingEnvelope
        config: Record<string, unknown>
        recordCopy?: MarketingWidgetRecordCopyIntent
    }) => void | Promise<void>
    onConfigurePresentation?: (selection: { bindings: WidgetEntityBindingEnvelope; config: Record<string, unknown> }) => void
}

export type RecordFormMode = 'create' | 'edit'
const RESERVED_RECORD_COMPONENT_KEYS = new Set([
    'createdat',
    'createdby',
    'deletedat',
    'deletedby',
    'updatedat',
    'updatedby',
    'published',
    'publishedat',
    'publishedby',
    'id',
    '_id',
    'uuid',
    'recordid',
    'entityid',
    'componentid'
])
const EDITABLE_JSON_FORMATS = new Set(['marketingAction', 'marketingMediaReference'])
const EDITABLE_COMPONENT_TYPES = new Set(['STRING', 'NUMBER', 'BOOLEAN', 'DATE'])
export const EMPTY_WIDGET_BINDING_SLOTS: readonly WidgetBindingSlotDefinition[] = []
export const EMPTY_MARKETING_ACTION_SECTION_TARGETS: readonly MarketingActionSectionTarget[] = []
export const EMPTY_RECORD_COMPONENTS: readonly Component[] = []

export const resolveRequiredLocaleValidationError = (
    errors: readonly string[],
    fields: readonly DynamicFieldConfig[],
    t: (key: string, options?: { defaultValue?: string; field?: string; locale?: string }) => string,
    values: Record<string, unknown> = {}
): DynamicEntityFormFieldError | null => {
    for (const field of fields) {
        if (field.validationRules?.localized !== true) continue
        const requiredLocales = field.validationRules.requiredLocales ?? []
        const condition = field.validationRules.requiredWhen
        const conditionIsActive = Boolean(condition && values[condition.field] === condition.equals)
        const locale =
            requiredLocales.find((candidate) => errors.includes(`${field.id}.${candidate}.required`)) ??
            (errors.includes(`${field.id}.required`) && (field.required || conditionIsActive) ? requiredLocales[0] : undefined)
        if (!locale) continue

        const normalizedLocale = normalizeLocale(locale)
        const localeLabel = t(`layouts.widgetBindings.locales.${normalizedLocale}`, {
            defaultValue: normalizedLocale.toUpperCase()
        })
        return {
            fieldId: field.id,
            locale: normalizedLocale,
            message: t('layouts.widgetBindings.missingLocale', {
                defaultValue: 'Add {{field}} in {{locale}} before saving.',
                field: field.label,
                locale: localeLabel
            })
        }
    }
    return null
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const isAuthorableComponent = (component: Component): boolean => {
    const key = getCodenamePrimary(component.codename).trim()
    return Boolean(
        key &&
            !RESERVED_RECORD_COMPONENT_KEYS.has(key.toLowerCase()) &&
            component.system?.isSystem !== true &&
            !component.system?.systemKey &&
            component.uiConfig?.hidden !== true &&
            component.isActive !== false &&
            component.isExcluded !== true
    )
}

const isEditableRecordComponent = (component: Component): boolean => {
    if (EDITABLE_COMPONENT_TYPES.has(component.dataType)) return true
    if (component.dataType !== 'JSON') return false
    const format = (component.validationRules as DynamicFieldValidationRules | undefined)?.format
    return typeof format === 'string' && EDITABLE_JSON_FORMATS.has(format)
}

export const hasUnsupportedRequiredRecordComponents = (
    components: readonly Component[],
    semanticKeyComponents: ReadonlySet<string>
): boolean =>
    components.some((component) => {
        const key = getCodenamePrimary(component.codename).trim()
        return (
            component.isRequired &&
            isAuthorableComponent(component) &&
            !semanticKeyComponents.has(key) &&
            !isEditableRecordComponent(component)
        )
    })

export const buildDynamicFields = (
    components: readonly Component[],
    locale: string,
    t: (key: string, options?: { defaultValue?: string }) => string,
    semanticKeyComponents: ReadonlySet<string>,
    requiredLocales: readonly string[] = [],
    conditionalRequired: readonly EntityRecordPolicyConditionalRequired[] = []
): DynamicFieldConfig[] =>
    components
        .filter((component) => {
            const key = getCodenamePrimary(component.codename).trim()
            return isAuthorableComponent(component) && !semanticKeyComponents.has(key) && isEditableRecordComponent(component)
        })
        .map((component) => {
            const key = getCodenamePrimary(component.codename).trim()
            const rules = component.validationRules as DynamicFieldValidationRules | undefined
            const conditionalRule = conditionalRequired.find((rule) => rule.componentCodename === key)
            const rows = component.uiConfig?.rows
            return {
                id: key,
                codename: key,
                label:
                    getVLCString(component.name, locale).trim() ||
                    t('layouts.widgetBindings.contentField', { defaultValue: 'Content field' }),
                type: component.dataType as DynamicFieldConfig['type'],
                required: component.isRequired,
                localized: rules?.localized === true,
                validationRules: {
                    ...rules,
                    ...(conditionalRule
                        ? { requiredWhen: { field: conditionalRule.when.componentCodename, equals: conditionalRule.when.equals } }
                        : {}),
                    ...(rules?.localized === true && requiredLocales.length > 0 ? { requiredLocales: [...requiredLocales] } : {})
                },
                uiConfig: component.uiConfig,
                ...(typeof rows === 'number' && Number.isFinite(rows) && rows > 0 ? { multilineRows: rows } : {})
            }
        })

export const getRecordLabel = (
    data: Record<string, unknown>,
    components: readonly Component[],
    locale: string,
    fallback: string
): string => {
    const isSafeTextLabelComponent = (component: Component) => isAuthorableComponent(component) && component.dataType === 'STRING'
    const labelComponent =
        components.find((component) => isSafeTextLabelComponent(component) && component.isDisplayComponent === true) ??
        components.find((component) => isSafeTextLabelComponent(component) && getCodenamePrimary(component.codename).trim() === 'Title') ??
        components.find(isSafeTextLabelComponent)
    if (!labelComponent) return fallback
    const value = data[getCodenamePrimary(labelComponent.codename).trim()]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (isRecord(value)) return getVLCString(value as Parameters<typeof getVLCString>[0], locale).trim() || fallback
    return fallback
}

export const readSemanticKey = (slot: WidgetBindingSlotDefinition, data: Record<string, unknown>): string | null => {
    const component = slot.requirements.components.find(({ semanticKey }) => semanticKey)
    const value = component ? data[component.componentCodename] : undefined
    return typeof value === 'string' && value.trim() ? value.trim() : null
}

export const normalizeLocale = (locale: string): 'en' | 'ru' => (locale.toLowerCase().startsWith('ru') ? 'ru' : 'en')

const makeSelector = (slot: WidgetBindingSlotDefinition, draft: DraftBinding): WidgetBindingSelector => {
    if (draft.selectorKind === 'semantic-key') {
        const semanticKeyField = slot.requirements.components.find(({ semanticKey }) => semanticKey)?.field
        if (!semanticKeyField || !draft.semanticKey) throw new Error('MARKETING_WIDGET_BINDING_SELECTION_INVALID')
        return { kind: 'semantic-key', field: semanticKeyField, value: draft.semanticKey }
    }
    if (draft.selectorKind === 'relation-set') {
        if (!slot.relation) throw new Error('MARKETING_WIDGET_BINDING_RELATION_INVALID')
        return { kind: 'relation-set', parentSlot: slot.relation.parentSlot }
    }
    return { kind: 'record-set' }
}

export const makeApiSelector = (slot: WidgetBindingSlotDefinition, draft: DraftBinding): WidgetBindingSelectorInput => {
    if (draft.selectorKind === 'semantic-key') {
        if (!draft.semanticKey) throw new Error('MARKETING_WIDGET_BINDING_SELECTION_INVALID')
        return { kind: 'semantic-key', value: draft.semanticKey }
    }
    if (draft.selectorKind === 'relation-set') {
        if (!slot.relation) throw new Error('MARKETING_WIDGET_BINDING_RELATION_INVALID')
        return { kind: 'relation-set' }
    }
    return { kind: 'record-set' }
}

export const createBindingEnvelope = (
    widgetKey: MarketingWidgetKey,
    rendererConfig: Record<string, unknown>,
    slots: readonly WidgetBindingSlotDefinition[],
    selections: Record<string, DraftBinding>
): WidgetEntityBindingEnvelope => {
    const definition = getLayoutWidgetDefinition(widgetKey, rendererConfig)
    if (!definition) throw new Error('MARKETING_WIDGET_DEFINITION_UNAVAILABLE')

    const envelope = {
        version: 1 as const,
        slots: (slots ?? [])
            .filter((slot) => selections[slot.key])
            .map((slot) => {
                const draft = selections[slot.key]
                if (!draft) throw new Error('MARKETING_WIDGET_BINDING_SELECTION_INVALID')
                return {
                    slot: slot.key,
                    targets: [
                        {
                            entityKind: 'object' as const,
                            entityCodename: draft.sourceKey,
                            selector: makeSelector(slot, draft),
                            projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                        }
                    ]
                }
            })
    }
    return validateWidgetBindings(definition, envelope)
}

export const sameBindings = (left: Record<string, DraftBinding>, right: Record<string, DraftBinding>): boolean => {
    const normalize = (bindings: Record<string, DraftBinding>) =>
        Object.entries(bindings)
            .map(([slot, binding]) => [slot, binding.sourceKey, binding.selectorKind, binding.semanticKey ?? ''])
            .sort(([leftSlot], [rightSlot]) => String(leftSlot).localeCompare(String(rightSlot)))
    return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right))
}

export const toDraftBindings = (bindings: readonly LayoutZoneWidgetBindingReadItem[]): Record<string, DraftBinding> =>
    Object.fromEntries(
        bindings.map((binding) => [
            binding.slot,
            {
                sourceKey: binding.sourceKey,
                sourceName: binding.sourceName,
                selectorKind: binding.selectorKind,
                semanticKey: binding.semanticKey,
                selectionLabel: binding.selectionLabel
            }
        ])
    )
