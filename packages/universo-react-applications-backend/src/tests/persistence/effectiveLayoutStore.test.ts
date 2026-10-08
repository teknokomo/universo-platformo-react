import {
    findEffectiveLayoutBaseWidgets,
    findEffectiveLayoutEntity,
    findEffectiveLayoutHomePages,
    listEffectiveLayoutCandidates,
    listEffectiveLayoutWidgets
} from '../../persistence/effectiveLayoutStore'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('effectiveLayoutStore', () => {
    const schemaName = 'app_018f8a787b8f7c1da111222233334444'

    it('binds the target kind and entity selector without interpolating user input', async () => {
        const { executor } = createMockDbExecutor()

        await findEffectiveLayoutEntity(executor, schemaName, 'page', { kind: 'codename', value: 'Home' })

        expect(executor.query).toHaveBeenCalledTimes(1)
        const [sql, params] = executor.query.mock.calls[0] as [string, unknown[]]
        expect(sql).toContain('o.kind = $1')
        expect(sql).toContain("lower(o.config->'capabilities'->'layoutConfig'->>'enabled') = 'true'")
        expect(sql).toContain('= $2')
        expect(sql).toContain('"app_018f8a787b8f7c1da111222233334444"."_app_objects"')
        expect(params).toEqual(['page', 'Home'])
    })

    it('lists every active global or target-scoped candidate with a bound entity id', async () => {
        const { executor } = createMockDbExecutor()
        const entityId = '018f8a78-7b8f-7c1d-a111-2222333344a1'

        await listEffectiveLayoutCandidates(executor, schemaName, entityId)

        const [sql, params] = executor.query.mock.calls[0] as [string, unknown[]]
        expect(sql).toContain('l.scope_entity_id IS NULL OR l.scope_entity_id IS NOT DISTINCT FROM $1')
        expect(sql).not.toContain('LIMIT 100')
        expect(params).toEqual([entityId])
    })

    it('resolves only an active, layout-capable Page marked as the home route', async () => {
        const { executor } = createMockDbExecutor()

        await findEffectiveLayoutHomePages(executor, schemaName)

        const [sql, params] = executor.query.mock.calls[0] as [string, unknown[]]
        expect(sql).toContain('"app_018f8a787b8f7c1da111222233334444"."_app_objects"')
        expect(sql).toContain("o.kind = 'page'")
        expect(sql).toContain("o.config->'runtime'->>'routeSegment' = 'home'")
        expect(sql).toContain("lower(o.config->'capabilities'->'layoutConfig'->>'enabled') = 'true'")
        expect(sql).toContain('o._upl_deleted = false')
        expect(sql).toContain('o._app_deleted = false')
        expect(sql).toContain('LIMIT 2')
        expect(params).toBeUndefined()
    })

    it('applies published lifecycle filters when resolving a public home Page', async () => {
        const { executor } = createMockDbExecutor()

        await findEffectiveLayoutHomePages(executor, schemaName, 'public')

        const [sql] = executor.query.mock.calls[0] as [string, unknown[]]
        expect(sql).toContain('"_upl_archived" = false')
        expect(sql).toContain('"_app_archived" = false')
        expect(sql).toContain('"_app_published" = true')
    })

    it('selects the source-state baseline and keeps the layout id bound', async () => {
        const { executor } = createMockDbExecutor()
        const layoutId = '018f8a78-7b8f-7c1d-a111-2222333344a2'

        await listEffectiveLayoutWidgets(executor, schemaName, layoutId)

        const [sql, params] = executor.query.mock.calls[0] as [string, unknown[]]
        expect(sql).toContain('w.source_state')
        expect(sql).not.toContain('w.config IS DISTINCT FROM w.source_config')
        expect(sql).toContain('w.layout_id = $1')
        expect(sql).toContain('w.is_active = true')
        expect(params).toEqual([layoutId])
    })

    it('uses a typed UUID array for inherited base-widget lookup and skips empty batches', async () => {
        const { executor } = createMockDbExecutor()
        const widgetId = '018f8a78-7b8f-7c1d-a111-2222333344a3'

        await findEffectiveLayoutBaseWidgets(executor, schemaName, [])
        expect(executor.query).not.toHaveBeenCalled()

        await findEffectiveLayoutBaseWidgets(executor, schemaName, [widgetId])
        const [sql, params] = executor.query.mock.calls[0] as [string, unknown[]]
        expect(sql).toContain(
            '(w.id = ANY($1::uuid[]) OR w.source_widget_id = ANY($1::uuid[]) OR w.source_base_widget_id = ANY($1::uuid[]))'
        )
        expect(sql).toContain('l.scope_entity_id IS NULL')
        expect(sql).toContain('w.is_active = true')
        expect(sql).toContain('w.source_widget_id')
        expect(sql).toContain('w.instance_key')
        expect(sql).toContain('w.zone')
        expect(sql).toContain('w.config')
        expect(sql).toContain('w.source_config')
        expect(params).toEqual([[widgetId]])
    })

    it('treats layout-capable custom object kinds as object runtime targets', async () => {
        const { executor } = createMockDbExecutor()
        const entityId = '018f8a78-7b8f-7c1d-a111-2222333344a3'

        await findEffectiveLayoutEntity(executor, schemaName, 'object', { kind: 'id', value: entityId })

        const [sql, params] = executor.query.mock.calls[0] as [string, unknown[]]
        expect(sql).toContain("NOT IN ('hub', 'set', 'enumeration', 'page', 'ledger')")
        expect(sql).toContain("$1 = 'object'")
        expect(params).toEqual(['object', entityId])
    })

    it('applies published lifecycle filters to anonymous effective-layout reads only', async () => {
        const { executor } = createMockDbExecutor()
        const entityId = '018f8a78-7b8f-7c1d-a111-2222333344a3'
        const layoutId = '018f8a78-7b8f-7c1d-a111-2222333344a2'
        const widgetId = '018f8a78-7b8f-7c1d-a111-2222333344a4'

        await findEffectiveLayoutEntity(executor, schemaName, 'object', { kind: 'id', value: entityId }, 'public')
        await listEffectiveLayoutCandidates(executor, schemaName, entityId, 'public')
        await listEffectiveLayoutWidgets(executor, schemaName, layoutId, 'public')
        await findEffectiveLayoutBaseWidgets(executor, schemaName, [widgetId], 'public')

        const publicSql = executor.query.mock.calls.map(([sql]) => String(sql))
        for (const sql of publicSql) {
            expect(sql).toContain('"_upl_archived" = false')
            expect(sql).toContain('"_app_archived" = false')
            expect(sql).toContain('"_app_published" = true')
        }

        executor.query.mockClear()
        await findEffectiveLayoutEntity(executor, schemaName, 'object', { kind: 'id', value: entityId })
        const authenticatedSql = String(executor.query.mock.calls[0]?.[0])
        expect(authenticatedSql).toContain('o._upl_deleted = false')
        expect(authenticatedSql).not.toContain('"_app_published" = true')
    })
})
