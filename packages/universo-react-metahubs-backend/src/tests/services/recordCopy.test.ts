import { describe, expect, it, jest } from '@jest/globals'
import { ComponentDefinitionDataType } from '@universo-react/types'
import type { SqlQueryable } from '@universo-react/utils/database'
import type { MetahubRecordsService } from '../../domains/metahubs/services/MetahubRecordsService'
import { prepareRecordCopy } from '../../domains/metahubs/services/recordCopy'

describe('prepareRecordCopy', () => {
    it('removes optional table rows when child-table copying is disabled', async () => {
        const db = { query: jest.fn() } as unknown as SqlQueryable
        const recordsService = {
            suggestUniqueComponentValue: jest.fn()
        } as unknown as MetahubRecordsService

        const prepared = await prepareRecordCopy({
            metahubId: 'metahub-1',
            objectCollectionId: '0190a9b5-3cde-7abc-8def-0123456789a1',
            sourceData: { OptionalRows: [{ label: 'Optional row' }] },
            components: [
                {
                    codename: 'OptionalRows',
                    dataType: ComponentDefinitionDataType.TABLE,
                    parentComponentId: null,
                    isRequired: false,
                    validationRules: {}
                }
            ],
            recordsService,
            copyChildTables: false,
            db
        })

        expect(prepared).toEqual({
            data: {},
            copyOptions: { copyChildTables: false },
            hasRequiredChildTables: false
        })
        expect(recordsService.suggestUniqueComponentValue).not.toHaveBeenCalled()
    })

    it('preserves all table rows when a required table exists and re-suffixes only unique root components', async () => {
        const db = { query: jest.fn() } as unknown as SqlQueryable
        const recordsService = {
            suggestUniqueComponentValue: jest.fn(async (_metahubId, _objectId, codename: string) => `${codename}-copy`)
        } as unknown as MetahubRecordsService

        const prepared = await prepareRecordCopy({
            metahubId: 'metahub-1',
            objectCollectionId: '0190a9b5-3cde-7abc-8def-0123456789a1',
            sourceData: {
                ImageKey: 'image-card',
                AssetKey: 'asset-card',
                RequiredRows: [{ label: 'Required row' }],
                OptionalRows: [{ label: 'Optional row' }],
                ChildKey: 'nested-value'
            },
            components: [
                {
                    codename: 'ImageKey',
                    dataType: ComponentDefinitionDataType.STRING,
                    parentComponentId: null,
                    isRequired: true,
                    validationRules: { unique: true, maxLength: 64, pattern: '^[a-z][a-z0-9-]*$' }
                },
                {
                    codename: 'AssetKey',
                    dataType: ComponentDefinitionDataType.STRING,
                    parentComponentId: null,
                    isRequired: false,
                    validationRules: { unique: true }
                },
                {
                    codename: 'RequiredRows',
                    dataType: ComponentDefinitionDataType.TABLE,
                    parentComponentId: null,
                    isRequired: false,
                    validationRules: { minRows: 1 }
                },
                {
                    codename: 'OptionalRows',
                    dataType: ComponentDefinitionDataType.TABLE,
                    parentComponentId: null,
                    isRequired: false,
                    validationRules: {}
                },
                {
                    codename: 'ChildKey',
                    dataType: ComponentDefinitionDataType.STRING,
                    parentComponentId: 'table-parent',
                    isRequired: false,
                    validationRules: { unique: true }
                }
            ],
            recordsService,
            userId: '0190a9b5-3cde-7abc-8def-0123456789a2',
            copyChildTables: false,
            db
        })

        expect(prepared).toEqual({
            data: {
                ImageKey: 'ImageKey-copy',
                AssetKey: 'AssetKey-copy',
                RequiredRows: [{ label: 'Required row' }],
                OptionalRows: [{ label: 'Optional row' }],
                ChildKey: 'nested-value'
            },
            copyOptions: { copyChildTables: true },
            hasRequiredChildTables: true
        })
        expect(recordsService.suggestUniqueComponentValue).toHaveBeenCalledTimes(2)
        expect(recordsService.suggestUniqueComponentValue).toHaveBeenNthCalledWith(
            1,
            'metahub-1',
            '0190a9b5-3cde-7abc-8def-0123456789a1',
            'ImageKey',
            'image-card',
            '0190a9b5-3cde-7abc-8def-0123456789a2',
            { maxLength: 64, pattern: '^[a-z][a-z0-9-]*$', format: null },
            db
        )
        expect(recordsService.suggestUniqueComponentValue).toHaveBeenNthCalledWith(
            2,
            'metahub-1',
            '0190a9b5-3cde-7abc-8def-0123456789a1',
            'AssetKey',
            'asset-card',
            '0190a9b5-3cde-7abc-8def-0123456789a2',
            { maxLength: null, pattern: null, format: null },
            db
        )
    })
})
