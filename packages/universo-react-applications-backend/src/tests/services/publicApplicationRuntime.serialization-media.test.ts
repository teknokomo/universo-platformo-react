import { PublicMarketingMaterializationError, serializePublicMarketingRuntime } from '../../services/publicMarketingRuntime'

const applicationId = '0190a9b5-3cde-7abc-8def-0123456789ab'

describe('public marketing runtime serialization', () => {
    it('keeps every benefit of the included pricing tiers when maxItems bounds only the tiers', () => {
        const layoutId = '019ccefc-2f7b-7b36-82f4-85cdb1312287'
        const tiers = ['pre-seed', 'seed', 'growth'] as const
        const tierRows = tiers.map((key, index) => ({
            id: `019ccefc-2f7b-7b36-82f4-85cdb13122${90 + index}`,
            codename: key,
            TierKey: key,
            Title: { en: key },
            Price: index + 1,
            Period: { en: 'stage' },
            Featured: false,
            SortOrder: index + 1,
            IsVisible: true
        }))
        const benefitRows = tiers.flatMap((key, tierIndex) =>
            Array.from({ length: 5 }, (_unused, benefitIndex) => ({
                id: `019ccefc-2f7b-7b36-82f4-85cdb13123${tierIndex}${benefitIndex}`,
                codename: `${key}-benefit-${benefitIndex + 1}`,
                BenefitKey: `${key}-benefit-${benefitIndex + 1}`,
                TierRef: `019ccefc-2f7b-7b36-82f4-85cdb13122${90 + tierIndex}`,
                Label: { en: `${key} benefit ${benefitIndex + 1}` },
                SortOrder: benefitIndex + 1,
                IsVisible: true
            }))
        )
        const rows = new Map<string, readonly Record<string, unknown>[]>([
            [
                'MarketingPageSiteSettings',
                [
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312286',
                        codename: 'site-settings',
                        BrandName: { en: 'Public brand' },
                        HeroTitle: { en: 'Public title' },
                        HeroSubtitle: { en: 'Public subtitle' },
                        IsVisible: true
                    }
                ]
            ],
            ['MarketingPagePricing', tierRows],
            ['MarketingPagePricingBenefit', benefitRows]
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
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312285',
                        zone: 'marketing-main',
                        semanticRegion: 'main',
                        widgetKey: 'marketing.pricing',
                        sortOrder: 1,
                        config: {
                            instanceKey: 'pricing',
                            source: { entityCodename: 'MarketingPagePricing', entityKind: 'object' },
                            maxItems: 3,
                            showBenefits: true,
                            cardStyle: 'uniform',
                            cardWidth: 'auto'
                        },
                        isActive: true,
                        version: 1
                    }
                ],
                precedence: [],
                publicationIdentity: null,
                effectiveHash: 'b'.repeat(64)
            } as never
        })

        const pricing = payload.marketingPage.widgets.find((widget) => widget.widgetKey === 'marketing.pricing')
        const records = (pricing?.data as { records: Array<Record<string, unknown>> } | undefined)?.records ?? []
        const tierRecords = records.filter((record) => record.kind === 'pricingTier')
        const benefitRecords = records.filter((record) => record.kind === 'pricingBenefit')
        expect(tierRecords).toHaveLength(3)
        expect(benefitRecords).toHaveLength(15)
        for (const tier of tierRecords) {
            expect((tier.benefits as unknown[]).length).toBe(5)
            expect((tier.benefitKeys as unknown[]).length).toBe(5)
        }
    })

    it('skips records that miss a mapped field and only fails when the whole collection is unusable', () => {
        const layoutId = '019ccefc-2f7b-7b36-82f4-85cdb1312257'
        const featureRows = [
            {
                id: '019ccefc-2f7b-7b36-82f4-85cdb1312258',
                codename: 'complete-feature',
                FeatureKey: 'complete-feature',
                Title: { en: 'Complete feature' },
                Description: { en: 'Mapped description' },
                IsVisible: true
            },
            {
                id: '019ccefc-2f7b-7b36-82f4-85cdb1312259',
                codename: 'incomplete-feature',
                FeatureKey: 'incomplete-feature',
                Title: { en: 'Incomplete feature' },
                IsVisible: true
            }
        ]
        const rows = new Map<string, readonly Record<string, unknown>[]>([
            [
                'MarketingPageSiteSettings',
                [
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312256',
                        codename: 'site-settings',
                        BrandName: { en: 'Public brand' },
                        HeroTitle: { en: 'Public title' },
                        HeroSubtitle: { en: 'Public subtitle' },
                        IsVisible: true
                    }
                ]
            ],
            ['MarketingPageFeature', featureRows]
        ])
        const effectiveLayout = () =>
            ({
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
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312255',
                        zone: 'marketing-main',
                        semanticRegion: 'main',
                        widgetKey: 'marketing.collection',
                        sortOrder: 1,
                        config: {
                            instanceKey: 'features',
                            variant: 'features',
                            source: { entityCodename: 'MarketingPageFeature', entityKind: 'object', fieldMap: { title: 'description' } },
                            maxItems: 10
                        },
                        isActive: true,
                        version: 1
                    }
                ],
                precedence: [],
                publicationIdentity: null,
                effectiveHash: 'd'.repeat(64)
            } as never)

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
            effectiveLayout: effectiveLayout()
        })
        const features = payload.marketingPage.widgets.find((widget) => widget.widgetKey === 'marketing.collection')
        const rendered = (features?.data as { records: Array<Record<string, unknown>> } | undefined)?.records ?? []
        expect(rendered).toHaveLength(1)
        expect(rendered[0]).toMatchObject({ title: { en: 'Mapped description' } })

        // When no record can satisfy the map the collection fails closed.
        const incompleteOnly = new Map<string, readonly Record<string, unknown>[]>([
            ['MarketingPageSiteSettings', rows.get('MarketingPageSiteSettings') ?? []],
            ['MarketingPageFeature', [featureRows[1]]]
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
                rows: incompleteOnly,
                effectiveLayout: effectiveLayout()
            })
        ).toThrow(PublicMarketingMaterializationError)
    })

    it('applies the layout brand name and logo overrides to the public site settings record', () => {
        const layoutId = '019ccefc-2f7b-7b36-82f4-85cdb1312267'
        const rows = new Map<string, readonly Record<string, unknown>[]>([
            [
                'MarketingPageSiteSettings',
                [
                    {
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312266',
                        codename: 'site-settings',
                        BrandName: { en: 'Record brand' },
                        HeroTitle: { en: 'Public title' },
                        HeroSubtitle: { en: 'Public subtitle' },
                        BrandLogo: null,
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
                        id: '019ccefc-2f7b-7b36-82f4-85cdb1312265',
                        zone: 'marketing-header',
                        semanticRegion: 'header',
                        widgetKey: 'marketing.brand',
                        sortOrder: 0,
                        config: {
                            instanceKey: 'brand',
                            source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object', recordKey: 'site-settings' },
                            brandName: 'Configured brand',
                            brandLogo: {
                                kind: 'logo',
                                resource: { type: 'url', url: 'https://example.test/brand.webp', launchMode: 'inline' },
                                decorative: true
                            }
                        },
                        isActive: true,
                        version: 1
                    }
                ],
                precedence: [],
                publicationIdentity: null,
                effectiveHash: 'c'.repeat(64)
            } as never
        })

        const brand = payload.marketingPage.widgets.find((widget) => widget.widgetKey === 'marketing.brand')
        const record = (brand?.data as { records: Array<Record<string, unknown>> } | undefined)?.records[0]
        expect(record).toMatchObject({
            kind: 'siteSettings',
            brandName: { en: 'Configured brand', ru: 'Configured brand' },
            brandLogo: { kind: 'logo', decorative: true, resource: { url: 'https://example.test/brand.webp' } }
        })
    })

    it('never dereferences media URLs while serializing the anonymous runtime', () => {
        const layoutId = '019ccefc-2f7b-7b36-82f4-85cdb1312247'
        const fetchSpy = jest.spyOn(globalThis, 'fetch' as never).mockImplementation((() => {
            throw new Error('SSRF: serialization must not fetch remote URLs')
        }) as never)
        try {
            const rows = new Map<string, readonly Record<string, unknown>[]>([
                [
                    'MarketingPageSiteSettings',
                    [
                        {
                            id: '019ccefc-2f7b-7b36-82f4-85cdb1312246',
                            codename: 'site-settings',
                            BrandName: { en: 'Public brand' },
                            BrandLogo: {
                                resource: { type: 'url', url: 'https://attacker.test/track.png', launchMode: 'inline' },
                                decorative: true
                            },
                            HeroTitle: { en: 'Public title' },
                            HeroSubtitle: { en: 'Public subtitle' },
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
                            id: '019ccefc-2f7b-7b36-82f4-85cdb1312245',
                            zone: 'marketing-header',
                            semanticRegion: 'header',
                            widgetKey: 'marketing.brand',
                            sortOrder: 0,
                            config: {
                                instanceKey: 'brand',
                                source: {
                                    entityCodename: 'MarketingPageSiteSettings',
                                    entityKind: 'object',
                                    recordKey: 'site-settings'
                                }
                            },
                            isActive: true,
                            version: 1
                        }
                    ],
                    precedence: [],
                    publicationIdentity: null,
                    effectiveHash: 'e'.repeat(64)
                } as never
            })

            expect(fetchSpy).not.toHaveBeenCalled()
            const brand = payload.marketingPage.widgets.find((widget) => widget.widgetKey === 'marketing.brand')
            const record = (brand?.data as { records: Array<Record<string, unknown>> } | undefined)?.records[0]
            expect(record?.brandLogo).toMatchObject({ resource: { url: 'https://attacker.test/track.png' } })
        } finally {
            fetchSpy.mockRestore()
        }
    })

    it('drops remote plain-HTTP media at the public boundary while keeping HTTPS media', () => {
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
            ]
        ])

        const buildWidget = (url: string) => ({
            id: '019ccefc-2f7b-7b36-82f4-85cdb1312274',
            zone: 'marketing-main',
            semanticRegion: 'main',
            widgetKey: 'marketing.image',
            sortOrder: 1,
            config: {
                instanceKey: 'hero-image',
                media: {
                    kind: 'hero',
                    resource: { type: 'url', url, launchMode: 'inline' },
                    alt: { en: 'Alt' },
                    decorative: false
                }
            },
            isActive: true,
            version: 1
        })

        const httpsPayload = serializePublicMarketingRuntime({
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
                widgets: [buildWidget('https://example.com/image.png')],
                precedence: [],
                publicationIdentity: null,
                effectiveHash: 'a'.repeat(64)
            } as never
        })

        expect(httpsPayload.marketingPage.widgets[0]?.config.media?.resource.url).toBe('https://example.com/image.png')

        // A persisted plain-HTTP remote URL must not cross the anonymous
        // boundary: the active image widget is a required-media surface, so the
        // serializer fails closed into the shared unavailable outcome instead
        // of rendering insecure media.
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
                    widgets: [buildWidget('http://insecure.example.com/image.png')],
                    precedence: [],
                    publicationIdentity: null,
                    effectiveHash: 'a'.repeat(64)
                } as never
            })
        ).toThrow(PublicMarketingMaterializationError)
    })
})
