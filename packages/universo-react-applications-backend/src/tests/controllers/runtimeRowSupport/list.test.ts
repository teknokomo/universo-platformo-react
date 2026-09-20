import {
    buildRuntimeListClauses,
    findUnsupportedRuntimeListFields,
    normalizeRuntimeFilterValue,
    resolveRuntimeFilterValue
} from '../../../controllers/runtimeRowSupport/list'
import type { RuntimeListComponent } from '../../../controllers/runtimeRowSupport/contracts'
import type { RuntimeDatasourceFilter, RuntimeDatasourceSort } from '@universo-react/types'

const codename = (text: string) => ({ _primary: 'en', locales: { en: { content: text } } })

const component = (
    columnName: string,
    dataType: RuntimeListComponent['data_type'],
    validationRules?: Record<string, unknown>
): RuntimeListComponent => ({
    codename: codename(columnName),
    column_name: columnName,
    data_type: dataType,
    ...(validationRules ? { validation_rules: validationRules } : {})
})

const attrs: RuntimeListComponent[] = [
    component('name', 'STRING'),
    component('score', 'NUMBER'),
    component('active', 'BOOLEAN'),
    component('owner_id', 'STRING'),
    component('notes', 'TABLE'),
    component('payload', 'JSON')
]

const baseParams = {
    activeCondition: '_upl_deleted = false',
    attrs,
    fallbackOrderBy: 'id ASC'
}

describe('buildRuntimeListClauses', () => {
    const withFilter = (filter: RuntimeDatasourceFilter) => buildRuntimeListClauses({ ...baseParams, filters: [filter] })
    const withSort = (sort: RuntimeDatasourceSort[]) => buildRuntimeListClauses({ ...baseParams, sort })

    it('returns only the active condition and fallback order without query input', () => {
        expect(buildRuntimeListClauses(baseParams)).toEqual({
            whereSql: '_upl_deleted = false',
            orderBySql: 'id ASC',
            values: []
        })
    })

    it('builds one escaped pattern across searchable scalar fields', () => {
        const result = buildRuntimeListClauses({ ...baseParams, search: '50%_off' })
        expect(result.values).toEqual(['%50\\%\\_off%'])
        expect(result.whereSql).toBe(
            `_upl_deleted = false AND ("name"::text ILIKE $1 ESCAPE '\\' OR "score"::text ILIKE $1 ESCAPE '\\' OR "active"::text ILIKE $1 ESCAPE '\\' OR "owner_id"::text ILIKE $1 ESCAPE '\\')`
        )
        expect(buildRuntimeListClauses({ ...baseParams, search: '   ' }).whereSql).toBe('_upl_deleted = false')
    })

    it('uses localized SQL for versioned string search', () => {
        const localized = buildRuntimeListClauses({
            activeCondition: 'active',
            attrs: [component('title', 'STRING', { localized: true })],
            search: 'x',
            fallbackOrderBy: 'id ASC'
        })
        expect(localized.whereSql).toContain(`COALESCE("title"->'locales'`)
    })

    it('normalizes numeric and boolean filter values', () => {
        const numeric = withFilter({ field: 'score', operator: 'greaterThan', value: '10' })
        expect(numeric.whereSql).toBe('_upl_deleted = false AND "score" > $1')
        expect(numeric.values).toEqual([10])

        const boolean = withFilter({ field: 'active', operator: 'equals', value: ' true ' })
        expect(boolean.whereSql).toBe('_upl_deleted = false AND "active" = $1')
        expect(boolean.values).toEqual([true])

        const invalid = withFilter({ field: 'active', operator: 'equals', value: 'maybe' })
        expect(invalid.whereSql).toBe('_upl_deleted = false')
        expect(invalid.values).toEqual([])
    })

    it('substitutes the runtime current user token and drops it for anonymous requests', () => {
        const tokenFilter: RuntimeDatasourceFilter = { field: 'owner_id', operator: 'equals', value: '{{runtime.currentUserId}}' }
        const withUser = buildRuntimeListClauses({ ...baseParams, filters: [tokenFilter], currentUserId: 'user-42' })
        expect(withUser.whereSql).toBe('_upl_deleted = false AND "owner_id" = $1')
        expect(withUser.values).toEqual(['user-42'])

        const anonymous = buildRuntimeListClauses({ ...baseParams, filters: [tokenFilter] })
        expect(anonymous.whereSql).toBe('_upl_deleted = false')
        expect(anonymous.values).toEqual([])

        const objectForm = buildRuntimeListClauses({
            ...baseParams,
            filters: [{ field: 'owner_id', operator: 'equals', value: { runtime: 'currentUserId' } }],
            currentUserId: 'user-7'
        })
        expect(objectForm.values).toEqual(['user-7'])
    })

    it('builds contains, startsWith, endsWith, isEmpty and isNotEmpty clauses', () => {
        const contains = withFilter({ field: 'name', operator: 'contains', value: 'li' })
        expect(contains.whereSql).toBe(`_upl_deleted = false AND "name"::text ILIKE $1 ESCAPE '\\'`)
        expect(contains.values).toEqual(['%li%'])
        expect(withFilter({ field: 'name', operator: 'startsWith', value: 'li' }).values).toEqual(['li%'])
        expect(withFilter({ field: 'name', operator: 'endsWith', value: 'li' }).values).toEqual(['%li'])
        expect(withFilter({ field: 'name', operator: 'isEmpty' }).whereSql).toBe(
            `_upl_deleted = false AND ("name" IS NULL OR "name"::text = '')`
        )
        expect(withFilter({ field: 'name', operator: 'isNotEmpty' }).whereSql).toBe(
            `_upl_deleted = false AND ("name" IS NOT NULL AND "name"::text <> '')`
        )
    })

    it('skips filters for TABLE, JSON and unknown fields', () => {
        for (const field of ['notes', 'payload', 'missing']) {
            const result = withFilter({ field, operator: 'contains', value: 'x' })
            expect(result.whereSql).toBe('_upl_deleted = false')
            expect(result.values).toEqual([])
        }
    })

    it('orders by supported sort fields before the fallback order', () => {
        const result = withSort([
            { field: 'name', direction: 'desc' },
            { field: 'score', direction: 'asc' },
            { field: 'notes', direction: 'asc' },
            { field: 'missing', direction: 'desc' }
        ])
        expect(result.orderBySql).toBe('"name" DESC NULLS LAST, "score" ASC NULLS LAST, id ASC')
    })

    it('numbers placeholders across search and filter clauses', () => {
        const result = buildRuntimeListClauses({
            ...baseParams,
            search: 'a',
            filters: [{ field: 'score', operator: 'lessThan', value: 5 }]
        })
        expect(result.values).toEqual(['%a%', 5])
        expect(result.whereSql).toContain('ILIKE $1')
        expect(result.whereSql).toContain('"score" < $2')
    })
})

