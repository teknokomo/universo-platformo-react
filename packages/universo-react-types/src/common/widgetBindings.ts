import { z } from 'zod'
import {
    entityRecordPolicyCoRequiredGroupsSchema,
    entityRecordPolicyConditionalRequiredSchema,
    resolveEntityRecordPolicy,
    sameEntityRecordPolicyConditionalRequired
} from './entityRecordPolicy'

export const MAX_WIDGET_BINDING_SLOTS = 16
export const MAX_WIDGET_BINDING_TARGETS = 32
export const MAX_WIDGET_BINDING_RESOLVED_RECORDS = 500
export const MAX_WIDGET_BINDING_PROJECTION_FIELDS = 32
export const MAX_WIDGET_BINDING_COMPONENTS = 32
export const MAX_MARKETING_WIDGET_SOURCE_RECORDS = 1000

const semanticNamePattern = /^[A-Za-z][A-Za-z0-9._-]*$/u
const semanticValuePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const technicalFieldNamePattern = /^(?:_?id|uuid|(?:entity|record|component|row|table|schema)(?:_?id|name)?)$/iu

const semanticNameSchema = (maxLength: number) =>
    z.string().trim().min(1).max(maxLength).regex(semanticNamePattern, 'Expected a semantic codename.')
const semanticValueSchema = (maxLength: number) =>
    z.string().trim().min(1).max(maxLength).regex(semanticValuePattern, 'Expected a semantic value.')

const semanticRoleSchema = z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(semanticNamePattern, 'Expected a semantic field name.')
    .refine((value) => !technicalFieldNamePattern.test(value), 'Physical identifiers cannot be used as semantic fields.')

export const widgetBindingEntityKindSchema = z.enum(['hub', 'object', 'page', 'set', 'enumeration'])
export type WidgetBindingEntityKind = z.infer<typeof widgetBindingEntityKindSchema>

export const semanticEntitySelectorSchema = z
    .object({
        kind: z.literal('semantic-key'),
        field: semanticRoleSchema,
        value: semanticValueSchema(128).refine((value) => !uuidPattern.test(value), 'Physical identifiers cannot be used as semantic keys.')
    })
    .strict()
export type SemanticEntitySelector = z.infer<typeof semanticEntitySelectorSchema>

export const recordSetEntitySelectorSchema = z.object({ kind: z.literal('record-set') }).strict()
export type RecordSetEntitySelector = z.infer<typeof recordSetEntitySelectorSchema>

export const relationSetEntitySelectorSchema = z.object({ kind: z.literal('relation-set'), parentSlot: semanticRoleSchema }).strict()
export type RelationSetEntitySelector = z.infer<typeof relationSetEntitySelectorSchema>

export const widgetBindingSelectorSchema = z.discriminatedUnion('kind', [
    semanticEntitySelectorSchema,
    recordSetEntitySelectorSchema,
    relationSetEntitySelectorSchema
])
export type WidgetBindingSelector = z.infer<typeof widgetBindingSelectorSchema>

export const widgetBindingProjectionFieldSchema = z
    .object({
        field: semanticRoleSchema,
        componentCodename: semanticNameSchema(128)
    })
    .strict()
export type WidgetBindingProjectionField = z.infer<typeof widgetBindingProjectionFieldSchema>

const widgetBindingTargetSchema = z
    .object({
        entityKind: widgetBindingEntityKindSchema,
        entityCodename: semanticNameSchema(128),
        selector: widgetBindingSelectorSchema,
        projection: z.array(widgetBindingProjectionFieldSchema).min(1).max(MAX_WIDGET_BINDING_PROJECTION_FIELDS)
    })
    .strict()
    .superRefine((target, context) => {
        const fields = new Set<string>()
        const components = new Set<string>()
        target.projection.forEach((entry, index) => {
            if (fields.has(entry.field)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['projection', index, 'field'],
                    message: 'Projection fields must be unique.'
                })
            }
            if (components.has(entry.componentCodename)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['projection', index, 'componentCodename'],
                    message: 'Projection Components must be unique.'
                })
            }
            fields.add(entry.field)
            components.add(entry.componentCodename)
        })
    })
