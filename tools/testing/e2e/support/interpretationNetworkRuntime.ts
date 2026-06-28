// Interpretation Network interpretation network — runtime helpers for the
// `metahubs-interpretation-network-app-export.spec.ts` Playwright generator.
//
// The `interpretation-network` metahub template ships the start Page, two-pane
// dashboard layout, base presets, and the full interpretation-network
// model (Concept / Interpretation / Relation / Material + Context /
// RelationType / CellColor). Fresh apps must not ship user-authored
// demo Structures, matrix rows, Relations, Materials, or Templates.
//
// The named-entity lookup algorithm (`readRuntimeLabel` /
// `normalizeEntityLookup` / `findNamedItem`) is re-exported from
// `lmsRuntime.ts` as `_internal` so a single change there propagates
// to both runtime modules.

import type { Page } from '@playwright/test'
import { expect } from '../fixtures/test'
import { getRuntimeAppData, listObjectCollections } from './backend/api-session.mjs'
import { _internal, waitForMetahubEnumerationId, waitForOptionValueId } from './lmsRuntime'

export type ApiContext = Awaited<ReturnType<typeof import('./backend/api-session.mjs').createLoggedInApiContext>>

type InterpretationNetworkBrowserRegressionIssue = {
    source: 'console' | 'pageerror' | 'response'
    text: string
    url?: string
    status?: number
}

type NamedItem = {
    id?: string
    codename?: unknown
    name?: unknown
    title?: unknown
}

type RuntimeColumn = {
    codename?: string
    field?: string
    dataType?: string
    uiConfig?: Record<string, unknown>
    childColumns?: RuntimeColumn[]
}

type RuntimeData = {
    section?: {
        id?: string
        kind?: string
        codename?: string
        name?: string
        pageBlocks?: unknown
    }
    sections?: Array<{ codename?: string; kind?: string; name?: string }>
    columns?: RuntimeColumn[]
    rows?: Array<Record<string, unknown>>
}

/**
 * Waits for a Interpretation Network metahub Object collection by display codename.
 */
export async function waitForInterpretationNetworkMetahubObjectId(
    api: ApiContext,
    metahubId: string,
    expectedName: string
): Promise<string> {
    let objectId: string | null = null

    await expect
        .poll(
            async () => {
                const response = await listObjectCollections(api, metahubId, { limit: 100, offset: 0 })
                const found = _internal.findNamedItem((response.items ?? []) as NamedItem[], expectedName)
                objectId = found?.id ?? null
                return objectId
            },
            { timeout: 30_000, intervals: [500, 1_000, 2_000] }
        )
        .toBeTruthy()

    return String(objectId)
}

export const waitForInterpretationNetworkEnumerationId = (api: ApiContext, metahubId: string, expectedName: string) =>
    waitForMetahubEnumerationId(api, metahubId, expectedName)

export const waitForInterpretationNetworkOptionValueId = (
    api: ApiContext,
    metahubId: string,
    enumerationId: string,
    expectedCodename: string
) => waitForOptionValueId(api, metahubId, enumerationId, expectedCodename)

export const watchInterpretationNetworkBrowserRegressionIssues = (page: Page): InterpretationNetworkBrowserRegressionIssue[] => {
    const issues: InterpretationNetworkBrowserRegressionIssue[] = []

    page.on('console', (message) => {
        if (message.type() !== 'error') return
        issues.push({ source: 'console', text: message.text() })
    })
    page.on('pageerror', (error) => {
        issues.push({ source: 'pageerror', text: error.message })
    })
    page.on('response', (response) => {
        const status = response.status()
        const url = response.url()
        if (!url.includes('/api/v1/applications/') && !url.includes('/api/v1/metahub/')) return
        if (status >= 200 && status < 300) return
        if (status === 419) return
        issues.push({
            source: 'response',
            text: `HTTP ${status} ${response.request().method()} ${url}`,
            url,
            status
        })
    })

    return issues
}

export const expectNoInterpretationNetworkBrowserRegressionIssues = (
    issues: InterpretationNetworkBrowserRegressionIssue[],
    label: string
): void => {
    expect(
        issues,
        `${label} produced browser/runtime issues:\n${issues.map((issue) => `[${issue.source}] ${issue.text}`).join('\n')}`
    ).toEqual([])
}

