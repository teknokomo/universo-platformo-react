const { getLayoutWidgetDefinition } = require('@universo-react/types')

const { MetahubNotFoundError, MetahubValidationError } = require('../shared/domainErrors')
const {
    assertPlacementVariant,
    discoveryDefinition,
    requireDefinitionSlot,
    validateRegistryBindings,
    withValidatedRendererConfig
} = require('./widgetBindingValidation')

const definition = getLayoutWidgetDefinition('relationBuilder', {})

if (!definition) throw new Error('relationBuilder definition is missing')

const targetFor = (slot, entityCodename, selector) => ({
    entityKind: 'object',
    entityCodename,
    selector,
    projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
})

describe('Dashboard binding slot families', () => {
    it('resolves and validates a concrete relationBuilder family member', () => {
        const parent = requireDefinitionSlot(definition, 'parent')
        const panel = requireDefinitionSlot(definition, 'panel:primary')
        expect(panel).toMatchObject({
            key: 'panel:primary',
            selectorKinds: ['relation-set'],
            relation: { field: 'parent', parentSlot: 'parent' }
        })

        const validated = validateRegistryBindings(definition, {
            version: 1,
            slots: [
                { slot: 'parent', targets: [targetFor(parent, 'ParentRecords', { kind: 'record-set' })] },
                {
                    slot: 'panel:primary',
                    targets: [targetFor(panel, 'PanelRecords', { kind: 'relation-set', parentSlot: 'parent' })]
                }
            ]
        })

        expect(validated.slots.map(({ slot }) => slot)).toEqual(['panel:primary', 'parent'])
    })

    it('fails closed for unknown and malformed family member slots', () => {
        expect(() => requireDefinitionSlot(definition, 'panel:1bad')).toThrow(MetahubValidationError)
        expect(() => requireDefinitionSlot(definition, 'other')).toThrow(MetahubNotFoundError)
    })

    it('resolves Dashboard manual-menu source slots through the shared variant registry', () => {
        const manualMenu = discoveryDefinition('dashboard', 'menuWidget', 'manual')
        expect(manualMenu.bindingSlots?.map(({ key }) => key)).toEqual(['items', 'heading'])
        expect(() => discoveryDefinition('dashboard', 'menuWidget')).toThrow(MetahubValidationError)
        expect(() => discoveryDefinition('dashboard', 'menuWidget', 'unknown')).toThrow(MetahubValidationError)
    })

    it('changes only a registered binding variant and rejects mismatched placement lookups', () => {
        const generatedMenu = getLayoutWidgetDefinition('menuWidget', { variant: 'generated' })
        if (!generatedMenu) throw new Error('menuWidget definition is missing')
        const widget = {
            row: {},
            templateKey: 'dashboard',
            widgetKey: 'menuWidget',
            rendererConfig: { variant: 'generated' },
            neutral: { bindings: { version: 1, slots: [] } },
            definition: generatedMenu
        }

        const manualWidget = withValidatedRendererConfig(widget, { variant: 'manual' })
        expect(manualWidget.definition.bindingSlots?.map(({ key }) => key)).toEqual(['items', 'heading'])
        expect(() => assertPlacementVariant(manualWidget, 'generated')).toThrow(MetahubValidationError)
        expect(() => assertPlacementVariant(manualWidget, 'manual')).not.toThrow()
        expect(() => withValidatedRendererConfig(widget, { variant: 'unknown' })).toThrow(MetahubValidationError)
        expect(() => withValidatedRendererConfig(widget, { variant: 'manual', items: [] })).toThrow(MetahubValidationError)
    })
})
