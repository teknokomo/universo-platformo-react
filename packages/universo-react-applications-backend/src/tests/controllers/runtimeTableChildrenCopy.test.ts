import { isUuidV7 } from '@universo-react/utils'
import { createCodenameVLC } from '@universo-react/utils/vlc'
import { createMockDbExecutor } from '../utils/dbMocks'
import { copyRuntimeChildTables } from '../../controllers/runtimeRowWriteHandlers/tableChildren'

const oldBlockKey = '019f2000-0000-7000-8000-000000000011'
const parentId = '019f2000-0000-7000-8000-000000000012'
const copiedParentId = '019f2000-0000-7000-8000-000000000013'

const blocksTable = {
    id: 'blocks-id',
    codename: 'Blocks',
    column_name: 'blocks_rows',
    validation_rules: {}
} as never

const questionsTable = {
    id: 'questions-id',
    codename: 'Questions',
    column_name: 'questions_rows',
    validation_rules: {}
} as never

const blockKeyMetadata = {
    codename: 'BlockKey',
    column_name: 'block_key',
    data_type: 'STRING',
    validation_rules: {},
    ui_config: { serverOwned: true, siblingRowSelectKey: true, generateUuidV7: true }
}

const selectorMetadata = {
    codename: 'BlockKey',
    column_name: 'block_key',
    data_type: 'STRING',
    validation_rules: {},
    ui_config: {
        siblingRowSelect: {
            tableCodename: 'Blocks',
            valueFieldCodename: 'BlockKey',
            labelFieldCodename: 'Title',
            requiredWithRows: true
        }
    }
}

const copyContext = {
    schemaIdent: 'runtime_schema',
    workspacesEnabled: false,
    currentWorkspaceId: null,
    userId: 'user-id'
} as never

describe('runtime child TABLE copy', () => {
    it('rejects source child rows above the TABLE maxRows limit', async () => {
        const { executor } = createMockDbExecutor()
        const limitedBlocksTable = {
            id: 'blocks-id',
            codename: 'Blocks',
            column_name: 'blocks_rows',
            validation_rules: { maxRows: 100 }
        } as never
        const sourceRows = Array.from({ length: 101 }, (_, index) => ({
            block_key: oldBlockKey,
            title: `Block ${index + 1}`,
            _tp_sort_order: index
        }))
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT codename, column_name, data_type, validation_rules, ui_config')) {
                return [
                    blockKeyMetadata,
                    { codename: 'Title', column_name: 'title', data_type: 'STRING', validation_rules: {}, ui_config: {} }
                ]
            }
            if (sql.includes('FROM runtime_schema."blocks_rows"')) return sourceRows
            return []
        })

        await expect(
            copyRuntimeChildTables({
                executor,
                ctx: copyContext,
                tableAttrs: [limitedBlocksTable],
                runtimeRowCondition: '_upl_deleted = false',
                sourceParentId: parentId,
                copiedParentId
            })
        ).rejects.toMatchObject({ statusCode: 400 })
        expect(executor.query).not.toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO runtime_schema."blocks_rows"'),
            expect.any(Array)
        )
    })

    it('remaps generated UUID v7 keys in dependent rows independent of TABLE order', async () => {
        const { executor } = createMockDbExecutor()
        const localizedBlockTable = { ...blocksTable, codename: createCodenameVLC('en', 'Blocks') }
        const localizedBlockKeyMetadata = { ...blockKeyMetadata, codename: createCodenameVLC('en', 'BlockKey') }
        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('SELECT codename, column_name, data_type, validation_rules, ui_config')) {
                return params?.[0] === blocksTable.id
                    ? [
                          localizedBlockKeyMetadata,
                          { codename: 'Title', column_name: 'title', data_type: 'STRING', validation_rules: {}, ui_config: {} }
                      ]
                    : [
                          selectorMetadata,
                          { codename: 'Question', column_name: 'question', data_type: 'STRING', validation_rules: {}, ui_config: {} }
                      ]
            }
            if (sql.includes('FROM runtime_schema."blocks_rows"'))
                return [{ block_key: oldBlockKey.toUpperCase(), title: 'Introduction', _tp_sort_order: 0 }]
            if (sql.includes('FROM runtime_schema."questions_rows"')) {
                return [{ block_key: oldBlockKey.toLowerCase(), question: 'Question one', _tp_sort_order: 0 }]
            }
            return []
        })

        await copyRuntimeChildTables({
            executor,
            ctx: copyContext,
            tableAttrs: [questionsTable, localizedBlockTable],
            runtimeRowCondition: '_upl_deleted = false',
            sourceParentId: parentId,
            copiedParentId
        })

        const blockInsert = executor.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO runtime_schema."blocks_rows"'))
        const questionInsert = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes('INSERT INTO runtime_schema."questions_rows"')
        )
        const copiedBlockKey = (blockInsert?.[1] as unknown[] | undefined)?.[3]
        const copiedQuestionKey = (questionInsert?.[1] as unknown[] | undefined)?.[3]

        expect(isUuidV7(copiedBlockKey)).toBe(true)
        expect(copiedBlockKey).not.toBe(oldBlockKey)
        expect(copiedQuestionKey).toBe(copiedBlockKey)
    })

    it('fails closed if a copied selector points to a target row that was not copied', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT codename, column_name, data_type, validation_rules, ui_config')) {
                return [
                    selectorMetadata,
                    { codename: 'Question', column_name: 'question', data_type: 'STRING', validation_rules: {}, ui_config: {} }
                ]
            }
            if (sql.includes('FROM runtime_schema."questions_rows"')) {
                return [{ block_key: oldBlockKey, question: 'Question one', _tp_sort_order: 0 }]
            }
            return []
        })

        await expect(
            copyRuntimeChildTables({
                executor,
                ctx: copyContext,
                tableAttrs: [questionsTable],
                runtimeRowCondition: '_upl_deleted = false',
                sourceParentId: parentId,
                copiedParentId
            })
        ).rejects.toMatchObject({ statusCode: 400 })
        expect(executor.query).not.toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO runtime_schema."questions_rows"'),
            expect.any(Array)
        )
    })

    it('rejects duplicate generated keys that differ only by UUID casing', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('SELECT codename, column_name, data_type, validation_rules, ui_config')) {
                return params?.[0] === blocksTable.id ? [blockKeyMetadata] : []
            }
            if (sql.includes('FROM runtime_schema."blocks_rows"')) {
                return [
                    { block_key: oldBlockKey, _tp_sort_order: 0 },
                    { block_key: oldBlockKey.toUpperCase(), _tp_sort_order: 1 }
                ]
            }
            return []
        })

        await expect(
            copyRuntimeChildTables({
                executor,
                ctx: copyContext,
                tableAttrs: [blocksTable],
                runtimeRowCondition: '_upl_deleted = false',
                sourceParentId: parentId,
                copiedParentId
            })
        ).rejects.toMatchObject({ statusCode: 409 })
        expect(executor.query).not.toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO runtime_schema."blocks_rows"'),
            expect.any(Array)
        )
    })
})
