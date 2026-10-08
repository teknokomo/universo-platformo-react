import type { DbExecutor } from '@universo-react/utils/database'
import {
    buildSingleTargetWidgetBinding,
    decodeWidgetConfigEnvelope,
    encodeWidgetConfigEnvelope,
    getLayoutWidgetDefinition
} from '@universo-react/types'
import { MetahubComponentsService } from '../../domains/metahubs/services/MetahubComponentsService'
import { MetahubRecordsService } from '../../domains/metahubs/services/MetahubRecordsService'
import { MetahubSchemaService } from '../../domains/metahubs/services/MetahubSchemaService'
import { cloneRecordWidgetBindingsInSubtree } from '../../domains/layouts/services/cloneRecordWidgetSubtree'

const schemaName = 'mhb_0123456789abcdef0123456789abcdef_b1'
const metahubId = '0190a9b5-3cde-7abc-8def-0123456789a1'
const sourceRecordId = '0190a9b5-3cde-7abc-8def-000000000011'
const copiedRecordIds = [
    '0190a9b5-3cde-7abc-8def-000000000021',
    '0190a9b5-3cde-7abc-8def-000000000022',
    '550e8400-e29b-41d4-a716-446655440000'
]

const componentRows = [
    {
        codename: 'Key',
        dataType: 'STRING',
        isRequired: true,
        parentComponentId: null,
        validationRules: { unique: true, maxLength: 128, pattern: '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$' }
    },
    {
        codename: 'Title',
        dataType: 'STRING',
        isRequired: true,
        parentComponentId: null,
        validationRules: { localized: true, maxLength: 255 }
    },
    {
        codename: 'Body',
        dataType: 'STRING',
        isRequired: false,
        parentComponentId: null,
        validationRules: { localized: true, maxLength: 4096 }
    }
]

const createPlacement = (id: string, widgetKey: 'infoCard' | 'overviewTitle', zone: 'left' | 'center') => {
    const definition = getLayoutWidgetDefinition(widgetKey)
    if (!definition) throw new Error(`Missing widget definition: ${widgetKey}`)
    const bindings = buildSingleTargetWidgetBinding(definition, 'content', {
        entityKind: 'object',
        entityCodename: 'Announcements',
        semanticKey: 'feature-1'
    })
    return {
        id,
        widgetKey,
        zone,
        config: encodeWidgetConfigEnvelope({ rendererConfig: {}, neutral: { bindings } }, { templateKey: 'dashboard', widgetKey, zone })
    }
}

