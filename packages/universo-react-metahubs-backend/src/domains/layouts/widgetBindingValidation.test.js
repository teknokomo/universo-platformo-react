const { assignLayoutZoneWidgetSchema } = require('./services/layoutServiceContracts')
const { encodeWidgetConfigEnvelope, getLayoutWidgetDefinition } = require('@universo-react/types')
const { parseResolvedWidget } = require('./widgetBindingValidation')

describe('parseResolvedWidget', () => {
    it('accepts the seeded Messenger tab through the shared assignment contract', () => {
        const config = {
            tabs: [{ slotKey: 'tab:overview', label: { en: 'Overview', ru: 'Обзор' }, isDefault: true }]
        }

        const result = assignLayoutZoneWidgetSchema.safeParse({
            widgetKey: 'detailsTabs',
            zone: 'center',
            config,
            expectedVersion: 1
        })

        expect(result.success).toBe(true)
    })

    it('accepts a shared dashboard widget hosted by the Messenger App template', () => {
        const templateKey = 'messenger-app'
        const widgetKey = 'detailsTitle'
        const zone = 'center'
        const rendererConfig = { level: 'h2' }
        const definition = getLayoutWidgetDefinition(widgetKey, rendererConfig)
        if (!definition) throw new Error('detailsTitle must be registered')
        const bindings = {
            version: 1,
            slots: [
                {
                    slot: 'content',
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename: 'MessengerOverviewContent',
                            selector: { kind: 'semantic-key', field: 'key', value: 'overview-heading' },
                            projection: [
                                { field: 'key', componentCodename: 'Key' },
                                { field: 'title', componentCodename: 'Title' },
                                { field: 'body', componentCodename: 'Body' }
                            ]
                        }
                    ]
                }
            ]
        }

        const config = encodeWidgetConfigEnvelope(
            { rendererConfig, neutral: { bindings } },
            { templateKey, widgetKey, zone, rendererConfig }
        )

        const resolved = parseResolvedWidget({
            id: '0190a9b5-3cde-7abc-8def-0123456789a2',
            layout_id: '0190a9b5-3cde-7abc-8def-0123456789a3',
            template_key: templateKey,
            scope_entity_id: null,
            base_layout_id: null,
            widget_key: widgetKey,
            zone,
            config,
            widget_version: 1
        })

        expect(definition.templateKey).toBe('dashboard')
        expect(resolved.templateKey).toBe(templateKey)
        expect(resolved.definition.supportedTemplates).toContain(templateKey)
        expect(resolved.definition.bindingSlots?.map(({ key }) => key)).toContain('content')
    })
})
