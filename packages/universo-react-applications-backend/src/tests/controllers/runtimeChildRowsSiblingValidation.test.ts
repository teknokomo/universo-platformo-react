import { isUuidV7 } from '@universo-react/utils'
import { createMockDbExecutor } from '../utils/dbMocks'
import {
    assertSiblingRowKeyHasNoReferences,
    prepareGeneratedSiblingRowKeys,
    validateExistingSiblingRowSelectsForTarget,
    validateSiblingRowSelectTargets
} from '../../controllers/runtimeChildRowsSiblingValidation'

const recordId = '019f2000-0000-7000-8000-000000000002'
const blockKey = '019f2000-0000-7000-8000-000000000006'
const blockRowId = '019f2000-0000-7000-8000-000000000007'

const blockKeyAttr = {
    id: 'blocks-block-key',
    codename: 'BlockKey',
    column_name: 'block_key',
    data_type: 'STRING',
    is_required: true,
    ui_config: {
        hidden: true,
        generateUuidV7: true,
        siblingRowSelectKey: true,
        serverOwned: true
    }
}

const questionBlockAttr = {
    id: 'questions-block-key',
    codename: 'BlockKey',
    column_name: 'block_key',
    data_type: 'STRING',
    is_required: false,
    ui_config: {
        siblingRowSelect: {
            tableCodename: 'Blocks',
            valueFieldCodename: 'BlockKey',
            labelFieldCodename: 'Title',
            requiredWithRows: true
        }
    }
}

const blocksContext = {
    error: null,
    object: { id: 'object-id', codename: 'Quiz', table_name: 'quiz', config: {} },
    lifecycleContract: {} as never,
    tableAttr: { id: 'blocks-id', codename: 'Blocks', column_name: 'blocks_rows', data_type: 'TABLE', validation_rules: {} },
    tabTableName: 'blocks_rows',
    tabTableIdent: 'runtime_schema."blocks_rows"',
    parentTableIdent: 'runtime_schema."quiz"',
    childAttrs: [blockKeyAttr]
} as Parameters<typeof prepareGeneratedSiblingRowKeys>[0]

const questionsContext = {
    ...blocksContext,
    tableAttr: { ...blocksContext.tableAttr, id: 'questions-id', codename: 'Questions', column_name: 'questions_rows' },
    tabTableName: 'questions_rows',
    tabTableIdent: 'runtime_schema."questions_rows"',
    childAttrs: [questionBlockAttr]
} as Parameters<typeof prepareGeneratedSiblingRowKeys>[0]

const configureTargetMetadata = (query: jest.Mock, targetRows: Array<Record<string, unknown>>) => {
    query.mockImplementation(async (sql: string) => {
        if (sql.includes('WHERE object_id = $1')) return [{ id: 'blocks-id', column_name: 'blocks_rows' }]
        if (sql.includes('WHERE parent_component_id = $1')) {
            return [
                {
                    column_name: 'block_key',
                    data_type: 'STRING',
                    ui_config: { siblingRowSelectKey: true, generateUuidV7: true }
                }
            ]
        }
        if (sql.includes('FROM runtime_schema."blocks_rows"')) return targetRows
        return []
    })
}

