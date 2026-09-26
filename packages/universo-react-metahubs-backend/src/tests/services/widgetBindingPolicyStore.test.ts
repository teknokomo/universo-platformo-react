import {
    acquireWidgetBindingObjectLock,
    isEntityBoundByCodename,
    isEntityRecordBoundBySemanticKey
} from '../../domains/layouts/widgetBindingPolicyStore'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('widget binding policy store', () => {
    const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
    const objectId = '0190a9b5-3cde-7abc-8def-0123456789a1'

    it('acquires the graph lock before locking the authoritative Object row', async () => {
        const executor = createMockDbExecutor()
        ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT id, kind')) return [{ id: objectId, kind: 'object', codename: 'MarketingPageHero', config: {} }]
            return []
        })

        await expect(acquireWidgetBindingObjectLock(executor, schemaName, objectId)).resolves.toMatchObject({
            id: objectId,
            codename: 'MarketingPageHero'
        })

        const sql = (executor.query as jest.Mock).mock.calls.map(([statement]) => String(statement))
        expect(sql[0]).toContain('pg_advisory_xact_lock')
        expect(sql[1]).toContain('FOR UPDATE')
        expect(sql[1]).toContain('"_mhb_objects"')
    })

    it('checks semantic-key references in every live placement without interpolating values', async () => {
        const executor = createMockDbExecutor()
        ;(executor.query as jest.Mock).mockResolvedValue([{ bound: true }])

        await expect(isEntityRecordBoundBySemanticKey(executor, schemaName, 'MarketingPageHero', 'hero-0190')).resolves.toBe(true)

        const [sql, params] = (executor.query as jest.Mock).mock.calls[0] as [string, unknown[]]
        expect(sql).toContain('jsonb_array_elements')
        expect(sql).toContain('widget._upl_deleted = false')
        expect(sql).toContain('widget._mhb_deleted = false')
        expect(sql).toContain('layout._upl_deleted = false')
        expect(sql).toContain('layout._mhb_deleted = false')
        expect(sql).toContain('layout_override._mhb_deleted = false')
        expect(sql).toContain('layout_override._upl_deleted = false')
        expect(sql).toContain('layout_override.is_deleted_override = false')
        expect(params).toEqual(['MarketingPageHero', 'hero-0190'])
    })

    it('checks codename references across live layouts before deleting an Entity', async () => {
        const executor = createMockDbExecutor()
        ;(executor.query as jest.Mock).mockResolvedValue([{ bound: true }])

        await expect(isEntityBoundByCodename(executor, schemaName, 'object', 'MarketingPageHero')).resolves.toBe(true)

        const [sql, params] = (executor.query as jest.Mock).mock.calls[0] as [string, unknown[]]
        expect(sql).toContain('jsonb_array_elements')
        expect(sql).toContain("value->>'entityKind' = $1")
        expect(sql).toContain("value->>'entityCodename' = $2")
        expect(params).toEqual(['object', 'MarketingPageHero'])
    })
})
