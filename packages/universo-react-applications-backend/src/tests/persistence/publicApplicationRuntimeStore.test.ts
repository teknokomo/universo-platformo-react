import { createMockDbExecutor } from '../utils/dbMocks'
import { loadAllowlistedPublishedMarketingRows } from '../../persistence/publicApplicationRuntimeStore'
import { getLayoutWidgetDefinition } from '@universo-react/types'

const heroMetadata = (objectId: string, codename = 'MarketingPageHero') => ({
    id: objectId,
    kind: 'object',
    codename,
    tableName: 'custom_hero_table',
    config: {
        recordPolicy: {
            version: 1,
            runtimeMutation: 'deny',
            denyDeleteWhenBound: true,
            immutableSemanticKeyWhenBound: true,
            semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['default'] },
            requiredLocales: ['en', 'ru'],
            validatorKey: 'marketing.hero.v1'
        }
    }
})
const heroComponents = (objectId: string) =>
    getLayoutWidgetDefinition('marketing.hero')!.bindingSlots![0]!.requirements.components.map((component, index) => ({
        objectId,
        codename: {
            _schema: '1',
            _primary: 'en',
            locales: { en: { content: component.componentCodename } }
        },
        columnName:
            component.componentCodename === 'HeroKey'
                ? 'cmp_019ccefc2f7b7b3682f485cdb1312277'
                : component.componentCodename === 'Title'
                ? 'cmp_019ccefc2f7b7b3682f485cdb1312278'
                : `cmp_${String(index).padStart(24, '0')}`,
        dataType: component.valueType === 'json' ? 'jsonb' : 'text',
        isRequired: component.required,
        validationRules: {
            ...(component.localized ? { localized: true } : {}),
            ...(component.maxLength !== undefined ? { maxLength: component.maxLength } : {}),
            ...(component.semanticKey ? { unique: true } : {}),
            ...(component.format ? { format: component.format } : {})
        }
    }))

