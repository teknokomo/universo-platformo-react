import { describe, expect, it, jest } from '@jest/globals'
import {
    buildSingleTargetWidgetBinding,
    decodeWidgetConfigEnvelope,
    encodeWidgetConfigEnvelope,
    getLayoutWidgetDefinition
} from '@universo-react/types'
import { duplicateMarketingWidgetRecordAndPlace } from '../../domains/layouts/services/marketingWidgetRecordDuplicate'

const mockPersisted = { records: [] as Array<Record<string, unknown>>, placements: [] as Array<Record<string, unknown>> }
const mockLockForCopy = jest.fn()
const mockSuggestUniqueComponentValue = jest.fn()
const mockCreateRecord = jest.fn()
const mockFindComponents = jest.fn()
const mockAssignPlacement = jest.fn()

const runFakeSavepoint = async (work: (tx: typeof mockTx) => Promise<unknown>) => {
    const recordsBefore = [...mockPersisted.records]
    const placementsBefore = [...mockPersisted.placements]
    try {
        return await work(mockTx)
    } catch (error) {
        mockPersisted.records.splice(0, mockPersisted.records.length, ...recordsBefore)
        mockPersisted.placements.splice(0, mockPersisted.placements.length, ...placementsBefore)
        throw error
    }
}

const mockTx = {
    query: jest.fn(),
    transaction: jest.fn((work: (tx: typeof mockTx) => Promise<unknown>) => runFakeSavepoint(work)),
    isReleased: () => false
}
const mockOuter = {
    query: jest.fn(),
    transaction: jest.fn((work: (tx: typeof mockTx) => Promise<unknown>) => runFakeSavepoint(work)),
    isReleased: () => false
}

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    __esModule: true,
    MetahubSchemaService: class {
        constructor(_executor: unknown) {}
        ensureSchema() {
            return Promise.resolve('mhb_test_b1')
        }
    }
}))

jest.mock('../../domains/metahubs/services/MetahubObjectsService', () => ({
    __esModule: true,
    MetahubObjectsService: class {
        constructor(_executor: unknown, _schemaService: unknown) {}
    }
}))

jest.mock('../../domains/metahubs/services/MetahubComponentsService', () => ({
    __esModule: true,
    MetahubComponentsService: class {
        constructor(_executor: unknown, _schemaService: unknown) {}
        findAllFlat(...args: unknown[]) {
            return mockFindComponents(...args)
        }
    }
}))

jest.mock('../../domains/metahubs/services/MetahubRecordsService', () => ({
    __esModule: true,
    MetahubRecordsService: class {
        constructor(_executor: unknown, _schemaService: unknown, _objectsService: unknown, _componentsService: unknown) {}
        lockForCopy(...args: unknown[]) {
            return mockLockForCopy(...args)
        }
        suggestUniqueComponentValue(...args: unknown[]) {
            return mockSuggestUniqueComponentValue(...args)
        }
        create(...args: unknown[]) {
            return mockCreateRecord(...args)
        }
    }
}))

jest.mock('../../domains/layouts/services/MetahubLayoutsService', () => ({
    __esModule: true,
    MetahubLayoutsService: class {
        constructor(private readonly executor: typeof mockTx, _schemaService: unknown) {}
        assignLayoutZoneWidget(...args: unknown[]) {
            return this.executor.transaction(() => mockAssignPlacement(...args))
        }
    }
}))

const metahubId = '0190a9b5-3cde-7abc-8def-0123456789a0'
const layoutId = '0190a9b5-3cde-7abc-8def-0123456789a1'
const entityId = '0190a9b5-3cde-7abc-8def-0123456789a2'
const sourceRecordId = '0190a9b5-3cde-7abc-8def-0123456789a3'
const copiedRecordId = '0190a9b5-3cde-7abc-8def-0123456789a4'
const placementId = '0190a9b5-3cde-7abc-8def-0123456789a5'
const userId = '0190a9b5-3cde-7abc-8def-0123456789a6'
const sourceSemanticKey = 'image-card'
const copiedSemanticKey = 'image-card-copy'

const widgetConfig = () => {
    const definition = getLayoutWidgetDefinition('marketing.image')
    if (!definition) throw new Error('marketing.image must be registered')
    const bindings = buildSingleTargetWidgetBinding(definition, 'content', {
        entityKind: 'object',
        entityCodename: 'MarketingPageImage',
        semanticKey: sourceSemanticKey
    })
    return encodeWidgetConfigEnvelope(
        { rendererConfig: { instanceKey: '0190a9b5-3cde-7abc-8def-0123456789b1', height: 320 }, neutral: { bindings } },
        { templateKey: 'marketing-page', widgetKey: 'marketing.image', zone: 'marketing-main' }
    )
}

const request = () => ({
    zone: 'marketing-main' as const,
    widgetKey: 'marketing.image' as const,
    config: widgetConfig(),
    expectedVersion: 8,
    recordCopy: {
        entityId,
        recordId: sourceRecordId,
        sourceKey: 'MarketingPageImage',
        sourceSemanticKey,
        slot: 'content'
    }
})

