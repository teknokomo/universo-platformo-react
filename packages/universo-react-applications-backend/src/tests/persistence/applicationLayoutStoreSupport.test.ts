import { describe, expect, it, jest } from '@jest/globals'
import { buildSingleTargetWidgetBinding, encodeLayoutWidgetConfigEnvelope, LAYOUT_WIDGET_DEFINITIONS } from '@universo-react/types'

import {
    assertRendererConfigInput,
    getApplicationLayoutDetail,
    getApplicationLayoutRawConfig,
    getApplicationLayoutWidgetSourceBindingState,
    mapLayout,
    mapWidget,
    prepareCopiedWidgetConfigs
} from '../../persistence/applicationLayoutStoreSupport'

const heroWidgetDefinition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
if (!heroWidgetDefinition) throw new Error('The marketing hero widget must be registered')

const heroBinding = (semanticKey = 'default') =>
    buildSingleTargetWidgetBinding(heroWidgetDefinition, 'content', {
        entityKind: 'object',
        entityCodename: 'MarketingPageHero',
        semanticKey
    })

const heroSourceConfig = (semanticKey = 'default') =>
    encodeLayoutWidgetConfigEnvelope(
        {
            rendererConfig: { instanceKey: 'hero', showLeadForm: true },
            neutral: { bindings: heroBinding(semanticKey) }
        },
        { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
    )

const baseRow = {
    id: '0190a9b5-3cde-7abc-8def-012345678901',
    layout_id: '0190a9b5-3cde-7abc-8def-012345678902',
    zone: 'marketing-main',
    widget_key: 'marketing.hero',
    sort_order: 0,
    config: { instanceKey: 'hero', showLeadForm: true },
    source_config: null,
    source_widget_id: null,
    source_base_widget_id: null,
    is_customized: false,
    is_active: true,
    version: 1
} as const

const baseLayoutRow = {
    id: '0190a9b5-3cde-7abc-8def-012345678902',
    scope_entity_id: null,
    template_key: 'dashboard',
    name: { en: 'Dashboard' },
    description: null,
    config: { showHeader: true },
    is_active: true,
    is_default: true,
    sort_order: 0,
    source_kind: 'application' as const,
    source_layout_id: null,
    source_snapshot_hash: null,
    source_content_hash: null,
    local_content_hash: null,
    sync_state: 'clean' as const,
    is_source_excluded: false,
    source_deleted_at: null,
    source_deleted_by: null,
    version: 1
}

describe('applicationLayoutStoreSupport', () => {
    it('rejects a layout without canonical composition metadata', () => {
        expect(() => mapLayout(baseLayoutRow)).toThrow('APPLICATION_LAYOUT_COMPOSITION_INVALID')
    })

    it('rejects a non-object persisted layout config instead of replacing it with an empty config', () => {
        expect(() => mapLayout({ ...baseLayoutRow, config: 'invalid' as never })).toThrow('APPLICATION_LAYOUT_CONFIG_INVALID')
    })

    it('rejects legacy root composition fields instead of treating them as persisted composition metadata', () => {
        expect(() =>
            mapLayout({
                ...baseLayoutRow,
                config: { compositionMode: 'independent', baseLayoutId: null }
            })
        ).toThrow()
    })

    it('rejects unsupported persisted neutral layout metadata', () => {
        expect(() =>
            mapLayout({
                ...baseLayoutRow,
                config: {
                    __layout: {
                        composition: { mode: 'independent', baseLayoutId: null },
                        unsupported: true
                    }
                }
            })
        ).toThrow()
    })

    it('rejects malformed persisted layout response fields instead of normalizing them', () => {
        const config = { __layout: { composition: { mode: 'independent', baseLayoutId: null } } }

        expect(() => mapLayout({ ...baseLayoutRow, config, name: 'Dashboard' as never })).toThrow()
        expect(() => mapLayout({ ...baseLayoutRow, config, description: 'Description' as never })).toThrow()
        expect(() => mapLayout({ ...baseLayoutRow, config, is_active: 'true' as never })).toThrow()
        expect(() => mapLayout({ ...baseLayoutRow, config, version: 0 })).toThrow()
    })

    it('does not fall back to the public renderer config when raw persisted metadata is unavailable', () => {
        const item = mapLayout({
            ...baseLayoutRow,
            config: { __layout: { composition: { mode: 'independent', baseLayoutId: null } } }
        })

        expect(() => getApplicationLayoutRawConfig({ item, widgets: [] })).toThrow('APPLICATION_LAYOUT_CONFIG_INVALID')
    })

    it('rejects malformed reserved widget metadata instead of silently stripping it', () => {
        expect(() =>
            mapWidget(
                {
                    ...baseRow,
                    config: {
                        ...baseRow.config,
                        __layout: { placement: 'invalid' }
                    }
                },
                'marketing-page'
            )
        ).toThrow('APPLICATION_LAYOUT_WIDGET_INVALID')
    })

    it('rejects malformed reserved source metadata instead of dropping the source baseline', () => {
        expect(() =>
            mapWidget(
                {
                    ...baseRow,
                    source_config: {
                        ...baseRow.config,
                        __layout: { placement: 'invalid' }
                    }
                },
                'marketing-page'
            )
        ).toThrow('APPLICATION_LAYOUT_WIDGET_INVALID')
    })

    it('keeps the trusted source binding out of renderer DTOs while retaining it in process metadata', () => {
        const widget = mapWidget(
            {
                ...baseRow,
                config: { instanceKey: 'hero', showLeadForm: false },
                source_config: heroSourceConfig()
            },
            'marketing-page'
        )

        expect(widget.config).toEqual({ instanceKey: 'hero', showLeadForm: false })
        expect(widget.sourceConfig).toEqual({ instanceKey: 'hero', showLeadForm: true })
        expect(widget.config).not.toHaveProperty('__layout')
        expect(widget.sourceConfig).not.toHaveProperty('__layout')
        expect(JSON.stringify(widget)).not.toContain('bindings')
        expect(getApplicationLayoutWidgetSourceBindingState(widget)).toEqual({
            persistedApplicationRow: true,
            bindings: heroBinding()
        })
    })

    it('retains trusted source bindings after the application detail response schema parses mapped widgets', async () => {
        const layoutRow = {
            ...baseLayoutRow,
            template_key: 'marketing-page',
            config: {
                themeMode: 'system',
                __layout: { composition: { mode: 'independent', baseLayoutId: null } }
            }
        }
        const row = { ...baseRow, config: { instanceKey: 'hero', showLeadForm: false }, source_config: heroSourceConfig() }
        const query = jest.fn().mockResolvedValueOnce([layoutRow]).mockResolvedValueOnce([row])

        const detail = await getApplicationLayoutDetail({ query } as never, 'app_018f8a787b8f7c1da111222233334444', baseRow.layout_id)

        expect(detail?.widgets[0]?.config).toEqual({ instanceKey: 'hero', showLeadForm: false })
        expect(getApplicationLayoutWidgetSourceBindingState(detail?.widgets[0])).toEqual({
            persistedApplicationRow: true,
            bindings: heroBinding()
        })
        expect(JSON.stringify(detail)).not.toContain('bindings')
    })

    it('rejects client-supplied binding metadata and does not copy a trusted source binding into an app-owned layout', () => {
        expect(() => assertRendererConfigInput({ instanceKey: 'hero', __layout: { bindings: heroBinding() } })).toThrow(
            'APPLICATION_LAYOUT_RESERVED_METADATA'
        )

        const widget = mapWidget({ ...baseRow, source_config: heroSourceConfig() }, 'marketing-page')
        expect(() => prepareCopiedWidgetConfigs('marketing-page', [widget])).toThrow('APPLICATION_LAYOUT_WIDGET_BINDING_COPY_UNSUPPORTED')
    })

    it('rejects malformed widget configuration instead of reading it through a legacy fallback', () => {
        expect(() =>
            mapWidget(
                {
                    ...baseRow,
                    config: { instanceKey: 'hero', unexpected: { nested: true } }
                },
                'marketing-page'
            )
        ).toThrow('APPLICATION_LAYOUT_WIDGET_INVALID')
    })

    it('rejects malformed source configuration instead of discarding the source baseline', () => {
        expect(() =>
            mapWidget(
                {
                    ...baseRow,
                    source_config: { instanceKey: 'hero', unexpected: { nested: true } }
                },
                'marketing-page'
            )
        ).toThrow('APPLICATION_LAYOUT_WIDGET_INVALID')
    })

    it('rejects malformed persisted widget response fields after canonical config decoding', () => {
        expect(() => mapWidget({ ...baseRow, id: 'widget-id' }, 'marketing-page')).toThrow()
        expect(() => mapWidget({ ...baseRow, is_customized: 'false' as never }, 'marketing-page')).toThrow()
        expect(() => mapWidget({ ...baseRow, is_active: 'true' as never }, 'marketing-page')).toThrow()
        expect(() => mapWidget({ ...baseRow, version: 0 }, 'marketing-page')).toThrow()
    })
})
