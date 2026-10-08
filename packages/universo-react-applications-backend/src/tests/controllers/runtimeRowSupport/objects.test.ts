const mockResolveEffectiveLayoutStructureForRequest = jest.fn()

jest.mock('../../../services/effectiveLayoutResolverCore', () => ({
    __esModule: true,
    resolveEffectiveLayoutStructureForRequest: (...args: unknown[]) => mockResolveEffectiveLayoutStructureForRequest(...args)
}))

import {
    buildRuntimeAttrLookup,
    findRuntimeAttrByFieldKey,
    findRuntimeSystemKeyAttr,
    readRuntimeAttrStringValue,
    readRuntimeAttrValue,
    resolveRuntimeObjectCollectionConfig,
    resolveRuntimeRecordOwnerColumnName
} from '../../../controllers/runtimeRowSupport/objects'
import { resolveRuntimeRelationOwnedFieldCodenames } from '../../../services/runtimeRowSupport/list'
import { resolveRuntimeRelationWriteScope } from '../../../controllers/runtimeRowSupport/relationScope'
import type { RuntimeObjectCollectionAttr } from '../../../services/runtimeRowSupport/contracts'
import { createRelationBuilderEffectiveWidget } from './runtimeRelationAuthorityFixture'
import type { DbExecutor } from '@universo-react/utils'

const codename = (text: string) => ({ _primary: 'en', locales: { en: { content: text } } })

const attr = (
    columnName: string,
    dataType: string,
    label: string,
    overrides: Partial<RuntimeObjectCollectionAttr> = {}
): RuntimeObjectCollectionAttr => ({
    id: `attr-${columnName}-${label}`,
    codename: codename(label),
    column_name: columnName,
    data_type: dataType,
    is_required: false,
    ...overrides
})

const startDateAttr = attr('start_date', 'DATE', 'Start date')

describe('buildRuntimeAttrLookup', () => {
    it('indexes an attr by column name and codename in both cases', () => {
        const lookup = buildRuntimeAttrLookup([startDateAttr])
        expect(lookup.size).toBe(3)
        expect(lookup.get('start_date')).toBe(startDateAttr)
        expect(lookup.get('Start date')).toBe(startDateAttr)
        expect(lookup.get('start date')).toBe(startDateAttr)
    })

    it('keeps the later attr when keys collide', () => {
        const first = attr('value', 'STRING', 'Value')
        const second = attr('value', 'NUMBER', 'Value')
        expect(buildRuntimeAttrLookup([first, second]).get('value')).toBe(second)
    })

    it('supports plain string codenames', () => {
        const plain = attr('code', 'STRING', 'ignored', { codename: 'Code' })
        const lookup = buildRuntimeAttrLookup([plain])
        expect(lookup.get('Code')).toBe(plain)
        expect(lookup.get('code')).toBe(plain)
    })
})

describe('readRuntimeAttrValue', () => {
    it('prefers the column value, falls back to the codename key and preserves falsy values', () => {
        expect(readRuntimeAttrValue({ start_date: '2026-01-01', 'Start date': '2026-02-02' }, startDateAttr)).toBe('2026-01-01')
        expect(readRuntimeAttrValue({ start_date: null, 'Start date': '2026-02-02' }, startDateAttr)).toBe('2026-02-02')
        expect(readRuntimeAttrValue({ 'Start date': '2026-02-02' }, startDateAttr)).toBe('2026-02-02')
        expect(readRuntimeAttrValue({ start_date: false }, startDateAttr)).toBe(false)
        expect(readRuntimeAttrValue({}, startDateAttr)).toBeUndefined()
    })
})

describe('findRuntimeAttrByFieldKey', () => {
    it('matches trimmed field keys case-insensitively', () => {
        expect(findRuntimeAttrByFieldKey([startDateAttr], '  START_DATE  ')).toBe(startDateAttr)
        expect(findRuntimeAttrByFieldKey([startDateAttr], 'Start date')).toBe(startDateAttr)
        expect(findRuntimeAttrByFieldKey([startDateAttr], 'missing')).toBeUndefined()
    })
})

describe('readRuntimeAttrStringValue', () => {
    it('returns trimmed strings and null for empty or non-string values', () => {
        expect(readRuntimeAttrStringValue({ start_date: ' 2026-01-01 ' }, startDateAttr)).toBe('2026-01-01')
        expect(readRuntimeAttrStringValue({ start_date: '   ' }, startDateAttr)).toBeNull()
        expect(readRuntimeAttrStringValue({ start_date: 42 }, startDateAttr)).toBeNull()
        expect(readRuntimeAttrStringValue({}, undefined)).toBeNull()
    })
})

