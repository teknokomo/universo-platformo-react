import { isUuidV7 } from '@universo-react/utils'
import { buildRuntimeSiblingRowAliases, resolveRuntimeSiblingRowReference } from '../../controllers/runtimeSiblingRowAliases'
import { buildCreateTableEntries, prepareCreateTableChildRows } from '../../controllers/runtimeRowWriteHandlers/create'
import {
    buildBulkUpdateTableEntries,
    prepareBulkUpdateTableChildRows,
    replaceRuntimeTableChildRows
} from '../../controllers/runtimeRowWriteHandlers/bulkUpdate'
import { buildRuntimeSoftDeleteSetClause, runtimeCodenameTextSql } from '../../shared/runtimeHelpers'
import { resolveApplicationLifecycleContractFromConfig } from '@universo-react/utils'

const blocksTable = {
    id: 'blocks-id',
    codename: 'Blocks',
    data_type: 'TABLE',
    column_name: 'blocks',
    validation_rules: {}
} as never

const questionsTable = {
    id: 'questions-id',
    codename: 'Questions',
    data_type: 'TABLE',
    column_name: 'questions',
    validation_rules: {}
} as never

const blockKeyAttr = {
    id: 'block-key-id',
    codename: 'BlockKey',
    column_name: 'block_key',
    data_type: 'STRING',
    is_required: true,
    validation_rules: {},
    ui_config: { siblingRowSelectKey: true, generateUuidV7: true }
}

const titleAttr = {
    id: 'block-title-id',
    codename: 'Title',
    column_name: 'title',
    data_type: 'STRING',
    is_required: true,
    validation_rules: {},
    ui_config: {}
}

