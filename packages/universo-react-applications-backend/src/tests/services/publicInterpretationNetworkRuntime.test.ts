import type { RuntimeSurfaceReady } from '../../services/interpretationNetwork/runtimeInterpretationNetworkCore'
import {
    PublicInterpretationNetworkUnavailableError,
    readPublicInterpretationNetwork
} from '../../services/publicInterpretationNetworkRuntime'
import { issueHandle } from '../../services/publicInterpretationNetwork/handles'
import { PAGE_SIZE, MAX_PUBLIC_BODY_BYTES } from '../../services/publicInterpretationNetwork/contracts'
import { readMaterials } from '../../services/publicInterpretationNetwork/materialsReader'
import * as publicInterpretationProjection from '../../services/publicInterpretationNetwork/projection'
import type { DbExecutor } from '@universo-react/utils'

const applicationId = '0190a9b5-3cde-7abc-8def-0123456789ab'
const workspaceId = '0190a9b5-3cde-7abc-8def-0123456789ac'
const layoutId = '0190a9b5-3cde-7abc-8def-0123456789ad'
const widgetId = '0190a9b5-3cde-7abc-8def-0123456789ae'

const field = (codename: string, column_name: string) => ({ codename, column_name, data_type: 'STRING' as const })
const contract = (codename: string, tableName: string, fields: Record<string, ReturnType<typeof field>>, childFields = {}) => ({
    object: { id: `${widgetId.slice(0, -1)}${codename.length}`, codename, table_name: tableName },
    fields,
    childFields,
    childTableName: codename === 'Interpretation' ? 'tbl_interpretation_matrix' : undefined
})

const surface = (overrides: Record<string, unknown> = {}) =>
    ({
        applicationId,
        schemaName: 'app_0190a9b53cde7abc8def0123456789ab',
        workspaceId,
        layoutId,
        widgetId,
        widgetKey: 'interpretationNetworkWorkspace',
        widgetConfig: {
            cellStylePolicy: {
                allowedColors: ['#FFFFFF'],
                allowCustomColors: false,
                editable: { fillColor: true, textColor: true, borderColor: true, borderWidth: true, borderStyle: true }
            }
        },
        structureMode: 'multiple',
        featureState: 'ready',
        missing: [],
        contracts: {
            Structure: contract('Structure', 'obj_structure', {
                Name: field('Name', 'name'),
                Description: field('Description', 'description'),
                SystemKey: field('SystemKey', 'system_key')
            }),
            Interpretation: contract(
                'Interpretation',
                'obj_interpretation',
                { Title: field('Title', 'title'), ParentStructure: field('ParentStructure', 'parent_structure') },
                {
                    CellId: field('CellId', 'cell_id'),
                    ParentCellId: field('ParentCellId', 'parent_cell_id'),
                    RowKey: field('RowKey', 'row_key'),
                    ColKey: field('ColKey', 'col_key'),
                    RowLabel: field('RowLabel', 'row_label'),
                    ColLabel: field('ColLabel', 'col_label'),
                    CellValue: field('CellValue', 'cell_value'),
                    CellDescription: field('CellDescription', 'cell_description'),
                    CellFillColor: field('CellFillColor', 'cell_fill_color'),
                    TextColor: field('TextColor', 'text_color'),
                    MaterialRef: field('MaterialRef', 'material_ref')
                }
            ),
            Material: contract('Material', 'obj_material', {
                Title: field('Title', 'title'),
                Description: field('Description', 'description'),
                Body: field('Body', 'body'),
                CellId: field('CellId', 'cell_id'),
                InterpretationId: field('InterpretationId', 'interpretation_id'),
                TemplateOwnerId: field('TemplateOwnerId', 'template_owner_id')
            }),
            TableTemplate: contract('TableTemplate', 'obj_table_template', { Name: field('Name', 'name') })
        },
        ...overrides
    } as unknown as RuntimeSurfaceReady)

const input = (executor: DbExecutor, overrides: Record<string, unknown> = {}) => ({
    executor,
    surface: surface(),
    applicationId,
    layoutId,
    widgetId,
    instanceKey: 'interpretation-workspace',
    target: { applicationId, targetKind: null, locale: 'en' as const },
    locale: 'en' as const,
    view: 'structures' as const,
    offset: 0,
    ...overrides
})