describe('resolveRuntimeObjectCollectionConfig relation authority', () => {
    it('preserves the authorized relation projection used by relation scope and owned-field discovery', async () => {
        const applicationId = '019f2000-0000-7000-8000-000000000001'
        const objectCollectionId = '019f2000-0000-7000-8000-000000000002'
        const parentEntityId = '019f2000-0000-7000-8000-000000000007'
        const parentRecordId = '019f2000-0000-7000-8000-000000000003'
        const relationWidget = createRelationBuilderEffectiveWidget()
        mockResolveEffectiveLayoutStructureForRequest.mockResolvedValue({
            status: 'ok',
            layout: { id: '019f2000-0000-7000-8000-000000000004', templateKey: 'dashboard', config: {} },
            widgets: [relationWidget]
        })

        const query = jest.fn(async (sql: string) => {
            if (sql.includes('FROM "app_test"._app_objects')) {
                return [{ id: parentEntityId, kind: 'object', codename: 'Courses', table_name: 'courses', config: null }]
            }
            return []
        })
        const manager = {
            query
        } as unknown as DbExecutor
        const result = await resolveRuntimeObjectCollectionConfig({
            manager,
            applicationId,
            userId: '019f2000-0000-7000-8000-000000000006',
            role: 'member',
            workspaceId: null,
            locale: 'en',
            objectCollectionId,
            objectCollectionCodename: 'CourseItems'
        })
        const scope = await resolveRuntimeRelationWriteScope({
            manager,
            schemaIdent: '"app_test"',
            zoneWidgets: result.selectedLayout.zoneWidgets,
            childEntity: { codename: 'CourseItems' },
            childAttrs: [
                {
                    id: 'course-ref',
                    codename: 'CourseId',
                    column_name: 'course_id',
                    data_type: 'REF',
                    is_required: true,
                    target_object_id: parentEntityId,
                    target_object_kind: 'object'
                },
                {
                    id: 'sort-order',
                    codename: 'SortOrder',
                    column_name: 'sort_order',
                    data_type: 'NUMBER',
                    is_required: true
                }
            ],
            request: { fieldCodename: 'CourseId', parentRecordId }
        })
        const ownedFields = resolveRuntimeRelationOwnedFieldCodenames(result.selectedLayout.zoneWidgets, 'CourseItems')

        expect(mockResolveEffectiveLayoutStructureForRequest).toHaveBeenCalledWith(
            expect.anything(),
            { applicationId, userId: '019f2000-0000-7000-8000-000000000006', role: 'member' },
            { applicationId, targetKind: 'object', entityTypeId: objectCollectionId, locale: 'en' }
        )
        expect(scope).toMatchObject({
            request: { fieldCodename: 'CourseId', parentRecordId },
            parentFieldAttr: { target_object_id: parentEntityId },
            parentCollection: { id: parentEntityId, codename: 'Courses' },
            sortOrderAttr: { codename: 'SortOrder', column_name: 'sort_order' }
        })
        expect(ownedFields).toEqual(['CourseId', 'SortOrder'])
        expect(result.selectedLayout.zoneWidgets.center[0]).not.toHaveProperty('runtimeData')
        expect(query.mock.calls.every(([sql]) => !sql.includes('FROM "app_test".courses'))).toBe(true)
    })
})

describe('findRuntimeSystemKeyAttr', () => {
    it('requires the SystemKey string codename, a valid identifier and serverOwned metadata', () => {
        const systemKey = attr('system_key', 'STRING', 'SystemKey', { codename: 'SystemKey', ui_config: { serverOwned: true } })
        expect(findRuntimeSystemKeyAttr([systemKey])).toBe(systemKey)
        expect(findRuntimeSystemKeyAttr([attr('system_key', 'STRING', 'SystemKey')])).toBeUndefined()
        expect(findRuntimeSystemKeyAttr([attr('bad key', 'STRING', 'SystemKey', { codename: 'SystemKey' })])).toBeUndefined()
    })
})

describe('resolveRuntimeRecordOwnerColumnName', () => {
    const ownerAttr = attr('owner_id', 'REF', 'Owner', { target_object_id: 'object-1' })

    it('resolves the owner column from a field codename', () => {
        expect(
            resolveRuntimeRecordOwnerColumnName([ownerAttr], {
                runtimeRecordAccess: { mode: 'ownerOrShared', ownerFieldCodename: 'Owner' }
            })
        ).toBe('owner_id')
    })

    it('falls back to an explicit owner column name and rejects invalid identifiers', () => {
        expect(
            resolveRuntimeRecordOwnerColumnName([], { runtimeRecordAccess: { mode: 'ownerOrShared', ownerColumnName: 'owner_id' } })
        ).toBe('owner_id')
        expect(
            resolveRuntimeRecordOwnerColumnName([], { runtimeRecordAccess: { mode: 'ownerOrShared', ownerColumnName: 'bad-key' } })
        ).toBeNull()
    })

    it('returns null without a valid record access config', () => {
        expect(resolveRuntimeRecordOwnerColumnName([ownerAttr], null)).toBeNull()
        expect(resolveRuntimeRecordOwnerColumnName([ownerAttr], {})).toBeNull()
    })
})
