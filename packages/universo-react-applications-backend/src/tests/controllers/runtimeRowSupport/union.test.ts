import type { DbExecutor } from '@universo-react/utils'
import { resolveApplicationLifecycleContractFromConfig } from '@universo-react/utils'
import { buildRuntimeUnionTargetQuery, buildRuntimeUnionTargetSelect } from '../../../services/runtimeRowSupport/union/targetQuery'
import {
    mergeRuntimeUnionColumns,
    normalizeRuntimeUnionProjectionField,
    quoteSqlLiteral,
    remapRuntimeUnionSqlPlaceholders,
    resolveRuntimeUnionProjectionLabel
} from '../../../services/runtimeRowSupport/union/index'
import type { RuntimeColumnDefinition } from '../../../services/runtimeRowSupport/contracts'

const column = (overrides: Partial<RuntimeColumnDefinition> & Pick<RuntimeColumnDefinition, 'field'>): RuntimeColumnDefinition => ({
    id: `column-${overrides.field}`,
    codename: 'Name',
    dataType: 'STRING',
    isRequired: false,
    isDisplayComponent: false,
    headerName: 'Name',
    validationRules: {},
    uiConfig: {},
    refTargetEntityId: null,
    refTargetEntityKind: null,
    refTargetConstantId: null,
    ...overrides
})

describe('remapRuntimeUnionSqlPlaceholders', () => {
    it('shifts every bound placeholder by the offset', () => {
        expect(remapRuntimeUnionSqlPlaceholders('a = $1 AND b = $2', 3)).toBe('a = $4 AND b = $5')
        expect(remapRuntimeUnionSqlPlaceholders('x = $10', 5)).toBe('x = $15')
    })

    it('leaves SQL without placeholders and a zero offset unchanged', () => {
        expect(remapRuntimeUnionSqlPlaceholders('id = $1', 0)).toBe('id = $1')
        expect(remapRuntimeUnionSqlPlaceholders('deleted = false', 4)).toBe('deleted = false')
    })
})

describe('buildRuntimeUnionTargetQuery published scope', () => {
    it('restricts public record rows and nested child counts to published records', async () => {
        const executor = { query: jest.fn().mockResolvedValue([]) } as unknown as DbExecutor
        const childTableComponentId = '019f2000-0000-7000-8000-000000000103'
        const objectCollection = {
            id: '019f2000-0000-7000-8000-000000000101',
            kind: 'object',
            codename: 'PublicRecords',
            table_name: 'public_records',
            config: {},
            lifecycleContract: resolveApplicationLifecycleContractFromConfig({})
        }
        const components = [
            {
                id: childTableComponentId,
                codename: 'Children',
                column_name: 'children',
                data_type: 'TABLE' as const,
                is_required: false
            }
        ]
        const queryParams = {
            manager: executor,
            schemaIdent: '"app_test"',
            applicationId: '019f2000-0000-7000-8000-000000000102',
            runtimeContext: {
                manager: executor,
                schemaIdent: '"app_test"',
                currentWorkspaceId: null,
                userId: null,
                role: null,
                permissions: {
                    manageMembers: false,
                    manageApplication: false,
                    createContent: false,
                    editContent: false,
                    deleteContent: false,
                    readReports: false
                },
                publishedRecordsOnly: true
            },
            target: { objectCollectionCodename: 'PublicRecords' },
            components,
            physicalComponents: [],
            targetSort: undefined,
            targetFilters: undefined,
            enumOptionsMap: new Map(),
            projectionSpecs: [],
            locale: 'en',
            lifecycleState: 'active',
            libraryView: 'all',
            search: undefined,
            shouldProjectRecentAt: false,
            shouldProjectSharedAt: false
        }
        const result = await buildRuntimeUnionTargetQuery({ ...queryParams, objectCollection })

        expect(result.activeObjectRowCondition).toContain('"_app_published" = true')
        const unpublishedResult = await buildRuntimeUnionTargetQuery({
            ...queryParams,
            objectCollection: {
                ...objectCollection,
                lifecycleContract: {
                    ...objectCollection.lifecycleContract,
                    publish: { ...objectCollection.lifecycleContract.publish, enabled: false }
                }
            }
        })
        expect(unpublishedResult.activeObjectRowCondition).not.toContain('"_app_published"')
        const unionSelects: string[] = []
        buildRuntimeUnionTargetSelect({
            schemaIdent: '"app_test"',
            objectCollection,
            components,
            physicalComponents: [],
            target: { objectCollectionCodename: 'PublicRecords' },
            targetIndex: 0,
            locale: 'en',
            dataTableIdent: result.dataTableIdent,
            activeObjectRowCondition: result.activeObjectRowCondition,
            runtimeListClauses: result.runtimeListClauses,
            recordAccessClause: result.recordAccessClause,
            libraryViewClause: result.libraryViewClause,
            effectiveProjectionSpecs: result.effectiveProjectionSpecs,
            runtimeStarredExistsClause: null,
            runtimeSharedExistsClause: null,
            reorderFieldCodename: null,
            enumOptionsMap: new Map(),
            unionValues: [],
            unionSelects
        })
        expect(unionSelects[0]?.match(/"_app_published" = true/gu)).toHaveLength(2)
    })
})

