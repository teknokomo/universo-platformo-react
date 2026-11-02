import {
    decodeWidgetConfigEnvelope,
    detailsTabsWidgetConfigSchema,
    encodeWidgetConfigEnvelope,
    getLayoutWidgetAllowedZones
} from '@universo-react/types'
import { isUuidV7 } from '@universo-react/utils'
import type { SqlQueryable } from '@universo-react/utils/database'
import { DEFAULT_MESSENGER_APP_ZONE_WIDGETS } from '../../domains/shared/layoutDefaults'
import { MetahubLayoutPlacementSupport } from '../../domains/layouts/services/layoutPlacementSupport'
import type { LayoutScopeRow } from '../../domains/layouts/services/layoutServiceContracts'

const layoutId = '0190a9b5-3cde-7abc-8def-2123456789d1'

class MessengerLayoutSeedHarness extends MetahubLayoutPlacementSupport {
    protected override async lockLayoutScopeRow(): Promise<LayoutScopeRow> {
        return { id: layoutId, scope_entity_id: null, template_key: 'messenger-app', config: {} }
    }

    protected override async syncLayoutConfigFromZoneWidgets(): Promise<void> {}

    async seed(db: SqlQueryable): Promise<void> {
        await this.ensureDefaultZoneWidgets(db, 'mhb_0123456789abcdef0123456789abcdef', layoutId)
    }
}

describe('Messenger App default layout seed', () => {
    it('defines a safe header, localized Overview tab, and generated navigation child using existing runtime primitives', () => {
        expect(DEFAULT_MESSENGER_APP_ZONE_WIDGETS.map(({ zone, widgetKey, isActive }) => ({ zone, widgetKey, isActive }))).toEqual([
            { zone: 'top', widgetKey: 'header', isActive: undefined },
            { zone: 'center', widgetKey: 'detailsTabs', isActive: undefined },
            { zone: 'center', widgetKey: 'menuWidget', isActive: undefined }
        ])
        expect(getLayoutWidgetAllowedZones('header', 'messenger-app')).toEqual(['top'])
        expect(getLayoutWidgetAllowedZones('detailsTabs', 'messenger-app')).toEqual(['center'])
        expect(getLayoutWidgetAllowedZones('menuWidget', 'messenger-app')).toEqual(['center'])

        const centerTabs = DEFAULT_MESSENGER_APP_ZONE_WIDGETS[1]
        const context = {
            templateKey: 'messenger-app' as const,
            widgetKey: 'detailsTabs' as const,
            zone: 'center' as const,
            requireBindings: false
        }
        const config = encodeWidgetConfigEnvelope({ rendererConfig: centerTabs.config ?? {}, neutral: {} }, context)
        const decoded = decodeWidgetConfigEnvelope(config, context).rendererConfig
        expect(detailsTabsWidgetConfigSchema.parse(decoded)).toEqual({
            tabs: [{ slotKey: 'tab:overview', label: { en: 'Overview', ru: 'Обзор' }, isDefault: true }]
        })
        expect(DEFAULT_MESSENGER_APP_ZONE_WIDGETS[2]).toMatchObject({
            parentInstanceKey: 'messenger-overview-tabs',
            slotKey: 'tab:overview',
            config: { variant: 'generated' }
        })
        expect(DEFAULT_MESSENGER_APP_ZONE_WIDGETS[2]).not.toHaveProperty('bindings')
    })

    it('persists nested placements with unique UUID v7 identities and the actual parent database id', async () => {
        const query = jest.fn(async (sql: string, params: unknown[] = []) => {
            const statement = String(sql)
            if (statement.includes('SELECT id, widget_key, zone, is_active') && statement.includes('"_mhb_widgets"')) return []
            if (statement.includes('INSERT INTO') && statement.includes('"_mhb_widgets"')) {
                return [{ id: params[0], instance_key: params[2] }]
            }
            throw new Error(`Unexpected SQL in Messenger default seed test: ${statement}`)
        })
        const harness = new MessengerLayoutSeedHarness({} as never, {} as never)

        await harness.seed({ query } as never)

        const inserts = query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('"_mhb_widgets"'))
        expect(inserts).toHaveLength(3)
        const persisted = inserts.map(([, params]) => ({
            id: String(params[0]),
            instanceKey: String(params[2]),
            parentWidgetId: params[3],
            slotKey: params[4],
            zone: params[5],
            widgetKey: params[6],
            config: JSON.parse(String(params[8])) as Record<string, unknown>
        }))
        expect(persisted.map(({ widgetKey, zone }) => ({ widgetKey, zone }))).toEqual([
            { widgetKey: 'header', zone: 'top' },
            { widgetKey: 'detailsTabs', zone: 'center' },
            { widgetKey: 'menuWidget', zone: 'center' }
        ])
        expect(persisted.every(({ id, instanceKey }) => isUuidV7(id) && isUuidV7(instanceKey))).toBe(true)
        expect(new Set(persisted.map(({ id }) => id)).size).toBe(3)
        expect(new Set(persisted.map(({ instanceKey }) => instanceKey)).size).toBe(3)
        expect(persisted[2]).toMatchObject({
            parentWidgetId: persisted[1]?.id,
            slotKey: 'tab:overview'
        })
        expect(
            decodeWidgetConfigEnvelope(persisted[2]?.config ?? {}, {
                templateKey: 'messenger-app',
                widgetKey: 'menuWidget',
                zone: 'center'
            }).rendererConfig
        ).toEqual({ variant: 'generated' })
    })
})
