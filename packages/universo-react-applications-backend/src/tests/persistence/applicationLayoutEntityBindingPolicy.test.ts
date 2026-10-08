import { describe, expect, it } from '@jest/globals'
import {
    buildSingleTargetWidgetBinding,
    encodeLayoutWidgetConfigEnvelope,
    getLayoutWidgetDefinition,
    LAYOUT_WIDGET_DEFINITIONS,
    validateWidgetBindings
} from '@universo-react/types'
import {
    containsEntityBackedWidgetCopyConflict,
    containsPersistedRequiredEntityBackedWidget
} from '../../persistence/applicationLayoutEntityBindingPolicy'

const imageDefinition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.image')
if (!imageDefinition) throw new Error('The marketing image widget must be registered')

const heroDefinition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
if (!heroDefinition) throw new Error('The marketing hero widget must be registered')

const imageConfig = encodeLayoutWidgetConfigEnvelope(
    {
        rendererConfig: {},
        neutral: {
            bindings: buildSingleTargetWidgetBinding(imageDefinition, 'content', {
                entityKind: 'object',
                entityCodename: 'MarketingPageImage',
                semanticKey: 'primary'
            })
        }
    },
    { templateKey: 'marketing-page', widgetKey: 'marketing.image', zone: 'marketing-main' }
)