export type WidgetBindingTarget = z.infer<typeof widgetBindingTargetSchema>

const widgetBindingSlotSchema = z
    .object({
        slot: semanticRoleSchema,
        targets: z.array(widgetBindingTargetSchema).min(1).max(MAX_WIDGET_BINDING_TARGETS)
    })
    .strict()
    .superRefine((slot, context) => {
        const identities = new Set<string>()
        slot.targets.forEach((target, index) => {
            const selectorIdentity =
                target.selector.kind === 'semantic-key'
                    ? [target.selector.kind, target.selector.field, target.selector.value].join('\u0000')
                    : target.selector.kind === 'relation-set'
                    ? [target.selector.kind, target.selector.parentSlot].join('\u0000')
                    : target.selector.kind
            const identity = [target.entityKind, target.entityCodename, selectorIdentity].join('\u0000')
            if (identities.has(identity)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['targets', index],
                    message: 'A semantic target can only be bound once in a slot.'
                })
            }
            identities.add(identity)
        })
    })
export type WidgetBindingSlot = z.infer<typeof widgetBindingSlotSchema>

export const widgetEntityBindingEnvelopeSchema = z
    .object({
        version: z.literal(1),
        slots: z.array(widgetBindingSlotSchema).min(1).max(MAX_WIDGET_BINDING_SLOTS)
    })
    .strict()
    .superRefine((envelope, context) => {
        const names = new Set<string>()
        envelope.slots.forEach((slot, index) => {
            if (names.has(slot.slot)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['slots', index, 'slot'],
                    message: 'Binding slot names must be unique.'
                })
            }
            names.add(slot.slot)
        })
    })
export type WidgetEntityBindingEnvelope = z.infer<typeof widgetEntityBindingEnvelopeSchema>

const bindingRecordPolicyRequirementSchema = z
    .object({
        runtimeMutation: z.enum(['allow', 'deny']),
        denyDeleteWhenBound: z.boolean().optional(),
        immutableSemanticKeyWhenBound: z.boolean().optional(),
        semanticKey: z
            .object({
                componentCodename: semanticNameSchema(128),
                creationPrefix: semanticValueSchema(128),
                protectedValues: z.array(semanticValueSchema(128)).min(1).max(16)
            })
            .strict()
            .optional(),
        requiredLocales: z.array(z.string().trim().min(2).max(16)).min(1).max(8).optional(),
        coRequiredGroups: entityRecordPolicyCoRequiredGroupsSchema.optional(),
        conditionalRequired: entityRecordPolicyConditionalRequiredSchema.optional()
    })
    .strict()

const bindingComponentRequirementSchema = z
    .object({
        field: semanticRoleSchema,
        componentCodename: semanticNameSchema(128),
        valueType: z.enum(['string', 'number', 'boolean', 'json', 'ref']),
        localized: z.boolean(),
        required: z.boolean(),
        semanticKey: z.boolean().optional(),
        maxLength: z.number().int().positive().max(4096).optional(),
        pattern: z.string().trim().min(1).max(256).optional(),
        format: z.string().trim().min(1).max(64).regex(semanticNamePattern, 'Expected a semantic validator format.').optional()
    })
    .strict()
    .superRefine((component, context) => {
        if (
            component.semanticKey &&
            (component.valueType !== 'string' || component.localized || !component.required || !component.pattern)
        ) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['semanticKey'],
                message: 'Semantic keys must be required, non-localized string Components with a canonical pattern.'
            })
        }
    })
export type WidgetBindingComponentRequirement = z.infer<typeof bindingComponentRequirementSchema>

