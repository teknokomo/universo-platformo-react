import { resolvePreferredCatalogIdFromGlobalMenu } from '../../controllers/runtimeRowsController'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('runtimeRowsController startup catalog resolution', () => {
    it('derives startup catalog bindings from the global default or active layout only', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('information_schema.tables')) {
                return [{ layoutsExists: true, widgetsExists: true }]
            }

            if (sql.includes('FROM runtime_schema._app_layouts')) {
                expect(sql).toContain('catalog_id IS NULL')
                return [{ id: 'global-layout-1' }]
            }

            if (sql.includes('FROM runtime_schema._app_widgets')) {
                return [{ config: { bindToHub: true, boundHubId: 'hub-1' } }]
            }

            if (sql.includes("config->'hubs' @>")) {
                return [{ id: 'catalog-1' }]
            }

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            resolvePreferredCatalogIdFromGlobalMenu({
                manager: executor,
                schemaName: 'runtime_schema',
                schemaIdent: 'runtime_schema'
            })
        ).resolves.toBe('catalog-1')

        expect(executor.query).toHaveBeenCalled()
    })
})