describe('public Interpretation Network read projector', () => {
    const previousSecret = process.env.UNIVERSO_RUNTIME_RECORD_HANDLE_SECRET

    beforeEach(() => {
        process.env.UNIVERSO_RUNTIME_RECORD_HANDLE_SECRET = 'public-in-test-secret-with-enough-entropy'
    })

    afterAll(() => {
        if (previousSecret === undefined) delete process.env.UNIVERSO_RUNTIME_RECORD_HANDLE_SECRET
        else process.env.UNIVERSO_RUNTIME_RECORD_HANDLE_SECRET = previousSecret
    })

    it('returns a bounded semantic structure page with encrypted public-local handles and explicit Workspace filtering', async () => {
        const structureId = '0190a9b5-3cde-7abc-8def-0123456789b1'
        const query = jest
            .fn()
            .mockResolvedValue([{ id: structureId, name: { _primary: 'en', locales: { en: { content: 'Research' } } }, description: null }])
        const executor = { query } as unknown as DbExecutor

        const result = await readPublicInterpretationNetwork(input(executor))

        expect(result).toMatchObject({ view: 'structures', page: { offset: 0, limit: 100, hasMore: false } })
        expect(result.items[0]).toMatchObject({ name: 'Research', description: null })
        const firstItem = result.items[0]
        expect(firstItem && 'handle' in firstItem ? firstItem.handle : undefined).toMatch(/^pn1\./u)
        expect(JSON.stringify(result)).not.toContain(structureId)
        expect(query).toHaveBeenCalledTimes(1)
        expect(query.mock.calls[0]?.[0]).toContain('"workspace_id" = $1')
        expect(query.mock.calls[0]?.[1]).toEqual([workspaceId, 101, 0])
        expect(query.mock.calls[0]?.[0]).toMatch(/^SELECT/u)
    })

    it('rejects a public-local parent handle after Workspace or normalized target changes before reading rows', async () => {
        const query = jest.fn().mockResolvedValue([{ id: '0190a9b5-3cde-7abc-8def-0123456789b1', name: 'Research', description: null }])
        const executor = { query } as unknown as DbExecutor
        const structurePage = await readPublicInterpretationNetwork(input(executor))
        const handle = structurePage.view === 'structures' ? structurePage.items[0]?.handle : undefined
        expect(handle).toBeDefined()
        query.mockClear()

        await expect(
            readPublicInterpretationNetwork(
                input(executor, {
                    view: 'interpretations',
                    parentHandle: handle,
                    surface: surface({ workspaceId: '0190a9b5-3cde-7abc-8def-0123456789b2' })
                })
            )
        ).rejects.toBeInstanceOf(PublicInterpretationNetworkUnavailableError)
        expect(query).not.toHaveBeenCalled()

        await expect(
            readPublicInterpretationNetwork(
                input(executor, {
                    view: 'interpretations',
                    parentHandle: handle,
                    instanceKey: 'different-active-widget'
                })
            )
        ).rejects.toBeInstanceOf(PublicInterpretationNetworkUnavailableError)
        expect(query).not.toHaveBeenCalled()

        await expect(
            readPublicInterpretationNetwork(
                input(executor, {
                    view: 'interpretations',
                    parentHandle: handle,
                    target: { applicationId, targetKind: null, locale: 'ru' },
                    locale: 'ru'
                })
            )
        ).rejects.toBeInstanceOf(PublicInterpretationNetworkUnavailableError)
        expect(query).not.toHaveBeenCalled()
    })

    it('rejects offsets outside the server bound without querying persistence', async () => {
        const query = jest.fn()
        await expect(readPublicInterpretationNetwork(input({ query } as unknown as DbExecutor, { offset: 10_001 }))).rejects.toBeInstanceOf(
            PublicInterpretationNetworkUnavailableError
        )
        expect(query).not.toHaveBeenCalled()
    })

    it.each(['structures', 'interpretations', 'matrix', 'materials'] as const)(
        'projects only the configured %s page and exposes the extra row through hasMore',
        async (view) => {
            const executorQuery = jest.fn()
            const executor = { query: executorQuery } as unknown as DbExecutor
            const structureId = '0190a9b5-3cde-7abc-8def-0123456789b1'
            const interpretationId = '0190a9b5-3cde-7abc-8def-0123456789b2'
            const cellId = 'cell-primary'
            const uuidFor = (index: number) => `0190a9b5-3cde-7abc-8def-${String(index).padStart(12, '0')}`
            const limit = PAGE_SIZE[view]
            const baseInput = input(executor)
            let request = input(executor, { view })

            if (view === 'structures') {
                executorQuery.mockResolvedValueOnce(
                    Array.from({ length: limit + 1 }, (_, index) => ({
                        id: uuidFor(index + 100),
                        name: `Structure ${index}`,
                        description: null
                    }))
                )
            } else if (view === 'interpretations') {
                request = input(executor, {
                    view,
                    parentHandle: issueHandle(baseInput, { kind: 'structure', recordId: structureId })
                })
                executorQuery
                    .mockResolvedValueOnce([{ id: structureId, name: 'Research', description: null }])
                    .mockResolvedValueOnce(
                        Array.from({ length: limit + 1 }, (_, index) => ({ id: uuidFor(index + 200), title: `Meaning ${index}` }))
                    )
            } else if (view === 'matrix') {
                request = input(executor, {
                    view,
                    parentHandle: issueHandle(baseInput, { kind: 'interpretation', recordId: interpretationId })
                })
                executorQuery.mockResolvedValueOnce([{ id: interpretationId, title: 'Meaning' }]).mockResolvedValueOnce(
                    Array.from({ length: limit + 1 }, (_, index) => ({
                        _tp_sort_order: index,
                        cellId: `cell-${index}`,
                        parentCellId: null,
                        rowKey: `row-${index}`,
                        colKey: `column-${index}`,
                        rowLabel: `Row ${index}`,
                        columnLabel: `Column ${index}`,
                        value: `Value ${index}`,
                        description: null
                    }))
                )
            } else {
                request = input(executor, {
                    view,
                    parentHandle: issueHandle(baseInput, { kind: 'cell', recordId: interpretationId, cellId })
                })
                executorQuery
                    .mockResolvedValueOnce([{ id: interpretationId }])
                    .mockResolvedValueOnce([{ cellId, materialRef: null }])
                    .mockResolvedValueOnce(
                        Array.from({ length: limit + 1 }, (_, index) => ({
                            id: uuidFor(index + 300),
                            title: `Material ${index}`,
                            description: null,
                            body: null
                        }))
                    )
            }

            const result = await readPublicInterpretationNetwork(request)

            expect(result.view).toBe(view)
            expect(result.items).toHaveLength(limit)
            expect(result.page).toEqual({ offset: 0, limit, hasMore: true })
        }
    )

    it('projects valid stored colors even when they are outside the current edit allowlist and suppresses malformed colors', async () => {
        const structureId = '0190a9b5-3cde-7abc-8def-0123456789b1'
        const interpretationId = '0190a9b5-3cde-7abc-8def-0123456789b2'
        const query = jest
            .fn()
            .mockResolvedValueOnce([{ id: structureId, name: 'Research', description: null }])
            .mockResolvedValueOnce([{ id: structureId, name: 'Research', description: null }])
            .mockResolvedValueOnce([{ id: interpretationId, title: 'Meaning' }])
            .mockResolvedValueOnce([{ id: interpretationId, title: 'Meaning' }])
            .mockResolvedValueOnce([
                {
                    _tp_sort_order: 0,
                    cellId: 'cell-a',
                    parentCellId: null,
                    rowKey: 'row-a',
                    colKey: 'column-a',
                    rowLabel: 'Row A',
                    columnLabel: 'Column A',
                    value: 'Value',
                    description: null,
                    fillColor: '#123456',
                    textColor: 'not-a-color'
                }
            ])
        const executor = { query } as unknown as DbExecutor

        const structures = await readPublicInterpretationNetwork(input(executor))
        if (structures.view !== 'structures') throw new Error('Expected structures response')
        const interpretations = await readPublicInterpretationNetwork(
            input(executor, { view: 'interpretations', parentHandle: structures.items[0]?.handle })
        )
        if (interpretations.view !== 'interpretations') throw new Error('Expected interpretations response')
        expect(interpretations.structure.handle).toBe(structures.items[0]?.handle)
        const matrix = await readPublicInterpretationNetwork(
            input(executor, { view: 'matrix', parentHandle: interpretations.items[0]?.handle })
        )

        expect(matrix.view).toBe('matrix')
        if (matrix.view !== 'matrix') return
        expect(matrix.items[0]?.style).toEqual({ fillColor: '#123456' })
        expect(JSON.stringify(matrix)).not.toContain(interpretationId)
        expect(JSON.stringify(matrix)).not.toContain('not-a-color')
        expect(query.mock.calls[4]?.[0]).toContain('AS "cellId"')
    })

    it('scopes public Materials by both Interpretation and CellId', async () => {
        const structureId = '0190a9b5-3cde-7abc-8def-0123456789b1'
        const interpretationId = '0190a9b5-3cde-7abc-8def-0123456789b2'
        const cellId = '0190a9b5-3cde-7abc-8def-0123456789b3'
        const primaryMaterialId = '0190a9b5-3cde-7abc-8def-0123456789b4'
        const query = jest
            .fn()
            .mockResolvedValueOnce([{ id: structureId, name: 'Research', description: null }])
            .mockResolvedValueOnce([{ id: structureId, name: 'Research', description: null }])
            .mockResolvedValueOnce([{ id: interpretationId, title: 'Meaning' }])
            .mockResolvedValueOnce([{ id: interpretationId, title: 'Meaning' }])
            .mockResolvedValueOnce([
                {
                    _tp_sort_order: 0,
                    cellId,
                    parentCellId: null,
                    rowKey: 'row-a',
                    colKey: 'column-a',
                    rowLabel: 'Row A',
                    columnLabel: 'Column A',
                    value: 'Meaning',
                    description: null,
                    materialRef: primaryMaterialId
                }
            ])
            .mockResolvedValueOnce([{ id: interpretationId, parentStructure: structureId }])
            .mockResolvedValueOnce([{ cellId, materialRef: primaryMaterialId }])
            .mockResolvedValueOnce(
                Array.from({ length: 20 }, (_, index) => ({
                    id: index === 0 ? primaryMaterialId : `0190a9b5-3cde-7abc-8def-${String(1000 + index).padStart(12, '0')}`,
                    title: index === 0 ? 'Scoped material' : `Scoped material ${index + 1}`,
                    description: null,
                    body:
                        index === 0
                            ? {
                                  format: 'editorjs',
                                  data: {
                                      blocks: [
                                          {
                                              id: 'public-body-paragraph',
                                              type: 'paragraph',
                                              data: { text: 'Public material detail is available without an account.' }
                                          }
                                      ]
                                  }
                              }
                            : null
                }))
            )
        const executor = { query } as unknown as DbExecutor

        const structures = await readPublicInterpretationNetwork(input(executor))
        if (structures.view !== 'structures') throw new Error('Expected structures response')
        const interpretations = await readPublicInterpretationNetwork(
            input(executor, { view: 'interpretations', parentHandle: structures.items[0]?.handle })
        )
        if (interpretations.view !== 'interpretations') throw new Error('Expected interpretations response')
        const matrix = await readPublicInterpretationNetwork(
            input(executor, { view: 'matrix', parentHandle: interpretations.items[0]?.handle })
        )
        if (matrix.view !== 'matrix') throw new Error('Expected matrix response')
        const materials = await readPublicInterpretationNetwork(
            input(executor, { view: 'materials', parentHandle: matrix.items[0]?.handle })
        )

        expect(materials.view).toBe('materials')
        expect(materials.items).toHaveLength(20)
        expect(materials.items[0]).toMatchObject({
            title: 'Scoped material',
            bodyText: 'Public material detail is available without an account.',
            isPrimary: true
        })
        expect(query).toHaveBeenCalledTimes(8)
        const [materialsSql, materialsParams] = query.mock.calls[7] as [string, unknown[]]
        expect(materialsSql).toContain('octet_length("body"::text) <= $1')
        expect(materialsSql).toContain('"interpretation_id" = $2')
        expect(materialsSql).toContain('"cell_id" = $3')
        expect(materialsSql).toContain('"template_owner_id" IS NULL')
        expect(materialsSql).toContain('CASE WHEN "id" = $5 THEN 0 ELSE 1 END ASC')
        expect(materialsParams).toContain(primaryMaterialId)
        expect(materialsParams).toEqual([MAX_PUBLIC_BODY_BYTES, interpretationId, cellId, workspaceId, primaryMaterialId, 26, 0])
    })

    it('fails closed on a stored oversized Material Body before parsing or returning Body text', async () => {
        const interpretationId = '0190a9b5-3cde-7abc-8def-0123456789b2'
        const cellId = '0190a9b5-3cde-7abc-8def-0123456789b3'
        const materialId = '0190a9b5-3cde-7abc-8def-0123456789b4'
        const request = input({ query: jest.fn() } as unknown as DbExecutor, { view: 'materials' })
        const parentHandle = issueHandle(request, { kind: 'cell', recordId: interpretationId, cellId })
        const query = jest
            .fn()
            .mockResolvedValueOnce([{ id: interpretationId }])
            .mockResolvedValueOnce([{ id: '0190a9b5-3cde-7abc-8def-0123456789b5', cellId, materialRef: null }])
            .mockResolvedValueOnce([{ id: materialId, title: 'Oversized', description: null, body: null, bodyOversized: true }])
        const executor = { query } as unknown as DbExecutor
        const bodyProjection = jest.spyOn(publicInterpretationProjection, 'projectBodyText')

        try {
            await expect(readMaterials({ ...request, executor, parentHandle })).rejects.toBeInstanceOf(
                PublicInterpretationNetworkUnavailableError
            )
            expect(bodyProjection).not.toHaveBeenCalled()
            expect(query).toHaveBeenCalledTimes(3)
            const [materialsSql, materialsParams] = query.mock.calls[2] as [string, unknown[]]
            expect(materialsSql).toContain('ELSE NULL END AS "body"')
            expect(materialsSql).toContain('AS "bodyOversized"')
            expect(materialsParams).toContain(MAX_PUBLIC_BODY_BYTES)
        } finally {
            bodyProjection.mockRestore()
        }
    })
})