/** Normalize physical Component data types before comparing persisted metadata with a binding contract. */
export const normalizeWidgetBindingDataType = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined
    const normalized = value
        .trim()
        .toUpperCase()
        .replace(/\s+/gu, ' ')
        .replace(/\s*\([^()]*\)\s*$/u, '')
    if (['STRING', 'TEXT', 'VARCHAR', 'CHARACTER VARYING', 'CHARACTER', 'CHAR', 'BPCHAR', 'CITEXT'].includes(normalized)) {
        return 'STRING'
    }
    if (
        [
            'NUMBER',
            'NUMERIC',
            'DECIMAL',
            'DEC',
            'INTEGER',
            'INT',
            'INT2',
            'INT4',
            'INT8',
            'SMALLINT',
            'BIGINT',
            'SERIAL',
            'SMALLSERIAL',
            'BIGSERIAL',
            'REAL',
            'FLOAT',
            'FLOAT4',
            'FLOAT8',
            'DOUBLE PRECISION'
        ].includes(normalized)
    ) {
        return 'NUMBER'
    }
    if (normalized === 'BOOLEAN' || normalized === 'BOOL') return 'BOOLEAN'
    if (normalized === 'JSON' || normalized === 'JSONB') return 'JSON'
    if (normalized === 'REF' || normalized === 'UUID') return 'REF'
    return normalized
}

/** Keep binding metadata checks identical at persistence and snapshot boundaries. */
export const matchesWidgetBindingComponentValidationRules = (
    requirement: WidgetBindingComponentRequirement,
    validationRules: unknown
): boolean => {
    const rules =
        validationRules && typeof validationRules === 'object' && !Array.isArray(validationRules)
            ? (validationRules as Record<string, unknown>)
            : {}
    return (
        (rules.localized === true) === requirement.localized &&
        (requirement.maxLength === undefined || rules.maxLength === requirement.maxLength) &&
        (requirement.semanticKey !== true || rules.unique === true) &&
        (requirement.pattern === undefined || rules.pattern === requirement.pattern) &&
        (requirement.format === undefined || rules.format === requirement.format)
    )
}

const widgetBindingSlotRequirementsSchema = z
    .object({
        entityCapabilities: z.array(z.string().trim().min(1).max(64)).min(1).max(16),
        components: z.array(bindingComponentRequirementSchema).min(1).max(MAX_WIDGET_BINDING_COMPONENTS),
        entityKinds: z.array(widgetBindingEntityKindSchema).min(1).max(5).optional(),
        recordPolicy: bindingRecordPolicyRequirementSchema.optional()
    })
    .strict()
    .superRefine((requirements, context) => {
        const fields = requirements.components.map(({ field }) => field)
        const codenames = requirements.components.map(({ componentCodename }) => componentCodename)
        if (new Set(fields).size !== fields.length) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['components'],
                message: 'Required Component fields must be unique.'
            })
        }
        if (new Set(codenames).size !== codenames.length) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['components'],
                message: 'Required Component codenames must be unique.'
            })
        }
        for (const [groupIndex, group] of (requirements.recordPolicy?.coRequiredGroups ?? []).entries()) {
            for (const [fieldIndex, codename] of group.entries()) {
                const component = requirements.components.find((candidate) => candidate.componentCodename === codename)
                if (!component || component.required) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['recordPolicy', 'coRequiredGroups', groupIndex, fieldIndex],
                        message: 'Co-required Components must be declared as optional slot requirements.'
                    })
                }
            }
        }
        for (const [ruleIndex, rule] of (requirements.recordPolicy?.conditionalRequired ?? []).entries()) {
            const target = requirements.components.find((candidate) => candidate.componentCodename === rule.componentCodename)
            const condition = requirements.components.find((candidate) => candidate.componentCodename === rule.when.componentCodename)
            const expectedConditionType =
                typeof rule.when.equals === 'boolean' ? 'boolean' : typeof rule.when.equals === 'number' ? 'number' : 'string'
            if (!target || target.required) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['recordPolicy', 'conditionalRequired', ruleIndex, 'componentCodename'],
                    message: 'Conditionally required Components must be declared as optional slot requirements.'
                })
            }
            if (!condition || condition.localized || condition.valueType !== expectedConditionType) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['recordPolicy', 'conditionalRequired', ruleIndex, 'when'],
                    message: 'Conditional requirements must reference a non-localized scalar Component with a matching value type.'
                })
            }
        }
        if (requirements.components.filter(({ semanticKey }) => semanticKey === true).length > 1) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['components'],
                message: 'A binding slot can declare at most one semantic key Component.'
            })
        }
        if (new Set(requirements.entityCapabilities).size !== requirements.entityCapabilities.length) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['entityCapabilities'],
                message: 'Required Entity capabilities must be unique.'
            })
        }
        if (requirements.entityKinds && new Set(requirements.entityKinds).size !== requirements.entityKinds.length) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['entityKinds'],
                message: 'Allowed Entity kinds must be unique.'
            })
        }
    })

