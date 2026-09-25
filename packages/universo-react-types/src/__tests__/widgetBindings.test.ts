import { describe, expect, it } from 'vitest'

import {
    canonicalizeWidgetBindings,
    buildSingleTargetWidgetBinding,
    validateWidgetBindings,
    widgetEntityBindingEnvelopeSchema,
    widgetBindingSlotDefinitionSchema,
    type WidgetBindingDefinitionContract
} from '../common/widgetBindings'
import { LAYOUT_WIDGET_DEFINITIONS } from '../common/layoutWidgetDefinitions'

const heroSlot = {
    key: 'content',
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
                maxLength: 64
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
            requiredLocales: ['en', 'ru'],
            validatorKey: 'marketing.hero.v1'
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

describe('entity-backed widget binding contracts', () => {
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
})
