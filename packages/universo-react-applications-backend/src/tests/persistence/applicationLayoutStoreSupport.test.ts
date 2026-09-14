import { describe, expect, it } from '@jest/globals'

import { getApplicationLayoutRawConfig, mapLayout, mapWidget } from '../../persistence/applicationLayoutStoreSupport'

const baseRow = {
    id: '0190a9b5-3cde-7abc-8def-012345678901',
    layout_id: '0190a9b5-3cde-7abc-8def-012345678902',
    zone: 'marketing-main',
    widget_key: 'marketing.hero',
    sort_order: 0,
    config: {
        instanceKey: 'hero',
        source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object' }
    },
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
