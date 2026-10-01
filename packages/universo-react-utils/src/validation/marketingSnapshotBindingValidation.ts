import {
    entityRecordPolicySchema,
    getLayoutWidgetDefinition,
    MARKETING_PAGE_REQUIRED_LOCALES,
    matchesWidgetBindingComponentValidationRules,
    normalizeWidgetBindingDataType,
    sameEntityRecordPolicyConditionalRequired,
    validateWidgetBindings
} from '@universo-react/types'
import type { WidgetEntityBindingEnvelope } from '@universo-react/types'

import { isUuidV7 } from '../uuid'
import { getCodenamePrimary } from '../vlc'
import { findInvalidWidgetBindingRecordComponent } from './marketingSnapshotRecordValidation'

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

const getSnapshotFieldCodename = (field: Record<string, unknown>): string | undefined =>
    typeof field.codename === 'string' ? field.codename : getCodenamePrimary(field.codename as never) ?? undefined

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

const capabilityEnabled = (config: unknown, capability: string): boolean => {
    if (!isRecord(config) || !isRecord(config.capabilities)) return false
    const value = config.capabilities[capability]
    if (value === true) return true
    return isRecord(value) && (value.enabled === true || value.isEnabled === true)
}

type SnapshotWidgetDefinition = NonNullable<ReturnType<typeof getLayoutWidgetDefinition>>
type SnapshotBinding = ReturnType<typeof validateWidgetBindings>['slots'][number]
type SnapshotBindingTarget = SnapshotBinding['targets'][number]
type SnapshotBindingSlotDefinition = NonNullable<SnapshotWidgetDefinition['bindingSlots']>[number]
type SnapshotRecordPolicyResult = ReturnType<typeof entityRecordPolicySchema.safeParse>

const sameStringGroups = (left: readonly (readonly string[])[] = [], right: readonly (readonly string[])[] = []): boolean => {
    const normalize = (groups: readonly (readonly string[])[]): string[] => groups.map((group) => [...group].sort().join('\u0000')).sort()
    const normalizedLeft = normalize(left)
    const normalizedRight = normalize(right)
    return normalizedLeft.length === normalizedRight.length && normalizedLeft.every((group, index) => group === normalizedRight[index])
}

const validateSnapshotEntityPolicy = (
    entity: SnapshotEntity,
    target: SnapshotBindingTarget,
    slotDefinition: SnapshotBindingSlotDefinition,
    scope: string,
    fail: SnapshotValidationFailure
): SnapshotRecordPolicyResult => {
    const requiredRecordPolicy = slotDefinition.requirements.recordPolicy
    const config = isRecord(entity.config) ? entity.config : undefined
    const recordPolicy = config?.recordPolicy
    const policy = entityRecordPolicySchema.safeParse(recordPolicy)
    if (config && Object.hasOwn(config, 'recordPolicy') && !policy.success) {
        fail('Marketing snapshot binding Entity record policy is invalid', { scope, entityKind: target.entityKind })
    }
    if (!requiredRecordPolicy) return policy

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
        (actualLocales?.length === requiredLocales.length && actualLocales.every((locale, index) => locale === requiredLocales[index]))
    if (
        !policy.success ||
        policy.data.runtimeMutation !== requiredRecordPolicy.runtimeMutation ||
        (requiredRecordPolicy.denyDeleteWhenBound !== undefined &&
            policy.data.denyDeleteWhenBound !== requiredRecordPolicy.denyDeleteWhenBound) ||
        (requiredRecordPolicy.immutableSemanticKeyWhenBound !== undefined &&
            policy.data.immutableSemanticKeyWhenBound !== requiredRecordPolicy.immutableSemanticKeyWhenBound) ||
        !semanticKeyMatches ||
        !requiredLocalesMatch ||
        !sameStringGroups(requiredRecordPolicy.coRequiredGroups, policy.data.coRequiredGroups) ||
        !sameEntityRecordPolicyConditionalRequired(requiredRecordPolicy.conditionalRequired, policy.data.conditionalRequired)
    ) {
        fail('Marketing snapshot binding Entity record policy does not match its registered contract', {
            scope,
            entityKind: target.entityKind
        })
    }
    return policy
}