export const widgetBindingSlotDefinitionSchema = z
    .object({
        key: semanticRoleSchema,
        selectorKinds: z
            .array(z.enum(['semantic-key', 'record-set', 'relation-set']))
            .min(1)
            .max(3),
        authoring: z
            .object({
                labelKey: z.string().trim().min(1).max(128),
                defaultLabel: z.string().trim().min(1).max(128),
                placeholderKey: z.string().trim().min(1).max(128),
                defaultPlaceholder: z.string().trim().min(1).max(128),
                helperTextKey: z.string().trim().min(1).max(128),
                defaultHelperText: z.string().trim().min(1).max(256),
                emptyOptionsKey: z.string().trim().min(1).max(128),
                defaultEmptyOptions: z.string().trim().min(1).max(128),
                loadingOptionsKey: z.string().trim().min(1).max(128),
                defaultLoadingOptions: z.string().trim().min(1).max(128)
            })
            .strict(),
        cardinality: z
            .object({
                min: z.number().int().min(0).max(MAX_WIDGET_BINDING_TARGETS),
                max: z.number().int().min(1).max(MAX_WIDGET_BINDING_TARGETS)
            })
            .strict()
            .superRefine((cardinality, context) => {
                if (cardinality.min > cardinality.max) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['min'],
                        message: 'Minimum slot cardinality cannot exceed maximum cardinality.'
                    })
                }
            }),
        orderByField: semanticRoleSchema.optional(),
        visibilityField: semanticRoleSchema.optional(),
        maxResolvedRecords: z.number().int().positive().max(MAX_WIDGET_BINDING_RESOLVED_RECORDS).optional(),
        relation: z.object({ field: semanticRoleSchema, parentSlot: semanticRoleSchema }).strict().optional(),
        requirements: widgetBindingSlotRequirementsSchema
    })
    .strict()
    .superRefine((slot, context) => {
        const fields = new Set(slot.requirements.components.map(({ field }) => field))
        if (slot.orderByField && !fields.has(slot.orderByField)) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['orderByField'], message: 'Order role must be declared by the slot.' })
        }
        if (slot.visibilityField && !fields.has(slot.visibilityField)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['visibilityField'],
                message: 'Visibility role must be declared by the slot.'
            })
        }
        if (slot.relation) {
            const relationComponent = slot.requirements.components.find(({ field }) => field === slot.relation?.field)
            if (!slot.selectorKinds.includes('relation-set') || relationComponent?.valueType !== 'ref') {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['relation'],
                    message: 'Relation slots require a declared REF Component.'
                })
            }
        }
        if (slot.selectorKinds.includes('relation-set') !== Boolean(slot.relation)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['relation'],
                message: 'Relation-set slots must declare one REF relationship.'
            })
        }
        if (slot.selectorKinds.includes('record-set') && slot.maxResolvedRecords === undefined) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['maxResolvedRecords'],
                message: 'Record-set slots require a server result limit.'
            })
        }
    })
export type WidgetBindingSlotDefinition = z.infer<typeof widgetBindingSlotDefinitionSchema>

export interface WidgetBindingEntityComponentMetadata {
    readonly codename: string
    readonly dataType: string
    readonly isRequired: boolean
    readonly validationRules: unknown
}

export interface WidgetBindingEntityMetadata {
    readonly kind: string
    readonly config: unknown
    readonly components: readonly WidgetBindingEntityComponentMetadata[]
}

