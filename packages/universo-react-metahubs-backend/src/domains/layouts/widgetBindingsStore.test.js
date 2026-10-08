const {
    countWidgetBindingObjectRecords,
    findWidgetBindingObjectByCodename,
    findWidgetBindingRecordBySemanticKey,
    hasWidgetBindingUsage,
    listWidgetBindingComponents,
    listWidgetBindingObjectCandidates,
    listWidgetBindingSemanticRecords,
    loadWidgetBindingSourceLayout,
    loadWidgetBindingWidget,
    updateWidgetBindingConfig
} = require('./widgetBindingsStore')

const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
const widgetId = '0190a9b5-3cde-7abc-8def-0123456789a1'
const layoutId = '0190a9b5-3cde-7abc-8def-0123456789a2'
const targetObjectId = '0190a9b5-3cde-7abc-8def-0123456789a3'

const createDb = (result = []) => {
    const query = jest.fn(async () => result)
    const db = {
        query,
        transaction: async (callback) => callback(db),
        isReleased: () => false
    }
    return { db, query }
}

describe('generic widget binding SQL store', () => {
    it('locks a live top-level source layout before provisioning', async () => {
        const row = { id: layoutId, template_key: 'marketing-page', scope_entity_id: null, base_layout_id: null }
        const { db, query } = createDb([row])

        await expect(loadWidgetBindingSourceLayout(db, schemaName, layoutId, true)).resolves.toEqual(row)

        const [sql, params] = query.mock.calls[0]
        expect(sql).toContain('"_upl_deleted" = false')
        expect(sql).toContain('"_mhb_deleted" = false')
        expect(sql).toContain('"scope_entity_id"')
        expect(sql).toContain('FOR UPDATE')
        expect(params).toEqual([layoutId])
    })

    it('scopes widget lookup to an active source layout and quotes the schema identifiers', async () => {
        const row = {
            id: widgetId,
            layout_id: layoutId,
            template_key: 'marketing-page',
            scope_entity_id: null,
            base_layout_id: null,
            widget_key: 'marketing.hero',
            zone: 'marketing-main',
            config: {},
            widget_version: 4
        }
        const { db, query } = createDb([row])

        await expect(loadWidgetBindingWidget(db, schemaName, widgetId)).resolves.toEqual(row)

        const [sql, params] = query.mock.calls[0]
        expect(sql).toContain('"' + schemaName + '"."_mhb_widgets"')
        expect(sql).toContain('"_upl_deleted" = false')
        expect(sql).toContain('"base_layout_id" IS NULL')
        expect(sql).toContain('"id" = $1')
        expect(params).toEqual([widgetId])
    })

    it('uses registry requirements to select allowed Object kinds and applies a hard candidate cap', async () => {
        const { db, query } = createDb([])
        const requirements = {
            entityKinds: ['object'],
            entityCapabilities: ['dataSchema', 'records'],
            components: []
        }

        await listWidgetBindingObjectCandidates(db, schemaName, requirements, 0)

        const [sql, params] = query.mock.calls[0]
        expect(sql).toContain('"_mhb_entity_type_definitions"')
        expect(sql).toContain('object."kind" = ANY($1::text[])')
        expect(sql).toContain('LIMIT $2 OFFSET $3')
        expect(sql).not.toContain('"_mhb_elements"')
        expect(params).toEqual([['object'], 251, 0, null, null])
    })

    it('restricts candidate source codenames with a bound allowlist', async () => {
        const { db, query } = createDb([])

        await listWidgetBindingObjectCandidates(
            db,
            schemaName,
            { entityKinds: ['object'], entityCodenames: ['Enrollments'], entityCapabilities: [], components: [] },
            0
        )

        const [sql, params] = query.mock.calls[0]
        expect(sql).toContain('= ANY($5::text[])')
        expect(sql).not.toContain('Enrollments')
        expect(params).toEqual([['object'], 251, 0, null, ['Enrollments']])
    })

    it('applies the same source codename allowlist to exact source lookups', async () => {
        const row = { id: targetObjectId, kind: 'object', codename: 'Enrollments' }
        const { db, query } = createDb([row])

        await expect(
            findWidgetBindingObjectByCodename(
                db,
                schemaName,
                { entityKinds: ['object'], entityCodenames: ['Enrollments'], entityCapabilities: [], components: [] },
                'Enrollments'
            )
        ).resolves.toEqual(row)

        const [sql, params] = query.mock.calls[0]
        expect(sql).toContain('= ANY($3::text[])')
        expect(sql).not.toContain('Enrollments')
        expect(params).toEqual([['object'], 'Enrollments', ['Enrollments']])
    })

    it('filters source discovery in SQL using escaped bound search text before pagination', async () => {
        const search = "Logo_%' OR 1=1 --"
        const { db, query } = createDb([])

        await listWidgetBindingObjectCandidates(
            db,
            schemaName,
            { entityKinds: ['object'], entityCapabilities: [], components: [] },
            50,
            search
        )

        const [sql, params] = query.mock.calls[0]
        expect(sql).toContain('ILIKE $4 ESCAPE E')
        expect(sql).toContain('LIMIT $2 OFFSET $3')
        expect(sql).not.toContain(search)
        expect(params).toEqual([['object'], 251, 50, "%Logo\\_\\%' OR 1=1 --%", null])
    })

    it('filters semantic records through bound registry component keys and bounded pagination', async () => {
        const search = ' launch '
        const { db, query } = createDb([])

        await listWidgetBindingSemanticRecords(db, schemaName, widgetId, 'HeroKey', 101, 100, search, ['HeroKey', 'Title'])

        const [sql, params] = query.mock.calls[0]
        expect(sql).toContain('unnest($6::text[])')
        expect(sql).toContain('ILIKE $5 ESCAPE E')
        expect(sql).toContain('LIMIT $3 OFFSET $4')
        expect(sql).not.toContain(search)
        expect(params).toEqual([widgetId, 'HeroKey', 101, 100, '% launch %', ['HeroKey', 'Title']])
    })

    it('counts records only for already validated compatible sources', async () => {
        const { db, query } = createDb([{ object_id: widgetId, records_count: 6 }])

        await expect(countWidgetBindingObjectRecords(db, schemaName, [widgetId])).resolves.toEqual([
            { object_id: widgetId, records_count: 6 }
        ])

        const [sql, params] = query.mock.calls[0]
        expect(sql).toContain('"object_id" = ANY($1::uuid[])')
        expect(sql).toContain('COUNT(*)::int')
        expect(params).toEqual([[widgetId]])
    })

    it('loads registry component and declared REF target metadata with bound Object UUIDs', async () => {
        const row = {
            object_id: widgetId,
            codename: 'TierRef',
            data_type: 'REF',
            is_required: true,
            validation_rules: {},
            target_object_id: targetObjectId,
            target_object_kind: 'object',
            target_object_codename: 'PricingTiers'
        }
        const { db, query } = createDb([row])

        await expect(listWidgetBindingComponents(db, schemaName, [widgetId])).resolves.toEqual([row])

        const [sql, params] = query.mock.calls[0]
        expect(sql).toContain(`"${schemaName}"."_mhb_components"`)
        expect(sql).toContain(`"${schemaName}"."_mhb_objects"`)
        expect(sql).toContain('component."target_object_id" AS target_object_id')
        expect(sql).toContain('component."target_object_kind" AS target_object_kind')
        expect(sql).toContain('AS target_object_codename')
        expect(sql).toContain('target_object."id" = component."target_object_id"')
        expect(sql).toContain('target_object."_upl_deleted" = false')
        expect(sql).toContain('"parent_component_id" IS NULL')
        expect(sql).toContain('"object_id" = ANY($1::uuid[])')
        expect(params).toEqual([[widgetId]])
    })

    it('keeps semantic-key field and value parameterized while locking the selected row', async () => {
        const maliciousLookingKey = "site' OR true --"
        const { db, query } = createDb([])

        await findWidgetBindingRecordBySemanticKey(db, schemaName, widgetId, 'SiteKey', maliciousLookingKey)

        const [sql, params] = query.mock.calls[0]
        expect(sql).toContain('"data" ->> $2::text = $3')
        expect(sql).toContain('FOR SHARE')
        expect(sql).not.toContain(maliciousLookingKey)
        expect(params).toEqual([widgetId, 'SiteKey', maliciousLookingKey])
    })

    it('checks target usage across active widget bindings and scoped overrides', async () => {
        const { db, query } = createDb([
            {
                widget_id: widgetId,
                widget_key: 'marketing.hero',
                config: {},
                slot_key: 'content',
                entity_kind: 'object',
                entity_codename: 'MarketingPageHero',
                selector_kind: 'semantic-key',
                selector_value: 'hero-default'
            }
        ])

        await expect(
            hasWidgetBindingUsage(db, schemaName, {
                entityKind: 'object',
                entityCodename: 'MarketingPageHero',
                semanticKey: 'hero-default',
                excludeWidgetId: widgetId
            })
        ).resolves.toBe(true)

        const [sql, params] = query.mock.calls[0]
        expect(sql).toContain('"_mhb_layout_widget_overrides"')
        expect(sql).toContain("'semantic-key'")
        expect(sql).toContain("'entityCodename' = $2")
        expect(sql).toContain('$4::uuid')
        expect(params).toEqual(['object', 'MarketingPageHero', 'hero-default', widgetId, 1])
    })

    it('uses contiguous bind parameters when checking whole-source usage', async () => {
        const { db, query } = createDb([])

        await expect(
            hasWidgetBindingUsage(db, schemaName, {
                entityKind: 'object',
                entityCodename: 'MarketingLogos',
                excludeWidgetId: widgetId
            })
        ).resolves.toBe(false)

        const [sql, params] = query.mock.calls[0]
        expect(sql).toContain('$3::uuid')
        expect(sql).not.toContain('$4::uuid')
        expect(params).toEqual(['object', 'MarketingLogos', widgetId, 1])
    })

    it('uses optimistic version checks, active-row guards and RETURNING for config writes', async () => {
        const { db, query } = createDb([{ widget_version: 5 }])
        const config = { __layout: { bindings: { version: 1, slots: [] } } }

        await expect(
            updateWidgetBindingConfig(db, schemaName, {
                widgetId,
                layoutId,
                expectedVersion: 4,
                config
            })
        ).resolves.toBe(5)

        const [sql, params] = query.mock.calls[0]
        expect(sql).toMatch(/^UPDATE /u)
        expect(sql).toContain('RETURNING')
        expect(sql).toContain('COALESCE(widget."_upl_version", 1) = $6')
        expect(sql).toContain('"_upl_deleted" = false')
        expect(params[0]).toBe(JSON.stringify(config))
        expect(params.slice(3)).toEqual([widgetId, layoutId, 4])
        expect(sql).not.toContain(JSON.stringify(config))
    })

    it('fails closed when the optimistic update affects no widget', async () => {
        const { db } = createDb([])

        await expect(
            updateWidgetBindingConfig(db, schemaName, {
                widgetId,
                layoutId,
                expectedVersion: 4,
                config: {}
            })
        ).rejects.toThrow('Widget bindings changed while they were being updated')
    })
})