const assertSnapshotEntityComponents = (
    entity: SnapshotEntity,
    target: SnapshotBindingTarget,
    slotDefinition: SnapshotBindingSlotDefinition,
    scope: string,
    fail: SnapshotValidationFailure
): void => {
    if (!Array.isArray(entity.fields)) {
        fail('Marketing snapshot binding entity Components are missing', { scope, entityKind: target.entityKind })
    }
    const components = new Map<string, Record<string, unknown>[]>()
    for (const rawField of entity.fields) {
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
            normalizeWidgetBindingDataType(component.dataType)?.toLowerCase() !== requirement.valueType ||
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
}

const selectOrderedSnapshotRecords = (
    records: readonly unknown[],
    slotDefinition: SnapshotBindingSlotDefinition,
    scope: string,
    fail: SnapshotValidationFailure
): unknown[] => {
    const orderField = slotDefinition.orderByField
    const orderRequirement = slotDefinition.requirements.components.find(({ field }) => field === orderField)
    if (!orderField || !orderRequirement || !slotDefinition.maxResolvedRecords) {
        fail('Marketing snapshot ordered binding contract is invalid', { scope })
    }
    const visibilityRequirement = slotDefinition.visibilityField
        ? slotDefinition.requirements.components.find(({ field }) => field === slotDefinition.visibilityField)
        : undefined
    if (slotDefinition.visibilityField && !visibilityRequirement) {
        fail('Marketing snapshot visibility binding contract is invalid', { scope })
    }

    const visibleRecords = records.filter((record) => {
        if (!visibilityRequirement) return true
        return isRecord(record) && isRecord(record.data) && record.data[visibilityRequirement.componentCodename] === true
    })
    if (visibleRecords.length > slotDefinition.maxResolvedRecords) {
        fail('Marketing snapshot binding exceeds the registered maximum record count', {
            scope,
            maxResolvedRecords: slotDefinition.maxResolvedRecords,
            recordCount: visibleRecords.length
        })
    }
    for (const [recordIndex, record] of visibleRecords.entries()) {
        if (
            !isRecord(record) ||
            !isRecord(record.data) ||
            typeof record.data[orderRequirement.componentCodename] !== 'number' ||
            !Number.isFinite(record.data[orderRequirement.componentCodename])
        ) {
            fail('Marketing snapshot bound record data is invalid', {
                scope,
                component: orderRequirement.componentCodename,
                recordIndex
            })
        }
    }
    return visibleRecords.slice().sort((left, right) => {
        const leftData = (left as Record<string, unknown>).data as Record<string, unknown>
        const rightData = (right as Record<string, unknown>).data as Record<string, unknown>
        const orderDifference =
            (leftData[orderRequirement.componentCodename] as number) - (rightData[orderRequirement.componentCodename] as number)
        if (orderDifference !== 0) return orderDifference
        const leftId = isRecord(left) && typeof left.id === 'string' ? left.id : ''
        const rightId = isRecord(right) && typeof right.id === 'string' ? right.id : ''
        return leftId < rightId ? -1 : leftId > rightId ? 1 : 0
    })
}

const selectSnapshotBindingRecords = (
    snapshot: SnapshotLike,
    definition: SnapshotWidgetDefinition,
    envelope: WidgetEntityBindingEnvelope,
    entity: SnapshotEntity,
    target: SnapshotBindingTarget,
    slotDefinition: SnapshotBindingSlotDefinition,
    records: unknown[],
    scope: string,
    fail: SnapshotValidationFailure
): unknown[] => {
    if (target.selector.kind === 'semantic-key') {
        const semanticRequirement = slotDefinition.requirements.components.find(({ semanticKey }) => semanticKey === true)
        if (!semanticRequirement || target.selector.field !== semanticRequirement.field) {
            fail('Marketing snapshot binding selector is invalid', { scope, entityKind: target.entityKind })
        }
        const selected = records.filter((record) => {
            if (
                !isRecord(record) ||
                !isRecord(record.data) ||
                record.data[semanticRequirement.componentCodename] !== target.selector.value
            ) {
                return false
            }
            if (!slotDefinition.visibilityField) return true
            const visibility = slotDefinition.requirements.components.find(({ field }) => field === slotDefinition.visibilityField)
            return Boolean(visibility && record.data[visibility.componentCodename] === true)
        })
        if (selected.length !== 1) {
            fail('Marketing snapshot binding target record is missing or ambiguous', { scope, entityKind: target.entityKind })
        }
        return selected
    }

    if (target.selector.kind === 'record-set') return selectOrderedSnapshotRecords(records, slotDefinition, scope, fail)

    const relation = slotDefinition.relation
    const relationRequirement = slotDefinition.requirements.components.find(({ field }) => field === relation?.field)
    if (!relation || relation.parentSlot !== target.selector.parentSlot || relationRequirement?.valueType !== 'ref') {
        fail('Marketing snapshot relation binding is invalid', { scope, entityKind: target.entityKind })
    }
    const parentBinding = envelope.slots.find(({ slot }) => slot === relation.parentSlot)
    const parentDefinition = definition.bindingSlots?.find(({ key }) => key === relation.parentSlot)
    if (!parentBinding || !parentDefinition) {
        fail('Marketing snapshot relation parent binding is missing', { scope, parentSlot: relation.parentSlot })
    }
    const parentRecordIds = new Set<string>()
    const relationComponentMatches = (Array.isArray(entity.fields) ? entity.fields : []).filter(
        (field): field is Record<string, unknown> =>
            isRecord(field) && getSnapshotFieldCodename(field) === relationRequirement.componentCodename
    )
    if (relationComponentMatches.length !== 1) {
        fail('Marketing snapshot relation Component is missing or ambiguous', {
            scope,
            entityKind: target.entityKind,
            component: relationRequirement.componentCodename
        })
    }
    const relationComponent = relationComponentMatches[0]
    for (const parentTarget of parentBinding.targets) {
        const parent = assertBoundEntity(snapshot, parentTarget.entityKind, parentTarget.entityCodename, scope, fail)
        if (relationComponent.targetEntityId !== parent.entityId || relationComponent.targetEntityKind !== parentTarget.entityKind) {
            fail('Marketing snapshot relation Component targets another Entity', {
                scope,
                entityKind: target.entityKind,
                component: relationRequirement.componentCodename,
                parentEntityKind: parentTarget.entityKind
            })
        }
        const parentRecords = snapshot.elements?.[parent.entityId]
        if (!Array.isArray(parentRecords)) {
            fail('Marketing snapshot relation parent records are missing', { scope, parentSlot: relation.parentSlot })
        }
        if (parentTarget.selector.kind === 'relation-set') {
            fail('Nested relation bindings are not supported by this Marketing Page contract', {
                scope,
                parentSlot: relation.parentSlot
            })
        }
        const selectedParents = selectSnapshotBindingRecords(
            snapshot,
            definition,
            envelope,
            parent.entity,
            parentTarget,
            parentDefinition,
            parentRecords,
            scope,
            fail
        )
        for (const parentRecord of selectedParents) {
            if (!isRecord(parentRecord) || !isUuidV7(parentRecord.id)) {
                fail('Marketing snapshot relation parent record id is invalid', { scope, parentSlot: relation.parentSlot })
            }
            parentRecordIds.add(parentRecord.id)
        }
    }
    const relatedRecords = records.filter(
        (record) =>
            isRecord(record) &&
            isRecord(record.data) &&
            typeof record.data[relationRequirement.componentCodename] === 'string' &&
            parentRecordIds.has(record.data[relationRequirement.componentCodename] as string)
    )
    return selectOrderedSnapshotRecords(relatedRecords, slotDefinition, scope, fail)
}

const assertSnapshotBindingRecordData = (
    selectedRecords: unknown[],
    target: SnapshotBindingTarget,
    slotDefinition: SnapshotBindingSlotDefinition,
    policy: SnapshotRecordPolicyResult,
    scope: string,
    fail: SnapshotValidationFailure
): void => {
    const invalidRecordComponent = findInvalidWidgetBindingRecordComponent(
        selectedRecords,
        slotDefinition.requirements.components,
        policy.success ? policy.data.requiredLocales ?? MARKETING_PAGE_REQUIRED_LOCALES : MARKETING_PAGE_REQUIRED_LOCALES,
        policy.success ? policy.data.coRequiredGroups ?? [] : [],
        policy.success ? policy.data.conditionalRequired ?? [] : []
    )
    if (invalidRecordComponent) {
        fail('Marketing snapshot bound record data is invalid', {
            scope,
            entityKind: target.entityKind,
            component: invalidRecordComponent.componentCodename,
            recordIndex: invalidRecordComponent.recordIndex
        })
    }
}

export const assertMarketingSnapshotBoundTargetContract = (
    snapshot: SnapshotLike,
    definition: NonNullable<ReturnType<typeof getLayoutWidgetDefinition>>,
    binding: ReturnType<typeof validateWidgetBindings>['slots'][number],
    scope: string,
    fail: SnapshotValidationFailure,
    envelope: WidgetEntityBindingEnvelope
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
        const policy = validateSnapshotEntityPolicy(entity, target, slotDefinition, scope, fail)
        assertSnapshotEntityComponents(entity, target, slotDefinition, scope, fail)

        const records = snapshot.elements?.[entityId]
        if (!Array.isArray(records)) {
            fail('Marketing snapshot binding target record is missing', { scope, entityKind: target.entityKind })
        }
        const selectedRecords = selectSnapshotBindingRecords(
            snapshot,
            definition,
            envelope,
            entity,
            target,
            slotDefinition,
            records,
            scope,
            fail
        )
        assertSnapshotBindingRecordData(selectedRecords, target, slotDefinition, policy, scope, fail)
    }
}
