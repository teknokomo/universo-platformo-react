import { describe, expect, it } from 'vitest'

import {
    canonicalizeWidgetBindings,
    buildSingleTargetWidgetBinding,
    expandWidgetBindingSlotFamilies,
    isCompatibleWidgetBindingEntity,
    normalizeWidgetBindingDataType,
    resolveWidgetBindingSlotDefinition,
    validateWidgetBindings,
    widgetEntityBindingEnvelopeSchema,
    widgetBindingSlotDefinitionSchema,
    type WidgetBindingDefinitionContract
} from '../common/widgetBindings'
import { getLayoutWidgetDefinition, LAYOUT_WIDGET_DEFINITIONS, layoutWidgetDefinitionSchema } from '../common/layoutWidgetDefinitions'

const heroSlot = {
    key: 'content',
    selectorKinds: ['semantic-key'],
    authoring: {
        labelKey: 'layouts.widgetBindings.recordLabel',
        defaultLabel: 'Content record',
        placeholderKey: 'layouts.widgetBindings.recordPlaceholder',
        defaultPlaceholder: 'Search by content title',
        helperTextKey: 'layouts.widgetBindings.recordHelperText',
        defaultHelperText: 'Choose the Entity record displayed by this widget.',
        emptyOptionsKey: 'layouts.widgetBindings.noRecords',
        defaultEmptyOptions: 'No compatible content records found.',
        loadingOptionsKey: 'layouts.widgetBindings.loadingRecords',
        defaultLoadingOptions: 'Loading content records…'
    },
    cardinality: { min: 1, max: 1 },
    requirements: {
        entityCapabilities: ['dataSchema', 'records'],
        components: [
            {
                field: 'key',
                componentCodename: 'HeroKey',
                valueType: 'string',
                localized: false,
                required: true,
                semanticKey: true,
                maxLength: 64,
                pattern: '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$'
            },
            { field: 'title', componentCodename: 'Title', valueType: 'string', localized: true, required: true, maxLength: 255 },
            {
                field: 'description',
                componentCodename: 'Description',
                valueType: 'string',
                localized: true,
                required: true,
                maxLength: 2000
            }
        ],
        entityKinds: ['object'],
        recordPolicy: {
            runtimeMutation: 'deny',
            denyDeleteWhenBound: true,
            immutableSemanticKeyWhenBound: true,
            semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['default'] },
            requiredLocales: ['en', 'ru']
        }
    }
} as const

const heroBinding = {
    version: 1,
    slots: [
        {
            slot: 'content',
            targets: [
                {
                    entityKind: 'object',
                    entityCodename: 'MarketingPageHero',
                    selector: { kind: 'semantic-key', field: 'key', value: 'default' },
                    projection: [
                        { field: 'title', componentCodename: 'Title' },
                        { field: 'key', componentCodename: 'HeroKey' },
                        { field: 'description', componentCodename: 'Description' }
                    ]
                }
            ]
        }
    ]
} as const

const heroDefinition: WidgetBindingDefinitionContract = { bindingSlots: [heroSlot] }

const familyBaseSlot = {
    key: 'panel',
    selectorKinds: ['relation-set'],
    authoring: heroSlot.authoring,
    cardinality: { min: 0, max: 1 },
    maxResolvedRecords: 100,
    orderByField: 'label',
    relation: { field: 'parent', parentSlot: 'content' },
    requirements: {
        entityCapabilities: ['dataSchema', 'records'],
        components: [
            { field: 'parent', componentCodename: 'ParentRef', valueType: 'ref', localized: false, required: true },
            { field: 'label', componentCodename: 'Label', valueType: 'string', localized: true, required: true }
        ],
        entityKinds: ['object']
    }
} as const

const familyDefinition: WidgetBindingDefinitionContract = {
    bindingSlots: [heroSlot, familyBaseSlot],
    bindingSlotFamilies: [
        {
            familyKey: 'panel',
            slotPrefix: 'panel:',
            memberKeyPattern: '^[A-Za-z][A-Za-z0-9._-]{0,63}$',
            selectorKinds: ['relation-set'],
            cardinality: { min: 0, max: 1 },
            maxMembers: 2,
            requirements: familyBaseSlot.requirements,
            relation: familyBaseSlot.relation
        }
    ]
}

