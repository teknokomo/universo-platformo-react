import {
    getLayoutWidgetDefinition,
    matchesWidgetBindingComponentValidationRules,
    resolveEntityRecordPolicy,
    marketingHeroEntityContentSchema,
    marketingHeroWidgetDataSchema,
    type MarketingAction,
    type MarketingHeroEntityContent,
    type MarketingPageConfig,
    type MarketingHeroWidgetData
} from '@universo-react/types'
import { toLocalizedStringMap } from '@universo-react/utils'
import { getVLCString } from '@universo-react/utils/vlc'
import {
    resolveWidgetBindingTargets,
    WidgetBindingResolutionError,
    type ResolvedWidgetBindingTarget,
    type WidgetBindingRecordLoader
} from './widgetBindingResolver'

type RuntimeRecord = Record<string, unknown>

const asRecord = (value: unknown): RuntimeRecord =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as RuntimeRecord) : {}

const applyActionPolicy = (action: MarketingAction, config: MarketingPageConfig): MarketingAction => {
    if (action.kind === 'email' && !config.allowEmailActions) throw new Error('MARKETING_HERO_ACTION_DISABLED')
    if (action.kind === 'tel' && !config.allowTelephoneActions) throw new Error('MARKETING_HERO_ACTION_DISABLED')
    return action.kind === 'external' ? { ...action, target: config.externalLinkTarget } : action
}

const canApplyOptionalAction = (action: unknown, config: MarketingPageConfig): boolean => {
    const kind = asRecord(action).kind
    return !((kind === 'email' && !config.allowEmailActions) || (kind === 'tel' && !config.allowTelephoneActions))
}

/** Adapt one resolved binding-slot projection to the strict Hero renderer DTO. */
const resolveMarketingHeroEntityContent = (
    resolvedTargets: readonly ResolvedWidgetBindingTarget[],
    config: MarketingPageConfig
): MarketingHeroEntityContent => {
    if (resolvedTargets.length !== 1) throw new Error('MARKETING_HERO_BINDING_INVALID')
    const resolved = resolvedTargets[0]
    if (!resolved || resolved.slot !== 'content' || resolved.entityKind !== 'object' || !resolved.semanticKey) {
        throw new Error('MARKETING_HERO_BINDING_INVALID')
    }
    const projected = resolved.data

    const localized = (field: string, required: boolean): Record<string, string> | undefined => {
        const value = toLocalizedStringMap(projected[field])
        if (!value && required) throw new Error('MARKETING_HERO_CONTENT_INVALID')
        return value
    }
    const termsAction = projected.termsAction
    const optionalTermsAction =
        termsAction && canApplyOptionalAction(termsAction, config) ? applyActionPolicy(termsAction as MarketingAction, config) : undefined
    const hasAllowedTerms = optionalTermsAction !== undefined
    const candidate = {
        title: localized('title', true),
        ...(localized('accent', false) ? { accent: localized('accent', false) } : {}),
        description: localized('description', true),
        emailLabel: localized('emailLabel', true),
        emailPlaceholder: localized('emailPlaceholder', true),
        primaryActionLabel: localized('primaryActionLabel', true),
        primaryAction: applyActionPolicy(projected.primaryAction as MarketingAction, config),
        ...(hasAllowedTerms
            ? {
                  termsText: localized('termsText', true),
                  termsLinkLabel: localized('termsLinkLabel', true),
                  termsAction: optionalTermsAction
              }
            : {})
    }
    return marketingHeroEntityContentSchema.parse(candidate)
}

/** Preserve the established runtime envelope while exposing only the typed Hero content fields. */
const toMarketingHeroWidgetData = (content: MarketingHeroEntityContent): MarketingHeroWidgetData =>
    marketingHeroWidgetDataSchema.parse({
        records: [{ kind: 'heroContent', semanticKey: 'content', order: 0, isVisible: true, content }]
    })

interface ProjectMarketingWidgetBindingDataInput {
    widgetKey: string
    bindings: unknown
    loadRecords: WidgetBindingRecordLoader
    config: MarketingPageConfig
}

