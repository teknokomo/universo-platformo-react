import { describe, expect, it } from 'vitest'

import { applicationLayoutContractSchema, applicationLayoutSnapshotSchema, effectiveLayoutResultSchema } from '../common/applicationLayouts'
import {
    LAYOUT_WIDGET_DEFINITIONS,
    LAYOUT_ZONE_DEFINITIONS,
    layoutWidgetDefinitionSchema,
    layoutZoneDefinitionSchema
} from '../common/layoutWidgetDefinitions'
import { DASHBOARD_LAYOUT_WIDGETS } from '../common/metahubs'
import { MARKETING_WIDGET_REGISTRY, marketingPageConfigSchema, marketingWidgetRegistrySchema } from '../common/marketingPage'
import {
    RESERVED_LAYOUT_METADATA_KEY,
    decodeLayoutConfigEnvelope,
    decodeWidgetConfigEnvelope,
    encodeLayoutConfigEnvelope,
    encodeSnapshotLayoutConfigEnvelope,
    encodeWidgetConfigEnvelope,
    getLayoutWidgetDefaultPlacement,
    getLayoutZoneSettingDefault,
    layoutLogicalPlacementSchema,
    replaceLayoutRendererConfig,
    replaceWidgetRendererConfig,
    resolveLayoutWidgetPlacement,
    resolveLayoutZoneSettingValue
} from '../common/layoutEnvelope'

const marketingContext = { templateKey: 'marketing-page' as const }

const marketingWidgetContext = {
    ...marketingContext,
    widgetKey: 'marketing.navigation',
    zone: 'marketing-header'
} as const

