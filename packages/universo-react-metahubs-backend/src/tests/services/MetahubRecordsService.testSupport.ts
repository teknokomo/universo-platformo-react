import { ComponentDefinitionDataType } from '@universo-react/types'
import { MetahubRecordsService } from '../../domains/metahubs/services/MetahubRecordsService'
import { createMockDbExecutor } from '../utils/dbMocks'

export const metahubId = '018f8a78-7b8f-7c1d-a111-222233334560'
export const objectCollectionId = '018f8a78-7b8f-7c1d-a111-222233334561'
export const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
export const recordId = '018f8a78-7b8f-7c1d-a111-222233334562'

const tierComponents = [
    {
        id: 'tier-key-component',
        codename: 'TierKey',
        dataType: ComponentDefinitionDataType.STRING,
        isRequired: false,
        parentComponentId: null,
        validationRules: { maxLength: 64, unique: true }
    },
    {
        id: 'tier-title-component',
        codename: 'Title',
        dataType: ComponentDefinitionDataType.STRING,
        isRequired: false,
        parentComponentId: null,
        validationRules: { maxLength: 255 }
    }
]

export const createService = (overrides: { components?: unknown[]; allComponents?: unknown[] } = {}) => {
    const executor = createMockDbExecutor()
    const schemaService = { ensureSchema: jest.fn().mockResolvedValue(schemaName) }
    const objectsService = { findById: jest.fn().mockResolvedValue({ id: objectCollectionId }) }
    const componentsService = {
        findAllFlat: jest.fn().mockResolvedValue(overrides.components ?? tierComponents),
        getAllComponents: jest.fn().mockResolvedValue(overrides.allComponents ?? [])
    }
    const service = new MetahubRecordsService(executor, schemaService as never, objectsService as never, componentsService as never)

    return { executor, service, objectsService, componentsService }
}
