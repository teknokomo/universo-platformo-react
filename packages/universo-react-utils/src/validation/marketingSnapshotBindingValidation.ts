import {
    entityRecordPolicySchema,
    getLayoutWidgetDefinition,
    matchesWidgetBindingComponentValidationRules,
    marketingHeroEntityContentSchema,
    validateWidgetBindings
} from '@universo-react/types'

import { getCodenamePrimary, toLocalizedStringMap } from '../vlc'

type SnapshotEntity = {
    kind?: unknown
    codename?: unknown
    config?: unknown
    fields?: unknown
}

type SnapshotLike = {
    entities?: Record<string, SnapshotEntity>
    elements?: Record<string, unknown>
}

type SnapshotValidationFailure = (message: string, details: Record<string, unknown>) => never

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const getSnapshotEntityCodename = (entity: SnapshotEntity): string | undefined => {
    if (typeof entity.codename === 'string') return entity.codename
    return getCodenamePrimary(entity.codename) ?? undefined
}

const assertBoundEntity = (
    snapshot: SnapshotLike,
    entityKind: string,
    entityCodename: unknown,
    scope: string,
    fail: SnapshotValidationFailure
): { entityId: string; entity: SnapshotEntity } => {
    if (typeof entityCodename !== 'string') {
        fail('Marketing snapshot binding entity is invalid', { scope })
    }

    const matches = Object.entries(snapshot.entities ?? {}).filter(
        ([, candidate]) =>
            isRecord(candidate) &&
            candidate.kind === entityKind &&
            getSnapshotEntityCodename(candidate as SnapshotEntity) === entityCodename
    )
    if (matches.length !== 1) {
        fail('Marketing snapshot binding entity is missing', { scope, entityKind, entityCodename })
    }
    const [entityId, entity] = matches[0]
    return { entityId, entity: entity as SnapshotEntity }
}

const normalizeBindingDataType = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined
    const normalized = value.trim().toLowerCase()
    if (normalized === 'string' || normalized === 'text') return 'string'
    if (normalized === 'number' || normalized === 'numeric' || normalized === 'integer' || normalized === 'float') return 'number'
    if (normalized === 'boolean' || normalized === 'bool') return 'boolean'
    if (normalized === 'json' || normalized === 'object' || normalized === 'array') return 'json'
    return undefined
}

const capabilityEnabled = (config: unknown, capability: string): boolean => {
    if (!isRecord(config) || !isRecord(config.capabilities)) return false
    const value = config.capabilities[capability]
    if (value === true) return true
    return isRecord(value) && (value.enabled === true || value.isEnabled === true)
}