const matchesBindingValueType = (actualType: string, expectedType: WidgetBindingComponentRequirement['valueType']): boolean => {
    const expectedCanonicalType: Readonly<Record<WidgetBindingComponentRequirement['valueType'], string>> = {
        string: 'STRING',
        number: 'NUMBER',
        boolean: 'BOOLEAN',
        json: 'JSON',
        ref: 'REF'
    }
    return normalizeWidgetBindingDataType(actualType) === expectedCanonicalType[expectedType]
}

/** Check persisted Entity metadata against the exact registry contract for one binding slot. */
export const isCompatibleWidgetBindingEntity = (slot: WidgetBindingSlotDefinition, entity: WidgetBindingEntityMetadata): boolean => {
    if (slot.requirements.entityKinds && !slot.requirements.entityKinds.includes(entity.kind as WidgetBindingEntityKind)) return false
    const componentsByCodename = new Map<string, WidgetBindingEntityComponentMetadata>()
    for (const component of entity.components) {
        if (!component.codename || componentsByCodename.has(component.codename)) return false
        componentsByCodename.set(component.codename, component)
    }

    for (const requirement of slot.requirements.components) {
        const component = componentsByCodename.get(requirement.componentCodename)
        if (
            !component ||
            !matchesBindingValueType(component.dataType, requirement.valueType) ||
            component.isRequired !== requirement.required ||
            !matchesWidgetBindingComponentValidationRules(requirement, component.validationRules)
        ) {
            return false
        }
    }

    const expectedPolicy = slot.requirements.recordPolicy
    if (!expectedPolicy) return true
    let actualPolicy
    try {
        actualPolicy = resolveEntityRecordPolicy(entity.config)
    } catch {
        return false
    }
    if (!actualPolicy) return false
    const expectedSemantic = expectedPolicy.semanticKey
    if (
        actualPolicy.runtimeMutation !== expectedPolicy.runtimeMutation ||
        (expectedPolicy.denyDeleteWhenBound !== undefined && actualPolicy.denyDeleteWhenBound !== expectedPolicy.denyDeleteWhenBound) ||
        (expectedPolicy.immutableSemanticKeyWhenBound !== undefined &&
            actualPolicy.immutableSemanticKeyWhenBound !== expectedPolicy.immutableSemanticKeyWhenBound) ||
        actualPolicy.semanticKey?.componentCodename !== expectedSemantic?.componentCodename ||
        actualPolicy.semanticKey?.creationPrefix !== expectedSemantic?.creationPrefix ||
        (expectedSemantic !== undefined &&
            (actualPolicy.semanticKey?.protectedValues.length !== expectedSemantic.protectedValues.length ||
                expectedSemantic.protectedValues.some((value) => !actualPolicy.semanticKey?.protectedValues.includes(value)))) ||
        (expectedPolicy.requiredLocales !== undefined &&
            (actualPolicy.requiredLocales?.length !== expectedPolicy.requiredLocales.length ||
                expectedPolicy.requiredLocales.some((locale) => !actualPolicy.requiredLocales?.includes(locale)))) ||
        !sameStringGroups(actualPolicy.coRequiredGroups, expectedPolicy.coRequiredGroups) ||
        !sameEntityRecordPolicyConditionalRequired(actualPolicy.conditionalRequired, expectedPolicy.conditionalRequired)
    ) {
        return false
    }
    return true
}

const sameStringGroups = (left: readonly (readonly string[])[] | undefined, right: readonly (readonly string[])[] | undefined): boolean => {
    const normalize = (groups: readonly (readonly string[])[] | undefined): string[] =>
        (groups ?? []).map((group) => [...group].sort().join('\u0000')).sort()
    const normalizedLeft = normalize(left)
    const normalizedRight = normalize(right)
    return normalizedLeft.length === normalizedRight.length && normalizedLeft.every((group, index) => group === normalizedRight[index])
}

const switchPresentationFieldSchema = z
    .object({
        key: semanticRoleSchema,
        kind: z.literal('switch'),
        labelKey: z.string().trim().min(1).max(128),
        defaultLabel: z.string().trim().min(1).max(128),
        helperTextKey: z.string().trim().min(1).max(128),
        defaultHelperText: z.string().trim().min(1).max(256),
        defaultValue: z.boolean()
    })
    .strict()

