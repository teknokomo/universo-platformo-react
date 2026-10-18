import type { DbExecutor } from '@universo-react/utils'
import { buildCreateTableEntries } from '../../../controllers/runtimeRowWriteHandlers/createTableChildren'
import { buildBulkUpdateTableEntries } from '../../../controllers/runtimeRowWriteHandlers/bulkUpdateTableChildren'

const blocksTable = {
    id: 'blocks-component-id',
    codename: 'Blocks',
    column_name: 'blocks_rows',
    validation_rules: { maxRows: 100 }
} as never

describe('generic TABLE row limits', () => {
    it('rejects 101 Blocks rows through create and bulk-update boundaries', async () => {
        const manager = { query: jest.fn() } as unknown as DbExecutor
        const data = { Blocks: Array.from({ length: 101 }, () => ({})) }
        const expectedFailure = {
            kind: 'failure',
            statusCode: 400,
            body: { error: 'TABLE Blocks allows at most 100 row(s)' }
        }

        await expect(buildCreateTableEntries({ manager, schemaIdent: 'runtime_schema', data, tableAttrs: [blocksTable] })).resolves.toEqual(
            expectedFailure
        )
        await expect(
            buildBulkUpdateTableEntries({ manager, schemaIdent: 'runtime_schema', data, tableAttrs: [blocksTable] })
        ).resolves.toEqual(expectedFailure)
        expect(manager.query).not.toHaveBeenCalled()
    })
})