export const assertMarketingSnapshotBoundTargetContract = (
    snapshot: SnapshotLike,
    definition: NonNullable<ReturnType<typeof getLayoutWidgetDefinition>>,
    binding: ReturnType<typeof validateWidgetBindings>['slots'][number],
    scope: string,
    fail: SnapshotValidationFailure
): void => {
    const slotDefinition = definition.bindingSlots?.find(({ key }) => key === binding.slot)
    if (!slotDefinition) fail('Marketing snapshot widget binding is invalid', { scope })

    for (const target of binding.targets) {
        const { entityId, entity } = assertBoundEntity(snapshot, target.entityKind, target.entityCodename, scope, fail)
        for (const capability of slotDefinition.requirements.entityCapabilities) {
            if (!capabilityEnabled(entity.config, capability)) {
                fail('Marketing snapshot binding entity lacks a required capability', { scope, entityKind: target.entityKind })
            }
        }
        const requiredRecordPolicy = slotDefinition.requirements.recordPolicy
        const config = isRecord(entity.config) ? entity.config : undefined
        const recordPolicy = config?.recordPolicy
        const policy = entityRecordPolicySchema.safeParse(recordPolicy)
        const declaredValidatorKey = isRecord(recordPolicy) ? recordPolicy.validatorKey : undefined
        if (declaredValidatorKey !== undefined && !policy.success) {
            fail('Marketing snapshot binding Entity record policy is invalid', { scope, entityKind: target.entityKind })
        }
        if (requiredRecordPolicy) {
            const actualSemanticKey = policy.success ? policy.data.semanticKey : undefined
            const requiredSemanticKey = requiredRecordPolicy.semanticKey
            const semanticKeyMatches =
                requiredSemanticKey === undefined ||
                (actualSemanticKey?.componentCodename === requiredSemanticKey.componentCodename &&
                    actualSemanticKey.creationPrefix === requiredSemanticKey.creationPrefix &&
                    actualSemanticKey.protectedValues.length === requiredSemanticKey.protectedValues.length &&
                    actualSemanticKey.protectedValues.every((value, index) => value === requiredSemanticKey.protectedValues[index]))
            const actualLocales = policy.success ? policy.data.requiredLocales : undefined
            const requiredLocales = requiredRecordPolicy.requiredLocales
            const requiredLocalesMatch =
                requiredLocales === undefined ||
                (actualLocales?.length === requiredLocales.length &&
                    actualLocales.every((locale, index) => locale === requiredLocales[index]))
            if (
                !policy.success ||
                policy.data.runtimeMutation !== requiredRecordPolicy.runtimeMutation ||
                (requiredRecordPolicy.denyDeleteWhenBound !== undefined &&
                    policy.data.denyDeleteWhenBound !== requiredRecordPolicy.denyDeleteWhenBound) ||
                (requiredRecordPolicy.immutableSemanticKeyWhenBound !== undefined &&
                    policy.data.immutableSemanticKeyWhenBound !== requiredRecordPolicy.immutableSemanticKeyWhenBound) ||
                !semanticKeyMatches ||
                !requiredLocalesMatch ||
                (requiredRecordPolicy.validatorKey !== undefined && policy.data.validatorKey !== requiredRecordPolicy.validatorKey)
            ) {
                fail('Marketing snapshot binding Entity record policy does not match its registered contract', {
                    scope,
                    entityKind: target.entityKind
                })
            }
        }

        const rawFields = entity.fields
        if (!Array.isArray(rawFields)) {
            fail('Marketing snapshot binding entity Components are missing', { scope, entityKind: target.entityKind })
        }
        const components = new Map<string, Record<string, unknown>[]>()
        for (const rawField of rawFields) {
            if (!isRecord(rawField)) continue
            const codename =
                typeof rawField.codename === 'string' ? rawField.codename : getCodenamePrimary(rawField.codename as never) ?? undefined
            if (!codename) continue
            const values = components.get(codename) ?? []
            values.push(rawField)
            components.set(codename, values)
        }

        for (const requirement of slotDefinition.requirements.components) {
            const matches = components.get(requirement.componentCodename) ?? []
            if (matches.length !== 1) {
                fail('Marketing snapshot binding Component is missing or ambiguous', {
                    scope,
                    entityKind: target.entityKind,
                    component: requirement.componentCodename
                })
            }
            const component = matches[0]
            const rules = isRecord(component.validationRules) ? component.validationRules : {}
            if (
                normalizeBindingDataType(component.dataType) !== requirement.valueType ||
                component.isRequired !== requirement.required ||
                (component.parentComponentId !== undefined && component.parentComponentId !== null) ||
                !matchesWidgetBindingComponentValidationRules(requirement, rules)
            ) {
                fail('Marketing snapshot binding Component does not match its registered contract', {
                    scope,
                    entityKind: target.entityKind,
                    component: requirement.componentCodename
                })
            }
        }

        const semanticRequirement = slotDefinition.requirements.components.find(({ semanticKey }) => semanticKey === true)
        if (!semanticRequirement || target.selector.field !== semanticRequirement.field) {
            fail('Marketing snapshot binding selector is invalid', { scope, entityKind: target.entityKind })
        }
        const records = snapshot.elements?.[entityId]
        if (!Array.isArray(records)) {
            fail('Marketing snapshot binding target record is missing', { scope, entityKind: target.entityKind })
        }
        const matchingRecords = records.filter(
            (record) =>
                isRecord(record) && isRecord(record.data) && record.data[semanticRequirement.componentCodename] === target.selector.value
        )
        if (matchingRecords.length !== 1) {
            fail('Marketing snapshot binding target record is missing or ambiguous', { scope, entityKind: target.entityKind })
        }

        const targetRecord = matchingRecords[0]
        if (!isRecord(targetRecord) || !isRecord(targetRecord.data)) {
            fail('Marketing snapshot binding target record is invalid', { scope, entityKind: target.entityKind })
        }

        const validatorKey = policy.success ? policy.data.validatorKey : undefined
        if (validatorKey !== undefined) {
            if (validatorKey !== 'marketing.hero.v1') {
                fail('Marketing snapshot bound record validator is unsupported', { scope, entityKind: target.entityKind })
            }

            const requiredLocales = policy.success
                ? policy.data.requiredLocales ?? requiredRecordPolicy?.requiredLocales
                : requiredRecordPolicy?.requiredLocales
            const content: Record<string, unknown> = {}
            for (const requirement of slotDefinition.requirements.components) {
                if (requirement.semanticKey) continue
                const value = targetRecord.data[requirement.componentCodename]
                if (value === undefined || (value === null && !requirement.required)) continue

                if (requirement.localized) {
                    const localizedValue = toLocalizedStringMap(value)
                    if (!localizedValue || requiredLocales?.some((locale) => typeof localizedValue[locale] !== 'string')) {
                        fail('Marketing snapshot bound record data is invalid', { scope, entityKind: target.entityKind })
                    }
                    content[requirement.field] = localizedValue
                } else {
                    content[requirement.field] = value
                }
            }

            if (!marketingHeroEntityContentSchema.safeParse(content).success) {
                fail('Marketing snapshot bound record data is invalid', { scope, entityKind: target.entityKind })
            }
        }
    }
}