// This fake checks transaction orchestration/savepoint nesting only; the E2E
// stale-version case verifies rollback against persisted Supabase rows.
const transactionExecutor = {
    transaction: jest.fn((work: (tx: typeof mockOuter) => Promise<unknown>) => work(mockOuter)),
    query: jest.fn(),
    isReleased: () => false
}

describe('duplicateMarketingWidgetRecordAndPlace', () => {
    beforeEach(() => {
        mockPersisted.records.length = 0
        mockPersisted.placements.length = 0
        jest.clearAllMocks()

        mockLockForCopy.mockResolvedValue({
            object: { id: entityId, kind: 'object', codename: 'MarketingPageImage' },
            policy: undefined,
            record: { id: sourceRecordId, data: { ImageKey: sourceSemanticKey, Title: 'Campaign image' } }
        })
        mockFindComponents.mockResolvedValue([
            {
                codename: 'ImageKey',
                dataType: 'STRING',
                parentComponentId: null,
                isRequired: true,
                validationRules: { unique: true, maxLength: 128, pattern: '^[a-z][a-z0-9-]*$' }
            }
        ])
        mockSuggestUniqueComponentValue.mockResolvedValue(copiedSemanticKey)
        mockCreateRecord.mockImplementation(async (_metahubId, objectCollectionId, input) => {
            const created = {
                id: copiedRecordId,
                objectCollectionId,
                data: input.data,
                sortOrder: 2,
                version: 1
            }
            mockPersisted.records.push(created)
            return created
        })
        mockAssignPlacement.mockImplementation(async (_metahubId, assignedLayoutId, input) => {
            const placement = {
                id: placementId,
                layoutId: assignedLayoutId,
                zone: input.zone,
                widgetKey: input.widgetKey,
                config: input.config,
                sortOrder: 1,
                isActive: true,
                version: 1
            }
            mockPersisted.placements.push(placement)
            return placement
        })
    })

    it('copies the source and binds the normal placement DTO to the copied semantic key', async () => {
        const result = await duplicateMarketingWidgetRecordAndPlace({
            executor: transactionExecutor,
            metahubId,
            layoutId,
            userId,
            request: request()
        })

        expect(mockLockForCopy).toHaveBeenCalledWith(metahubId, entityId, sourceRecordId, userId, mockTx)
        expect(mockSuggestUniqueComponentValue).toHaveBeenCalledWith(
            metahubId,
            entityId,
            'ImageKey',
            sourceSemanticKey,
            userId,
            { maxLength: 128, pattern: '^[a-z][a-z0-9-]*$', format: null },
            mockTx
        )
        expect(mockCreateRecord).toHaveBeenCalledWith(
            metahubId,
            entityId,
            { data: { ImageKey: copiedSemanticKey, Title: 'Campaign image' }, createdBy: userId },
            userId,
            mockTx
        )
        expect(mockOuter.transaction).toHaveBeenCalledTimes(1)
        expect(mockTx.transaction).toHaveBeenCalledTimes(1)
        expect(mockTx.query.mock.invocationCallOrder[0]).toBeLessThan(mockLockForCopy.mock.invocationCallOrder[0])
        expect(mockAssignPlacement).toHaveBeenCalledWith(
            metahubId,
            layoutId,
            expect.objectContaining({ expectedVersion: 8, zone: 'marketing-main', widgetKey: 'marketing.image' }),
            userId
        )

        const assignedConfig = mockAssignPlacement.mock.calls[0][2].config
        const decoded = decodeWidgetConfigEnvelope(assignedConfig, {
            templateKey: 'marketing-page',
            widgetKey: 'marketing.image',
            zone: 'marketing-main',
            requireBindings: true
        })
        expect(decoded.neutral.bindings?.slots.find(({ slot }) => slot === 'content')?.targets[0]?.selector).toEqual({
            kind: 'semantic-key',
            field: 'key',
            value: copiedSemanticKey
        })
        expect(decoded.rendererConfig).toEqual({ instanceKey: '0190a9b5-3cde-7abc-8def-0123456789b1', height: 320 })
        expect(result).toMatchObject({ id: placementId, layoutId, zone: 'marketing-main', widgetKey: 'marketing.image' })
        expect(result).not.toHaveProperty('copyOptions')
        expect(mockPersisted.records).toHaveLength(1)
        expect(mockPersisted.placements).toHaveLength(1)
    })

    it('rolls back the copied record and inserted placement when assignment fails after the copy', async () => {
        mockAssignPlacement.mockImplementationOnce(async (_metahubId, assignedLayoutId, input) => {
            mockPersisted.placements.push({ id: placementId, layoutId: assignedLayoutId, config: input.config })
            throw new Error('Injected placement failure')
        })

        await expect(
            duplicateMarketingWidgetRecordAndPlace({
                executor: transactionExecutor,
                metahubId,
                layoutId,
                userId,
                request: request()
            })
        ).rejects.toThrow('Injected placement failure')

        expect(mockCreateRecord).toHaveBeenCalledTimes(1)
        expect(mockAssignPlacement).toHaveBeenCalledTimes(1)
        expect(mockOuter.transaction).toHaveBeenCalledTimes(1)
        expect(mockTx.transaction).toHaveBeenCalledTimes(1)
        expect(mockPersisted.records).toEqual([])
        expect(mockPersisted.placements).toEqual([])
    })
})