describe('publicApplicationRuntimeStore', () => {
    it('reads only published allowlisted columns without SELECT *', async () => {
        const { executor } = createMockDbExecutor()
        const objectId = '019ccefc-2f7b-7b36-82f4-85cdb1312275'
        const rowId = '019ccefc-2f7b-7b36-82f4-85cdb1312276'
        const physicalBrandName = 'cmp_019ccefc2f7b7b3682f485cdb1312277'
        executor.query
            .mockResolvedValueOnce([{ id: objectId, codename: 'MarketingPageSiteSettings', tableName: 'marketing_site_settings' }])
            .mockResolvedValueOnce([{ objectId, codename: 'BrandName', columnName: physicalBrandName }])
            .mockResolvedValueOnce([{ tableName: 'marketing_site_settings' }])
            .mockResolvedValueOnce([{ id: rowId, codename: 'site-settings', [physicalBrandName]: { en: 'Public brand' } }])

        const rows = await loadAllowlistedPublishedMarketingRows(executor, {
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            workspaceId: null,
            heroTargets: []
        })

        expect(rows.get('MarketingPageSiteSettings')).toEqual([{ id: rowId, BrandName: { en: 'Public brand' } }])
        expect(String(executor.query.mock.calls[3][0])).not.toContain('SELECT *')
        expect(String(executor.query.mock.calls[3][0])).toContain('_app_published = true')
        expect(String(executor.query.mock.calls[3][0])).toContain('workspace_id')
        // The limit is fetched as limit+1 so an over-limit published object
        // fails closed instead of silently truncating public content.
        expect(executor.query.mock.calls[3][1]).toEqual([1001])
    })

    it('loads only registered Hero Entity Components and excludes removed SiteSettings Hero fields', async () => {
        const { executor } = createMockDbExecutor()
        const objectId = '019ccefc-2f7b-7b36-82f4-85cdb1312275'
        const rowId = '019ccefc-2f7b-7b36-82f4-85cdb1312276'
        const keyColumn = 'cmp_019ccefc2f7b7b3682f485cdb1312277'
        const titleColumn = 'cmp_019ccefc2f7b7b3682f485cdb1312278'
        executor.query
            .mockResolvedValueOnce([heroMetadata(objectId)])
            .mockResolvedValueOnce([
                ...heroComponents(objectId),
                { objectId, codename: 'PrivateColumn', columnName: 'cmp_019ccefc2f7b7b3682f485cdb1312279' }
            ])
            .mockResolvedValueOnce([{ tableName: 'marketing_page_hero' }])
            .mockResolvedValueOnce([{ id: rowId, codename: 'hero-default', [keyColumn]: 'hero-default', [titleColumn]: { en: 'Title' } }])

        const rows = await loadAllowlistedPublishedMarketingRows(executor, {
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            workspaceId: null,
            heroTargets: [{ entityCodename: 'MarketingPageHero', semanticKeys: ['hero-default'] }]
        })

        expect(rows.get('MarketingPageHero')).toEqual([{ id: rowId, HeroKey: 'hero-default', Title: { en: 'Title' } }])
        const objectQuery = String(executor.query.mock.calls[0][0])
        expect(executor.query.mock.calls[0][1]?.[0]).toContain('MarketingPageHero')
        expect(objectQuery).toContain('_app_published = true')
        const componentQuery = String(executor.query.mock.calls[1][0])
        expect(componentQuery).toContain('_app_published = true')
        const heroQuery = String(executor.query.mock.calls[3][0])
        expect(heroQuery).toContain(keyColumn)
        expect(heroQuery).toContain(titleColumn)
        expect(heroQuery).toContain('= ANY($1::text[])')
        expect(executor.query.mock.calls[3][1]).toEqual([['hero-default'], 1001])
        expect(heroQuery).not.toContain('cmp_019ccefc2f7b7b3682f485cdb1312279')
        expect(heroQuery).not.toContain('HeroTitle')
    })

    it('does not query unbound Hero rows when no published placement selects a record', async () => {
        const { executor } = createMockDbExecutor()
        const objectId = '019ccefc-2f7b-7b36-82f4-85cdb1312275'
        executor.query
            .mockResolvedValueOnce([heroMetadata(objectId)])
            .mockResolvedValueOnce(heroComponents(objectId))
            .mockResolvedValueOnce([{ tableName: 'marketing_page_hero' }])

        const rows = await loadAllowlistedPublishedMarketingRows(executor, {
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            workspaceId: null,
            heroTargets: []
        })

        expect(rows.get('MarketingPageHero')).toEqual([])
        expect(executor.query).toHaveBeenCalledTimes(3)
        expect(executor.query.mock.calls.map(([sql]) => String(sql)).join('\n')).not.toContain(
            'FROM "app_019ccefc2f7b7b3682f485cdb1312268"."marketing_page_hero"'
        )
    })

    it('loads a compatible custom Hero Object through its materialized table metadata', async () => {
        const { executor } = createMockDbExecutor()
        const objectId = '019ccefc-2f7b-7b36-82f4-85cdb1312380'
        const rowId = '019ccefc-2f7b-7b36-82f4-85cdb1312381'
        const keyColumn = 'cmp_019ccefc2f7b7b3682f485cdb1312277'
        executor.query
            .mockResolvedValueOnce([heroMetadata(objectId, 'CustomLandingHero')])
            .mockResolvedValueOnce(heroComponents(objectId))
            .mockResolvedValueOnce([{ tableName: 'custom_hero_table' }])
            .mockResolvedValueOnce([{ id: rowId, [keyColumn]: 'hero-custom' }])

        const rows = await loadAllowlistedPublishedMarketingRows(executor, {
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            workspaceId: null,
            heroTargets: [{ entityCodename: 'CustomLandingHero', semanticKeys: ['hero-custom'] }]
        })

        expect(rows.get('CustomLandingHero')).toEqual([{ id: rowId, HeroKey: 'hero-custom' }])
        expect(String(executor.query.mock.calls[3]?.[0])).toContain('custom_hero_table')
    })

    it('fails closed when a custom Hero Object lacks the authoritative validator policy', async () => {
        const { executor } = createMockDbExecutor()
        const objectId = '019ccefc-2f7b-7b36-82f4-85cdb1312382'
        const incompatible = { ...heroMetadata(objectId, 'CustomLandingHero'), config: {} }
        executor.query
            .mockResolvedValueOnce([incompatible])
            .mockResolvedValueOnce(heroComponents(objectId))
            .mockResolvedValueOnce([{ tableName: 'custom_hero_table' }])

        await expect(
            loadAllowlistedPublishedMarketingRows(executor, {
                schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
                workspaceId: null,
                heroTargets: [{ entityCodename: 'CustomLandingHero', semanticKeys: ['hero-custom'] }]
            })
        ).rejects.toThrow('Published Hero target is incompatible')
        expect(executor.query).toHaveBeenCalledTimes(3)
    })
})