const getColumnCodenames = (data: RuntimeData): string[] =>
    (data.columns ?? []).map((column) => column.codename ?? column.field).filter(Boolean) as string[]

const getChildColumnCodenames = (column: RuntimeColumn | undefined): string[] =>
    (column?.childColumns ?? []).map((child) => child.codename ?? child.field).filter(Boolean) as string[]

const findRuntimeColumn = (columns: RuntimeColumn[] | undefined, codename: string): RuntimeColumn | undefined =>
    (columns ?? []).find((column) => column.codename === codename || column.field === codename)

const expectRuntimeColumnHidden = (column: RuntimeColumn | undefined, label: string): void => {
    expect(column, `${label} column metadata must exist`).toBeDefined()
    const uiConfig = column?.uiConfig ?? {}
    expect(uiConfig.hidden, `${label} must be hidden from normal UI`).toBe(true)
    expect(uiConfig.gridHidden, `${label} must be hidden from runtime grids`).toBe(true)
    expect(uiConfig.formHidden, `${label} must be hidden from runtime forms`).toBe(true)
}

const resolveRuntimeField = (data: RuntimeData, codename: string): string => {
    const column = (data.columns ?? []).find((candidate) => candidate.codename === codename || candidate.field === codename)
    return column?.field ?? codename
}

const getRuntimeValue = (row: Record<string, unknown>, field: string): unknown => {
    if (Object.prototype.hasOwnProperty.call(row, field)) {
        return row[field]
    }
    const data = row.data
    if (data && typeof data === 'object' && !Array.isArray(data) && Object.prototype.hasOwnProperty.call(data, field)) {
        return (data as Record<string, unknown>)[field]
    }
    return undefined
}

const hasRuntimeRowWithFieldText = (data: RuntimeData, fieldCodename: string, expectedText: string): boolean => {
    const rows = data.rows ?? []
    const field = resolveRuntimeField(data, fieldCodename)
    return rows.some((row) => {
        const value = getRuntimeValue(row, field)
        return typeof value === 'string' && value.includes(expectedText)
    })
}

const expectRuntimeRowWithFieldTextAbsent = (data: RuntimeData, fieldCodename: string, forbiddenText: string, label: string): void => {
    expect(
        hasRuntimeRowWithFieldText(data, fieldCodename, forbiddenText),
        `${label} must not include seeded demo row where ${fieldCodename} contains "${forbiddenText}"`
    ).toBe(false)
}

const expectRuntimeSectionAvailable = (data: RuntimeData, codename: string, label: string): void => {
    const sections = data.sections ?? []
    expect(
        sections.some((section) => section.codename === codename),
        `${label} runtime section list must include ${codename}`
    ).toBe(true)
}