const familyBinding = {
    version: 1,
    slots: [
        ...heroBinding.slots,
        {
            slot: 'panel:primary',
            targets: [
                {
                    entityKind: 'object',
                    entityCodename: 'DashboardPanelItems',
                    selector: { kind: 'relation-set', parentSlot: 'content' },
                    projection: [
                        { field: 'parent', componentCodename: 'ParentRef' },
                        { field: 'label', componentCodename: 'Label' }
                    ]
                }
            ]
        }
    ]
} as const

describe('entity-backed widget binding contracts', () => {
    it('accepts an empty neutral envelope only when the widget declares no required bindings', () => {
        const emptyEnvelope = { version: 1, slots: [] }
        expect(widgetEntityBindingEnvelopeSchema.safeParse(emptyEnvelope).success).toBe(true)
        expect(canonicalizeWidgetBindings(emptyEnvelope)).toEqual(emptyEnvelope)
        expect(validateWidgetBindings({ bindingSlots: [] }, emptyEnvelope)).toEqual(emptyEnvelope)
        expect(() => validateWidgetBindings(heroDefinition, emptyEnvelope)).toThrow(/Required binding slot is missing/u)
    })

    it('expands Dashboard-style binding slot families through the shared contract', () => {
        const resolved = resolveWidgetBindingSlotDefinition(familyDefinition, 'panel:primary')
        expect(resolved).toMatchObject({
            key: 'panel:primary',
            selectorKinds: ['relation-set'],
            relation: { field: 'parent', parentSlot: 'content' }
        })
        expect(widgetBindingSlotDefinitionSchema.safeParse({ ...familyBaseSlot, key: 'panel:primary' }).success).toBe(true)
        const expanded = expandWidgetBindingSlotFamilies(familyDefinition, familyBinding)
        expect(expanded.bindingSlots.map(({ key }) => key)).toEqual(['content', 'panel', 'panel:primary'])
        expect(validateWidgetBindings(familyDefinition, familyBinding)).toEqual(canonicalizeWidgetBindings(familyBinding))
        expect(validateWidgetBindings(expanded, familyBinding)).toEqual(canonicalizeWidgetBindings(familyBinding))
    })

    it('fails closed for unknown, malformed, duplicate, ambiguous, colliding, and over-limit family slots', () => {
        expect(() =>
            validateWidgetBindings(familyDefinition, {
                ...familyBinding,
                slots: [...familyBinding.slots, { ...familyBinding.slots[1], slot: 'unknown' }]
            })
        ).toThrow(/not declared/u)
        expect(() =>
            validateWidgetBindings(familyDefinition, {
                ...familyBinding,
                slots: [familyBinding.slots[0], { ...familyBinding.slots[1], slot: 'panel:1bad' }]
            })
        ).toThrow(/member key is invalid/u)
        expect(() =>
            validateWidgetBindings(familyDefinition, {
                ...familyBinding,
                slots: [...familyBinding.slots, familyBinding.slots[1]]
            })
        ).toThrow(/unique/u)

        const ambiguous: WidgetBindingDefinitionContract = {
            ...familyDefinition,
            bindingSlotFamilies: [
                ...(familyDefinition.bindingSlotFamilies ?? []),
                {
                    ...(familyDefinition.bindingSlotFamilies?.[0] as NonNullable<
                        WidgetBindingDefinitionContract['bindingSlotFamilies']
                    >[number]),
                    slotPrefix: 'panel:p'
                }
            ]
        }
        expect(() => resolveWidgetBindingSlotDefinition(ambiguous, 'panel:primary')).toThrow(/more than one/u)

        const colliding: WidgetBindingDefinitionContract = {
            bindingSlots: [heroSlot, familyBaseSlot, { ...familyBaseSlot, key: 'panel-primary' }],
            bindingSlotFamilies: [
                {
                    ...(familyDefinition.bindingSlotFamilies?.[0] as NonNullable<
                        WidgetBindingDefinitionContract['bindingSlotFamilies']
                    >[number]),
                    slotPrefix: 'panel-'
                }
            ]
        }
        expect(() => resolveWidgetBindingSlotDefinition(colliding, 'panel-primary')).toThrow(/collides/u)

        const bounded: WidgetBindingDefinitionContract = {
            ...familyDefinition,
            bindingSlotFamilies: [
                {
                    ...(familyDefinition.bindingSlotFamilies?.[0] as NonNullable<
                        WidgetBindingDefinitionContract['bindingSlotFamilies']
                    >[number]),
                    maxMembers: 1
                }
            ]
        }
        expect(() =>
            validateWidgetBindings(bounded, {
                version: 1,
                slots: [familyBinding.slots[0], familyBinding.slots[1], { ...familyBinding.slots[1], slot: 'panel:secondary' }]
            })
        ).toThrow(/member limit/u)
    })

    it('normalizes PostgreSQL Component data type aliases for binding validation', () => {
        expect(normalizeWidgetBindingDataType('character varying(255)')).toBe('STRING')
        expect(normalizeWidgetBindingDataType('citext')).toBe('STRING')
        expect(normalizeWidgetBindingDataType('double precision')).toBe('NUMBER')
        expect(normalizeWidgetBindingDataType('bool')).toBe('BOOLEAN')
        expect(normalizeWidgetBindingDataType('jsonb')).toBe('JSON')
        expect(normalizeWidgetBindingDataType('uuid')).toBe('REF')
        expect(normalizeWidgetBindingDataType('timestamp with time zone')).toBe('TIMESTAMP WITH TIME ZONE')
        expect(normalizeWidgetBindingDataType(null)).toBeUndefined()
    })

    it('declares valid capability and slot metadata for every Marketing widget and collection variant', () => {
        const marketingDefinitions = LAYOUT_WIDGET_DEFINITIONS.filter(({ templateKey }) => templateKey === 'marketing-page')
        expect(marketingDefinitions).toHaveLength(8)
        for (const definition of marketingDefinitions) {
            expect(layoutWidgetDefinitionSchema.safeParse(definition).success, definition.key).toBe(true)
            expect(definition.authoring?.application).toMatchObject({
                presentationOnly: true,
                canEditContent: false,
                canRebind: false
            })
            for (const slot of definition.bindingSlots ?? []) {
                expect(widgetBindingSlotDefinitionSchema.safeParse(slot).success, `${definition.key}/${slot.key}`).toBe(true)
            }
            for (const [variant, slots] of Object.entries(definition.bindingVariants ?? {})) {
                expect(slots.length, `${definition.key}/${variant}`).toBeGreaterThan(0)
                for (const slot of slots) {
                    expect(widgetBindingSlotDefinitionSchema.safeParse(slot).success, `${definition.key}/${variant}/${slot.key}`).toBe(true)
                }
            }
            for (const field of definition.presentationFields ?? []) {
                expect(field.labelKey, `${definition.key}/${field.key}`).toMatch(/^layouts\.marketing\.widget\./)
                if (field.helperTextKey) {
                    expect(field.helperTextKey, `${definition.key}/${field.key} helper`).toMatch(/^layouts\.marketing\.widget\./)
                }
                for (const option of field.options ?? []) {
                    expect(option.labelKey, `${definition.key}/${field.key}/${option.value}`).toMatch(/^layouts\.marketing\.widget\./)
                }
            }
        }

        const collectionDefinition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.collection')
        expect(collectionDefinition?.initialBindingSlotKey).toBe('items')
        for (const variant of ['logos', 'features', 'testimonials', 'highlights', 'faq']) {
            const resolvedDefinition = getLayoutWidgetDefinition('marketing.collection', { variant })
            expect(resolvedDefinition?.bindingSlots?.map(({ key }) => key)).toEqual(['section', 'items'])
            expect(resolvedDefinition?.bindingSlots?.some(({ key }) => key === collectionDefinition?.initialBindingSlotKey)).toBe(true)
        }
        expect(getLayoutWidgetDefinition('marketing.collection', { variant: 'unknown' })?.bindingSlots).toEqual([])

        if (!collectionDefinition) throw new Error('Marketing collection layout definition is missing')
        const legacyDefinition = Object.fromEntries(Object.entries(collectionDefinition).filter(([key]) => key !== 'initialBindingSlotKey'))
        expect(layoutWidgetDefinitionSchema.safeParse(legacyDefinition).success).toBe(true)

        const invalidVariantDefinition = {
            ...collectionDefinition,
            bindingVariants: {
                ...collectionDefinition.bindingVariants,
                faq: (collectionDefinition.bindingVariants?.faq ?? []).filter(({ key }) => key !== 'items')
            }
        }
        expect(layoutWidgetDefinitionSchema.safeParse(invalidVariantDefinition).success).toBe(false)
    })

    it('accepts a bounded semantic-key binding with no physical identifiers', () => {
        expect(widgetEntityBindingEnvelopeSchema.safeParse(heroBinding).success).toBe(true)
        expect(widgetBindingSlotDefinitionSchema.safeParse(heroSlot).success).toBe(true)
        expect(validateWidgetBindings(heroDefinition, heroBinding)).toEqual(canonicalizeWidgetBindings(heroBinding))
    })

    it('rejects unknown metadata and physical-ID-shaped selectors', () => {
        expect(
            widgetEntityBindingEnvelopeSchema.safeParse({
                ...heroBinding,
                unexpected: true
            }).success
        ).toBe(false)
        expect(
            widgetEntityBindingEnvelopeSchema.safeParse({
                version: 1,
                slots: [
                    {
                        ...heroBinding.slots[0],
                        targets: [
                            {
                                ...heroBinding.slots[0].targets[0],
                                selector: { kind: 'semantic-key', field: 'recordId', value: 'default' }
                            }
                        ]
                    }
                ]
            }).success
        ).toBe(false)
        expect(
            widgetEntityBindingEnvelopeSchema.safeParse({
                version: 1,
                slots: [
                    {
                        ...heroBinding.slots[0],
                        targets: [
                            {
                                ...heroBinding.slots[0].targets[0],
                                selector: {
                                    kind: 'semantic-key',
                                    field: 'key',
                                    value: '0190a9b5-3cde-7abc-8def-0123456789a1'
                                }
                            }
                        ]
                    }
                ]
            }).success
        ).toBe(false)
    })

    it('validates generic component format requirements declared by the widget registry', () => {
        const hero = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
        const contentSlot = hero?.bindingSlots?.find(({ key }) => key === 'content')
        const primaryAction = contentSlot?.requirements.components.find(({ field }) => field === 'primaryAction')
        expect(primaryAction?.format).toBe('marketingAction')
        expect(widgetBindingSlotDefinitionSchema.safeParse(contentSlot).success).toBe(true)
        expect(
            widgetBindingSlotDefinitionSchema.safeParse({
                ...contentSlot,
                requirements: {
                    ...contentSlot?.requirements,
                    components: contentSlot?.requirements.components.map((component) =>
                        component.field === 'primaryAction' ? { ...component, format: 'invalid format' } : component
                    )
                }
            }).success
        ).toBe(false)
    })

    it('rejects duplicate slots, targets, and projection roles', () => {
        const target = heroBinding.slots[0].targets[0]
        expect(
            widgetEntityBindingEnvelopeSchema.safeParse({
                version: 1,
                slots: [heroBinding.slots[0], heroBinding.slots[0]]
            }).success
        ).toBe(false)
        expect(
            widgetEntityBindingEnvelopeSchema.safeParse({
                version: 1,
                slots: [{ slot: 'content', targets: [target, target] }]
            }).success
        ).toBe(false)
        expect(
            widgetEntityBindingEnvelopeSchema.safeParse({
                version: 1,
                slots: [
                    {
                        slot: 'content',
                        targets: [
                            {
                                ...target,
                                projection: [...target.projection, target.projection[0]]
                            }
                        ]
                    }
                ]
            }).success
        ).toBe(false)
    })

    it('canonicalizes all set-like arrays deterministically', () => {
        const canonical = canonicalizeWidgetBindings(heroBinding)
        expect(canonical.slots[0].targets[0].projection.map(({ field }) => field)).toEqual(['description', 'key', 'title'])
        expect(canonicalizeWidgetBindings(canonical)).toEqual(canonical)
    })

    it('supports a bounded record-set source independently from the rows it resolves', () => {
        const definition: WidgetBindingDefinitionContract = {
            bindingSlots: [
                {
                    ...heroSlot,
                    key: 'items',
                    selectorKinds: ['record-set'],
                    cardinality: { min: 1, max: 1 },
                    orderByField: 'order',
                    visibilityField: 'visible',
                    maxResolvedRecords: 100,
                    requirements: {
                        ...heroSlot.requirements,
                        recordPolicy: undefined,
                        components: [
                            {
                                field: 'key',
                                componentCodename: 'RecordKey',
                                valueType: 'string',
                                localized: false,
                                required: true,
                                semanticKey: true,
                                pattern: '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$'
                            },
                            { field: 'title', componentCodename: 'Title', valueType: 'string', localized: true, required: true },
                            { field: 'order', componentCodename: 'SortOrder', valueType: 'number', localized: false, required: true },
                            { field: 'visible', componentCodename: 'IsVisible', valueType: 'boolean', localized: false, required: true }
                        ]
                    }
                }
            ]
        }
        const binding = {
            version: 1,
            slots: [
                {
                    slot: 'items',
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename: 'CustomOrderedContent',
                            selector: { kind: 'record-set' },
                            projection: [
                                { field: 'key', componentCodename: 'RecordKey' },
                                { field: 'title', componentCodename: 'Title' },
                                { field: 'order', componentCodename: 'SortOrder' },
                                { field: 'visible', componentCodename: 'IsVisible' }
                            ]
                        }
                    ]
                }
            ]
        }

        expect(validateWidgetBindings(definition, binding).slots[0].targets).toHaveLength(1)
        expect(widgetBindingSlotDefinitionSchema.safeParse(definition.bindingSlots?.[0]).success).toBe(true)
        expect(
            widgetEntityBindingEnvelopeSchema.safeParse({
                ...binding,
                slots: [
                    { ...binding.slots[0], targets: [{ ...binding.slots[0].targets[0], selector: { kind: 'record-set', limit: 5000 } }] }
                ]
            }).success
        ).toBe(false)
    })

    it('supports schema-driven record tables without persisting Component projections', () => {
        const definition = getLayoutWidgetDefinition('detailsTable', { variant: 'records' })
        const slot = definition?.bindingSlots?.find(({ key }) => key === 'rows')
        if (!definition || !slot) throw new Error('Generic records table contract is unavailable')

        expect(slot).toMatchObject({
            projectionMode: 'entity-schema',
            selectorKinds: ['record-set'],
            requirements: { components: [] }
        })
        const binding = {
            version: 1 as const,
            slots: [
                {
                    slot: 'rows',
                    targets: [
                        {
                            entityKind: 'object' as const,
                            entityCodename: 'Enrollments',
                            selector: { kind: 'record-set' as const },
                            projection: []
                        }
                    ]
                }
            ]
        }

        expect(validateWidgetBindings(definition, binding)).toEqual(binding)
        expect(() =>
            validateWidgetBindings(definition, {
                ...binding,
                slots: [
                    {
                        ...binding.slots[0],
                        targets: [
                            {
                                ...binding.slots[0].targets[0],
                                projection: [{ field: 'title', componentCodename: 'Title' }]
                            }
                        ]
                    }
                ]
            })
        ).toThrow(/must not persist Component projections/u)

        const invalidSchemaSlot = {
            ...slot,
            orderByField: 'title',
            requirements: {
                ...slot.requirements,
                components: [{ field: 'title', componentCodename: 'Title', valueType: 'string', localized: true, required: true }]
            }
        }
        expect(widgetBindingSlotDefinitionSchema.safeParse(invalidSchemaSlot).success).toBe(false)
        expect(
            widgetBindingSlotDefinitionSchema.safeParse({
                ...slot,
                projectionMode: 'registered'
            }).success
        ).toBe(false)
    })

    it('accepts only the fixed learner Enrollment target kinds through the registered table slot', () => {
        const definition = getLayoutWidgetDefinition('detailsTable', { variant: 'learner-enrollments' })
        const slot = definition?.bindingSlots?.find(({ key }) => key === 'rows')
        if (!definition || !slot) throw new Error('Learner Enrollment table contract is unavailable')

        expect(slot.selectorKinds).toEqual(['learner-enrollment-set'])
        expect(slot.requirements.entityCodenames).toEqual(['Enrollments'])
        const target = {
            entityKind: 'object' as const,
            entityCodename: 'Enrollments',
            selector: { kind: 'learner-enrollment-set' as const, targetKind: 'course' as const },
            projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
        }
        const bindings = validateWidgetBindings(definition, { version: 1, slots: [{ slot: 'rows', targets: [target] }] })
        expect(bindings.slots[0]?.targets[0]?.selector).toEqual({ kind: 'learner-enrollment-set', targetKind: 'course' })
        expect(() =>
            validateWidgetBindings(definition, {
                version: 1,
                slots: [{ slot: 'rows', targets: [{ ...target, entityCodename: 'OtherCompatibleEntity' }] }]
            })
        ).toThrow()
        expect(
            isCompatibleWidgetBindingEntity(slot, {
                kind: 'object',
                codename: 'OtherCompatibleEntity',
                config: {},
                components: slot.requirements.components.map((requirement) => ({
                    codename: requirement.componentCodename,
                    dataType: requirement.valueType.toUpperCase(),
                    isRequired: requirement.required,
                    validationRules: {
                        ...(requirement.localized ? { localized: true } : {}),
                        ...(requirement.maxLength === undefined ? {} : { maxLength: requirement.maxLength })
                    }
                }))
            })
        ).toBe(false)

        expect(
            widgetEntityBindingEnvelopeSchema.safeParse({
                version: 1,
                slots: [
                    {
                        slot: 'rows',
                        targets: [
                            {
                                ...target,
                                selector: { kind: 'learner-enrollment-set', targetKind: 'content' }
                            }
                        ]
                    }
                ]
            }).success
        ).toBe(false)
        expect(() =>
            validateWidgetBindings(definition, {
                version: 1,
                slots: [{ slot: 'rows', targets: [{ ...target, selector: { kind: 'record-set' } }] }]
            })
        ).toThrow()
    })

    it('requires a relation-set to target its declared parent slot and REF role', () => {
        const parentSlot = {
            ...heroSlot,
            key: 'tiers',
            selectorKinds: ['record-set'] as const,
            maxResolvedRecords: 24,
            orderByField: 'key'
        }
        const benefitsSlot = {
            ...heroSlot,
            key: 'benefits',
            selectorKinds: ['relation-set'] as const,
            maxResolvedRecords: 100,
            orderByField: 'key',
            relation: { field: 'tier', parentSlot: 'tiers' },
            requirements: {
                ...heroSlot.requirements,
                components: [
                    {
                        field: 'key',
                        componentCodename: 'BenefitKey',
                        valueType: 'string' as const,
                        localized: false,
                        required: true,
                        semanticKey: true,
                        pattern: '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$'
                    },
                    { field: 'tier', componentCodename: 'TierRef', valueType: 'ref' as const, localized: false, required: true }
                ]
            }
        }
        const definition: WidgetBindingDefinitionContract = { bindingSlots: [parentSlot, benefitsSlot] }
        const target = (entityCodename: string, selector: unknown, projection: { field: string; componentCodename: string }[]) => ({
            entityKind: 'object' as const,
            entityCodename,
            selector,
            projection
        })
        const valid = {
            version: 1,
            slots: [
                {
                    slot: 'tiers',
                    targets: [target('CustomTier', { kind: 'record-set' }, heroBinding.slots[0].targets[0].projection)]
                },
                {
                    slot: 'benefits',
                    targets: [
                        target('CustomBenefit', { kind: 'relation-set', parentSlot: 'tiers' }, [
                            { field: 'key', componentCodename: 'BenefitKey' },
                            { field: 'tier', componentCodename: 'TierRef' }
                        ])
                    ]
                }
            ]
        }
        expect(validateWidgetBindings(definition, valid).slots).toHaveLength(2)
        expect(() => validateWidgetBindings(definition, { ...valid, slots: [valid.slots[1]] })).toThrow()
        expect(() =>
            validateWidgetBindings(definition, {
                ...valid,
                slots: [
                    valid.slots[0],
                    {
                        ...valid.slots[1],
                        targets: [
                            target('CustomBenefit', { kind: 'relation-set', parentSlot: 'wrong' }, valid.slots[1].targets[0].projection)
                        ]
                    }
                ]
            })
        ).toThrow()
        expect(
            widgetBindingSlotDefinitionSchema.safeParse({
                ...benefitsSlot,
                requirements: {
                    ...benefitsSlot.requirements,
                    components: benefitsSlot.requirements.components.map((item) =>
                        item.field === 'tier' ? { ...item, valueType: 'json' } : item
                    )
                }
            }).success
        ).toBe(false)
    })

    it('allows an optional slot to be absent without encoding an empty target array', () => {
        const definition: WidgetBindingDefinitionContract = {
            bindingSlots: [heroSlot, { ...heroSlot, key: 'optional', cardinality: { min: 0, max: 1 } }]
        }
        expect(validateWidgetBindings(definition, heroBinding).slots).toHaveLength(1)
        expect(() =>
            validateWidgetBindings(definition, {
                ...heroBinding,
                slots: [...heroBinding.slots, { slot: 'optional', targets: [] }]
            })
        ).toThrow()
    })

    it('validates slot cardinality, allowed kinds, semantic key, and exact projection coverage', () => {
        expect(() =>
            validateWidgetBindings(heroDefinition, {
                version: 1,
                slots: [{ slot: 'unknown', targets: [heroBinding.slots[0].targets[0]] }]
            })
        ).toThrow()

        expect(() =>
            validateWidgetBindings(heroDefinition, {
                version: 1,
                slots: [{ slot: 'content', targets: [] }]
            })
        ).toThrow()

        expect(() =>
            validateWidgetBindings(heroDefinition, {
                version: 1,
                slots: [
                    {
                        slot: 'content',
                        targets: [
                            {
                                ...heroBinding.slots[0].targets[0],
                                entityKind: 'page'
                            }
                        ]
                    }
                ]
            })
        ).toThrow()

        expect(() =>
            validateWidgetBindings(heroDefinition, {
                version: 1,
                slots: [
                    {
                        slot: 'content',
                        targets: [
                            {
                                ...heroBinding.slots[0].targets[0],
                                selector: { kind: 'semantic-key', field: 'title', value: 'default' }
                            }
                        ]
                    }
                ]
            })
        ).toThrow()

        expect(() =>
            validateWidgetBindings(heroDefinition, {
                version: 1,
                slots: [
                    {
                        slot: 'content',
                        targets: [
                            {
                                ...heroBinding.slots[0].targets[0],
                                projection: [{ field: 'title', componentCodename: 'Title' }]
                            }
                        ]
                    }
                ]
            })
        ).toThrow()
    })

    it('builds its projection from registry metadata and rejects a forged Component mapping', () => {
        const built = buildSingleTargetWidgetBinding(heroDefinition, 'content', {
            entityKind: 'object',
            entityCodename: 'MarketingPageHero',
            semanticKey: 'hero-content'
        })
        expect(built.slots[0].targets[0].projection).toEqual([
            { field: 'description', componentCodename: 'Description' },
            { field: 'key', componentCodename: 'HeroKey' },
            { field: 'title', componentCodename: 'Title' }
        ])

        const forged: unknown = {
            ...heroBinding,
            slots: [
                {
                    ...heroBinding.slots[0],
                    targets: [
                        {
                            ...heroBinding.slots[0].targets[0],
                            projection: heroBinding.slots[0].targets[0].projection.map((entry) =>
                                entry.field === 'title' ? { ...entry, componentCodename: 'Email' } : entry
                            )
                        }
                    ]
                }
            ]
        }
        expect(() => validateWidgetBindings(heroDefinition, forged)).toThrow()
    })

    it('rejects invalid slot definitions and excessive binding arrays', () => {
        expect(
            widgetBindingSlotDefinitionSchema.safeParse({
                ...heroSlot,
                cardinality: { min: 2, max: 1 }
            }).success
        ).toBe(false)
        expect(
            widgetEntityBindingEnvelopeSchema.safeParse({
                version: 1,
                slots: Array.from({ length: 17 }, (_, index) => ({
                    slot: `slot-${index}`,
                    targets: [heroBinding.slots[0].targets[0]]
                }))
            }).success
        ).toBe(false)
    })

    it('accepts capability-compatible custom Objects and rejects incompatible Component metadata', () => {
        const definition = getLayoutWidgetDefinition('marketing.collection', { variant: 'logos' })
        const slot = definition?.bindingSlots?.find(({ key }) => key === 'items')
        if (!slot) throw new Error('Marketing logos item slot is missing')
        const components = slot.requirements.components.map((requirement) => ({
            codename: requirement.componentCodename,
            dataType: requirement.valueType.toUpperCase(),
            isRequired: requirement.required,
            validationRules: {
                ...(requirement.localized ? { localized: true } : {}),
                ...(requirement.maxLength === undefined ? {} : { maxLength: requirement.maxLength }),
                ...(requirement.semanticKey ? { unique: true } : {}),
                ...(requirement.pattern === undefined ? {} : { pattern: requirement.pattern }),
                ...(requirement.format === undefined ? {} : { format: requirement.format })
            }
        }))
        const customObject = { kind: 'object', codename: 'CustomLogoItems', config: {}, components }

        expect(isCompatibleWidgetBindingEntity(slot, customObject)).toBe(true)
        for (const uiConfig of [{ sensitive: true }, { private: true }, { serverOwned: true }]) {
            expect(
                isCompatibleWidgetBindingEntity(slot, {
                    ...customObject,
                    components: components.map((component) => (component.codename === 'AltText' ? { ...component, uiConfig } : component))
                })
            ).toBe(false)
        }
        expect(
            isCompatibleWidgetBindingEntity(slot, {
                ...customObject,
                components: components.map((component) => {
                    const requirement = slot.requirements.components.find(
                        ({ componentCodename }) => componentCodename === component.codename
                    )
                    const aliases = { string: 'citext', number: 'double precision', boolean: 'bool', json: 'jsonb', ref: 'uuid' } as const
                    return requirement ? { ...component, dataType: aliases[requirement.valueType] } : component
                })
            })
        ).toBe(true)
        expect(
            isCompatibleWidgetBindingEntity(slot, {
                ...customObject,
                components: components.map((component) =>
                    component.codename === 'IsVisible' ? { ...component, dataType: 'STRING' } : component
                )
            })
        ).toBe(false)
        const semanticKeyRequirement = slot.requirements.components.find(({ semanticKey }) => semanticKey)
        if (!semanticKeyRequirement) throw new Error('Marketing logos semantic key requirement is missing')
        expect(
            isCompatibleWidgetBindingEntity(slot, {
                ...customObject,
                components: components.map((component) =>
                    component.codename === semanticKeyRequirement.componentCodename
                        ? { ...component, validationRules: { ...component.validationRules, pattern: '^invalid$' } }
                        : component
                )
            })
        ).toBe(false)
        expect(
            widgetBindingSlotDefinitionSchema.safeParse({
                ...slot,
                requirements: {
                    ...slot.requirements,
                    components: slot.requirements.components.map(({ pattern: _pattern, ...component }) => component)
                }
            }).success
        ).toBe(false)
    })

    it('keeps collection media optional when the runtime supports text-only content', () => {
        const logos = getLayoutWidgetDefinition('marketing.collection', { variant: 'logos' })?.bindingSlots?.find(
            ({ key }) => key === 'items'
        )
        const features = getLayoutWidgetDefinition('marketing.collection', { variant: 'features' })?.bindingSlots?.find(
            ({ key }) => key === 'items'
        )
        const testimonials = getLayoutWidgetDefinition('marketing.collection', { variant: 'testimonials' })?.bindingSlots?.find(
            ({ key }) => key === 'items'
        )
        if (!logos || !features || !testimonials) throw new Error('Marketing collection item binding slots are missing')

        for (const codename of ['ImageLight', 'ImageDark']) {
            expect(logos.requirements.components.find(({ componentCodename }) => componentCodename === codename)?.required).toBe(false)
            expect(features.requirements.components.find(({ componentCodename }) => componentCodename === codename)?.required).toBe(false)
        }
        for (const codename of ['Occupation', 'AvatarUrl', 'LogoLightUrl', 'LogoDarkUrl']) {
            expect(testimonials.requirements.components.find(({ componentCodename }) => componentCodename === codename)?.required).toBe(
                false
            )
        }
    })

    it('requires the registered conditional alternative-text policy for Marketing Images', () => {
        const definition = getLayoutWidgetDefinition('marketing.image')
        const slot = definition?.bindingSlots?.[0]
        if (!slot?.requirements.recordPolicy) throw new Error('Marketing Image content policy is missing')
        expect(slot.requirements.components.find(({ componentCodename }) => componentCodename === 'Resource')?.required).toBe(false)
        const components = slot.requirements.components.map((requirement) => ({
            codename: requirement.componentCodename,
            dataType: requirement.valueType.toUpperCase(),
            isRequired: requirement.required,
            validationRules: {
                ...(requirement.localized ? { localized: true } : {}),
                ...(requirement.maxLength === undefined ? {} : { maxLength: requirement.maxLength }),
                ...(requirement.semanticKey ? { unique: true } : {}),
                ...(requirement.pattern === undefined ? {} : { pattern: requirement.pattern }),
                ...(requirement.format === undefined ? {} : { format: requirement.format })
            }
        }))
        const entity = {
            kind: 'object',
            codename: 'MarketingImages',
            config: { recordPolicy: { version: 1, ...slot.requirements.recordPolicy } },
            components
        }

        expect(isCompatibleWidgetBindingEntity(slot, entity)).toBe(true)
        expect(
            isCompatibleWidgetBindingEntity(slot, {
                ...entity,
                config: {
                    recordPolicy: {
                        version: 1,
                        ...slot.requirements.recordPolicy,
                        conditionalRequired: undefined
                    }
                }
            })
        ).toBe(false)
        expect(
            widgetBindingSlotDefinitionSchema.safeParse({
                ...slot,
                requirements: {
                    ...slot.requirements,
                    recordPolicy: {
                        ...slot.requirements.recordPolicy,
                        conditionalRequired: [{ componentCodename: 'ImageKey', when: { componentCodename: 'Decorative', equals: false } }]
                    }
                }
            }).success
        ).toBe(false)
    })
})
