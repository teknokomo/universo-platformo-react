import { copyMetahubLayout } from '../../domains/layouts/services/copyMetahubLayout'
import { marketingLayoutZoneWidgets } from '../../domains/templates/data/marketing-page.layouts'
import { isUuidV7 } from '@universo-react/utils'
import { copyLayoutFixtureIds, copyLayoutFixtureSchema, createCopyMetahubLayoutFixture } from '../support/copyMetahubLayoutFixture'

describe('copyMetahubLayout', () => {
    it('copies a dashboard without widgets and disables default widget seeding', async () => {
        const { executor, trx, queries } = createCopyMetahubLayoutFixture()

        const copiedLayout = await copyMetahubLayout({
            executor,
            schemaName: copyLayoutFixtureSchema,
            layoutId: copyLayoutFixtureIds.source,
            userId: 'test-user-id',
            input: { copyWidgets: false, name: { en: 'Main dashboard copy' } }
        })

        expect(copiedLayout.id).toBe(copyLayoutFixtureIds.created)
        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(trx.transaction).toHaveBeenCalledTimes(1)
        expect(queries.some(({ sql }) => sql.includes('pg_advisory_xact_lock'))).toBe(true)

        const sourceLock = queries.find(
            ({ sql, params }) =>
                sql.includes(`SELECT * FROM "${copyLayoutFixtureSchema}"."_mhb_layouts"`) &&
                sql.includes('FOR UPDATE') &&
                params[0] === copyLayoutFixtureIds.source
        )
        expect(sourceLock).toBeDefined()

        const layoutInsert = queries.find(({ sql }) => sql.includes(`INSERT INTO "${copyLayoutFixtureSchema}"."_mhb_layouts"`))
        expect(layoutInsert).toBeDefined()
        const config = JSON.parse(String(layoutInsert?.params[5])) as Record<string, unknown>
        expect(config.__skipDefaultZoneWidgetSeed).toBe(true)
        expect(
            queries.some(
                ({ sql }) =>
                    sql.includes(`INSERT INTO "${copyLayoutFixtureSchema}"."_mhb_widgets"`) ||
                    sql.includes(`INSERT INTO "${copyLayoutFixtureSchema}"."_mhb_layout_widget_overrides"`)
            )
        ).toBe(false)
    })

    it('checks the source version under its row lock before writing a copy', async () => {
        const { executor, queries } = createCopyMetahubLayoutFixture({
            sourceLayout: { _upl_version: 2 }
        })

        await expect(
            copyMetahubLayout({
                executor,
                schemaName: copyLayoutFixtureSchema,
                layoutId: copyLayoutFixtureIds.source,
                userId: 'test-user-id',
                input: { copyWidgets: false, expectedVersion: 1, name: { en: 'Main dashboard copy' } }
            })
        ).rejects.toMatchObject({
            statusCode: 409,
            code: 'CONFLICT',
            details: { operation: 'copy-layout' }
        })

        expect(queries.some(({ sql }) => sql.includes('pg_advisory_xact_lock'))).toBe(true)
        expect(
            queries.some(
                ({ sql, params }) =>
                    sql.includes(`SELECT * FROM "${copyLayoutFixtureSchema}"."_mhb_layouts"`) &&
                    sql.includes('FOR UPDATE') &&
                    params[0] === copyLayoutFixtureIds.source
            )
        ).toBe(true)
        expect(queries.some(({ sql }) => sql.includes('INSERT INTO'))).toBe(false)
    })

    it('reuses Entity bindings when copying a Marketing widget without inserting Entity records', async () => {
        const seededHero = marketingLayoutZoneWidgets['marketing-main'].find(({ widgetKey }) => widgetKey === 'marketing.hero')
        if (!seededHero) throw new Error('The Marketing Page template must seed a Hero placement')

        const sourceWidget = {
            id: '0190a9b5-3cde-7abc-8def-0123456789a4',
            zone: seededHero.zone,
            widget_key: seededHero.widgetKey,
            sort_order: seededHero.sortOrder,
            config: seededHero.config,
            is_active: seededHero.isActive
        }
        const { executor, queries, copiedWidgetIds } = createCopyMetahubLayoutFixture({
            sourceLayout: {
                template_key: 'marketing-page',
                config: { themeMode: 'system' }
            },
            sourceWidgets: [sourceWidget]
        })

        const copiedLayout = await copyMetahubLayout({
            executor,
            schemaName: copyLayoutFixtureSchema,
            layoutId: copyLayoutFixtureIds.source,
            userId: 'test-user-id',
            input: { copyWidgets: true, entityBindingCopyMode: 'reuse', name: { en: 'Marketing page copy' } }
        })

        const widgetInsert = queries.find(({ sql }) => sql.includes(`INSERT INTO "${copyLayoutFixtureSchema}"."_mhb_widgets"`))
        expect(widgetInsert).toBeDefined()
        expect(widgetInsert?.params[0]).toBe(copiedLayout.id)
        expect(widgetInsert?.params[2]).toBe('marketing.hero')
        expect(copiedWidgetIds).toHaveLength(1)
        expect(isUuidV7(copiedWidgetIds[0])).toBe(true)
        expect(copiedWidgetIds[0]).not.toBe(sourceWidget.id)

        const copiedWidgetConfig = JSON.parse(String(widgetInsert?.params[4])) as Record<string, unknown>
        const copiedNeutral = copiedWidgetConfig.__layout as Record<string, unknown>
        const seededConfig = seededHero.config as Record<string, unknown>
        const seededNeutral = seededConfig.__layout as Record<string, unknown>
        expect(copiedNeutral.bindings).toEqual(seededNeutral.bindings)
        expect(queries.some(({ sql }) => /INSERT\s+INTO\s+"[^"]+"\."(?:obj|cmp)_[^"]+"/iu.test(sql))).toBe(false)
    })
})