const textPresentationFieldSchema = z
    .object({
        key: semanticRoleSchema,
        kind: z.literal('text'),
        labelKey: z.string().trim().min(1).max(128),
        defaultLabel: z.string().trim().min(1).max(128),
        helperTextKey: z.string().trim().min(1).max(128),
        defaultHelperText: z.string().trim().min(1).max(256),
        defaultValue: z.string().max(4096),
        required: z.boolean(),
        minLength: z.number().int().min(0).max(4096).optional(),
        maxLength: z.number().int().positive().max(4096).optional()
    })
    .strict()

const selectPresentationFieldSchema = z
    .object({
        key: semanticRoleSchema,
        kind: z.literal('select'),
        labelKey: z.string().trim().min(1).max(128),
        defaultLabel: z.string().trim().min(1).max(128),
        helperTextKey: z.string().trim().min(1).max(128),
        defaultHelperText: z.string().trim().min(1).max(256),
        defaultValue: z.string().trim().min(1).max(128),
        required: z.boolean(),
        options: z
            .array(
                z
                    .object({
                        value: z.string().trim().min(1).max(128),
                        labelKey: z.string().trim().min(1).max(128),
                        defaultLabel: z.string().trim().min(1).max(128)
                    })
                    .strict()
            )
            .min(1)
            .max(32)
    })
    .strict()

const numberPresentationFieldSchema = z
    .object({
        key: semanticRoleSchema,
        kind: z.literal('number'),
        labelKey: z.string().trim().min(1).max(128),
        defaultLabel: z.string().trim().min(1).max(128),
        helperTextKey: z.string().trim().min(1).max(128),
        defaultHelperText: z.string().trim().min(1).max(256),
        defaultValue: z.number().int(),
        min: z.number().int(),
        max: z.number().int()
    })
    .strict()

export const layoutWidgetPresentationFieldSchema = z
    .discriminatedUnion('kind', [
        switchPresentationFieldSchema,
        textPresentationFieldSchema,
        selectPresentationFieldSchema,
        numberPresentationFieldSchema
    ])
    .superRefine((field, context) => {
        if (field.kind === 'text') {
            if (field.minLength !== undefined && field.maxLength !== undefined && field.minLength > field.maxLength) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['minLength'],
                    message: 'Minimum text length cannot exceed maximum length.'
                })
            }
            if (field.maxLength !== undefined && field.defaultValue.length > field.maxLength) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['defaultValue'],
                    message: 'Presentation default exceeds its maximum length.'
                })
            }
        }
        if (field.kind === 'select') {
            const values = field.options.map(({ value }) => value)
            if (new Set(values).size !== values.length) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['options'],
                    message: 'Presentation options must be unique.'
                })
            }
            if (!values.includes(field.defaultValue)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['defaultValue'],
                    message: 'Presentation default must be one of the declared options.'
                })
            }
        }
        if (field.kind === 'number' && (field.min > field.max || field.defaultValue < field.min || field.defaultValue > field.max)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['defaultValue'],
                message: 'Numeric presentation default must be within its declared bounds.'
            })
        }
    })
export type LayoutWidgetPresentationField = z.infer<typeof layoutWidgetPresentationFieldSchema>

export const layoutWidgetAuthoringCapabilitiesSchema = z
    .object({
        metahub: z
            .object({
                add: z.enum(['none', 'select-source', 'create-or-select']),
                duplicate: z.enum(['none', 'share-bindings', 'clone-record']),
                contentEditing: z.enum(['none', 'single-record', 'record-set', 'multi-slot']),
                canRebind: z.boolean()
            })
            .strict(),
        application: z
            .object({
                presentationOnly: z.boolean(),
                canAdd: z.boolean(),
                canDuplicate: z.boolean(),
                canEditContent: z.boolean(),
                canRebind: z.boolean(),
                resetToSource: z.boolean()
            })
            .strict()
    })
    .strict()
    .superRefine((capabilities, context) => {
        if (capabilities.application.presentationOnly && (capabilities.application.canEditContent || capabilities.application.canRebind)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['application'],
                message: 'Presentation-only Application capabilities cannot mutate content or bindings.'
            })
        }
    })