describe('normalizeRuntimeUnionProjectionField', () => {
    it('normalizes the system projection aliases case-insensitively', () => {
        expect(normalizeRuntimeUnionProjectionField('Type')).toBe('type')
        expect(normalizeRuntimeUnionProjectionField('title')).toBe('title')
        expect(normalizeRuntimeUnionProjectionField('STATUS')).toBe('status')
        expect(normalizeRuntimeUnionProjectionField('updated_at')).toBe('updatedAt')
        expect(normalizeRuntimeUnionProjectionField('viewedAt')).toBe('recentAt')
        expect(normalizeRuntimeUnionProjectionField('shared')).toBe('sharedAt')
    })

    it('returns null for project, unknown and empty fields', () => {
        expect(normalizeRuntimeUnionProjectionField('project')).toBeNull()
        expect(normalizeRuntimeUnionProjectionField('custom_field')).toBeNull()
        expect(normalizeRuntimeUnionProjectionField('')).toBeNull()
    })
})

describe('mergeRuntimeUnionColumns', () => {
    it('returns an empty list for no groups and keeps a single group intact', () => {
        expect(mergeRuntimeUnionColumns([])).toEqual([])
        const only = [column({ field: 'name' }), column({ field: 'score', dataType: 'NUMBER' })]
        expect(mergeRuntimeUnionColumns([only])).toEqual(only)
    })

    it('merges duplicate fields, keeps first-seen base properties and de-duplicates options by id', () => {
        const first = column({
            field: 'status',
            codename: 'Status',
            headerName: 'Status',
            refOptions: [
                { id: 'a', codename: 'A', label: 'A', isDefault: false, sortOrder: 0 },
                { id: 'b', codename: 'B', label: 'B', isDefault: false, sortOrder: 1 }
            ]
        })
        const second = column({
            field: 'status',
            codename: 'Other',
            headerName: 'Other',
            refOptions: [
                { id: 'b', codename: 'B', label: 'B', isDefault: false, sortOrder: 1 },
                { id: 'c', codename: 'C', label: 'C', isDefault: false, sortOrder: 2 }
            ]
        })
        const [merged] = mergeRuntimeUnionColumns([[first], [second]])
        expect(merged.codename).toBe('Status')
        expect(merged.headerName).toBe('Status')
        expect(merged.refOptions?.map((option) => option.id)).toEqual(['a', 'b', 'c'])
    })

    it('merges enum options and keeps the first defined child columns', () => {
        const childColumns = [column({ field: 'child' })]
        const first = column({ field: 'items' })
        const second = column({
            field: 'items',
            enumOptions: [{ id: 'e1', codename: 'E', label: 'E', isDefault: false, sortOrder: 0 }],
            childColumns
        })
        const [merged] = mergeRuntimeUnionColumns([[first], [second]])
        expect(merged.enumOptions?.map((option) => option.id)).toEqual(['e1'])
        expect(merged.childColumns).toBe(childColumns)
        expect(merged.refOptions).toBeUndefined()
    })

    it('preserves first-seen field order across groups', () => {
        const result = mergeRuntimeUnionColumns([[column({ field: 'first' })], [column({ field: 'second' }), column({ field: 'first' })]])
        expect(result.map((item) => item.field)).toEqual(['first', 'second'])
    })
})

describe('resolveRuntimeUnionProjectionLabel', () => {
    it('localizes known projection fields and falls back to English', () => {
        expect(resolveRuntimeUnionProjectionLabel('type', 'ru-RU')).toBe('Тип')
        expect(resolveRuntimeUnionProjectionLabel('sharedAt', 'ru')).toBe('Доступ открыт')
        expect(resolveRuntimeUnionProjectionLabel('type', 'en')).toBe('Type')
    })
})

describe('quoteSqlLiteral', () => {
    it('escapes single quotes', () => {
        expect(quoteSqlLiteral("O'Brien")).toBe("'O''Brien'")
        expect(quoteSqlLiteral('plain')).toBe("'plain'")
    })
})
