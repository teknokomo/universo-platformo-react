import { afterEach, describe, expect, it, vi } from 'vitest'

import {
    buildRuntimeLayoutQueryKey,
    effectiveLayoutResultSchema,
    fetchMarketingPageRuntime,
    fetchRuntimeEffectiveLayout,
    normalizeRuntimeLayoutTarget,
    runtimeZoneWidgetsSchema,
    toDashboardZoneWidgets
} from '../api'

const target = {
    targetKind: 'page' as const,
    entityTypeCodename: '  LandingPage  ',
    workspaceId: ' workspace-1 ',
    locale: ' ru ',
    themeVariant: ' dark '
}

const applicationId = '0190a9b5-3cde-7abc-8def-0123456789a1'
const layoutId = '0190a9b5-3cde-7abc-8def-0123456789a2'
const runtimeTemplate = {
    status: 'ok' as const,
    target: {
        applicationId,
        targetKind: 'page' as const,
        entityTypeCodename: 'LandingPage',
        workspaceId: '0190a9b5-3cde-7abc-8def-0123456789a3',
        locale: 'ru',
        themeVariant: 'dark'
    },
    resolvedEntityTypeId: null,
    scope: 'global' as const,
    layout: {
        id: layoutId,
        scopeEntityId: null,
        templateKey: 'dashboard' as const,
        sourceKind: 'application' as const,
        sourceLayoutId: null,
        compositionMode: 'independent' as const,
        baseLayoutId: null,
        config: {}
    },
    widgets: [
        {
            id: '0190a9b5-3cde-7abc-8def-0123456789b1',
            layoutId,
            zone: 'left',
            semanticRegion: 'sidebar',
            widgetKey: 'menuWidget',
            sortOrder: 1,
            config: {},
            isActive: true
        },
        {
            id: '0190a9b5-3cde-7abc-8def-0123456789b2',
            layoutId,
            zone: 'top',
            semanticRegion: 'header',
            widgetKey: 'languageSwitcher',
            sortOrder: 1,
            config: {},
            isActive: true
        },
        {
            id: '0190a9b5-3cde-7abc-8def-0123456789b3',
            layoutId,
            zone: 'right',
            semanticRegion: 'auxiliary',
            widgetKey: 'productTree',
            sortOrder: 1,
            config: {},
            isActive: true
        },
        {
            id: '0190a9b5-3cde-7abc-8def-0123456789b4',
            layoutId,
            zone: 'bottom',
            semanticRegion: 'footer',
            widgetKey: 'footer',
            sortOrder: 1,
            config: {},
            isActive: true
        },
        {
            id: '0190a9b5-3cde-7abc-8def-0123456789b5',
            layoutId,
            zone: 'center',
            semanticRegion: 'main',
            widgetKey: 'detailsTable',
            sortOrder: 1,
            config: {},
            isActive: true
        }
    ],
    precedence: ['application-global'] as const,
    publicationIdentity: null,
    effectiveHash: 'a'.repeat(64)
}

const marketingRuntimeTemplate = {
    templateKey: 'marketing-page' as const,
    marketingPage: {
        templateKey: 'marketing-page' as const,
        locale: 'en' as const,
        config: {},
        runtime: {
            layoutId,
            layoutVersion: 1,
            layoutHash: 'a'.repeat(64)
        },
        widgets: [
            {
                instanceKey: 'hero',
                zone: 'marketing-main' as const,
                sortOrder: 0,
                isActive: true,
                widgetKey: 'marketing.hero' as const,
                config: {
                    instanceKey: 'hero',
                    source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object' as const }
                },
                data: { records: [] }
            }
        ]
    }
}

