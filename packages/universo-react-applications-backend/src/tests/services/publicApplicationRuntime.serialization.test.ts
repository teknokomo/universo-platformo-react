import { MARKETING_DEFAULT_IMAGE_URL, MARKETING_SOURCE_FIELD_KEYS } from '@universo-react/types'
import { PUBLIC_MARKETING_RECORD_FIELDS, serializePublicMarketingRuntime } from '../../services/publicMarketingRuntime'

const applicationId = '0190a9b5-3cde-7abc-8def-0123456789ab'

describe('public marketing runtime serialization', () => {
    it('serializes an independent public DTO without forwarding internal row fields', () => {
        const rowId = '019ccefc-2f7b-7b36-82f4-85cdb1312272'
        const layoutId = '019ccefc-2f7b-7b36-82f4-85cdb1312273'
        const rows = new Map([
            [
                'MarketingPageSiteSettings',
                [
                    {
                        id: rowId,
                        codename: 'site-settings',
                        BrandName: { en: 'Public brand' },
                        HeroTitle: { en: 'Public title' },
                        HeroSubtitle: { en: 'Public subtitle' },
                        IsVisible: true,
                        secret: 'must-not-cross-boundary'
                    }
                ]
            ]
        ])

        const payload = serializePublicMarketingRuntime({
            route: {
                applicationId,
                matchedBy: 'uuid',
                matchedAlias: null,
                routingMode: 'direct',
                primaryAlias: null,
                canonicalAlias: null
            },
            locale: 'en',
            rows,
            effectiveLayout: {
                status: 'ok',
                target: { applicationId, locale: 'en' },
                resolvedEntityTypeId: null,
                scope: 'global',
                layout: {
                    id: layoutId,
                    scopeKind: 'global',
                    scopeEntityId: null,
                    templateKey: 'marketing-page',
                    sourceKind: 'authored',
                    sourceLayoutId: null,
                    sourceSnapshotHash: null,
                    sourceContentHash: null,
                    localContentHash: null,
                    syncState: 'synced',
                    name: {},
                    description: null,
                    config: { themeMode: 'system' },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0,
                    version: 1
                },
                widgets: [
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312274',
                        zone: 'marketing-header',
                        semanticRegion: 'header',
                        widgetKey: 'marketing.auth',
                        sortOrder: 0,
                        config: { instanceKey: 'auth', showAuthActions: true },
                        isActive: true,
                        version: 1
                    },
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312275',
                        zone: 'marketing-main',
                        semanticRegion: 'main',
                        widgetKey: 'marketing.image',
                        sortOrder: 1,
                        config: {
                            instanceKey: 'hero-image',
                            media: {
                                kind: 'hero',
                                resource: { type: 'url', url: MARKETING_DEFAULT_IMAGE_URL, launchMode: 'inline' },
                                alt: { en: 'Material UI dashboard preview' },
                                decorative: false
                            }
                        },
                        isActive: true,
                        version: 1
                    }
                ],
                precedence: [],
                publicationIdentity: null,
                effectiveHash: 'a'.repeat(64)
            } as never
        })

        expect(payload.route).not.toHaveProperty('applicationId')
        expect(JSON.stringify(payload)).not.toContain(rowId)
        expect(JSON.stringify(payload)).not.toContain('must-not-cross-boundary')
        expect(payload.marketingPage.widgets[0]).toMatchObject({ widgetKey: 'marketing.auth' })
        expect(payload.marketingPage.widgets[1]).toMatchObject({
            widgetKey: 'marketing.image',
            config: {
                media: {
                    resource: { url: MARKETING_DEFAULT_IMAGE_URL },
                    alt: { en: 'Material UI dashboard preview' },
                    decorative: false
                }
            }
        })
    })

    it('keeps the public marketing field allowlist aligned with the authoring source fields', () => {
        const authoringFields = new Set(Object.values(MARKETING_SOURCE_FIELD_KEYS).flat())
        const undeclared = [...PUBLIC_MARKETING_RECORD_FIELDS].filter((field) => field !== 'semanticKey' && !authoringFields.has(field))

        expect(undeclared).toEqual([])
    })

    it('projects active header layout rows, excluding disabled ones, with the language switcher', () => {
        const layoutId = '019ccefc-2f7b-7b36-82f4-85cdb1312281'
        const rows = new Map<string, readonly Record<string, unknown>[]>([
            [
                'MarketingPageSiteSettings',
                [
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312282',
                        codename: 'site-settings',
                        BrandName: { en: 'Public brand' },
                        HeroTitle: { en: 'Public title' },
                        HeroSubtitle: { en: 'Public subtitle' },
                        IsVisible: true
                    }
                ]
            ],
            [
                'MarketingPageNavigation',
                [
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312283',
                        codename: 'about',
                        NavKey: 'about',
                        Label: { en: 'About' },
                        Href: '#hero',
                        SortOrder: 1,
                        IsVisible: true
                    }
                ]
            ]
        ])
        const headerWidget = (
            widgetKey: string,
            instanceKey: string | undefined,
            sortOrder: number,
            isActive = true,
            extraConfig: Record<string, unknown> = {}
        ) => ({
            id: `019ccefc-2f7b-7b36-82f4-85cdb13122${80 + sortOrder}`,
            zone: 'marketing-header',
            semanticRegion: 'header',
            widgetKey,
            sortOrder,
            config: { ...(instanceKey ? { instanceKey } : {}), ...extraConfig },
            isActive,
            version: 1
        })

        const payload = serializePublicMarketingRuntime({
            route: {
                applicationId,
                matchedBy: 'uuid',
                matchedAlias: null,
                routingMode: 'direct',
                primaryAlias: null,
                canonicalAlias: null
            },
            locale: 'en',
            rows,
            effectiveLayout: {
                status: 'ok',
                target: { applicationId, locale: 'en' },
                resolvedEntityTypeId: null,
                scope: 'global',
                layout: {
                    id: layoutId,
                    scopeKind: 'global',
                    scopeEntityId: null,
                    templateKey: 'marketing-page',
                    sourceKind: 'authored',
                    sourceLayoutId: null,
                    sourceSnapshotHash: null,
                    sourceContentHash: null,
                    localContentHash: null,
                    syncState: 'synced',
                    name: {},
                    description: null,
                    config: { themeMode: 'system' },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0,
                    version: 1
                },
                widgets: [
                    headerWidget('marketing.brand', 'brand', 0, true, {
                        source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object' }
                    }),
                    headerWidget('marketing.navigation', 'navigation', 1, true, {
                        source: { entityCodename: 'MarketingPageNavigation', entityKind: 'object' }
                    }),
                    headerWidget('marketing.auth', 'auth', 2, true, { showAuthActions: false }),
                    { ...headerWidget('languageSwitcher', undefined, 3), placement: 'start' },
                    headerWidget('colorModeSwitcher', undefined, 4, false)
                ],
                precedence: [],
                publicationIdentity: null,
                effectiveHash: 'a'.repeat(64)
            } as never
        })

        const headerWidgets = payload.marketingPage.headerWidgets ?? []
        const headerKeys = headerWidgets.map((widget) => widget.widgetKey)
        expect(headerKeys).toEqual(['marketing.brand', 'marketing.navigation', 'marketing.auth', 'languageSwitcher'])
        expect(headerKeys).not.toContain('colorModeSwitcher')

        const languageSwitcher = headerWidgets.find((widget) => widget.widgetKey === 'languageSwitcher')
        expect(languageSwitcher).toMatchObject({ isActive: true, zone: 'marketing-header', placement: 'start' })
        const brandHeader = headerWidgets.find((widget) => widget.widgetKey === 'marketing.brand')
        expect(brandHeader).not.toHaveProperty('placement')

        const auth = payload.marketingPage.widgets.find((widget) => widget.widgetKey === 'marketing.auth')
        const authHeader = headerWidgets.find((widget) => widget.widgetKey === 'marketing.auth')
        expect(authHeader?.instanceKey).toBe(auth?.instanceKey)
        expect(payload.marketingPage.widgets.map((widget) => widget.widgetKey)).not.toContain('languageSwitcher')
    })

    it('keeps semantic widget instance keys and replaces opaque UUID identities with synthetic keys', () => {
        const layoutId = '019ccefc-2f7b-7b36-82f4-85cdb1312273'
        const opaqueInstanceKey = '019ccefc-2f7b-7b36-82f4-85cdb1312288'
        const rows = new Map<string, readonly Record<string, unknown>[]>([
            [
                'MarketingPageSiteSettings',
                [
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312272',
                        codename: 'site-settings',
                        BrandName: { en: 'Public brand' },
                        HeroTitle: { en: 'Public title' },
                        HeroSubtitle: { en: 'Public subtitle' },
                        IsVisible: true
                    }
                ]
            ]
        ])

        const buildImageWidget = (instanceKey: string, sortOrder: number) => ({
            id: '019ccefc-2f7b-7b36-82f4-85cdb1312274',
            zone: 'marketing-main',
            semanticRegion: 'main',
            widgetKey: 'marketing.image',
            sortOrder,
            config: {
                instanceKey,
                media: {
                    kind: 'hero',
                    resource: { type: 'url', url: 'https://example.com/image.png', launchMode: 'inline' },
                    alt: { en: 'Alt' },
                    decorative: false
                }
            },
            isActive: true,
            version: 1
        })

        const payload = serializePublicMarketingRuntime({
            route: {
                applicationId,
                matchedBy: 'uuid',
                matchedAlias: null,
                routingMode: 'direct',
                primaryAlias: null,
                canonicalAlias: null
            },
            locale: 'en',
            rows,
            effectiveLayout: {
                status: 'ok',
                target: { applicationId, locale: 'en' },
                resolvedEntityTypeId: null,
                scope: 'global',
                layout: {
                    id: layoutId,
                    scopeKind: 'global',
                    scopeEntityId: null,
                    templateKey: 'marketing-page',
                    sourceKind: 'authored',
                    sourceLayoutId: null,
                    sourceSnapshotHash: null,
                    sourceContentHash: null,
                    localContentHash: null,
                    syncState: 'synced',
                    name: {},
                    description: null,
                    config: { themeMode: 'system' },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0,
                    version: 1
                },
                widgets: [buildImageWidget('hero-image', 1), buildImageWidget(opaqueInstanceKey, 2)],
                precedence: [],
                publicationIdentity: null,
                effectiveHash: 'a'.repeat(64)
            } as never
        })

        expect(payload.marketingPage.widgets[0]).toMatchObject({ instanceKey: 'hero-image' })
        // Opaque identifiers never cross the anonymous boundary.
        expect(payload.marketingPage.widgets[1]?.instanceKey).toMatch(/^marketing-image-[0-9]+$/u)
        expect(JSON.stringify(payload)).not.toContain(opaqueInstanceKey)
    })

    it('resolves recordKey-filtered collection items by their own key components', () => {
        const layoutId = '019ccefc-2f7b-7b36-82f4-85cdb1312273'
        const thisRunAppId = applicationId
        const rows = new Map<string, readonly Record<string, unknown>[]>([
            [
                'MarketingPageSiteSettings',
                [
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312272',
                        codename: 'site-settings',
                        BrandName: { en: 'Public brand' },
                        HeroTitle: { en: 'Public title' },
                        HeroSubtitle: { en: 'Public subtitle' },
                        IsVisible: true
                    }
                ]
            ],
            [
                'MarketingPageHighlight',
                [
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312290',
                        HighlightKey: 'stage-pre-seed',
                        Title: { en: 'Project development stages · Pre-seed' },
                        Description: { en: '30–90m RUB' },
                        SortOrder: 1,
                        IsVisible: true
                    },
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312291',
                        HighlightKey: 'stage-seed',
                        Title: { en: 'Project development stages · Seed' },
                        Description: { en: '150–500m RUB' },
                        SortOrder: 2,
                        IsVisible: true
                    }
                ]
            ]
        ])

        const payload = serializePublicMarketingRuntime({
            route: {
                applicationId: thisRunAppId,
                matchedBy: 'uuid',
                matchedAlias: null,
                routingMode: 'direct',
                primaryAlias: null,
                canonicalAlias: null
            },
            locale: 'en',
            rows,
            effectiveLayout: {
                status: 'ok',
                target: { applicationId: thisRunAppId, locale: 'en' },
                resolvedEntityTypeId: null,
                scope: 'global',
                layout: {
                    id: layoutId,
                    scopeKind: 'global',
                    scopeEntityId: null,
                    templateKey: 'marketing-page',
                    sourceKind: 'authored',
                    sourceLayoutId: null,
                    sourceSnapshotHash: null,
                    sourceContentHash: null,
                    localContentHash: null,
                    syncState: 'synced',
                    name: {},
                    description: null,
                    config: { themeMode: 'system' },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0,
                    version: 1
                },
                widgets: [
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312292',
                        zone: 'marketing-main',
                        semanticRegion: 'main',
                        widgetKey: 'marketing.collection',
                        sortOrder: 1,
                        config: {
                            instanceKey: 'development-stage-pre-seed',
                            variant: 'highlights',
                            source: {
                                entityCodename: 'MarketingPageHighlight',
                                entityKind: 'object',
                                recordKey: 'stage-pre-seed'
                            }
                        },
                        isActive: true,
                        version: 1
                    }
                ],
                precedence: [],
                publicationIdentity: null,
                effectiveHash: 'a'.repeat(64)
            } as never
        })

        const collection = payload.marketingPage.widgets[0] as { data: { records: Array<Record<string, unknown>> } }
        const highlights = collection.data.records.filter((record) => record.kind === 'highlight')
        expect(highlights).toHaveLength(1)
        expect(highlights[0]).toMatchObject({
            kind: 'highlight',
            semanticKey: 'stage-pre-seed',
            title: { en: 'Project development stages · Pre-seed' }
        })
    })

    it('fails closed when a collection recordKey matches no published record', () => {
        const layoutId = '019ccefc-2f7b-7b36-82f4-85cdb1312273'
        const rows = new Map<string, readonly Record<string, unknown>[]>([
            [
                'MarketingPageSiteSettings',
                [
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312272',
                        codename: 'site-settings',
                        BrandName: { en: 'Public brand' },
                        HeroTitle: { en: 'Public title' },
                        HeroSubtitle: { en: 'Public subtitle' },
                        IsVisible: true
                    }
                ]
            ],
            [
                'MarketingPageHighlight',
                [
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312290',
                        HighlightKey: 'stage-pre-seed',
                        Title: { en: 'Project development stages · Pre-seed' },
                        Description: { en: '30–90m RUB' },
                        SortOrder: 1,
                        IsVisible: true
                    }
                ]
            ]
        ])

        expect(() =>
            serializePublicMarketingRuntime({
                route: {
                    applicationId,
                    matchedBy: 'uuid',
                    matchedAlias: null,
                    routingMode: 'direct',
                    primaryAlias: null,
                    canonicalAlias: null
                },
                locale: 'en',
                rows,
                effectiveLayout: {
                    status: 'ok',
                    target: { applicationId, locale: 'en' },
                    resolvedEntityTypeId: null,
                    scope: 'global',
                    layout: {
                        id: layoutId,
                        scopeKind: 'global',
                        scopeEntityId: null,
                        templateKey: 'marketing-page',
                        sourceKind: 'authored',
                        sourceLayoutId: null,
                        sourceSnapshotHash: null,
                        sourceContentHash: null,
                        localContentHash: null,
                        syncState: 'synced',
                        name: {},
                        description: null,
                        config: { themeMode: 'system' },
                        isActive: true,
                        isDefault: true,
                        sortOrder: 0,
                        version: 1
                    },
                    widgets: [
                        {
                            id: '019ccefc-2f7b-7b36-82f4-85cdb1312292',
                            zone: 'marketing-main',
                            semanticRegion: 'main',
                            widgetKey: 'marketing.collection',
                            sortOrder: 1,
                            config: {
                                instanceKey: 'development-stage-pre-seed',
                                variant: 'highlights',
                                source: {
                                    entityCodename: 'MarketingPageHighlight',
                                    entityKind: 'object',
                                    recordKey: 'stage-missing'
                                }
                            },
                            isActive: true,
                            version: 1
                        }
                    ],
                    precedence: [],
                    publicationIdentity: null,
                    effectiveHash: 'a'.repeat(64)
                } as never
            })
        ).toThrow('Public marketing widget source is unavailable')
    })

    it('re-keys colliding public widget instance keys instead of failing the runtime', () => {
        const layoutId = '019ccefc-2f7b-7b36-82f4-85cdb1312273'
        const opaqueInstanceKey = '019ccefc-2f7b-7b36-82f4-85cdb1312288'
        const rows = new Map<string, readonly Record<string, unknown>[]>([
            [
                'MarketingPageSiteSettings',
                [
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312272',
                        codename: 'site-settings',
                        BrandName: { en: 'Public brand' },
                        HeroTitle: { en: 'Public title' },
                        HeroSubtitle: { en: 'Public subtitle' },
                        IsVisible: true
                    }
                ]
            ]
        ])

        const buildImageWidget = (instanceKey: string, sortOrder: number) => ({
            id: '019ccefc-2f7b-7b36-82f4-85cdb1312274',
            zone: 'marketing-main',
            semanticRegion: 'main',
            widgetKey: 'marketing.image',
            sortOrder,
            config: {
                instanceKey,
                media: {
                    kind: 'hero',
                    resource: { type: 'url', url: 'https://example.com/image.png', launchMode: 'inline' },
                    alt: { en: 'Alt' },
                    decorative: false
                }
            },
            isActive: true,
            version: 1
        })

        const payload = serializePublicMarketingRuntime({
            route: {
                applicationId,
                matchedBy: 'uuid',
                matchedAlias: null,
                routingMode: 'direct',
                primaryAlias: null,
                canonicalAlias: null
            },
            locale: 'en',
            rows,
            effectiveLayout: {
                status: 'ok',
                target: { applicationId, locale: 'en' },
                resolvedEntityTypeId: null,
                scope: 'global',
                layout: {
                    id: layoutId,
                    scopeKind: 'global',
                    scopeEntityId: null,
                    templateKey: 'marketing-page',
                    sourceKind: 'authored',
                    sourceLayoutId: null,
                    sourceSnapshotHash: null,
                    sourceContentHash: null,
                    localContentHash: null,
                    syncState: 'synced',
                    name: {},
                    description: null,
                    config: { themeMode: 'system' },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0,
                    version: 1
                },
                // The persisted key intentionally matches the synthetic identity
                // shape of the second widget.
                widgets: [buildImageWidget('marketing-image-1', 1), buildImageWidget(opaqueInstanceKey, 2)],
                precedence: [],
                publicationIdentity: null,
                effectiveHash: 'a'.repeat(64)
            } as never
        })

        const instanceKeys = payload.marketingPage.widgets.map((widget) => widget.instanceKey)
        expect(instanceKeys[0]).toBe('marketing-image-1')
        expect(instanceKeys[1]).toMatch(/^marketing-image-[0-9]+$/u)
        expect(new Set(instanceKeys).size).toBe(instanceKeys.length)
    })

    it('keeps text-only partner logo records at the public boundary instead of dropping them', () => {
        const layoutId = '019ccefc-2f7b-7b36-82f4-85cdb1312273'
        const rows = new Map<string, readonly Record<string, unknown>[]>([
            [
                'MarketingPageSiteSettings',
                [
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312272',
                        codename: 'site-settings',
                        BrandName: { en: 'Public brand' },
                        HeroTitle: { en: 'Public title' },
                        HeroSubtitle: { en: 'Public subtitle' },
                        IsVisible: true
                    }
                ]
            ],
            [
                'MarketingPageLogo',
                [
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312290',
                        codename: 'dev-institutions',
                        LogoKey: 'development-institutions',
                        AltText: { en: 'Development institutions' },
                        ImageLight: null,
                        ImageDark: null,
                        IsVisible: true
                    }
                ]
            ]
        ])

        const payload = serializePublicMarketingRuntime({
            route: {
                applicationId,
                matchedBy: 'uuid',
                matchedAlias: null,
                routingMode: 'direct',
                primaryAlias: null,
                canonicalAlias: null
            },
            locale: 'en',
            rows,
            effectiveLayout: {
                status: 'ok',
                target: { applicationId, locale: 'en' },
                resolvedEntityTypeId: null,
                scope: 'global',
                layout: {
                    id: layoutId,
                    scopeKind: 'global',
                    scopeEntityId: null,
                    templateKey: 'marketing-page',
                    sourceKind: 'authored',
                    sourceLayoutId: null,
                    sourceSnapshotHash: null,
                    sourceContentHash: null,
                    localContentHash: null,
                    syncState: 'synced',
                    name: {},
                    description: null,
                    config: { themeMode: 'system' },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0,
                    version: 1
                },
                widgets: [
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312291',
                        zone: 'marketing-main',
                        semanticRegion: 'main',
                        widgetKey: 'marketing.collection',
                        sortOrder: 1,
                        config: {
                            instanceKey: 'logos',
                            variant: 'logos',
                            source: { entityCodename: 'MarketingPageLogo', entityKind: 'object' }
                        },
                        isActive: true,
                        version: 1
                    }
                ],
                precedence: [],
                publicationIdentity: null,
                effectiveHash: 'a'.repeat(64)
            } as never
        })

        const collection = payload.marketingPage.widgets[0] as {
            widgetKey: string
            data: { records: Array<Record<string, unknown>> }
        }
        expect(collection.widgetKey).toBe('marketing.collection')
        const logo = collection.data.records.find((record) => record.kind === 'logo')
        expect(logo).toBeDefined()
        expect(logo).toMatchObject({ kind: 'logo', name: { en: 'Development institutions' } })
        expect(logo).not.toHaveProperty('media')
    })

    it('forwards pricing card style and features display settings to the anonymous runtime', () => {
        const layoutId = '019ccefc-2f7b-7b36-82f4-85cdb1312297'
        const rows = new Map<string, readonly Record<string, unknown>[]>([
            [
                'MarketingPageSiteSettings',
                [
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312296',
                        codename: 'site-settings',
                        BrandName: { en: 'Public brand' },
                        HeroTitle: { en: 'Public title' },
                        HeroSubtitle: { en: 'Public subtitle' },
                        IsVisible: true
                    }
                ]
            ],
            [
                'MarketingPagePricing',
                [
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312298',
                        codename: 'pre-seed',
                        TierKey: 'pre-seed',
                        Title: { en: 'Pre-seed' },
                        Price: '1.00',
                        Period: { en: 'stage' },
                        Featured: false,
                        IsVisible: true
                    }
                ]
            ],
            [
                'MarketingPageFeature',
                [
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312299',
                        codename: 'digital-twins',
                        FeatureKey: 'territorial-digital-twins',
                        Title: { en: 'Digital twins of territories' },
                        Description: { en: 'Interactive models of territories.' },
                        ImageLight: null,
                        ImageDark: null,
                        IsVisible: true
                    }
                ]
            ]
        ])

        const payload = serializePublicMarketingRuntime({
            route: {
                applicationId,
                matchedBy: 'uuid',
                matchedAlias: null,
                routingMode: 'direct',
                primaryAlias: null,
                canonicalAlias: null
            },
            locale: 'en',
            rows,
            effectiveLayout: {
                status: 'ok',
                target: { applicationId, locale: 'en' },
                resolvedEntityTypeId: null,
                scope: 'global',
                layout: {
                    id: layoutId,
                    scopeKind: 'global',
                    scopeEntityId: null,
                    templateKey: 'marketing-page',
                    sourceKind: 'authored',
                    sourceLayoutId: null,
                    sourceSnapshotHash: null,
                    sourceContentHash: null,
                    localContentHash: null,
                    syncState: 'synced',
                    name: {},
                    description: null,
                    config: { themeMode: 'system' },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0,
                    version: 1
                },
                widgets: [
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312295',
                        zone: 'marketing-main',
                        semanticRegion: 'main',
                        widgetKey: 'marketing.pricing',
                        sortOrder: 1,
                        config: {
                            instanceKey: 'pricing',
                            source: { entityCodename: 'MarketingPagePricing', entityKind: 'object' },
                            maxItems: 3,
                            showBenefits: false,
                            cardStyle: 'uniform',
                            cardWidth: 'full'
                        },
                        isActive: true,
                        version: 1
                    },
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312294',
                        zone: 'marketing-main',
                        semanticRegion: 'main',
                        widgetKey: 'marketing.collection',
                        sortOrder: 2,
                        config: {
                            instanceKey: 'features',
                            variant: 'features',
                            source: { entityCodename: 'MarketingPageFeature', entityKind: 'object' },
                            maxItems: 5,
                            showItemDescriptions: false,
                            fixedItemsHeight: true
                        },
                        isActive: true,
                        version: 1
                    }
                ],
                precedence: [],
                publicationIdentity: null,
                effectiveHash: 'a'.repeat(64)
            } as never
        })

        const pricing = payload.marketingPage.widgets.find((widget) => widget.widgetKey === 'marketing.pricing')
        expect(pricing?.config).toMatchObject({ cardStyle: 'uniform', showBenefits: false, cardWidth: 'full' })
        // Scaled NUMERIC text is canonicalized at the API boundary instead of shipping "1.00".
        const tier = (pricing?.data as { records: Array<Record<string, unknown>> } | undefined)?.records.find(
            (record) => record.kind === 'pricingTier'
        )
        expect(tier?.price).toEqual({ en: '1' })
        const features = payload.marketingPage.widgets.find(
            (widget) => widget.widgetKey === 'marketing.collection' && widget.config.variant === 'features'
        )
        expect(features?.config).toMatchObject({ showItemDescriptions: false, fixedItemsHeight: true })
    })
})
