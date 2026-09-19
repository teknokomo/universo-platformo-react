import type { DbExecutor } from '@universo-react/utils'
import { MARKETING_DEFAULT_IMAGE_URL, MARKETING_SOURCE_FIELD_KEYS } from '@universo-react/types'
import {
    PUBLIC_MARKETING_RECORD_FIELDS,
    PublicMarketingMaterializationError,
    serializePublicMarketingRuntime
} from '../../services/publicMarketingRuntime'
import {
    classifyPublicApplicationReadiness,
    parsePublicApplicationRef,
    PublicApplicationUnavailableError,
    resolvePublicApplication,
    type PublicRuntimeApplicationRow
} from '../../services/publicApplicationRuntime'

const applicationId = '0190a9b5-3cde-7abc-8def-0123456789ab'
const publicationId = '0190a9b5-3cde-7abc-8def-0123456789ac'
const publicationVersionId = '0190a9b5-3cde-7abc-8def-0123456789ad'

const readyApplication = (overrides: Partial<PublicRuntimeApplicationRow> = {}): PublicRuntimeApplicationRow => ({
    id: applicationId,
    schemaName: 'app_0190a9b53cde7abc8def0123456789ab',
    schemaStatus: 'synced',
    isPublic: true,
    workspacesEnabled: false,
    aliasRoutingMode: 'direct',
    installedReleaseMetadata: {
        kind: 'application_release_installation',
        bundleVersion: 1,
        sourceKind: 'publication',
        snapshotHash: 'a'.repeat(64),
        publicationId,
        publicationVersionId
    },
    lastSyncedPublicationVersionId: publicationVersionId,
    uplArchived: false,
    uplDeleted: false,
    appPublished: true,
    appArchived: false,
    appDeleted: false,
    hasActiveAlias: false,
    matchedAlias: null,
    primaryAlias: null,
    ...overrides
})

describe('public application runtime readiness', () => {
    it.each(['synced', 'outdated', 'update_available'])('accepts %s only with a coherent installed materialization', (schemaStatus) => {
        expect(classifyPublicApplicationReadiness(readyApplication({ schemaStatus }))).toEqual({ ready: true })
        expect(
            classifyPublicApplicationReadiness(
                readyApplication({ schemaStatus, installedReleaseMetadata: null, lastSyncedPublicationVersionId: null })
            )
        ).toEqual({ ready: false, reason: 'materialization_invalid' })
    })

    it.each(['draft', 'pending', 'maintenance', 'error', null])('fails closed for schema status %s', (schemaStatus) => {
        expect(classifyPublicApplicationReadiness(readyApplication({ schemaStatus }))).toEqual({
            ready: false,
            reason: 'schema_status_unavailable'
        })
    })

    it.each([
        ['upl deleted', { uplDeleted: true }, 'application_deleted'],
        ['app deleted', { appDeleted: true }, 'application_deleted'],
        ['upl archived', { uplArchived: true }, 'application_archived'],
        ['app archived', { appArchived: true }, 'application_archived'],
        ['private', { isPublic: false }, 'application_private'],
        ['unpublished', { appPublished: false }, 'application_unpublished'],
        ['missing schema', { schemaName: null }, 'schema_invalid']
    ] as const)('rejects %s applications', (_label, overrides, reason) => {
        expect(classifyPublicApplicationReadiness(readyApplication(overrides))).toEqual({ ready: false, reason })
    })

    it('rejects inconsistent publication lineage', () => {
        expect(
            classifyPublicApplicationReadiness(readyApplication({ lastSyncedPublicationVersionId: '0190a9b5-3cde-7abc-8def-0123456789ae' }))
        ).toEqual({ ready: false, reason: 'materialization_invalid' })
    })
})

describe('public application reference parsing and routing', () => {
    it('accepts canonical UUID v7 and lowercase aliases only', () => {
        expect(parsePublicApplicationRef(applicationId)).toEqual({ kind: 'uuid', value: applicationId })
        expect(parsePublicApplicationRef('seventy-third-meridian')).toEqual({ kind: 'alias', value: 'seventy-third-meridian' })

        for (const invalid of ['Seventy-Third-Meridian', ' alias', 'alias ', 'admin', 'bad/alias', 'bad%2Falias', 'a'.repeat(64)]) {
            expect(() => parsePublicApplicationRef(invalid)).toThrow(PublicApplicationUnavailableError)
        }
    })

    it('does not touch the database for malformed references', async () => {
        const query = jest.fn()
        const executor = { query } as unknown as DbExecutor

        await expect(resolvePublicApplication(executor, 'bad%2Falias')).rejects.toBeInstanceOf(PublicApplicationUnavailableError)
        expect(query).not.toHaveBeenCalled()
    })

    it('canonicalizes a secondary alias to the current primary alias', async () => {
        const query = jest.fn().mockResolvedValue([
            readyApplication({
                aliasRoutingMode: 'canonical',
                hasActiveAlias: true,
                matchedAlias: 'om73',
                primaryAlias: '73rd-meridian'
            })
        ])
        const executor = { query } as unknown as DbExecutor

        const resolved = await resolvePublicApplication(executor, 'om73')
        const [sql, params] = query.mock.calls[0]
        expect(sql).toContain('AND aa._upl_archived = false')
        expect(sql).toContain('AND aa._app_archived = false')
        expect(params).toEqual(['om73'])
        expect(resolved.route).toEqual({
            applicationId,
            matchedBy: 'alias',
            matchedAlias: 'om73',
            routingMode: 'canonical',
            primaryAlias: '73rd-meridian',
            canonicalAlias: '73rd-meridian'
        })
    })

    it('keeps UUID routes stable in canonical mode', async () => {
        const query = jest.fn().mockResolvedValue([
            readyApplication({
                aliasRoutingMode: 'canonical',
                hasActiveAlias: true,
                primaryAlias: '73rd-meridian'
            })
        ])
        const executor = { query } as unknown as DbExecutor

        const resolved = await resolvePublicApplication(executor, applicationId)
        expect(resolved.route.matchedBy).toBe('uuid')
        expect(resolved.route.primaryAlias).toBe('73rd-meridian')
        expect(resolved.route.canonicalAlias).toBeNull()
    })

    it('fails closed when canonical mode has aliases but no primary', async () => {
        const query = jest.fn().mockResolvedValue([
            readyApplication({
                aliasRoutingMode: 'canonical',
                hasActiveAlias: true,
                matchedAlias: 'om73',
                primaryAlias: null
            })
        ])
        const executor = { query } as unknown as DbExecutor

        await expect(resolvePublicApplication(executor, 'om73')).rejects.toMatchObject({ reason: 'primary_alias_invalid' })
    })

    it('fails closed with the unavailable outcome when persisted route data violates the shared route schema', async () => {
        // A persisted alias that bypassed the shared validation contract (for
        // example a reserved route word) must never escape as a ZodError/503;
        // the anonymous boundary maps it to the single unavailable outcome.
        const query = jest.fn().mockResolvedValue([
            readyApplication({
                aliasRoutingMode: 'direct',
                hasActiveAlias: true,
                primaryAlias: 'api'
            })
        ])
        const executor = { query } as unknown as DbExecutor

        await expect(resolvePublicApplication(executor, applicationId)).rejects.toMatchObject({ reason: 'routing_policy_invalid' })
    })
})

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