const questionBlockKeyAttr = {
    id: 'question-block-key-id',
    codename: 'BlockKey',
    column_name: 'block_key',
    data_type: 'STRING',
    is_required: false,
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

const questionTextAttr = {
    id: 'question-text-id',
    codename: 'Question',
    column_name: 'question',
    data_type: 'STRING',
    is_required: true,
    validation_rules: {},
    ui_config: {}
}

const manager = { query: jest.fn(async () => []) } as never

const childMetadataByTable = new Map([
    ['blocks-id', [blockKeyAttr, titleAttr]],
    ['questions-id', [questionBlockKeyAttr, questionTextAttr]]
])

const createMetadataManager = () => ({
    query: jest.fn(async (_sql: string, params?: unknown[]) => childMetadataByTable.get(String(params?.[0])) ?? [])
})

describe('generic runtime sibling row aliases', () => {
    it.each([
        ['parent create', prepareCreateTableChildRows],
        ['atomic bulk replacement', prepareBulkUpdateTableChildRows]
    ])('%s accepts unique UUID v7 sibling keys and rejects invalid or duplicate keys', async (_name, prepareRows) => {
        const key = '019f2000-0000-7000-8000-000000000006'
        const result = await prepareRows({
            manager,
            schemaIdent: 'runtime_schema',
            tableFieldPath: 'Blocks',
            tableAttr: blocksTable,
            childRows: [{ BlockKey: key, Title: 'Introduction' }],
            childAttrs: [blockKeyAttr, titleAttr]
        } as never)
        expect(result).toMatchObject({ kind: 'ok', rows: [{ block_key: key, title: 'Introduction' }] })

        const invalid = await prepareRows({
            manager,
            schemaIdent: 'runtime_schema',
            tableFieldPath: 'Blocks',
            tableAttr: blocksTable,
            childRows: [{ BlockKey: 'not-a-uuid-v7', Title: 'Introduction' }],
            childAttrs: [blockKeyAttr, titleAttr]
        } as never)
        expect(invalid).toMatchObject({
            kind: 'failure',
            statusCode: 400,
            body: { error: 'Invalid generated sibling row key: Blocks.BlockKey' }
        })

        const duplicate = await prepareRows({
            manager,
            schemaIdent: 'runtime_schema',
            tableFieldPath: 'Blocks',
            tableAttr: blocksTable,
            childRows: [
                { BlockKey: key, Title: 'Introduction' },
                { BlockKey: key, Title: 'Second introduction' }
            ],
            childAttrs: [blockKeyAttr, titleAttr]
        } as never)
        expect(duplicate).toMatchObject({
            kind: 'failure',
            statusCode: 400,
            body: { error: 'Duplicate generated sibling row key: Blocks.BlockKey' }
        })
    })

    it('continues to reject explicitly server-owned sibling keys', async () => {
        const result = await prepareCreateTableChildRows({
            manager,
            schemaIdent: 'runtime_schema',
            tableFieldPath: 'Blocks',
            tableAttr: blocksTable,
            childRows: [{ BlockKey: '019f2000-0000-7000-8000-000000000006', Title: 'Introduction' }],
            childAttrs: [{ ...blockKeyAttr, ui_config: { ...blockKeyAttr.ui_config, serverOwned: true } }, titleAttr]
        } as never)
        expect(result).toMatchObject({
            kind: 'failure',
            statusCode: 400,
            body: { error: 'Field is server-owned: Blocks.BlockKey' }
        })
    })

    it('resolves localized TABLE child codenames for create and update metadata queries', async () => {
        const localizedBlockKeyCodename = {
            _schema: '1',
            locales: { en: { content: 'BlockKey' } },
            _primary: 'en'
        }
        const metadataQuery = jest.fn(async (sql: string) => {
            const localizedCodenameProjection = `${runtimeCodenameTextSql('codename')} AS codename`
            const attrs = [
                { ...blockKeyAttr, codename: 'BlockKey' },
                { ...titleAttr, codename: 'Title' }
            ]
            return sql.includes(localizedCodenameProjection) ? attrs : [{ ...attrs[0], codename: localizedBlockKeyCodename }, attrs[1]]
        })
        const localizedMetadataManager = { query: metadataQuery } as never
        const input = { Blocks: [{ Title: 'Introduction' }] }

        const createResult = await buildCreateTableEntries({
            manager: localizedMetadataManager,
            schemaIdent: 'runtime_schema',
            data: input,
            tableAttrs: [blocksTable]
        } as never)
        const updateResult = await buildBulkUpdateTableEntries({
            manager: localizedMetadataManager,
            schemaIdent: 'runtime_schema',
            data: input,
            tableAttrs: [blocksTable]
        } as never)

        expect(createResult).toMatchObject({ kind: 'ok' })
        expect(updateResult).toMatchObject({ kind: 'ok' })
        if (createResult.kind !== 'ok' || updateResult.kind !== 'ok') return

        for (const result of [createResult, updateResult]) {
            expect(result.entries[0]?.childAttrs[0]?.codename).toBe('BlockKey')
            expect(isUuidV7(result.entries[0]?.rows[0]?.block_key)).toBe(true)
        }
        expect(metadataQuery.mock.calls).toHaveLength(2)
    })

    it('updates a referenced sibling row in place under a soft-delete lifecycle when its key is retained', async () => {
        const key = '019f2000-0000-7000-8000-000000000006'
        const query = jest.fn(async (sql: string) => {
            if (sql.includes('SELECT id, "block_key"') && sql.includes('_upl_deleted = true')) return []
            if (sql.includes('FOR UPDATE') && sql.includes('FROM runtime_schema."blocks"')) {
                return [{ id: 'existing-block-row-id', block_key: key }]
            }
            if (sql.includes('UPDATE runtime_schema."blocks"') && sql.includes('RETURNING id')) {
                return [{ id: 'existing-block-row-id' }]
            }
            if (sql.includes('FROM runtime_schema._app_components') && sql.includes('WHERE object_id = $1')) {
                return [{ id: 'blocks-id', column_name: 'blocks' }]
            }
            if (sql.includes('SELECT column_name, data_type, ui_config')) {
                return [{ column_name: 'block_key', data_type: 'STRING', ui_config: blockKeyAttr.ui_config }]
            }
            if (sql.includes('SELECT "block_key" FROM runtime_schema."blocks"')) return [{ block_key: key }]
            if (sql.includes('SELECT parent.column_name AS table_name,') && sql.includes('child.column_name AS value_column')) {
                return [{ table_name: 'questions', value_column: 'block_key', required_with_rows: null }]
            }
            if (sql.includes('FROM runtime_schema."questions"')) return [{ block_key: key }]
            return []
        })
        const rows = [{ block_key: key, title: 'Updated introduction' }]
        const childAttrsByColumn = new Map([
            ['block_key', { column_name: 'block_key', data_type: 'STRING', validation_rules: {} }],
            ['title', { column_name: 'title', data_type: 'STRING', validation_rules: {} }]
        ])

        const replacementResult = await replaceRuntimeTableChildRows({
            executor: { query } as never,
            schemaIdent: 'runtime_schema',
            objectCollectionId: 'assessment-object-id',
            userId: 'test-user-id',
            workspacesEnabled: false,
            currentWorkspaceId: null,
            runtimeRowCondition: '_upl_deleted = false AND _app_deleted = false',
            runtimeDeleteSetClause: '_app_deleted = true, _app_deleted_by = $1',
            runtimeDeletedRowCondition: '_upl_deleted = true AND _app_deleted = true',
            runtimeRestoreSetClause:
                '_upl_deleted = false, _upl_deleted_at = NULL, _upl_updated_by = $1, _app_deleted = false, _app_deleted_at = NULL, _upl_delete_cascade_id = NULL',
            parentRowId: 'assessment-row-id',
            entries: [
                {
                    cmp: blocksTable,
                    childAttrs: [blockKeyAttr, titleAttr],
                    tabTableName: 'blocks',
                    rows,
                    childAttrsByColumn
                }
            ]
        } as never).then(
            () => ({ statusCode: 200 }),
            (error: { statusCode?: number; body?: unknown }) => ({ statusCode: error.statusCode, body: error.body })
        )
        expect(replacementResult).toEqual({ statusCode: 200 })

        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE runtime_schema."blocks"'),
            expect.arrayContaining([key, 'Updated introduction'])
        )
        expect(query).not.toHaveBeenCalledWith(expect.stringContaining('DELETE FROM runtime_schema."blocks"'), expect.any(Array))
        expect(query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO runtime_schema."blocks"'), expect.any(Array))
    })

    it('soft-deletes removed keyed rows without repeating update audit columns', async () => {
        const key = '019f2000-0000-7000-8000-000000000006'
        const query = jest.fn(async (sql: string, _params?: unknown[]) => {
            if (sql.includes('SELECT id, "block_key"') && sql.includes('_upl_deleted = false')) {
                return [{ id: 'removed-block-row-id', block_key: key }]
            }
            if (sql.includes('SELECT id, "block_key"') && sql.includes('_upl_deleted = true')) return []
            if (sql.includes('SELECT parent.column_name AS table_name,') && sql.includes('JOIN')) return []
            if (sql.includes('FROM runtime_schema._app_components') && sql.includes('WHERE object_id = $1')) {
                return [{ id: 'blocks-id', column_name: 'blocks' }]
            }
            if (sql.includes('SELECT column_name, data_type, ui_config')) {
                return [{ column_name: 'block_key', data_type: 'STRING', ui_config: blockKeyAttr.ui_config }]
            }
            if (sql.includes('UPDATE runtime_schema."blocks"') && sql.includes('RETURNING id')) {
                return [{ id: 'removed-block-row-id' }]
            }
            return []
        })

        await replaceRuntimeTableChildRows({
            executor: { query } as never,
            schemaIdent: 'runtime_schema',
            objectCollectionId: 'assessment-object-id',
            userId: 'test-user-id',
            workspacesEnabled: false,
            currentWorkspaceId: null,
            runtimeRowCondition: '_upl_deleted = false AND _app_deleted = false',
            runtimeDeleteSetClause: buildRuntimeSoftDeleteSetClause('$1', resolveApplicationLifecycleContractFromConfig({}), {}),
            runtimeDeletedRowCondition: '_upl_deleted = true AND _app_deleted = true',
            runtimeRestoreSetClause: '_upl_deleted = false, _app_deleted = false',
            parentRowId: 'assessment-row-id',
            entries: [
                {
                    cmp: blocksTable,
                    childAttrs: [blockKeyAttr, titleAttr],
                    tabTableName: 'blocks',
                    rows: [],
                    childAttrsByColumn: new Map([
                        ['block_key', { column_name: 'block_key', data_type: 'STRING', validation_rules: {} }],
                        ['title', { column_name: 'title', data_type: 'STRING', validation_rules: {} }]
                    ])
                }
            ]
        } as never)

        const deleteCall = query.mock.calls.find(([sql]) => sql.includes('UPDATE runtime_schema."blocks"') && sql.includes('RETURNING id'))
        expect(deleteCall).toBeDefined()
        expect(deleteCall?.[0].match(/_upl_updated_at\s*=/gu)).toHaveLength(1)
        expect(deleteCall?.[0].match(/_upl_updated_by\s*=/gu)).toHaveLength(1)
        expect(deleteCall?.[0]).toContain('_upl_version = COALESCE(_upl_version, 1) + 1')
        expect(deleteCall?.[1]).toEqual(['test-user-id', 'removed-block-row-id', 'assessment-row-id'])
    })

    it('reuses a matching soft-deleted sibling row so a later parent restore cannot reveal duplicate keys', async () => {
        const key = '019f2000-0000-7000-8000-000000000006'
        const deletedRowId = 'deleted-block-row-id'
        const query = jest.fn(async (sql: string, _params?: unknown[]) => {
            if (sql.includes('SELECT id, "block_key"') && sql.includes('_upl_deleted = false')) return []
            if (sql.includes('SELECT id, "block_key"') && sql.includes('_upl_deleted = true')) {
                return [{ id: deletedRowId, block_key: key }]
            }
            if (sql.includes('UPDATE runtime_schema."blocks"') && sql.includes('RETURNING id')) {
                return [{ id: deletedRowId }]
            }
            if (sql.includes('FROM runtime_schema._app_components') && sql.includes('WHERE object_id = $1')) {
                return [{ id: 'blocks-id', column_name: 'blocks' }]
            }
            if (sql.includes('SELECT column_name, data_type, ui_config')) {
                return [{ column_name: 'block_key', data_type: 'STRING', ui_config: blockKeyAttr.ui_config }]
            }
            if (sql.includes('SELECT "block_key" FROM runtime_schema."blocks"')) return [{ block_key: key }]
            if (sql.includes('SELECT parent.column_name AS table_name,') && sql.includes('child.column_name AS value_column')) {
                return [{ table_name: 'questions', value_column: 'block_key', required_with_rows: null }]
            }
            if (sql.includes('FROM runtime_schema."questions"')) return [{ block_key: key }]
            return []
        })

        await replaceRuntimeTableChildRows({
            executor: { query } as never,
            schemaIdent: 'runtime_schema',
            objectCollectionId: 'assessment-object-id',
            userId: 'test-user-id',
            workspacesEnabled: false,
            currentWorkspaceId: null,
            runtimeRowCondition: '_upl_deleted = false AND _app_deleted = false',
            runtimeDeleteSetClause: '_upl_deleted = true, _app_deleted = true',
            runtimeDeletedRowCondition: '_upl_deleted = true AND _app_deleted = true',
            runtimeRestoreSetClause:
                '_upl_deleted = false, _upl_deleted_at = NULL, _upl_updated_by = $1, _app_deleted = false, _app_deleted_at = NULL, _upl_delete_cascade_id = NULL',
            parentRowId: 'assessment-row-id',
            entries: [
                {
                    cmp: blocksTable,
                    childAttrs: [blockKeyAttr, titleAttr],
                    tabTableName: 'blocks',
                    rows: [{ block_key: key, title: 'Restored introduction' }],
                    childAttrsByColumn: new Map([
                        ['block_key', { column_name: 'block_key', data_type: 'STRING', validation_rules: {} }],
                        ['title', { column_name: 'title', data_type: 'STRING', validation_rules: {} }]
                    ])
                }
            ]
        } as never)

        const restoreCall = query.mock.calls.find(([sql]) => sql.includes('UPDATE runtime_schema."blocks"'))
        expect(restoreCall?.[0]).toContain('_upl_deleted = false')
        expect(restoreCall?.[0]).toContain('_app_deleted = false')
        expect(restoreCall?.[0]).toContain('WHERE id = $5')
        expect(restoreCall?.[1]).toEqual(['test-user-id', key, 'Restored introduction', 0, deletedRowId, 'assessment-row-id'])
        expect(query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO runtime_schema."blocks"'), expect.any(Array))
        expect(query).not.toHaveBeenCalledWith(expect.stringContaining('DELETE FROM runtime_schema."blocks"'), expect.any(Array))
    })

    it('rejects an existing active/deleted duplicate sibling key before changing any row', async () => {
        const duplicateKey = '019f2000-0000-7000-8000-000000000006'
        const query = jest.fn(async (sql: string, _params?: unknown[]) => {
            if (sql.includes('SELECT id, "block_key"') && sql.includes('_upl_deleted = false')) {
                return [{ id: 'active-block-row-id', block_key: duplicateKey }]
            }
            if (sql.includes('SELECT id, "block_key"') && sql.includes('_upl_deleted = true')) {
                return [{ id: 'deleted-block-row-id', block_key: duplicateKey }]
            }
            return []
        })

        const result = await replaceRuntimeTableChildRows({
            executor: { query } as never,
            schemaIdent: 'runtime_schema',
            objectCollectionId: 'assessment-object-id',
            userId: 'test-user-id',
            workspacesEnabled: false,
            currentWorkspaceId: null,
            runtimeRowCondition: '_upl_deleted = false AND _app_deleted = false',
            runtimeDeleteSetClause: '_upl_deleted = true, _app_deleted = true',
            runtimeDeletedRowCondition: '_upl_deleted = true AND _app_deleted = true',
            runtimeRestoreSetClause:
                '_upl_deleted = false, _upl_deleted_at = NULL, _upl_updated_by = $1, _app_deleted = false, _app_deleted_at = NULL, _upl_delete_cascade_id = NULL',
            parentRowId: 'assessment-row-id',
            entries: [
                {
                    cmp: blocksTable,
                    childAttrs: [blockKeyAttr, titleAttr],
                    tabTableName: 'blocks',
                    rows: [{ block_key: duplicateKey, title: 'Introduction' }],
                    childAttrsByColumn: new Map([
                        ['block_key', { column_name: 'block_key', data_type: 'STRING', validation_rules: {} }],
                        ['title', { column_name: 'title', data_type: 'STRING', validation_rules: {} }]
                    ])
                }
            ]
        } as never).then(
            () => ({ statusCode: 200 }),
            (error: { statusCode?: number; body?: unknown }) => ({ statusCode: error.statusCode, body: error.body })
        )

        expect(result).toEqual({
            statusCode: 409,
            body: { error: 'Duplicate generated sibling row keys exist in this TABLE' }
        })
        expect(query.mock.calls.every(([sql]) => !/^(\s*)(UPDATE|DELETE|INSERT)\b/i.test(String(sql)))).toBe(true)
    })

    it('preserves input order when a keyed TABLE update inserts a row between retained rows', async () => {
        const retainedFirstKey = '019f2000-0000-7000-8000-000000000006'
        const insertedKey = '019f2000-0000-7000-8000-000000000007'
        const retainedLastKey = '019f2000-0000-7000-8000-000000000008'
        const retainedRows = [
            { id: 'retained-first-row-id', block_key: retainedFirstKey },
            { id: 'retained-last-row-id', block_key: retainedLastKey }
        ]
        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('SELECT id, "block_key"') && sql.includes('_upl_deleted = false')) return retainedRows
            if (sql.includes('SELECT id, "block_key"') && sql.includes('_upl_deleted = true')) return []
            if (sql.includes('UPDATE runtime_schema."blocks"') && sql.includes('RETURNING id')) {
                return [{ id: params?.[params.length - 2] }]
            }
            if (sql.includes('FROM runtime_schema._app_components') && sql.includes('WHERE object_id = $1')) {
                return [{ id: 'blocks-id', column_name: 'blocks' }]
            }
            if (sql.includes('SELECT column_name, data_type, ui_config')) {
                return [{ column_name: 'block_key', data_type: 'STRING', ui_config: blockKeyAttr.ui_config }]
            }
            if (sql.includes('SELECT "block_key" FROM runtime_schema."blocks"')) {
                return [{ block_key: retainedFirstKey }, { block_key: insertedKey }, { block_key: retainedLastKey }]
            }
            if (sql.includes('SELECT parent.column_name AS table_name,') && sql.includes('child.column_name AS value_column')) {
                return []
            }
            return []
        })

        await replaceRuntimeTableChildRows({
            executor: { query } as never,
            schemaIdent: 'runtime_schema',
            objectCollectionId: 'assessment-object-id',
            userId: 'test-user-id',
            workspacesEnabled: false,
            currentWorkspaceId: null,
            runtimeRowCondition: '_upl_deleted = false AND _app_deleted = false',
            runtimeDeleteSetClause: '_upl_deleted = true, _app_deleted = true',
            runtimeDeletedRowCondition: '_upl_deleted = true AND _app_deleted = true',
            runtimeRestoreSetClause:
                '_upl_deleted = false, _upl_deleted_at = NULL, _upl_updated_by = $1, _app_deleted = false, _app_deleted_at = NULL, _upl_delete_cascade_id = NULL',
            parentRowId: 'assessment-row-id',
            entries: [
                {
                    cmp: blocksTable,
                    childAttrs: [blockKeyAttr, titleAttr],
                    tabTableName: 'blocks',
                    rows: [
                        { block_key: retainedFirstKey, title: 'Retained block A' },
                        { block_key: insertedKey, title: 'New block B' },
                        { block_key: retainedLastKey, title: 'Retained block C' }
                    ],
                    childAttrsByColumn: new Map([
                        ['block_key', { column_name: 'block_key', data_type: 'STRING', validation_rules: {} }],
                        ['title', { column_name: 'title', data_type: 'STRING', validation_rules: {} }]
                    ])
                }
            ]
        } as never)

        const insertCall = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO runtime_schema."blocks"'))
        expect(insertCall?.[1]).toEqual(['assessment-row-id', 1, 'test-user-id', insertedKey, 'New block B'])
    })

    it('generates request-local server UUID v7 aliases and rejects duplicate aliases', () => {
        const result = buildRuntimeSiblingRowAliases([
            {
                tableCodename: 'Blocks',
                childAttrs: [blockKeyAttr, titleAttr],
                childRows: [{ $rowAlias: 'intro', Title: 'Introduction' }]
            }
        ])

        expect('error' in result).toBe(false)
        if ('error' in result) return
        const target = result.aliases.get('intro')
        expect(target).toMatchObject({ tableCodename: 'Blocks', valueFieldCodename: 'BlockKey' })
        expect(isUuidV7(target?.key)).toBe(true)
        expect(
            buildRuntimeSiblingRowAliases([
                {
                    tableCodename: 'Blocks',
                    childAttrs: [blockKeyAttr],
                    childRows: [{ $rowAlias: 'same' }, { $rowAlias: 'same' }]
                }
            ])
        ).toEqual({ error: 'Sibling row aliases must be unique within one request' })
    })

    it('resolves a reference only through matching sibling selector metadata', () => {
        const aliases = new Map([
            ['intro', { tableCodename: 'Blocks', valueFieldCodename: 'BlockKey', key: '019f2000-0000-7000-8000-000000000006' }]
        ])

        expect(resolveRuntimeSiblingRowReference({ $rowRef: 'intro' }, questionBlockKeyAttr, aliases)).toEqual({
            value: '019f2000-0000-7000-8000-000000000006'
        })
        expect(resolveRuntimeSiblingRowReference({ $rowRef: 'missing' }, questionBlockKeyAttr, aliases)).toHaveProperty('error')
        expect(resolveRuntimeSiblingRowReference({ $rowRef: 'intro' }, questionTextAttr, aliases)).toHaveProperty('error')
        expect(resolveRuntimeSiblingRowReference({ $rowRef: 'intro', extra: true }, questionBlockKeyAttr, aliases)).toHaveProperty('error')
    })

    it.each([
        ['parent create', prepareCreateTableChildRows],
        ['atomic bulk replacement', prepareBulkUpdateTableChildRows]
    ])('%s uses the server key for a matching sibling reference', async (_name, prepareRows) => {
        const aliasResult = buildRuntimeSiblingRowAliases([
            {
                tableCodename: 'Blocks',
                childAttrs: [blockKeyAttr, titleAttr],
                childRows: [{ $rowAlias: 'intro', Title: 'Introduction' }]
            }
        ])
        if ('error' in aliasResult) throw new Error(aliasResult.error)

        const blockResult = await prepareRows({
            manager,
            schemaIdent: 'runtime_schema',
            tableFieldPath: 'Blocks',
            tableAttr: blocksTable,
            childRows: [{ $rowAlias: 'intro', Title: 'Introduction' }],
            childAttrs: [blockKeyAttr, titleAttr],
            siblingRowAliases: aliasResult.aliases
        } as never)
        const questionResult = await prepareRows({
            manager,
            schemaIdent: 'runtime_schema',
            tableFieldPath: 'Questions',
            tableAttr: questionsTable,
            childRows: [{ BlockKey: { $rowRef: 'intro' }, Question: 'Question one' }],
            childAttrs: [questionBlockKeyAttr, questionTextAttr],
            siblingRowAliases: aliasResult.aliases
        } as never)

        expect(blockResult.kind).toBe('ok')
        expect(questionResult.kind).toBe('ok')
        if (blockResult.kind !== 'ok' || questionResult.kind !== 'ok') return
        expect(isUuidV7(blockResult.rows[0]?.block_key)).toBe(true)
        expect(blockResult.rows[0]?.block_key).toBe(aliasResult.aliases.get('intro')?.key)
        expect(questionResult.rows[0]?.block_key).toBe(blockResult.rows[0]?.block_key)
    })

    it('resolves aliases in generic parent create and atomic bulk TABLE builders regardless of table order', async () => {
        const data = {
            Blocks: [{ $rowAlias: 'intro', Title: 'Introduction' }],
            Questions: [{ BlockKey: { $rowRef: 'intro' }, Question: 'Question one' }]
        }
        const tableAttrs = [questionsTable, blocksTable] as never

        const createResult = await buildCreateTableEntries({
            manager: createMetadataManager() as never,
            schemaIdent: 'runtime_schema',
            data,
            tableAttrs
        })
        const bulkResult = await buildBulkUpdateTableEntries({
            manager: createMetadataManager() as never,
            schemaIdent: 'runtime_schema',
            data,
            tableAttrs
        })

        expect(createResult.kind).toBe('ok')
        expect(bulkResult.kind).toBe('ok')
        if (createResult.kind !== 'ok' || bulkResult.kind !== 'ok') return
        for (const entries of [createResult.entries, bulkResult.entries]) {
            const blockEntry = entries.find((entry) => entry.cmp.codename === 'Blocks')
            const questionEntry = entries.find((entry) => entry.cmp.codename === 'Questions')
            const blockKey = blockEntry?.rows[0]?.block_key
            expect(isUuidV7(blockKey)).toBe(true)
            expect(questionEntry?.rows[0]?.block_key).toBe(blockKey)
        }
    })

    it('rejects references that do not identify a declared target row', async () => {
        const result = await buildCreateTableEntries({
            manager: createMetadataManager() as never,
            schemaIdent: 'runtime_schema',
            data: {
                Blocks: [{ $rowAlias: 'intro', Title: 'Introduction' }],
                Questions: [{ BlockKey: { $rowRef: 'unknown' }, Question: 'Question one' }]
            },
            tableAttrs: [blocksTable, questionsTable] as never
        })

        expect(result).toMatchObject({ kind: 'failure', statusCode: 400 })
    })
})