describe('cloneRecordWidgetBindingsInSubtree', () => {
    let executor: DbExecutor
    let query: jest.Mock
    let findAllFlat: jest.SpyInstance
    let lockForCopy: jest.SpyInstance
    let createRecord: jest.SpyInstance
    let suggestUniqueComponentValue: jest.SpyInstance

    beforeEach(() => {
        jest.restoreAllMocks()
        let nextCopiedId = 0
        let nextSemanticSuffix = 0
        query = jest.fn(async (sql: string) => {
            if (sql.includes('FROM') && sql.includes('_mhb_objects') && sql.includes('FOR UPDATE')) {
                return [{ id: '0190a9b5-3cde-7abc-8def-000000000001', kind: 'object', codename: 'Announcements', config: {} }]
            }
            if (sql.includes('FROM') && sql.includes('_mhb_elements') && sql.includes('LIMIT 2')) {
                return [
                    {
                        id: sourceRecordId,
                        data: { Key: 'feature-1', Title: { en: 'Feature' }, Body: { en: 'A short description' } },
                        version: 1
                    }
                ]
            }
            throw new Error(`Unexpected clone-record query: ${sql}`)
        })
        executor = {
            query,
            transaction: jest.fn(async (callback: (tx: DbExecutor) => Promise<unknown>) => callback(executor)),
            isReleased: () => false
        }

        jest.spyOn(MetahubSchemaService.prototype, 'ensureSchema').mockResolvedValue(schemaName)
        findAllFlat = jest.spyOn(MetahubComponentsService.prototype, 'findAllFlat').mockResolvedValue(componentRows as never)
        lockForCopy = jest.spyOn(MetahubRecordsService.prototype, 'lockForCopy').mockResolvedValue({
            object: { id: '0190a9b5-3cde-7abc-8def-000000000001', kind: 'object', codename: 'Announcements', config: {} },
            record: {
                id: sourceRecordId,
                data: { Key: 'feature-1', Title: { en: 'Feature' }, Body: { en: 'A short description' } }
            }
        } as never)
        suggestUniqueComponentValue = jest
            .spyOn(MetahubRecordsService.prototype, 'suggestUniqueComponentValue')
            .mockImplementation(async (_metahubId, _objectId, _codename, baseValue) => `${baseValue}-copy-${++nextSemanticSuffix}`)
        createRecord = jest.spyOn(MetahubRecordsService.prototype, 'create').mockImplementation(async (_metahubId, _objectId, input) => {
            const id = copiedRecordIds[nextCopiedId++]
            return { id, data: input.data } as never
        })
    })

    it('copies and rebinds every clone-record widget in a subtree using the locked template policy', async () => {
        const placements = [createPlacement('widget-info', 'infoCard', 'left'), createPlacement('widget-title', 'overviewTitle', 'center')]

        const configs = await cloneRecordWidgetBindingsInSubtree({
            executor,
            metahubId,
            schemaName,
            templateKey: 'dashboard',
            placements,
            userId: '0190a9b5-3cde-7abc-8def-0123456789a2'
        })

        expect(configs.size).toBe(2)
        expect(query).toHaveBeenCalledTimes(5)
        expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('"mhb_0123456789abcdef0123456789abcdef_b1"."_mhb_objects"'), [
            'object',
            'Announcements'
        ])
        expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining('"mhb_0123456789abcdef0123456789abcdef_b1"."_mhb_elements"'), [
            '0190a9b5-3cde-7abc-8def-000000000001',
            'Key',
            'feature-1'
        ])
        expect(query.mock.calls[1][0]).not.toMatch(/FOR SHARE|FOR UPDATE/u)
        expect(query.mock.calls[2][0]).toMatch(/FOR SHARE/u)
        expect(findAllFlat).toHaveBeenCalledTimes(1)
        expect(lockForCopy).toHaveBeenCalledTimes(2)
        expect(lockForCopy.mock.invocationCallOrder[0]).toBeGreaterThan(query.mock.invocationCallOrder[1])
        expect(lockForCopy.mock.invocationCallOrder[0]).toBeLessThan(query.mock.invocationCallOrder[2])
        expect(suggestUniqueComponentValue).toHaveBeenCalledTimes(2)
        expect(createRecord).toHaveBeenCalledTimes(2)
        expect(createRecord.mock.calls.every((call) => call[4] === executor)).toBe(true)

        const first = decodeWidgetConfigEnvelope(configs.get('widget-info'), {
            templateKey: 'dashboard',
            widgetKey: 'infoCard',
            zone: 'left',
            requireBindings: true
        })
        const second = decodeWidgetConfigEnvelope(configs.get('widget-title'), {
            templateKey: 'dashboard',
            widgetKey: 'overviewTitle',
            zone: 'center',
            requireBindings: true
        })
        expect(first.neutral.bindings?.slots[0].targets[0].selector).toEqual({
            kind: 'semantic-key',
            field: 'key',
            value: 'feature-1-copy-1'
        })
        expect(second.neutral.bindings?.slots[0].targets[0].selector).toEqual({
            kind: 'semantic-key',
            field: 'key',
            value: 'feature-1-copy-2'
        })
    })

    it('rejects a clone-record source whose persisted selector is outside the registry policy before any copy work', async () => {
        const placement = createPlacement('widget-info', 'infoCard', 'left')
        const decoded = decodeWidgetConfigEnvelope(placement.config, {
            templateKey: 'dashboard',
            widgetKey: 'infoCard',
            zone: 'left',
            requireBindings: true
        })
        const bindings = decoded.neutral.bindings!
        const malformedBindings = {
            ...bindings,
            slots: bindings.slots.map((slot) => ({
                ...slot,
                targets: slot.targets.map((target) => ({ ...target, selector: { kind: 'record-set' as const } }))
            }))
        }
        const malformedConfig = {
            ...placement.config,
            __layout: {
                ...((placement.config as Record<string, unknown>).__layout as Record<string, unknown>),
                bindings: malformedBindings
            }
        }
        const malformedPlacement = {
            ...placement,
            config: malformedConfig
        }

        await expect(
            cloneRecordWidgetBindingsInSubtree({
                executor,
                metahubId,
                schemaName,
                templateKey: 'dashboard',
                placements: [malformedPlacement]
            })
        ).rejects.toThrow('unsupported record-copy binding')

        expect(query).not.toHaveBeenCalled()
        expect(lockForCopy).not.toHaveBeenCalled()
        expect(createRecord).not.toHaveBeenCalled()
    })

    it('rejects a record created with a non-v7 identifier so the surrounding subtree transaction rolls it back', async () => {
        createRecord.mockImplementationOnce(async (_metahubId, _objectId, input) => ({
            id: copiedRecordIds[2],
            data: input.data
        }))

        await expect(
            cloneRecordWidgetBindingsInSubtree({
                executor,
                metahubId,
                schemaName,
                templateKey: 'dashboard',
                placements: [createPlacement('widget-info', 'infoCard', 'left')]
            })
        ).rejects.toThrow('valid UUID v7 identity')
        expect(createRecord).toHaveBeenCalledTimes(1)
    })
})
