import {
    buildRuntimeAttrLookup,
    findRuntimeAttrByFieldKey,
    findRuntimeSystemKeyAttr,
    readRuntimeAttrStringValue,
    readRuntimeAttrValue,
    resolveRuntimeRecordOwnerColumnName
} from '../../../controllers/runtimeRowSupport/objects'
import type { RuntimeObjectCollectionAttr } from '../../../controllers/runtimeRowSupport/contracts'

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