export type LayoutWidgetAuthoringCapabilities = z.infer<typeof layoutWidgetAuthoringCapabilitiesSchema>

export interface WidgetBindingDefinitionContract {
    readonly bindingSlots?: readonly WidgetBindingSlotDefinition[]
    readonly bindingVariants?: Readonly<Record<string, readonly WidgetBindingSlotDefinition[]>>
}

const canonicalCompare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0)

const getBindingSelectorIdentity = (selector: WidgetBindingSelector): string => {
    if (selector.kind === 'semantic-key') return [selector.kind, selector.field, selector.value].join('\u0000')
    if (selector.kind === 'relation-set') return [selector.kind, selector.parentSlot].join('\u0000')
    return selector.kind
}

/** Parse and sort set-like binding collections so hashes and persistence are stable. */
export const canonicalizeWidgetBindings = (input: unknown): WidgetEntityBindingEnvelope => {
    const parsed = widgetEntityBindingEnvelopeSchema.parse(input)
    return {
        version: parsed.version,
        slots: [...parsed.slots]
            .sort((left, right) => canonicalCompare(left.slot, right.slot))
            .map(({ slot, targets }) => ({
                slot,
                targets: [...targets]
                    .sort((left, right) => {
                        const leftIdentity = [left.entityKind, left.entityCodename, getBindingSelectorIdentity(left.selector)].join(
                            '\u0000'
                        )
                        const rightIdentity = [right.entityKind, right.entityCodename, getBindingSelectorIdentity(right.selector)].join(
                            '\u0000'
                        )
                        return canonicalCompare(leftIdentity, rightIdentity)
                    })
                    .map((target) => ({
                        ...target,
                        selector: { ...target.selector },
                        projection: [...target.projection].sort((left, right) => canonicalCompare(left.field, right.field))
                    }))
            }))
    }
}

const addBindingIssue = (issues: z.IssueData[], path: (string | number)[], message: string): void => {
    issues.push({ code: z.ZodIssueCode.custom, path, message })
}