describe('findUnsupportedRuntimeListFields', () => {
    it('returns nothing for supported or absent sort and filter inputs', () => {
        expect(findUnsupportedRuntimeListFields(attrs)).toEqual([])
        expect(
            findUnsupportedRuntimeListFields(
                attrs,
                [{ field: 'name', direction: 'asc' }],
                [{ field: 'score', operator: 'greaterThan', value: 1 }]
            )
        ).toEqual([])
    })

    it('reports unknown, TABLE and JSON fields once each', () => {
        expect(
            findUnsupportedRuntimeListFields(
                attrs,
                [
                    { field: 'notes', direction: 'asc' },
                    { field: 'missing', direction: 'asc' }
                ],
                [
                    { field: 'notes', operator: 'contains', value: 'x' },
                    { field: 'payload', operator: 'contains', value: 'x' }
                ]
            )
        ).toEqual(['notes', 'missing', 'payload'])
    })
})

describe('filter value helpers', () => {
    it('normalizeRuntimeFilterValue returns undefined for unusable numeric and boolean input', () => {
        expect(normalizeRuntimeFilterValue(component('score', 'NUMBER'), 'abc')).toBeUndefined()
        expect(normalizeRuntimeFilterValue(component('active', 'BOOLEAN'), 'maybe')).toBeUndefined()
        expect(normalizeRuntimeFilterValue(component('active', 'BOOLEAN'), ' FALSE ')).toBe(false)
        expect(normalizeRuntimeFilterValue(component('name', 'STRING'), null)).toBeNull()
    })

    it('resolveRuntimeFilterValue keeps a raw value when the token is only a substring', () => {
        const raw = 'prefix-{{runtime.currentUserId}}'
        expect(resolveRuntimeFilterValue(raw, { currentUserId: 'user-1' })).toBe(raw)
    })
})