/**
 * Route registered binding slots through the shared resolver before applying
 * the widget's renderer adapter. The Hero adapter remains explicit so unknown
 * binding-slot widgets fail closed instead of receiving untyped Entity data.
 */
export const projectMarketingWidgetBindingData = ({
    widgetKey,
    bindings,
    loadRecords,
    config
}: ProjectMarketingWidgetBindingDataInput): MarketingHeroWidgetData | undefined => {
    const definition = getLayoutWidgetDefinition(widgetKey)
    if (!definition?.bindingSlots?.length) return undefined
    if (widgetKey !== 'marketing.hero') throw new Error('MARKETING_WIDGET_BINDING_ADAPTER_UNAVAILABLE')

    let resolvedTargets: ResolvedWidgetBindingTarget[]
    try {
        resolvedTargets = resolveWidgetBindingTargets(definition, bindings, (target) => {
            if (target.entityKind !== 'object') {
                throw new WidgetBindingResolutionError('invalid-contract')
            }
            return loadRecords(target)
        })
    } catch (error) {
        if (error instanceof WidgetBindingResolutionError) {
            throw new Error(
                error.reason === 'target-unavailable' ? 'MARKETING_HERO_BINDING_TARGET_UNAVAILABLE' : 'MARKETING_HERO_BINDING_INVALID'
            )
        }
        throw error
    }

    return toMarketingHeroWidgetData(resolveMarketingHeroEntityContent(resolvedTargets, config))
}

/** Validate a materialized Object against the authoritative Hero slot contract. */
export const isCompatibleMarketingHeroObject = (object: RuntimeRecord, components: readonly RuntimeRecord[]): boolean => {
    const definition = getLayoutWidgetDefinition('marketing.hero')
    const slot = definition?.bindingSlots?.find(({ key }) => key === 'content')
    if (!slot || object.kind !== 'object') return false

    let policy
    try {
        policy = resolveEntityRecordPolicy(object.config)
    } catch {
        return false
    }
    const requiredPolicy = slot.requirements.recordPolicy
    if (
        !policy ||
        !requiredPolicy ||
        policy.version !== 1 ||
        policy.runtimeMutation !== requiredPolicy.runtimeMutation ||
        policy.denyDeleteWhenBound !== requiredPolicy.denyDeleteWhenBound ||
        policy.immutableSemanticKeyWhenBound !== requiredPolicy.immutableSemanticKeyWhenBound ||
        policy.validatorKey !== requiredPolicy.validatorKey ||
        policy.semanticKey?.componentCodename !== requiredPolicy.semanticKey?.componentCodename ||
        policy.semanticKey?.creationPrefix !== requiredPolicy.semanticKey?.creationPrefix ||
        JSON.stringify(policy.semanticKey?.protectedValues ?? []) !== JSON.stringify(requiredPolicy.semanticKey?.protectedValues ?? []) ||
        policy.requiredLocales?.length !== requiredPolicy.requiredLocales?.length ||
        (requiredPolicy.requiredLocales ?? []).some((locale) => !policy.requiredLocales?.includes(locale))
    )
        return false

    const available = new Map<string, RuntimeRecord>()
    for (const component of components) {
        const codename = getVLCString(component.codename as Parameters<typeof getVLCString>[0], 'en').trim()
        if (!codename || available.has(codename)) return false
        available.set(codename, component)
    }
    return slot.requirements.components.every((requirement) => {
        const actual = available.get(requirement.componentCodename)
        if (!actual) return false
        const dataType = actual.data_type ?? actual.dataType
        const normalizedType = typeof dataType === 'string' ? dataType.toLowerCase() : ''
        const typeMatches =
            requirement.valueType === 'json'
                ? normalizedType === 'json' || normalizedType === 'jsonb'
                : normalizedType === 'string' || normalizedType === 'text'
        const isRequired = actual.is_required ?? actual.isRequired
        const validationRules = actual.validation_rules ?? actual.validationRules
        return (
            typeMatches && isRequired === requirement.required && matchesWidgetBindingComponentValidationRules(requirement, validationRules)
        )
    })
}
