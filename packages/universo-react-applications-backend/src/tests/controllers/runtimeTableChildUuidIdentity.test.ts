import { createMockDbExecutor } from '../utils/dbMocks'
import { prepareCreateTableChildRows } from '../../controllers/runtimeRowWriteHandlers/createTableChildren'
import {
    prepareBulkUpdateTableChildRows,
    replaceRuntimeTableChildRows
} from '../../controllers/runtimeRowWriteHandlers/bulkUpdateTableChildren'

const uuidV7 = '019f2000-0000-7000-8000-000000000011'
const uuidV7Upper = uuidV7.toUpperCase()
const secondUuidV7 = '019f2000-0000-7000-8000-000000000012'

const tableAttrValues = {
    id: 'blocks-table',
    codename: 'Blocks',
    column_name: 'blocks_rows',
    validation_rules: { minRows: 0 }
}
const tableAttr = tableAttrValues as never

const generatedKeyAttr = {
    id: 'block-key',
    codename: 'BlockKey',
    column_name: 'block_key',
    data_type: 'STRING',
    is_required: true,
    validation_rules: {},
    ui_config: { siblingRowSelectKey: true, generateUuidV7: true }
}

describe('runtime TABLE child UUID v7 identity', () => {
    it('stores create keys and sibling selections in lowercase, including row aliases', async () => {
        const { executor } = createMockDbExecutor()
        const created = await prepareCreateTableChildRows({
            manager: executor,
            schemaIdent: 'runtime_schema',
            tableFieldPath: 'Blocks',
            tableAttr,
            childRows: [{ BlockKey: uuidV7Upper }],
            childAttrs: [generatedKeyAttr] as never
        })

        expect(created.kind).toBe('ok')
        if (created.kind !== 'ok') return
        expect(created.rows[0]?.block_key).toBe(uuidV7)

        const aliases = new Map([['block-one', { tableCodename: 'Blocks', valueFieldCodename: 'BlockKey', key: uuidV7Upper }]])
        const aliasedTarget = await prepareCreateTableChildRows({
            manager: executor,
            schemaIdent: 'runtime_schema',
            tableFieldPath: 'Blocks',
            tableAttr,
            childRows: [{ $rowAlias: 'block-one' }],
            childAttrs: [generatedKeyAttr] as never,
            siblingRowAliases: aliases
        })
        expect(aliasedTarget.kind).toBe('ok')
        if (aliasedTarget.kind !== 'ok') return
        expect(aliasedTarget.rows[0]?.block_key).toBe(uuidV7)

        const selectedKeyAttr = {
            ...generatedKeyAttr,
            ui_config: {
                siblingRowSelect: {
                    tableCodename: 'Blocks',
                    valueFieldCodename: 'BlockKey',
                    labelFieldCodename: 'Title'
                }
            }
        }
        const aliasedSelection = await prepareCreateTableChildRows({
            manager: executor,
            schemaIdent: 'runtime_schema',
            tableFieldPath: 'Questions',
            tableAttr: { ...tableAttrValues, codename: 'Questions' } as never,
            childRows: [{ BlockKey: { $rowRef: 'block-one' } }],
            childAttrs: [selectedKeyAttr] as never,
            siblingRowAliases: aliases
        })
        expect(aliasedSelection.kind).toBe('ok')
        if (aliasedSelection.kind !== 'ok') return
        expect(aliasedSelection.rows[0]?.block_key).toBe(uuidV7)
    })

    it('normalizes bulk generated keys and selector values before persistence', async () => {
        const { executor } = createMockDbExecutor()
        const generated = await prepareBulkUpdateTableChildRows({
            manager: executor,
            schemaIdent: 'runtime_schema',
            tableFieldPath: 'Blocks',
            tableAttr,
            childRows: [{ BlockKey: uuidV7Upper }],
            childAttrs: [generatedKeyAttr] as never
        })
        expect(generated.kind).toBe('ok')
        if (generated.kind !== 'ok') return
        expect(generated.rows[0]?.block_key).toBe(uuidV7)

        const selectorAttr = {
            ...generatedKeyAttr,
            ui_config: {
                siblingRowSelect: {
                    tableCodename: 'Blocks',
                    valueFieldCodename: 'BlockKey',
                    labelFieldCodename: 'Title'
                }
            }
        }
        const selected = await prepareBulkUpdateTableChildRows({
            manager: executor,
            schemaIdent: 'runtime_schema',
            tableFieldPath: 'Questions',
            tableAttr: { ...tableAttrValues, codename: 'Questions' } as never,
            childRows: [{ BlockKey: uuidV7Upper }],
            childAttrs: [selectorAttr] as never
        })
        expect(selected.kind).toBe('ok')
        if (selected.kind !== 'ok') return
        expect(selected.rows[0]?.block_key).toBe(uuidV7)
    })

    it('treats differently cased generated keys as duplicates', async () => {
        const { executor } = createMockDbExecutor()
        const result = await prepareBulkUpdateTableChildRows({
            manager: executor,
            schemaIdent: 'runtime_schema',
            tableFieldPath: 'Blocks',
            tableAttr,
            childRows: [{ BlockKey: uuidV7Upper }, { BlockKey: uuidV7 }],
            childAttrs: [generatedKeyAttr] as never
        })

        expect(result).toMatchObject({ kind: 'failure', statusCode: 400 })
    })

    it('updates nullable columns when every replacement row explicitly clears them', async () => {
        const { executor } = createMockDbExecutor()
        const nullableFieldAttr = {
            id: 'block-note',
            codename: 'Note',
            column_name: 'note',
            data_type: 'STRING',
            is_required: false,
            validation_rules: {},
            ui_config: {}
        }
        const childAttrs = [generatedKeyAttr, nullableFieldAttr]
        const prepared = await prepareBulkUpdateTableChildRows({
            manager: executor,
            schemaIdent: 'runtime_schema',
            tableFieldPath: 'Blocks',
            tableAttr,
            childRows: [
                { BlockKey: uuidV7, note: null },
                { BlockKey: secondUuidV7, note: null }
            ],
            childAttrs: childAttrs as never
        })
        expect(prepared.kind).toBe('ok')
        if (prepared.kind !== 'ok') return
        expect(prepared.rows).toEqual([
            { block_key: uuidV7, note: null },
            { block_key: secondUuidV7, note: null }
        ])

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT id, "block_key"')) {
                return [
                    { id: 'row-one', block_key: uuidV7Upper },
                    { id: 'row-two', block_key: secondUuidV7.toUpperCase() }
                ]
            }
            if (sql.includes('SELECT id, column_name') && sql.includes("data_type = 'TABLE'")) {
                return [{ id: 'blocks-table', column_name: 'blocks_rows' }]
            }
            if (sql.includes('SELECT column_name, data_type, ui_config')) {
                return [
                    {
                        column_name: 'block_key',
                        data_type: 'STRING',
                        ui_config: { siblingRowSelectKey: true, generateUuidV7: true }
                    }
                ]
            }
            if (sql.includes('UPDATE runtime_schema."blocks_rows"')) return [{ id: 'updated-row' }]
            return []
        })

        await replaceRuntimeTableChildRows({
            executor,
            schemaIdent: 'runtime_schema',
            objectCollectionId: 'object-1',
            userId: 'user-1',
            workspacesEnabled: false,
            currentWorkspaceId: null,
            runtimeRowCondition: '_upl_deleted = false',
            runtimeDeleteSetClause: null,
            runtimeDeletedRowCondition: null,
            runtimeRestoreSetClause: null,
            parentRowId: 'parent-row',
            entries: [
                {
                    cmp: tableAttr,
                    childAttrs: childAttrs as never,
                    tabTableName: 'blocks_rows',
                    rows: prepared.rows,
                    childAttrsByColumn: new Map([
                        ['block_key', { column_name: 'block_key', data_type: 'STRING', validation_rules: {} }],
                        ['note', { column_name: 'note', data_type: 'STRING', validation_rules: {} }]
                    ])
                }
            ]
        })

        const updates = executor.query.mock.calls.filter(([sql]) => String(sql).includes('UPDATE runtime_schema."blocks_rows"'))
        expect(updates).toHaveLength(2)
        for (const [sql, values] of updates) {
            expect(String(sql)).toContain('"note" = $2')
            expect(values[1]).toBeNull()
        }
    })
})