describe('runtime child row sibling references', () => {
    it('generates a UUID v7 key for server-owned sibling row identities', () => {
        const prepared = prepareGeneratedSiblingRowKeys(blocksContext, {})

        expect(isUuidV7(prepared.block_key)).toBe(true)
        expect(prepared.BlockKey).toBe(prepared.block_key)
    })

    it('normalizes UUID v7 selector casing before resolving the active sibling row', async () => {
        const { executor } = createMockDbExecutor()
        configureTargetMetadata(executor.query, [{ id: blockRowId }])

        await expect(
            validateSiblingRowSelectTargets(executor, 'runtime_schema', questionsContext, recordId, '_upl_deleted = false', [
                { data: { BlockKey: blockKey.toUpperCase() } }
            ])
        ).resolves.toBeUndefined()
        expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('"block_key" = $2'), [recordId, blockKey])
    })

    it('requires a selected key when blocks exist and permits unblocked flat quizzes', async () => {
        const { executor } = createMockDbExecutor()
        configureTargetMetadata(executor.query, [{ id: blockRowId }])

        await expect(
            validateSiblingRowSelectTargets(
                executor,
                'runtime_schema',
                questionsContext,
                recordId,
                '_upl_deleted = false',
                [{ data: {} }],
                { isCreate: true }
            )
        ).rejects.toMatchObject({ statusCode: 400 })

        configureTargetMetadata(executor.query, [])
        await expect(
            validateSiblingRowSelectTargets(
                executor,
                'runtime_schema',
                questionsContext,
                recordId,
                '_upl_deleted = false',
                [{ data: {} }],
                { isCreate: true }
            )
        ).resolves.toBeUndefined()

        configureTargetMetadata(executor.query, [{ id: blockRowId }])
        await expect(
            validateSiblingRowSelectTargets(
                executor,
                'runtime_schema',
                questionsContext,
                recordId,
                '_upl_deleted = false',
                [{ data: {} }],
                { validateRequiredWithRows: true }
            )
        ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects missing, malformed, or inactive sibling references', async () => {
        const { executor } = createMockDbExecutor()
        configureTargetMetadata(executor.query, [])

        await expect(
            validateSiblingRowSelectTargets(executor, 'runtime_schema', questionsContext, recordId, '_upl_deleted = false', [
                { data: { BlockKey: blockKey } }
            ])
        ).rejects.toMatchObject({ statusCode: 400, body: { code: 'RUNTIME_SIBLING_TARGET_MISSING' } })
        await expect(
            validateSiblingRowSelectTargets(executor, 'runtime_schema', questionsContext, recordId, '_upl_deleted = false', [
                { data: { BlockKey: 'not-a-uuid-v7' } }
            ])
        ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('prevents deleting a block while an active question references its key', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('JOIN runtime_schema._app_components AS child')) {
                return [{ table_name: 'questions_rows', value_column: 'block_key' }]
            }
            if (sql.includes('FROM runtime_schema."questions_rows"')) return [{ '?column?': 1 }]
            return []
        })

        await expect(
            assertSiblingRowKeyHasNoReferences(executor, 'runtime_schema', blocksContext, recordId, '_upl_deleted = false', {
                block_key: blockKey
            })
        ).rejects.toMatchObject({ statusCode: 409, body: { code: 'RUNTIME_SIBLING_TARGET_IN_USE' } })
        expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('LOWER("block_key") = $2'), [recordId, blockKey])
    })

    it('rejects adding target rows when existing required sibling selectors are blank', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('WHERE object_id = $1')) return [{ id: 'blocks-id', column_name: 'blocks_rows' }]
            if (sql.includes('WHERE parent_component_id = $1')) {
                return [
                    {
                        column_name: 'block_key',
                        data_type: 'STRING',
                        ui_config: { siblingRowSelectKey: true, generateUuidV7: true }
                    }
                ]
            }
            if (sql.includes('SELECT "block_key" FROM runtime_schema."blocks_rows"')) return [{ block_key: blockKey }]
            if (sql.includes('JOIN runtime_schema._app_components AS child')) {
                return [{ table_name: 'questions_rows', value_column: 'block_key', required_with_rows: 'true' }]
            }
            if (sql.includes('SELECT "block_key" FROM runtime_schema."questions_rows"')) return [{ block_key: null }]
            return []
        })

        await expect(
            validateExistingSiblingRowSelectsForTarget(executor, 'runtime_schema', blocksContext, recordId, '_upl_deleted = false')
        ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('accepts existing dependent rows only when their UUID v7 reference resolves to an active target', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('WHERE object_id = $1')) return [{ id: 'blocks-id', column_name: 'blocks_rows' }]
            if (sql.includes('WHERE parent_component_id = $1')) {
                return [
                    {
                        column_name: 'block_key',
                        data_type: 'STRING',
                        ui_config: { siblingRowSelectKey: true, generateUuidV7: true }
                    }
                ]
            }
            if (sql.includes('SELECT "block_key" FROM runtime_schema."blocks_rows"')) return [{ block_key: blockKey }]
            if (sql.includes('JOIN runtime_schema._app_components AS child')) {
                return [{ table_name: 'questions_rows', value_column: 'block_key', required_with_rows: 'true' }]
            }
            if (sql.includes('SELECT "block_key" FROM runtime_schema."questions_rows"')) return [{ block_key: blockKey.toUpperCase() }]
            return []
        })

        await expect(
            validateExistingSiblingRowSelectsForTarget(executor, 'runtime_schema', blocksContext, recordId, '_upl_deleted = false')
        ).resolves.toBeUndefined()
    })

    it('rejects a direct target-table mutation when any required target has no source row', async () => {
        const secondBlockKey = '019f2000-0000-7000-8000-000000000008'
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('WHERE object_id = $1')) return [{ id: 'blocks-id', column_name: 'blocks_rows' }]
            if (sql.includes('WHERE parent_component_id = $1')) {
                return [
                    {
                        column_name: 'block_key',
                        data_type: 'STRING',
                        ui_config: { siblingRowSelectKey: true, generateUuidV7: true }
                    }
                ]
            }
            if (sql.includes('SELECT "block_key" FROM runtime_schema."blocks_rows"')) {
                return [{ block_key: blockKey }, { block_key: secondBlockKey }]
            }
            if (sql.includes('JOIN runtime_schema._app_components AS child')) {
                return [
                    {
                        table_name: 'questions_rows',
                        value_column: 'block_key',
                        required_with_rows: 'true',
                        require_each_target_referenced: 'true'
                    }
                ]
            }
            if (sql.includes('SELECT "block_key" FROM runtime_schema."questions_rows"')) return [{ block_key: blockKey }]
            return []
        })

        await expect(
            validateExistingSiblingRowSelectsForTarget(executor, 'runtime_schema', blocksContext, recordId, '_upl_deleted = false')
        ).rejects.toMatchObject({
            statusCode: 400,
            body: { code: 'RUNTIME_SIBLING_TARGET_UNREFERENCED' }
        })
    })

    it('rejects a source-row mutation that leaves a required target without questions', async () => {
        const secondBlockKey = '019f2000-0000-7000-8000-000000000008'
        const strictQuestionsContext = {
            ...questionsContext,
            childAttrs: [
                {
                    ...questionBlockAttr,
                    ui_config: {
                        siblingRowSelect: {
                            tableCodename: 'Blocks',
                            valueFieldCodename: 'BlockKey',
                            labelFieldCodename: 'Title',
                            requiredWithRows: true,
                            requireEachTargetReferenced: true
                        }
                    }
                }
            ]
        } as typeof questionsContext
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('WHERE object_id = $1')) return [{ id: 'blocks-id', column_name: 'blocks_rows' }]
            if (sql.includes('WHERE parent_component_id = $1')) {
                return [
                    {
                        column_name: 'block_key',
                        data_type: 'STRING',
                        ui_config: { siblingRowSelectKey: true, generateUuidV7: true }
                    }
                ]
            }
            if (sql.includes('FROM runtime_schema."blocks_rows"')) {
                return [{ block_key: blockKey }, { block_key: secondBlockKey }]
            }
            if (sql.includes('FROM runtime_schema."questions_rows"')) return [{ block_key: blockKey }]
            return []
        })

        await expect(
            validateExistingSiblingRowSelectsForTarget(executor, 'runtime_schema', strictQuestionsContext, recordId, '_upl_deleted = false')
        ).rejects.toMatchObject({
            statusCode: 400,
            body: { code: 'RUNTIME_SIBLING_TARGET_UNREFERENCED' }
        })
    })

    it('matches required target coverage without regard to UUID v7 casing', async () => {
        const strictQuestionsContext = {
            ...questionsContext,
            childAttrs: [
                {
                    ...questionBlockAttr,
                    ui_config: {
                        siblingRowSelect: {
                            tableCodename: 'Blocks',
                            valueFieldCodename: 'BlockKey',
                            requiredWithRows: true,
                            requireEachTargetReferenced: true
                        }
                    }
                }
            ]
        } as typeof questionsContext
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('WHERE object_id = $1')) return [{ id: 'blocks-id', column_name: 'blocks_rows' }]
            if (sql.includes('WHERE parent_component_id = $1')) {
                return [
                    {
                        column_name: 'block_key',
                        data_type: 'STRING',
                        ui_config: { siblingRowSelectKey: true, generateUuidV7: true }
                    }
                ]
            }
            if (sql.includes('FROM runtime_schema."blocks_rows"')) return [{ block_key: blockKey }]
            if (sql.includes('FROM runtime_schema."questions_rows"')) return [{ block_key: blockKey.toUpperCase() }]
            return []
        })

        await expect(
            validateExistingSiblingRowSelectsForTarget(executor, 'runtime_schema', strictQuestionsContext, recordId, '_upl_deleted = false')
        ).resolves.toBeUndefined()
    })
})