describe('neutral layout and widget envelopes', () => {
    it('round-trips neutral layout metadata and strips it before renderer parsing', () => {
        const rawConfig = {
            themeMode: 'dark',
            allowEmailActions: false,
            [RESERVED_LAYOUT_METADATA_KEY]: {
                composition: {
                    mode: 'overlay',
                    baseLayoutId: '0190a9b5-3cde-7abc-8def-0123456789a1'
                },
                zoneSettings: {
                    'marketing-header': { position: 'flow' }
                },
                sourceZoneSettings: {
                    'marketing-header': { position: 'fixed' }
                }
            }
        }

        const decoded = decodeLayoutConfigEnvelope(rawConfig, marketingContext)

        expect(decoded.rendererConfig).toEqual({ themeMode: 'dark', allowEmailActions: false })
        expect(decoded.rendererConfig).not.toHaveProperty(RESERVED_LAYOUT_METADATA_KEY)
        expect(marketingPageConfigSchema.safeParse(decoded.rendererConfig).success).toBe(true)
        expect(encodeLayoutConfigEnvelope({ rendererConfig: decoded.rendererConfig, neutral: decoded.neutral }, marketingContext)).toEqual(
            rawConfig
        )
    })

    it('preserves neutral metadata when replacing renderer config and rejects renderer injection', () => {
        const rawConfig = {
            themeMode: 'system',
            [RESERVED_LAYOUT_METADATA_KEY]: {
                zoneSettings: { 'marketing-header': { position: 'flow' } },
                sourceZoneSettings: { 'marketing-header': { position: 'fixed' } }
            }
        }

        expect(replaceLayoutRendererConfig(rawConfig, { themeMode: 'light' }, marketingContext)).toEqual({
            themeMode: 'light',
            [RESERVED_LAYOUT_METADATA_KEY]: rawConfig[RESERVED_LAYOUT_METADATA_KEY]
        })
        expect(() => encodeLayoutConfigEnvelope({ rendererConfig: { [RESERVED_LAYOUT_METADATA_KEY]: {} } })).toThrow(
            'reserved layout metadata'
        )
        expect(() => replaceLayoutRendererConfig(rawConfig, { [RESERVED_LAYOUT_METADATA_KEY]: {} }, marketingContext)).toThrow(
            'reserved layout metadata'
        )
    })

    it('fails closed for malformed or unsupported reserved metadata', () => {
        expect(() => decodeLayoutConfigEnvelope(undefined, marketingContext)).toThrow()
        expect(() => decodeLayoutConfigEnvelope(null, marketingContext)).toThrow()
        expect(() => decodeWidgetConfigEnvelope(undefined, marketingWidgetContext)).toThrow()
        expect(() => decodeWidgetConfigEnvelope(null, marketingWidgetContext)).toThrow()
        expect(() => decodeLayoutConfigEnvelope({ compositionMode: 'overlay' }, marketingContext)).toThrow('reserved layout metadata')
        expect(() => decodeLayoutConfigEnvelope({ baseLayoutId: null }, marketingContext)).toThrow('reserved layout metadata')
        expect(() => decodeLayoutConfigEnvelope({ [RESERVED_LAYOUT_METADATA_KEY]: { unknown: true } }, marketingContext)).toThrow()
        expect(() => decodeLayoutConfigEnvelope({ [RESERVED_LAYOUT_METADATA_KEY]: undefined }, marketingContext)).toThrow()
        expect(() =>
            decodeLayoutConfigEnvelope({ [RESERVED_LAYOUT_METADATA_KEY]: { zoneSettings: { unknown: {} } } }, marketingContext)
        ).toThrow()
        expect(() =>
            decodeLayoutConfigEnvelope(
                { [RESERVED_LAYOUT_METADATA_KEY]: { zoneSettings: { 'marketing-header': { position: 'sticky' } } } },
                marketingContext
            )
        ).toThrow()
        expect(() =>
            decodeLayoutConfigEnvelope(
                { [RESERVED_LAYOUT_METADATA_KEY]: { zoneSettings: { 'marketing-header': { unknown: 'flow' } } } },
                marketingContext
            )
        ).toThrow()
        expect(() =>
            decodeLayoutConfigEnvelope(
                { [RESERVED_LAYOUT_METADATA_KEY]: { zoneSettings: { 'marketing-main': { position: 'flow' } } } },
                marketingContext
            )
        ).toThrow()
        expect(() =>
            decodeLayoutConfigEnvelope(
                { [RESERVED_LAYOUT_METADATA_KEY]: { zoneSettings: { 'marketing-header': { position: 'flow' } } } },
                { templateKey: 'dashboard' }
            )
        ).toThrow()
        expect(() =>
            decodeLayoutConfigEnvelope(
                { [RESERVED_LAYOUT_METADATA_KEY]: { zoneSettings: { 'marketing-header': { position: 'flow' } } } },
                { templateKey: 'unknown-template' }
            )
        ).toThrow()
        expect(() =>
            decodeLayoutConfigEnvelope(
                {
                    [RESERVED_LAYOUT_METADATA_KEY]: {
                        sourceZoneSettings: { 'marketing-header': { position: 'fixed' } }
                    }
                },
                { ...marketingContext, allowSourceZoneSettings: false }
            )
        ).toThrow()
        expect(() =>
            encodeLayoutConfigEnvelope(
                { neutral: { sourceZoneSettings: { 'marketing-header': { position: 'fixed' } } } },
                { ...marketingContext, allowSourceZoneSettings: false }
            )
        ).toThrow()
        expect(() =>
            encodeLayoutConfigEnvelope(
                { neutral: { sourceZoneSettings: { 'marketing-header': { position: 'fixed' } } } },
                { ...marketingContext, allowSourceZoneSettings: false }
            )
        ).toThrow()
    })

    it('keeps defaults and typed placement/cardinality in the registry', () => {
        expect(getLayoutZoneSettingDefault('marketing-page', 'marketing-header', 'position')).toBe('fixed')
        expect(getLayoutZoneSettingDefault('marketing-page', 'marketing-header', 'missing')).toBeUndefined()
        expect(resolveLayoutZoneSettingValue('marketing-page', 'marketing-header', 'position')).toBe('fixed')
        expect(
            resolveLayoutZoneSettingValue('marketing-page', 'marketing-header', 'position', {
                'marketing-header': { position: 'flow' }
            })
        ).toBe('flow')
        expect(
            resolveLayoutZoneSettingValue('marketing-page', 'marketing-header', 'position', {
                'marketing-header': { position: 'unsupported' }
            })
        ).toBeUndefined()
        expect(layoutLogicalPlacementSchema.safeParse('start').success).toBe(true)
        expect(layoutLogicalPlacementSchema.safeParse('end').success).toBe(true)

        expect(MARKETING_WIDGET_REGISTRY['marketing.brand']).toMatchObject({
            repeatable: false,
            allowedZones: ['marketing-header'],
            defaultPlacement: 'start',
            mobileProjection: 'compact-header'
        })
        expect(MARKETING_WIDGET_REGISTRY['marketing.navigation']).toMatchObject({
            repeatable: true,
            defaultPlacement: 'start',
            mobileProjection: 'drawer'
        })
        expect(MARKETING_WIDGET_REGISTRY['marketing.auth']).toMatchObject({
            repeatable: false,
            defaultPlacement: 'end',
            mobileProjection: 'drawer'
        })

        const languageSwitcher = LAYOUT_WIDGET_DEFINITIONS.find((widget) => widget.key === 'languageSwitcher')
        const colorModeSwitcher = LAYOUT_WIDGET_DEFINITIONS.find((widget) => widget.key === 'colorModeSwitcher')
        expect(languageSwitcher).toMatchObject({ shared: true, multiInstance: false, defaultPlacement: 'end' })
        expect(colorModeSwitcher).toMatchObject({ shared: true, multiInstance: false, defaultPlacement: 'end' })
        expect(DASHBOARD_LAYOUT_WIDGETS.find((widget) => widget.key === 'languageSwitcher')?.multiInstance).toBe(false)
        expect(DASHBOARD_LAYOUT_WIDGETS.find((widget) => widget.key === 'colorModeSwitcher')?.multiInstance).toBe(false)
        expect(getLayoutWidgetDefaultPlacement({ ...marketingWidgetContext, widgetKey: 'marketing.brand' })).toBe('start')
        expect(getLayoutWidgetDefaultPlacement({ ...marketingWidgetContext, widgetKey: 'marketing.auth' })).toBe('end')
        expect(getLayoutWidgetDefaultPlacement({ ...marketingWidgetContext, widgetKey: 'languageSwitcher' })).toBe('end')
        expect(() => getLayoutWidgetDefaultPlacement({ ...marketingWidgetContext, widgetKey: 'marketing.hero' })).toThrow()
        expect(resolveLayoutWidgetPlacement(marketingWidgetContext)).toBe('start')
        expect(resolveLayoutWidgetPlacement(marketingWidgetContext, 'end')).toBe('end')
        expect(() => resolveLayoutWidgetPlacement({ ...marketingWidgetContext, widgetKey: 'marketing.hero' }, 'start')).toThrow()
    })

    it('round-trips widget placement and keeps it out of renderer config', () => {
        const rawConfig = {
            instanceKey: 'primary-navigation',
            enabled: true,
            [RESERVED_LAYOUT_METADATA_KEY]: { placement: 'start' }
        }
        const decoded = decodeWidgetConfigEnvelope(rawConfig, marketingWidgetContext)

        expect(decoded.rendererConfig).toEqual({ instanceKey: 'primary-navigation', enabled: true })
        expect(decoded.neutral).toEqual({ placement: 'start' })
        expect(encodeWidgetConfigEnvelope(decoded, marketingWidgetContext)).toEqual(rawConfig)
        expect(replaceWidgetRendererConfig(rawConfig, { instanceKey: 'secondary-navigation' }, marketingWidgetContext)).toEqual({
            instanceKey: 'secondary-navigation',
            [RESERVED_LAYOUT_METADATA_KEY]: { placement: 'start' }
        })
        expect(() => encodeWidgetConfigEnvelope({ rendererConfig: { [RESERVED_LAYOUT_METADATA_KEY]: {} } })).toThrow(
            'reserved layout metadata'
        )
    })

    it('does not add parallel snapshot composition or executable metadata validators', () => {
        const layout = {
            id: '0190a9b5-3cde-7abc-8def-0123456789a2',
            templateKey: 'marketing-page' as const,
            scopeKind: 'global' as const,
            scopeEntityId: null,
            sourceKind: 'application' as const,
            sourceLayoutId: null,
            compositionMode: 'independent' as const,
            baseLayoutId: null,
            widgets: []
        }

        expect(applicationLayoutContractSchema.safeParse(layout).success).toBe(true)
        expect(applicationLayoutSnapshotSchema.safeParse({ layouts: [layout] }).success).toBe(true)
        expect(applicationLayoutContractSchema.safeParse({ ...layout, zoneSettings: {} }).success).toBe(false)
        const effective = {
            status: 'ok' as const,
            target: {
                applicationId: '0190a9b5-3cde-7abc-8def-0123456789a3',
                targetKind: null,
                locale: 'en'
            },
            scope: 'global' as const,
            layout: {
                id: layout.id,
                templateKey: layout.templateKey,
                sourceKind: layout.sourceKind,
                sourceLayoutId: layout.sourceLayoutId,
                compositionMode: layout.compositionMode,
                baseLayoutId: layout.baseLayoutId
            },
            widgets: [],
            precedence: ['application-global' as const],
            publicationIdentity: null,
            effectiveHash: 'a'.repeat(64)
        }
        expect(effectiveLayoutResultSchema.safeParse(effective).success).toBe(true)
        expect(effectiveLayoutResultSchema.safeParse({ ...effective, zoneSettings: {} }).success).toBe(false)
        expect(
            encodeSnapshotLayoutConfigEnvelope(
                {
                    rendererConfig: { themeMode: 'dark' },
                    neutral: {
                        composition: { mode: 'independent', baseLayoutId: null },
                        zoneSettings: { 'marketing-header': { position: 'flow' } },
                        sourceZoneSettings: { 'marketing-header': { position: 'fixed' } }
                    }
                },
                marketingContext
            )
        ).toEqual({
            themeMode: 'dark',
            [RESERVED_LAYOUT_METADATA_KEY]: {
                zoneSettings: { 'marketing-header': { position: 'flow' } }
            }
        })

        expect(layoutZoneDefinitionSchema.parse(LAYOUT_ZONE_DEFINITIONS[5]).settings).toEqual([
            expect.objectContaining({ key: 'position', defaultValue: 'fixed' })
        ])
        expect(
            LAYOUT_ZONE_DEFINITIONS.every((zone) =>
                zone.settings.every((setting) => Object.values(setting).every((value) => typeof value !== 'function'))
            )
        ).toBe(true)
        expect(LAYOUT_WIDGET_DEFINITIONS.every((widget) => layoutWidgetDefinitionSchema.safeParse(widget).success)).toBe(true)
        expect(marketingWidgetRegistrySchema.safeParse(MARKETING_WIDGET_REGISTRY).success).toBe(true)
        expect(
            Object.values(MARKETING_WIDGET_REGISTRY).every((entry) => Object.values(entry).every((value) => typeof value !== 'function'))
        ).toBe(true)
    })
})
