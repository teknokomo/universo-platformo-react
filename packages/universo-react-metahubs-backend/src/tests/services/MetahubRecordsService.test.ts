import { ComponentDefinitionDataType } from '@universo-react/types'
import { MetahubRecordsService } from '../../domains/metahubs/services/MetahubRecordsService'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('MetahubRecordsService opaque colour persistence', () => {
    const metahubId = '018f8a78-7b8f-7c1d-a111-222233334560'
    const objectCollectionId = '018f8a78-7b8f-7c1d-a111-222233334561'
    const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'

    const createService = () => {
        const executor = createMockDbExecutor()
        const schemaService = { ensureSchema: jest.fn().mockResolvedValue(schemaName) }
        const objectsService = { findById: jest.fn().mockResolvedValue({ id: objectCollectionId }) }
        const componentsService = {
            findAllFlat: jest.fn().mockResolvedValue([
                {
                    id: 'matrix-component',
                    codename: 'InterpretationMatrix',
                    dataType: ComponentDefinitionDataType.TABLE,
                    isRequired: false,
                    parentComponentId: null,
                    validationRules: {}
                },
                {
                    id: 'fill-colour-component',
                    codename: 'CellFillColor',
                    dataType: ComponentDefinitionDataType.STRING,
                    isRequired: false,
                    parentComponentId: 'matrix-component',
                    validationRules: { format: 'hexColor', pattern: '[unsafe' }
                }
            ])
        }
        const service = new MetahubRecordsService(executor, schemaService as never, objectsService as never, componentsService as never)

        return { executor, service }
    }

    it('canonicalizes hex table child values before inserting the serialized design-time record', async () => {
        const { executor, service } = createService()
        ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT MAX(sort_order)')) return [{ max: 0 }]
            if (sql.includes('INSERT INTO'))
                return [{ id: 'record-1', object_id: objectCollectionId, data: {}, sort_order: 1, _upl_version: 1 }]
            if (sql.includes('SELECT id, sort_order')) return []
            if (sql.includes('SELECT * FROM')) {
                return [{ id: 'record-1', object_id: objectCollectionId, data: {}, sort_order: 1, _upl_version: 1 }]
            }
            return []
        })

        await service.create(metahubId, objectCollectionId, { data: { InterpretationMatrix: [{ CellFillColor: '#abc' }] } }, 'user-1')

        const insertCall = (executor.query as jest.Mock).mock.calls.find(([sql]) => String(sql).includes('INSERT INTO'))
        expect(insertCall?.[1]?.[1]).toBe(JSON.stringify({ InterpretationMatrix: [{ CellFillColor: '#AABBCC' }] }))
    })
})