describe('target-aware runtime client', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('normalizes layout identity and keeps content record selection out of the layout key', () => {
        expect(normalizeRuntimeLayoutTarget(target)).toEqual({
            targetKind: 'page',
            entityTypeId: null,
            entityTypeCodename: 'LandingPage',
            workspaceId: 'workspace-1',
            locale: 'ru',
            themeVariant: 'dark'
        })
        expect(buildRuntimeLayoutQueryKey('app-1', target)).toEqual([
            'applications',
            'app-1',
            'runtime',
            'effective-layout',
            {
                targetKind: 'page',
                entityTypeId: null,
                entityTypeCodename: 'LandingPage',
                workspaceId: 'workspace-1',
                locale: 'ru',
                themeVariant: 'dark'
            }
        ])
        expect(JSON.stringify(buildRuntimeLayoutQueryKey('app-1', target))).not.toContain('recordKey')
    })

    it('rejects an ambiguous target instead of sending two entity selectors', () => {
        expect(() => normalizeRuntimeLayoutTarget({ entityTypeId: 'entity-1', entityTypeCodename: 'LandingPage' })).toThrow(
            'entityTypeId or entityTypeCodename'
        )
        expect(() => normalizeRuntimeLayoutTarget({ entityTypeCodename: 'LandingPage' })).toThrow('target kind is required')
    })

    it('sends the normalized target before the renderer receives the parsed response', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(runtimeTemplate), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        )
        vi.stubGlobal('fetch', fetchMock)

        await expect(fetchRuntimeEffectiveLayout({ apiBaseUrl: '/api/v1', applicationId, target })).resolves.toMatchObject({
            status: 'ok',
            layout: { templateKey: 'dashboard', id: layoutId }
        })

        const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]))
        expect(requestUrl.pathname).toBe('/api/v1/applications/0190a9b5-3cde-7abc-8def-0123456789a1/runtime/effective-layout')
        expect(requestUrl.searchParams.get('targetKind')).toBe('page')
        expect(requestUrl.searchParams.get('entityTypeCodename')).toBe('LandingPage')
        expect(requestUrl.searchParams.get('workspaceId')).toBe('workspace-1')
        expect(requestUrl.searchParams.get('locale')).toBe('ru')
        expect(requestUrl.searchParams.get('themeVariant')).toBe('dark')
        expect(requestUrl.searchParams.has('recordKey')).toBe(false)
    })

    it('binds the effective layout hash to the marketing content request', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(marketingRuntimeTemplate), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        )
        vi.stubGlobal('fetch', fetchMock)

        await expect(
            fetchMarketingPageRuntime({
                apiBaseUrl: '/api/v1',
                applicationId,
                locale: 'en',
                expectedLayoutHash: 'b'.repeat(64)
            })
        ).resolves.toMatchObject({ templateKey: 'marketing-page' })

        const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]))
        expect(requestUrl.searchParams.get('expectedLayoutHash')).toBe('b'.repeat(64))
    })

    it('accepts all Dashboard zones and rejects an unknown zone', () => {
        const parsed = effectiveLayoutResultSchema.parse(runtimeTemplate)
        expect(runtimeZoneWidgetsSchema.safeParse(toDashboardZoneWidgets(parsed as Extract<typeof parsed, { status: 'ok' }>)).success).toBe(
            true
        )
        expect(
            effectiveLayoutResultSchema.safeParse({
                ...runtimeTemplate,
                widgets: [...runtimeTemplate.widgets, { ...runtimeTemplate.widgets[0], zone: 'floating' }]
            }).success
        ).toBe(false)
    })

    it('does not pass disabled widgets to the Dashboard renderer', () => {
        const parsed = effectiveLayoutResultSchema.parse({
            ...runtimeTemplate,
            widgets: runtimeTemplate.widgets.map((widget, index) => (index === 2 ? { ...widget, isActive: false } : widget))
        })

        const zones = toDashboardZoneWidgets(parsed as Extract<typeof parsed, { status: 'ok' }>)

        expect(zones.right).toEqual([])
        expect(zones.left).toHaveLength(1)
        expect(zones.center).toHaveLength(1)
    })

    it('fails closed when the runtime response contains an unknown zone', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    ...runtimeTemplate,
                    widgets: [...runtimeTemplate.widgets, { ...runtimeTemplate.widgets[0], zone: 'floating' }]
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        )
        vi.stubGlobal('fetch', fetchMock)

        await expect(fetchRuntimeEffectiveLayout({ apiBaseUrl: '/api/v1', applicationId, target })).rejects.toThrow(
            'response validation failed'
        )
    })
})