/** Validate binding shape against one registry definition without touching persistence. */
export const validateWidgetBindings = (definition: WidgetBindingDefinitionContract, input: unknown): WidgetEntityBindingEnvelope => {
    const bindings = canonicalizeWidgetBindings(input)
    const slotDefinitions = (definition.bindingSlots ?? []).map((slot) => widgetBindingSlotDefinitionSchema.parse(slot))
    const issues: z.IssueData[] = []
    const definitions = new Map<string, WidgetBindingSlotDefinition>()

    slotDefinitions.forEach((slot, index) => {
        if (definitions.has(slot.key)) {
            addBindingIssue(issues, ['bindingSlots', index, 'key'], 'Widget binding slot definitions must be unique.')
        }
        definitions.set(slot.key, slot)
    })

    bindings.slots.forEach((binding, bindingIndex) => {
        const definitionForSlot = definitions.get(binding.slot)
        if (!definitionForSlot) {
            addBindingIssue(issues, ['slots', bindingIndex, 'slot'], 'Binding slot is not declared by this widget.')
            return
        }

        const { cardinality, requirements } = definitionForSlot
        if (binding.targets.length < cardinality.min || binding.targets.length > cardinality.max) {
            addBindingIssue(issues, ['slots', bindingIndex, 'targets'], 'Binding target count is outside the declared cardinality.')
        }

        const declaredComponents = new Map(requirements.components.map((component) => [component.field, component]))
        const semanticKeyFields = requirements.components.filter(({ semanticKey }) => semanticKey === true)
        binding.targets.forEach((target, targetIndex) => {
            if (!definitionForSlot.selectorKinds.includes(target.selector.kind)) {
                addBindingIssue(
                    issues,
                    ['slots', bindingIndex, 'targets', targetIndex, 'selector', 'kind'],
                    'Selector kind is not allowed by this slot.'
                )
            }
            if (requirements.entityKinds && !requirements.entityKinds.includes(target.entityKind)) {
                addBindingIssue(
                    issues,
                    ['slots', bindingIndex, 'targets', targetIndex, 'entityKind'],
                    'Entity kind is not allowed by this slot.'
                )
            }
            if (
                target.selector.kind === 'semantic-key' &&
                (semanticKeyFields.length !== 1 || target.selector.field !== semanticKeyFields[0]?.field)
            ) {
                addBindingIssue(
                    issues,
                    ['slots', bindingIndex, 'targets', targetIndex, 'selector', 'field'],
                    'Selector must use the slot semantic-key Component.'
                )
            }
            if (target.selector.kind === 'relation-set' && target.selector.parentSlot !== definitionForSlot.relation?.parentSlot) {
                addBindingIssue(
                    issues,
                    ['slots', bindingIndex, 'targets', targetIndex, 'selector', 'parentSlot'],
                    'Relation selector must use the declared parent slot.'
                )
            }

            const projectedFields = new Set<string>()
            target.projection.forEach((projection, projectionIndex) => {
                const declared = declaredComponents.get(projection.field)
                if (!declared) {
                    addBindingIssue(
                        issues,
                        ['slots', bindingIndex, 'targets', targetIndex, 'projection', projectionIndex, 'field'],
                        'Projection field is not declared by this slot.'
                    )
                } else if (declared.componentCodename !== projection.componentCodename) {
                    addBindingIssue(
                        issues,
                        ['slots', bindingIndex, 'targets', targetIndex, 'projection', projectionIndex, 'componentCodename'],
                        'Projection Component must match the registered slot contract.'
                    )
                }
                projectedFields.add(projection.field)
            })
            requirements.components.forEach((component) => {
                if (!projectedFields.has(component.field)) {
                    addBindingIssue(
                        issues,
                        ['slots', bindingIndex, 'targets', targetIndex, 'projection'],
                        `Projection field is missing: ${component.field}.`
                    )
                }
            })
        })
    })

    slotDefinitions.forEach((slot, definitionIndex) => {
        const bindingIndex = bindings.slots.findIndex(({ slot: key }) => key === slot.key)
        if (slot.cardinality.min > 0 && bindingIndex === -1) {
            addBindingIssue(issues, ['bindingSlots', definitionIndex], 'Required binding slot is missing.')
        }
    })

    bindings.slots.forEach((binding, bindingIndex) => {
        const relation = definitions.get(binding.slot)?.relation
        if (relation && !bindings.slots.some(({ slot }) => slot === relation.parentSlot)) {
            addBindingIssue(issues, ['slots', bindingIndex], 'Relation binding requires its parent slot.')
        }
    })

    if (issues.length > 0) throw new z.ZodError(issues)
    return bindings
}

/** Build a complete, registry-controlled target projection for a semantic key. */
export const buildSingleTargetWidgetBinding = (
    definition: WidgetBindingDefinitionContract,
    slotKey: string,
    input: { entityKind: WidgetBindingEntityKind; entityCodename: string; semanticKey: string }
): WidgetEntityBindingEnvelope => {
    const slot = definition.bindingSlots?.find(({ key }) => key === slotKey)
    if (!slot) throw new z.ZodError([{ code: z.ZodIssueCode.custom, path: ['slot'], message: 'Binding slot is not declared.' }])
    const semanticKey = slot.requirements.components.find(({ semanticKey: isKey }) => isKey === true)
    if (!semanticKey) {
        throw new z.ZodError([{ code: z.ZodIssueCode.custom, path: ['slot'], message: 'Binding slot has no semantic key.' }])
    }

    return validateWidgetBindings(definition, {
        version: 1,
        slots: [
            {
                slot: slotKey,
                targets: [
                    {
                        entityKind: input.entityKind,
                        entityCodename: input.entityCodename,
                        selector: { kind: 'semantic-key', field: semanticKey.field, value: input.semanticKey },
                        projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                    }
                ]
            }
        ]
    })
}
