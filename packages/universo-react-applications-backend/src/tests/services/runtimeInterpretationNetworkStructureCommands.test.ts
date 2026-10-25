import { createMockDbExecutor } from '../utils/dbMocks'
import { RuntimeModulesService } from '../../services/runtimeModulesService'
import {
    ensureSingleSystemStructure,
    createStructureAggregate
} from '../../services/interpretationNetwork/runtimeInterpretationNetworkService'
import { makeCtx, makeSurface, userId, vlcText, workspaceId } from '../utils/interpretationNetworkRuntimeFixtures'
import type { RuntimeSchemaContext } from '../../shared/runtimeHelpers'

describe('runtime Interpretation Network Structure commands', () => {
    let lifecycleSpy: jest.SpyInstance

    beforeEach(() => {
        lifecycleSpy = jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue([])
    })

    afterEach(() => {
        lifecycleSpy.mockRestore()
    })

    it('creates a named Structure, Interpretation, and root cell as one aggregate', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        let insertId = 0
        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('INSERT INTO') && sql.includes('"structure"')) {
                expect(params).toEqual(expect.arrayContaining([workspaceId, userId]))
                return [{ id: `019f2000-0000-7000-8000-00000000010${++insertId}` }]
            }
            if (sql.includes('INSERT INTO') && sql.includes('"interpretation"')) {
                expect(params).toEqual(expect.arrayContaining(['019f2000-0000-7000-8000-000000000101', workspaceId, userId]))
                return [{ id: `019f2000-0000-7000-8000-00000000010${++insertId}` }]
            }
            if (sql.includes('INSERT INTO') && sql.includes('"interpretation_rows"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000103' }]
            }
            return []
        })

        const result = await createStructureAggregate(makeCtx(executor), makeSurface('multiple'), {
            name: vlcText('Structure'),
            description: vlcText('Description'),
            locale: 'en'
        })

        expect(result).toMatchObject({
            structureId: '019f2000-0000-7000-8000-000000000101',
            interpretationId: '019f2000-0000-7000-8000-000000000102',
            created: true
        })
        expect(lifecycleSpy.mock.calls.map(([call]) => call.payload.eventName)).toEqual([
            'beforeCreate',
            'beforeCreate',
            'afterCreate',
            'afterCreate'
        ])
    })

    it('rolls back the aggregate and does not emit afterCreate hooks when root creation fails', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('INSERT INTO') && sql.includes('"structure"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000101' }]
            }
            if (sql.includes('INSERT INTO') && sql.includes('"interpretation"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000102' }]
            }
            if (sql.includes('INSERT INTO') && sql.includes('"interpretation_rows"')) return []
            return []
        })

        await expect(
            createStructureAggregate(makeCtx(executor), makeSurface('multiple'), {
                name: vlcText('Structure'),
                locale: 'en'
            })
        ).rejects.toMatchObject({ code: 'INTERPRETATION_NETWORK_CHILD_INSERT_FAILED' })
        expect(lifecycleSpy.mock.calls.map(([call]) => call.payload.eventName)).toEqual(['beforeCreate', 'beforeCreate'])
    })

    it('creates a single system structure transactionally with a hidden SystemKey and a root cell', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        let insertId = 0
        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) return []
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                expect(params).toEqual(expect.arrayContaining(['primary', workspaceId, userId]))
                return [{ id: `019f2000-0000-7000-8000-00000000010${++insertId}` }]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                expect(params).toEqual(expect.arrayContaining(['019f2000-0000-7000-8000-000000000101', workspaceId, userId]))
                return [{ id: `019f2000-0000-7000-8000-00000000010${++insertId}` }]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                expect(params).toEqual(expect.arrayContaining(['019f2000-0000-7000-8000-000000000102', workspaceId, userId]))
                return [{ id: '019f2000-0000-7000-8000-000000000103' }]
            }
            return []
        })

        const result = await ensureSingleSystemStructure(makeCtx(executor), makeSurface('singleSystem'), { locale: 'en' })

        expect(result).toMatchObject({
            structureId: '019f2000-0000-7000-8000-000000000101',
            interpretationId: '019f2000-0000-7000-8000-000000000102',
            created: true
        })
        expect(txExecutor.query.mock.calls[0]?.[0]).toContain('pg_advisory_xact_lock')
        expect(lifecycleSpy.mock.calls.map(([call]) => call.payload.eventName)).toEqual([
            'beforeCreate',
            'beforeCreate',
            'afterCreate',
            'afterCreate'
        ])
        expect(lifecycleSpy.mock.calls.map(([call]) => call.attachmentId)).toEqual([
            'Structure-object',
            'Interpretation-object',
            'Structure-object',
            'Interpretation-object'
        ])
        expect(lifecycleSpy.mock.calls[3]?.[0].payload.metadata).toMatchObject({
            aggregateCommand: 'ensureSingleSystemStructure',
            childRowCount: 1
        })
    })

    it('returns the existing system aggregate to a read-only user without writing', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"') && sql.includes('"system_key" = $1')) {
                return [{ id: '019f2000-0000-7000-8000-000000000101', system_key: 'primary' }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000102' }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000103', cell_id: 'root-cell', parent_cell_id: null }]
            }
            return []
        })
        const memberContext: RuntimeSchemaContext = {
            ...makeCtx(executor),
            role: 'member',
            permissions: { ...makeCtx(executor).permissions, createContent: false, editContent: false }
        }

        await expect(ensureSingleSystemStructure(memberContext, makeSurface('singleSystem'), {})).resolves.toMatchObject({
            structureId: '019f2000-0000-7000-8000-000000000101',
            interpretationId: '019f2000-0000-7000-8000-000000000102',
            rootCellId: 'root-cell',
            created: false
        })
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
        expect(lifecycleSpy).not.toHaveBeenCalled()
    })

    it('denies read-only bootstrap inside the transaction before any content write', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) return []
            return []
        })
        const baseContext = makeCtx(executor)
        const memberContext: RuntimeSchemaContext = {
            ...baseContext,
            role: 'member',
            permissions: { ...baseContext.permissions, createContent: false, editContent: false }
        }

        await expect(ensureSingleSystemStructure(memberContext, makeSurface('singleSystem'), {})).rejects.toMatchObject({
            statusCode: 403,
            code: 'INTERPRETATION_NETWORK_PERMISSION_DENIED'
        })
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
        expect(lifecycleSpy).not.toHaveBeenCalled()
    })

    it('fails closed when ordinary structures exist before single-system ensure', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"') && sql.includes('"system_key" = $1')) {
                return []
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000120', system_key: null }]
            }
            return []
        })

        await expect(ensureSingleSystemStructure(makeCtx(executor), makeSurface('singleSystem'), {})).rejects.toMatchObject({
            code: 'INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST'
        })
        expect(
            txExecutor.query.mock.calls.some(([sql]) =>
                String(sql).includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."structure"')
            )
        ).toBe(false)
    })

    it('fails closed when a primary system structure coexists with ordinary structures', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"') && sql.includes('"system_key" = $1')) {
                return [{ id: '019f2000-0000-7000-8000-000000000101', system_key: 'primary' }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [
                    { id: '019f2000-0000-7000-8000-000000000101', system_key: 'primary' },
                    { id: '019f2000-0000-7000-8000-000000000121', system_key: null }
                ]
            }
            return []
        })

        await expect(ensureSingleSystemStructure(makeCtx(executor), makeSurface('singleSystem'), {})).rejects.toMatchObject({
            code: 'INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST'
        })
    })

    it('fails closed when multiple system structures already exist', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000101' }, { id: '019f2000-0000-7000-8000-000000000102' }]
            }
            return []
        })

        await expect(ensureSingleSystemStructure(makeCtx(executor), makeSurface('singleSystem'), {})).rejects.toMatchObject({
            code: 'INTERPRETATION_NETWORK_DUPLICATE_SYSTEM_STRUCTURE'
        })
    })

    it('fails closed when the existing system structure has duplicate matrices', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000101' }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000201' }, { id: '019f2000-0000-7000-8000-000000000202' }]
            }
            return []
        })

        await expect(ensureSingleSystemStructure(makeCtx(executor), makeSurface('singleSystem'), {})).rejects.toMatchObject({
            code: 'INTERPRETATION_NETWORK_MALFORMED_SYSTEM_STRUCTURE'
        })
    })

    it('fails closed when the existing system matrix has duplicate root cells', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000101' }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000201' }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [
                    { id: 'row-1', cell_id: 'root-a', parent_cell_id: null },
                    { id: 'row-2', cell_id: 'root-b', parent_cell_id: null }
                ]
            }
            return []
        })

        await expect(ensureSingleSystemStructure(makeCtx(executor), makeSurface('singleSystem'), {})).rejects.toMatchObject({
            code: 'INTERPRETATION_NETWORK_MALFORMED_SYSTEM_STRUCTURE'
        })
    })
})