export async function expectInterpretationNetworkRuntimeDataReady(
    api: ApiContext,
    applicationId: string
): Promise<{
    conceptSectionId: string
    interpretationSectionId: string
    interpretationTitleField: string
    relationSectionId: string
    materialSectionId: string
}> {
    const concepts = (await getRuntimeAppData(api, applicationId, {
        objectCollectionCodename: 'Concept',
        locale: 'en',
        limit: 20,
        offset: 0
    })) as RuntimeData
    const interpretations = (await getRuntimeAppData(api, applicationId, {
        objectCollectionCodename: 'Interpretation',
        locale: 'en',
        limit: 20,
        offset: 0
    })) as RuntimeData
    const relations = (await getRuntimeAppData(api, applicationId, {
        objectCollectionCodename: 'Relation',
        locale: 'en',
        limit: 20,
        offset: 0
    })) as RuntimeData
    const materials = (await getRuntimeAppData(api, applicationId, {
        objectCollectionCodename: 'Material',
        locale: 'en',
        limit: 20,
        offset: 0
    })) as RuntimeData

    const conceptSectionId = typeof concepts?.section?.id === 'string' ? concepts.section.id : ''
    const interpretationSectionId = typeof interpretations?.section?.id === 'string' ? interpretations.section.id : ''
    const relationSectionId = typeof relations?.section?.id === 'string' ? relations.section.id : ''
    const materialSectionId = typeof materials?.section?.id === 'string' ? materials.section.id : ''
    expect(conceptSectionId, 'Interpretation Network Concept runtime section id').toBeTruthy()
    expect(interpretationSectionId, 'Interpretation Network Interpretation runtime section id').toBeTruthy()
    expect(relationSectionId, 'Interpretation Network Relation runtime section id').toBeTruthy()
    expect(materialSectionId, 'Interpretation Network Material runtime section id').toBeTruthy()
    const interpretationTitleField = resolveRuntimeField(interpretations, 'Title')

    for (const sectionCodename of ['Concept', 'Interpretation', 'Relation', 'Material']) {
        expectRuntimeSectionAvailable(concepts, sectionCodename, 'Interpretation Network Concept response')
    }

    expect(getColumnCodenames(concepts)).toEqual(expect.arrayContaining(['Term', 'Description', 'Context']))
    expect(getColumnCodenames(interpretations)).toEqual(
        expect.arrayContaining(['Title', 'ParentConcept', 'Context', 'InterpretationMatrix'])
    )
    expect(getColumnCodenames(relations)).toEqual(expect.arrayContaining(['SourceLabel', 'TargetLabel', 'RelationType', 'Description']))
    for (const hiddenRelationColumn of ['SourceKind', 'SourceId', 'TargetKind', 'TargetId']) {
        expectRuntimeColumnHidden(findRuntimeColumn(relations.columns, hiddenRelationColumn), `Relation.${hiddenRelationColumn}`)
    }

    const matrixColumn = findRuntimeColumn(interpretations.columns, 'InterpretationMatrix')
    expect(matrixColumn?.dataType, 'InterpretationMatrix must be a TABLE runtime column').toBe('TABLE')
    expect(getChildColumnCodenames(matrixColumn)).toEqual(expect.arrayContaining(['CellId', 'CellValue', 'CellFillColor', 'MaterialRef']))
    expectRuntimeColumnHidden(findRuntimeColumn(matrixColumn?.childColumns, 'CellId'), 'InterpretationMatrix.CellId')
    const materialRefColumn = findRuntimeColumn(matrixColumn?.childColumns, 'MaterialRef')
    expect(materialRefColumn?.dataType, 'InterpretationMatrix.MaterialRef must be a REF runtime child column').toBe('REF')

    expect(concepts.rows ?? [], 'Fresh Interpretation Network Concepts must start without demo structures').toHaveLength(0)
    expect(interpretations.rows ?? [], 'Fresh Interpretation Network Interpretations must start without demo pages').toHaveLength(0)
    expect(relations.rows ?? [], 'Fresh Interpretation Network Relations must start empty').toHaveLength(0)
    expectRuntimeRowWithFieldTextAbsent(concepts, 'Term', 'Gravity', 'Interpretation Network Concepts')
    expectRuntimeRowWithFieldTextAbsent(interpretations, 'Title', 'Attraction between masses', 'Interpretation Network Interpretations')
    expectRuntimeRowWithFieldTextAbsent(relations, 'SourceLabel', 'Gravity', 'Interpretation Network Relations')

    expect(materials.section?.kind, 'Material must be exposed as an Object runtime section').toBe('object')
    expect(getColumnCodenames(materials)).toEqual(expect.arrayContaining(['Title', 'Body']))
    expect(materials.rows ?? [], 'Fresh Interpretation Network Materials must start empty').toHaveLength(0)
    expectRuntimeRowWithFieldTextAbsent(materials, 'Title', 'Gravity material', 'Interpretation Network Materials')

    const tableTemplates = (await getRuntimeAppData(api, applicationId, {
        objectCollectionCodename: 'TableTemplate',
        locale: 'en',
        limit: 20,
        offset: 0
    })) as RuntimeData
    expect(getColumnCodenames(tableTemplates)).toEqual(expect.arrayContaining(['Name', 'Description', 'TemplateMatrix']))
    expect(tableTemplates.rows ?? [], 'Fresh Interpretation Network TableTemplate records must start empty').toHaveLength(0)
    expectRuntimeRowWithFieldTextAbsent(tableTemplates, 'Name', 'Basic interpretation matrix', 'Interpretation Network TableTemplates')

    return {
        conceptSectionId,
        interpretationSectionId,
        interpretationTitleField,
        relationSectionId,
        materialSectionId
    }
}

// (The generator spec imports createLoggedInApiContext and disposeApiContext
// directly from './backend/api-session.mjs' — they don't need to be
// re-exported through this module.)
