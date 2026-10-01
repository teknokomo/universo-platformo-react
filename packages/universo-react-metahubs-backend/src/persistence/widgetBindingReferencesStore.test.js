const { listPersistedWidgetBindingReferences } = require('./widgetBindingReferencesStore')

const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
const widgetId = '0190a9b5-3cde-7abc-8def-0123456789a1'

const createDb = (result = []) => {
    const query = jest.fn(async () => result)
    return { db: { query }, query }
}

describe('persisted widget binding reference store', () => {
    it('reads base bindings for base placements and live overlay consumers with bounded JSON traversal', async () => {
        const reference = {
            widget_id: widgetId,
            widget_key: 'marketing.hero',
            config: {},
            slot_key: 'content',
            entity_kind: 'object',
            entity_codename: 'MarketingPageHero',
            selector_kind: 'semantic-key',
            selector_value: 'hero-default'
        }
        const { db, query } = createDb([reference])

        await expect(
            listPersistedWidgetBindingReferences(db, schemaName, {
                entityKind: 'object',
                entityCodename: 'MarketingPageHero',
                limit: 257
            })
        ).resolves.toEqual([reference])

        const [sql, params] = query.mock.calls[0]
        expect(sql).toContain(`"${schemaName}"."_mhb_widgets"`)
        expect(sql).toContain(`"${schemaName}"."_mhb_layout_widget_overrides"`)
        expect(sql).toContain('override."id" AS widget_id')
        expect(sql).toContain('base_widget."config" AS config')
        expect(sql).toContain('base_widget."layout_id" = layout."base_layout_id"')
        expect(sql).toContain('base_layout."scope_entity_id" IS NULL')
        expect(sql).toContain('layout."template_key" = \'marketing-page\'')
        expect(sql).not.toContain('AND NOT (\n                    layout."template_key" = \'marketing-page\'')
        expect(sql).toContain(`FROM "${schemaName}"."_mhb_widgets" AS widget`)
        expect(sql).toContain('layout."scope_entity_id" IS NOT NULL')
        expect(sql).toContain('layout."base_layout_id" IS NOT NULL')
        expect(sql).not.toContain('override."config"')
        expect(sql).toContain('"is_deleted_override" = false')
        expect(sql).toContain("jsonb_typeof(persisted.\"config\" #> '{__layout,bindings,slots}') = 'array'")
        expect(sql).toContain("jsonb_typeof(slot.\"value\" -> 'targets') = 'array'")
        expect(sql).toContain('reference."target" ->> \'entityKind\' = $1')
        expect(sql).toContain('reference."target" ->> \'entityCodename\' = $2')
        expect(sql).toContain('LIMIT $3')
        expect(params).toEqual(['object', 'MarketingPageHero', 257])
    })

    it('parameterizes semantic selectors and the optional excluded widget UUID', async () => {
        const maliciousKey = "hero' OR true --"
        const { db, query } = createDb([])

        await listPersistedWidgetBindingReferences(db, schemaName, {
            entityKind: 'object',
            entityCodename: 'MarketingPageHero',
            semanticKey: maliciousKey,
            excludeWidgetId: widgetId,
            limit: 1
        })

        const [sql, params] = query.mock.calls[0]
        expect(sql).toContain("reference.\"target\" -> 'selector' ->> 'kind' = 'semantic-key'")
        expect(sql).toContain("reference.\"target\" -> 'selector' ->> 'value' = $3")
        expect(sql).toContain('reference."widget_id" <> $4::uuid')
        expect(sql).toContain('LIMIT $5')
        expect(sql).not.toContain(maliciousKey)
        expect(params).toEqual(['object', 'MarketingPageHero', maliciousKey, widgetId, 1])
    })
})
