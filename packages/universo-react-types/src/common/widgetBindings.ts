import { z } from 'zod'

export const MAX_WIDGET_BINDING_SLOTS = 16
export const MAX_WIDGET_BINDING_TARGETS = 32
export const MAX_WIDGET_BINDING_PROJECTION_FIELDS = 32
export const MAX_WIDGET_BINDING_COMPONENTS = 32

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
        selector: semanticEntitySelectorSchema,
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
            const identity = [target.entityKind, target.entityCodename, target.selector.field, target.selector.value].join('\u0000')
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
        validatorKey: z.string().trim().min(1).max(128).optional()
    })
    .strict()

const bindingComponentRequirementSchema = z
    .object({
        field: semanticRoleSchema,
        componentCodename: semanticNameSchema(128),
        valueType: z.enum(['string', 'number', 'boolean', 'json']),
        localized: z.boolean(),
        required: z.boolean(),
        semanticKey: z.boolean().optional(),
        maxLength: z.number().int().positive().max(4096).optional(),
        format: z.string().trim().min(1).max(64).regex(semanticNamePattern, 'Expected a semantic validator format.').optional()
    })
    .strict()
    .superRefine((component, context) => {
        if (component.semanticKey && (component.valueType !== 'string' || component.localized || !component.required)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['semanticKey'],
                message: 'Semantic keys must be required, non-localized string Components.'
            })
        }
    })
export type WidgetBindingComponentRequirement = z.infer<typeof bindingComponentRequirementSchema>

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
        requirements: widgetBindingSlotRequirementsSchema
    })
    .strict()
export type WidgetBindingSlotDefinition = z.infer<typeof widgetBindingSlotDefinitionSchema>

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

export const layoutWidgetPresentationFieldSchema = z
    .discriminatedUnion('kind', [switchPresentationFieldSchema, textPresentationFieldSchema, selectPresentationFieldSchema])
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
    })
export type LayoutWidgetPresentationField = z.infer<typeof layoutWidgetPresentationFieldSchema>

export interface WidgetBindingDefinitionContract {
    readonly bindingSlots?: readonly WidgetBindingSlotDefinition[]
}

const canonicalCompare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0)

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
                        const leftIdentity = [left.entityKind, left.entityCodename, left.selector.field, left.selector.value].join('\u0000')
                        const rightIdentity = [right.entityKind, right.entityCodename, right.selector.field, right.selector.value].join(
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
            if (requirements.entityKinds && !requirements.entityKinds.includes(target.entityKind)) {
                addBindingIssue(
                    issues,
                    ['slots', bindingIndex, 'targets', targetIndex, 'entityKind'],
                    'Entity kind is not allowed by this slot.'
                )
            }
            if (semanticKeyFields.length !== 1 || target.selector.field !== semanticKeyFields[0]?.field) {
                addBindingIssue(
                    issues,
                    ['slots', bindingIndex, 'targets', targetIndex, 'selector', 'field'],
                    'Selector must use the slot semantic-key Component.'
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