const overlayConfig = encodeLayoutWidgetConfigEnvelope(
    { rendererConfig: {} },
    { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
)

const persistedOverlay = {
    id: '0190a9b5-3cde-7000-8000-000000000071',
    instance_key: 'hero',
    widget_key: 'marketing.hero',
    zone: 'marketing-main',
    config: overlayConfig,
    source_config: overlayConfig,
    source_widget_id: '0190a9b5-3cde-7000-8000-000000000073',
    source_base_widget_id: '0190a9b5-3cde-7000-8000-000000000073',
    _upl_deleted: false,
    _app_deleted: false
}

const registryBindings = (definition: NonNullable<ReturnType<typeof getLayoutWidgetDefinition>>) =>
    validateWidgetBindings(definition, {
        version: 1,
        slots: (definition.bindingSlots ?? []).map((slot, index) => {
            const selectorKind = slot.selectorKinds[0]
            const semanticComponent = slot.requirements.components.find(({ semanticKey }) => semanticKey === true)
            const selector =
                selectorKind === 'semantic-key'
                    ? { kind: selectorKind, field: semanticComponent?.field ?? 'key', value: `fixture-${index}` }
                    : selectorKind === 'relation-set'
                    ? { kind: selectorKind, parentSlot: slot.relation?.parentSlot ?? 'content' }
                    : selectorKind === 'learner-enrollment-set'
                    ? { kind: selectorKind, targetKind: 'course' as const }
                    : { kind: 'record-set' as const }
            return {
                slot: slot.key,
                targets: [
                    {
                        entityKind: 'object' as const,
                        entityCodename: `FixtureEntity${index}`,
                        selector,
                        projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                    }
                ]
            }
        })
    })

describe('application layout Entity binding policy', () => {
    it('blocks source-to-application copies for every registry variant with required source-owned bindings', () => {
        const expectedSourceManagedKeys = new Set([
            'marketing.brand',
            'marketing.navigation',
            'marketing.hero',
            'marketing.image',
            'marketing.collection',
            'marketing.pricing',
            'marketing.footer'
        ])
        const marketingVariants = LAYOUT_WIDGET_DEFINITIONS.flatMap((definition) => {
            if (!definition.supportedTemplates.includes('marketing-page')) return []
            const zone = definition.allowedZonesByTemplate['marketing-page']?.[0]
            if (!zone) return []

            const variants = definition.bindingVariants ? Object.keys(definition.bindingVariants) : [undefined]
            return variants.map((variant) => {
                const instanceKey = `copy-policy-${definition.key}${variant ? `-${variant}` : ''}`
                const rendererConfig = variant ? { variant } : {}
                const resolvedDefinition = getLayoutWidgetDefinition(definition.key, rendererConfig)
                const expectedConflict =
                    resolvedDefinition?.authoring?.application.presentationOnly === true &&
                    (resolvedDefinition.bindingSlots ?? []).some(({ cardinality }) => cardinality.min > 0)

                expect(expectedConflict).toBe(expectedSourceManagedKeys.has(definition.key))

                return {
                    widget: {
                        widgetKey: definition.key,
                        zone,
                        instanceKey,
                        config: encodeLayoutWidgetConfigEnvelope(
                            {
                                rendererConfig,
                                neutral: expectedConflict && resolvedDefinition ? { bindings: registryBindings(resolvedDefinition) } : {}
                            },
                            { templateKey: 'marketing-page', widgetKey: definition.key, zone, requireBindings: false }
                        )
                    },
                    expectedConflict
                }
            })
        })

        expect(marketingVariants.length).toBeGreaterThan(0)
        expect(marketingVariants.filter(({ expectedConflict }) => expectedConflict)).toHaveLength(11)
        for (const { widget, expectedConflict } of marketingVariants) {
            expect(containsEntityBackedWidgetCopyConflict('marketing-page', [widget])).toBe(expectedConflict)
        }
    })

    it('classifies required Entity-backed source widgets as unavailable for application-owned copies', () => {
        expect(
            containsEntityBackedWidgetCopyConflict('marketing-page', [
                { widgetKey: 'marketing.image', zone: 'marketing-main', instanceKey: 'image', config: imageConfig }
            ])
        ).toBe(true)
    })

    it('allows copying source widgets without required Entity binding slots', () => {
        const authConfig = encodeLayoutWidgetConfigEnvelope(
            { rendererConfig: {}, neutral: {} },
            { templateKey: 'marketing-page', widgetKey: 'marketing.auth', zone: 'marketing-header' }
        )

        expect(
            containsEntityBackedWidgetCopyConflict('marketing-page', [
                { widgetKey: 'marketing.auth', zone: 'marketing-header', instanceKey: 'auth', config: authConfig }
            ])
        ).toBe(false)
    })

    it('classifies required Entity-backed widgets inherited by sparse Marketing overlays', () => {
        expect(containsPersistedRequiredEntityBackedWidget('marketing-page', [persistedOverlay])).toBe(true)
    })

    it('classifies persisted source widgets with required Entity bindings', () => {
        const persistedSourceWidget = {
            ...persistedOverlay,
            widget_key: 'marketing.image',
            config: imageConfig,
            source_config: imageConfig,
            source_base_widget_id: null
        }

        expect(containsPersistedRequiredEntityBackedWidget('marketing-page', [persistedSourceWidget])).toBe(true)
    })

    it('rejects Entity bindings stored directly on a Marketing overlay widget', () => {
        const forgedOverlay = {
            ...persistedOverlay,
            source_config: encodeLayoutWidgetConfigEnvelope(
                {
                    rendererConfig: { showLeadForm: true },
                    neutral: {
                        bindings: buildSingleTargetWidgetBinding(heroDefinition, 'content', {
                            entityKind: 'object',
                            entityCodename: 'MarketingPageHero',
                            semanticKey: 'forged'
                        })
                    }
                },
                { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
            )
        }

        expect(() => containsPersistedRequiredEntityBackedWidget('marketing-page', [forgedOverlay])).toThrow(
            'violates its registry source policy'
        )
    })

    it('ignores soft-deleted persisted widgets before decoding their configuration', () => {
        const invalidDeletedWidget = { ...persistedOverlay, source_config: null, config: null }

        expect(containsPersistedRequiredEntityBackedWidget('marketing-page', [{ ...invalidDeletedWidget, _upl_deleted: true }])).toBe(false)
        expect(containsPersistedRequiredEntityBackedWidget('marketing-page', [{ ...invalidDeletedWidget, _app_deleted: true }])).toBe(false)
    })
})
