import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'
import {
    getApplicationEffectiveLayout,
    getRuntimeAppData,
    listApplicationLayouts,
    listApplicationLayoutWidgets,
    listApplicationWorkspaces,
    sendWithCsrf
} from './backend/api-session.mjs'
import { expectNoPageHorizontalOverflow } from './browser/runtimeUx'

export type InterpretationNetworkApi = Awaited<ReturnType<typeof import('./backend/api-session.mjs').createLoggedInApiContext>>

export type RuntimeRowsResponse = {
    section?: { id?: string; codename?: string }
    objectCollection?: { id?: string; codename?: string }
    columns?: Array<{
        id?: string
        codename?: string
        field?: string
        dataType?: string
        childColumns?: Array<{ id?: string; codename?: string; field?: string }>
    }>
    rows?: Array<Record<string, unknown>>
}

export type InterpretationNetworkRuntimeIds = {
    workspaceId: string
    layoutId: string
    widgetId: string
    instanceKey: string
    entityTypeId: string
    structureSectionId: string
    interpretationSectionId: string
    materialSectionId: string
    templateSectionId: string
    matrixComponentId: string
    templateMatrixComponentId: string
}

export type MatrixRowSnapshot = {
    rowId: string
    cellId: string
    parentCellId: string | null
    materialRef: string | null
    row: Record<string, unknown>
}

export type MaterialRowSnapshot = {
    rowId: string
    title: string
    description: string
    body: unknown
    row: Record<string, unknown>
}

export type TemplateSummary = {
    id: string
    name: unknown
    description?: unknown
    includesMaterials: boolean
    version: number
}

export type TemplateDetail = TemplateSummary & {
    matrix: { cellCount: number; rootCount: number; maxDepth: number }
    materialCount: number
}

export const uuidV7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const localizedContent = (content: string, locale = 'en') => {
    const timestamp = new Date(0).toISOString()
    return {
        _schema: '1',
        _primary: locale,
        locales: {
            [locale]: {
                content,
                version: 1,
                isActive: true,
                createdAt: timestamp,
                updatedAt: timestamp
            }
        }
    }
}

export const readLocalizedText = (value: unknown, locale = 'en'): string => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
    const localized = value as { _primary?: string; locales?: Record<string, { content?: unknown }> }
    const direct = localized.locales?.[locale]?.content
    if (typeof direct === 'string') return direct
    const primary = localized._primary ? localized.locales?.[localized._primary]?.content : undefined
    if (typeof primary === 'string') return primary
    const first = Object.values(localized.locales ?? {}).find((entry) => typeof entry.content === 'string')?.content
    return typeof first === 'string' ? first : ''
}

const requireString = (value: unknown, label: string): string => {
    expect(value, label).toEqual(expect.any(String))
    return String(value)
}

const findColumn = (data: RuntimeRowsResponse, codename: string) =>
    data.columns?.find((column) => column.codename === codename || column.field === codename)

/**
 * Runtime row payloads are keyed by physical `column_name` while the matrix
 * helpers speak in component codenames. Build the field→codename map from the
 * runtime column metadata so both key styles are available on every row.
 */
const buildColumnAliases = (columns: RuntimeRowsResponse['columns']): Record<string, string> => {
    const aliases: Record<string, string> = {}
    const collect = (column?: { field?: string; codename?: string }) => {
        if (!column) return
        if (typeof column.field === 'string' && typeof column.codename === 'string' && column.field !== column.codename) {
            aliases[column.field] = column.codename
        }
    }
    for (const column of columns ?? []) {
        collect(column)
        for (const child of column.childColumns ?? []) {
            collect(child)
        }
    }
    return aliases
}

const withColumnAliases = (row: Record<string, unknown>, aliases: Record<string, string>): Record<string, unknown> => {
    const mapped = { ...row }
    for (const [field, codename] of Object.entries(aliases)) {
        if (!Object.prototype.hasOwnProperty.call(mapped, codename) && Object.prototype.hasOwnProperty.call(row, field)) {
            mapped[codename] = row[field]
        }
    }
    return mapped
}

export const resolveRuntimeIds = async (
    api: InterpretationNetworkApi,
    applicationId: string,
    requestedWorkspaceId?: string
): Promise<InterpretationNetworkRuntimeIds> => {
    const workspaces = (await listApplicationWorkspaces(api, applicationId)) as {
        items?: Array<{ id?: string; isDefault?: boolean }>
    }
    const workspaceId = requireString(
        requestedWorkspaceId ?? workspaces.items?.find((workspace) => workspace.isDefault === true)?.id,
        requestedWorkspaceId ? 'requested workspace id' : 'default workspace id'
    )
    const [structures, interpretations, materials, templates, widgetContext] = (await Promise.all([
        ...(['Structure', 'Interpretation', 'Material', 'TableTemplate'].map((objectCollectionCodename) =>
            getRuntimeAppData(api, applicationId, {
                objectCollectionCodename,
                workspaceId,
                locale: 'en',
                limit: 100,
                offset: 0
            })
        ) as Promise<unknown>[]),
        resolveInterpretationNetworkWidgetContext(api, applicationId, workspaceId)
    ])) as [RuntimeRowsResponse, RuntimeRowsResponse, RuntimeRowsResponse, RuntimeRowsResponse, InterpretationNetworkWidgetContext]

    const matrixComponentId = requireString(findColumn(interpretations, 'InterpretationMatrix')?.id, 'matrix TABLE component id')
    const templateMatrixComponentId = requireString(findColumn(templates, 'TemplateMatrix')?.id, 'template matrix TABLE component id')
    return {
        workspaceId,
        ...widgetContext,
        structureSectionId: requireString(structures.section?.id ?? structures.objectCollection?.id, 'Structure section id'),
        interpretationSectionId: requireString(
            interpretations.section?.id ?? interpretations.objectCollection?.id,
            'Interpretation section id'
        ),
        materialSectionId: requireString(materials.section?.id ?? materials.objectCollection?.id, 'Material section id'),
        templateSectionId: requireString(templates.section?.id ?? templates.objectCollection?.id, 'TableTemplate section id'),
        matrixComponentId,
        templateMatrixComponentId
    }
}

export type InterpretationNetworkWidgetContext = {
    layoutId: string
    widgetId: string
    instanceKey: string
    entityTypeId: string
}

export const resolveInterpretationNetworkWidgetContext = async (
    api: InterpretationNetworkApi,
    applicationId: string,
    workspaceId: string
): Promise<InterpretationNetworkWidgetContext> => {
    const effectiveLayout = (await getApplicationEffectiveLayout(api, applicationId, {
        targetKind: 'object',
        entityTypeCodename: 'Structure',
        workspaceId,
        locale: 'en',
        themeVariant: 'light'
    })) as {
        layout?: { id?: unknown }
        resolvedEntityTypeId?: unknown
        widgets?: Array<{ id?: unknown; instanceKey?: unknown; widgetKey?: string }>
    }
    const widget = effectiveLayout.widgets?.find((candidate) => candidate.widgetKey === 'interpretationNetworkWorkspace')
    return {
        layoutId: requireString(effectiveLayout.layout?.id, 'Structure-scoped layout id'),
        widgetId: requireString(widget?.id, 'Structure-scoped Interpretation Network widget id'),
        instanceKey: requireString(widget?.instanceKey, 'Structure-scoped Interpretation Network widget instance key'),
        entityTypeId: requireString(effectiveLayout.resolvedEntityTypeId, 'Structure entity type id')
    }
}

export const setInterpretationNetworkWidgetConfig = async (
    api: InterpretationNetworkApi,
    applicationId: string,
    patch: Record<string, unknown>
): Promise<void> => {
    const layoutCollection = (await listApplicationLayouts(api, applicationId, { limit: 100, offset: 0 })) as {
        items?: Array<{ id?: string; isActive?: boolean }>
    }
    const widgetCollections = await Promise.all(
        (layoutCollection.items ?? [])
            .filter((layout): layout is { id: string; isActive?: boolean } => typeof layout.id === 'string' && layout.isActive === true)
            .map((layout) => listApplicationLayoutWidgets(api, applicationId, layout.id))
    )
    const targetWidgets = widgetCollections
        .flatMap(
            (collection) =>
                (
                    collection as {
                        items?: Array<{
                            id?: string
                            layoutId?: string
                            widgetKey?: string
                            config?: Record<string, unknown>
                            isActive?: boolean
                            version?: number
                        }>
                    }
                ).items ?? []
        )
        .filter(
            (widget) =>
                widget.widgetKey === 'interpretationNetworkWorkspace' &&
                widget.isActive === true &&
                typeof widget.id === 'string' &&
                typeof widget.layoutId === 'string'
        )
    expect(targetWidgets.length, 'Interpretation Network widget config updates').toBeGreaterThan(0)

    const updates = targetWidgets.map((widget) => {
        expect(widget.version, `Widget ${widget.id} exposes a persisted version`).toBeGreaterThan(0)
        return {
            layoutId: widget.layoutId,
            widgetId: widget.id,
            config: { ...(widget.config ?? {}), ...patch },
            expectedVersion: widget.version
        }
    })

    const response = await sendWithCsrf(api, 'PATCH', `/api/v1/applications/${applicationId}/layouts/zone-widgets/config/batch`, {
        updates
    })
    await assertApiOk(response, 'widget config update')
}

export const ensureSystemStructure = async (
    api: InterpretationNetworkApi,
    applicationId: string,
    workspaceId: string
): Promise<{ structureId: string; interpretationId: string; rootCellId: string; created: boolean; canCreate?: boolean }> => {
    const widgetContext = await resolveInterpretationNetworkWidgetContext(api, applicationId, workspaceId)
    const query = new URLSearchParams({
        workspaceId,
        layoutId: widgetContext.layoutId,
        widgetId: widgetContext.widgetId
    })
    const response = await sendWithCsrf(
        api,
        'POST',
        `/api/v1/applications/${applicationId}/runtime/interpretation-network/system-structure/ensure?${query}`,
        { locale: 'en' }
    )
    await assertApiOk(response, 'ensure system structure')
    const body = (await response.json()) as {
        structureId: string
        interpretationId: string
        rootCellId: string
        created: boolean
        canCreate?: boolean
    }
    expect(body.structureId).toMatch(uuidV7Pattern)
    expect(body.interpretationId).toMatch(uuidV7Pattern)
    expect(body.rootCellId).toMatch(uuidV7Pattern)
    return body
}

const aggregateUrl = (applicationId: string, suffix: string, workspaceId: string, widgetContext: InterpretationNetworkWidgetContext) => {
    const query = new URLSearchParams({
        workspaceId,
        layoutId: widgetContext.layoutId,
        widgetId: widgetContext.widgetId
    })
    return `/api/v1/applications/${applicationId}/runtime/interpretation-network${suffix}?${query}`
}

const fetchApi = async (api: InterpretationNetworkApi, path: string, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers ?? {})
    headers.set('Accept', 'application/json')
    const cookies =
        api.cookies instanceof Map
            ? Array.from(api.cookies.entries())
                  .map(([name, value]) => `${name}=${value}`)
                  .join('; ')
            : ''
    if (cookies) headers.set('Cookie', cookies)
    return fetch(new URL(path, api.baseURL), { ...init, headers })
}

const assertApiOk = async (response: Response, label: string, expectedStatus?: number): Promise<void> => {
    if (!response.ok || (expectedStatus !== undefined && response.status !== expectedStatus)) {
        throw new Error(`${label} failed with ${response.status}: ${await response.text()}`)
    }
}

export const listTemplates = async (
    api: InterpretationNetworkApi,
    applicationId: string,
    workspaceId: string
): Promise<TemplateSummary[]> => {
    const widgetContext = await resolveInterpretationNetworkWidgetContext(api, applicationId, workspaceId)
    const response = await fetchApi(api, aggregateUrl(applicationId, '/templates', workspaceId, widgetContext))
    if (response.status === 403) {
        return []
    }
    await assertApiOk(response, 'template list')
    const body = (await response.json()) as { items?: TemplateSummary[] }
    return body.items ?? []
}

export const getTemplateDetail = async (
    api: InterpretationNetworkApi,
    applicationId: string,
    workspaceId: string,
    templateId: string
): Promise<TemplateDetail> => {
    const widgetContext = await resolveInterpretationNetworkWidgetContext(api, applicationId, workspaceId)
    const response = await fetchApi(
        api,
        aggregateUrl(applicationId, `/templates/${encodeURIComponent(templateId)}`, workspaceId, widgetContext)
    )
    await assertApiOk(response, 'template detail')
    return (await response.json()) as TemplateDetail
}

export const saveTemplate = async (
    api: InterpretationNetworkApi,
    applicationId: string,
    workspaceId: string,
    input: { sourceStructureId: string; name: string; description: string; includeMaterials: boolean }
): Promise<TemplateSummary> => {
    const widgetContext = await resolveInterpretationNetworkWidgetContext(api, applicationId, workspaceId)
    const response = await sendWithCsrf(api, 'POST', aggregateUrl(applicationId, '/templates', workspaceId, widgetContext), {
        sourceStructureId: input.sourceStructureId,
        templateName: localizedContent(input.name),
        description: localizedContent(input.description),
        includeMaterials: input.includeMaterials,
        locale: 'en'
    })
    await assertApiOk(response, 'template save', 201)
    const template = (await response.json()) as TemplateSummary
    expect(template.id).toMatch(uuidV7Pattern)
    return template
}

export const instantiateTemplate = async (
    api: InterpretationNetworkApi,
    applicationId: string,
    workspaceId: string,
    template: TemplateSummary,
    name: string
): Promise<{ structureId: string; interpretationId: string }> => {
    const widgetContext = await resolveInterpretationNetworkWidgetContext(api, applicationId, workspaceId)
    const response = await sendWithCsrf(
        api,
        'POST',
        aggregateUrl(applicationId, `/templates/${encodeURIComponent(template.id)}/instantiate`, workspaceId, widgetContext),
        {
            structureName: localizedContent(name),
            description: localizedContent(`Created from ${readLocalizedText(template.name)}`),
            expectedVersion: template.version,
            locale: 'en'
        }
    )
    await assertApiOk(response, 'template instantiate', 201)
    const body = (await response.json()) as { structureId: string; interpretationId: string }
    expect(body.structureId).toMatch(uuidV7Pattern)
    expect(body.interpretationId).toMatch(uuidV7Pattern)
    return body
}

export const getMatrixRows = async (
    api: InterpretationNetworkApi,
    applicationId: string,
    runtimeIds: InterpretationNetworkRuntimeIds,
    interpretationId: string
): Promise<Array<Record<string, unknown>>> => {
    const params = new URLSearchParams({
        objectCollectionId: runtimeIds.interpretationSectionId,
        workspaceId: runtimeIds.workspaceId
    })
    const response = await fetchApi(
        api,
        `/api/v1/applications/${applicationId}/runtime/rows/${interpretationId}/tabular/${runtimeIds.matrixComponentId}?${params}`
    )
    await assertApiOk(response, 'matrix rows read')
    const columns = (await getRuntimeAppData(api, applicationId, {
        objectCollectionCodename: 'Interpretation',
        workspaceId: runtimeIds.workspaceId,
        locale: 'en',
        limit: 1,
        offset: 0
    })) as RuntimeRowsResponse
    const aliases = buildColumnAliases(columns.columns)
    const body = (await response.json()) as { items?: Array<Record<string, unknown>> }
    return (body.items ?? []).map((row) => withColumnAliases(row, aliases))
}

const readRuntimeRowValue = (row: Record<string, unknown>, key: string): unknown => {
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key]
    const data = row.data
    if (data && typeof data === 'object' && !Array.isArray(data) && Object.prototype.hasOwnProperty.call(data, key)) {
        return (data as Record<string, unknown>)[key]
    }
    const matrixHierarchy = row.matrixHierarchy
    if (matrixHierarchy && typeof matrixHierarchy === 'object' && !Array.isArray(matrixHierarchy)) {
        const hierarchyValue = (matrixHierarchy as Record<string, unknown>)[
            key === 'CellId' ? 'cellId' : key === 'ParentCellId' ? 'parentCellId' : ''
        ]
        if (hierarchyValue !== undefined) return hierarchyValue
    }
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>)[key] : undefined
}

const readReferenceId = (value: unknown): string | null => {
    if (typeof value === 'string') return value.trim() || null
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' && id.trim() ? id.trim() : null
}

export const toMatrixRowSnapshot = (row: Record<string, unknown>): MatrixRowSnapshot => ({
    rowId: requireString(row.id, 'matrix row id'),
    cellId: requireString(readRuntimeRowValue(row, 'CellId'), 'matrix CellId'),
    parentCellId: readReferenceId(readRuntimeRowValue(row, 'ParentCellId')),
    materialRef: readReferenceId(readRuntimeRowValue(row, 'MaterialRef')),
    row
})

export const findMatrixRowByTitle = (rows: Array<Record<string, unknown>>, title: string): MatrixRowSnapshot => {
    const row = rows.find((candidate) => readLocalizedText(readRuntimeRowValue(candidate, 'CellValue')) === title)
    expect(row, `matrix row titled ${title}`).toBeDefined()
    return toMatrixRowSnapshot(row!)
}

export const getTemplateMatrixRows = async (
    api: InterpretationNetworkApi,
    applicationId: string,
    runtimeIds: InterpretationNetworkRuntimeIds,
    templateId: string
): Promise<Array<Record<string, unknown>>> => {
    const params = new URLSearchParams({
        objectCollectionId: runtimeIds.templateSectionId,
        workspaceId: runtimeIds.workspaceId
    })
    const response = await fetchApi(
        api,
        `/api/v1/applications/${applicationId}/runtime/rows/${templateId}/tabular/${runtimeIds.templateMatrixComponentId}?${params}`
    )
    await assertApiOk(response, 'template matrix rows read')
    const columns = (await getRuntimeAppData(api, applicationId, {
        objectCollectionCodename: 'TableTemplate',
        workspaceId: runtimeIds.workspaceId,
        locale: 'en',
        limit: 1,
        offset: 0
    })) as RuntimeRowsResponse
    const aliases = buildColumnAliases(columns.columns)
    const body = (await response.json()) as { items?: Array<Record<string, unknown>> }
    return (body.items ?? []).map((row) => withColumnAliases(row, aliases))
}

export const getMaterialRows = async (
    api: InterpretationNetworkApi,
    applicationId: string,
    runtimeIds: InterpretationNetworkRuntimeIds
): Promise<MaterialRowSnapshot[]> => {
    const data = (await getRuntimeAppData(api, applicationId, {
        objectCollectionCodename: 'Material',
        workspaceId: runtimeIds.workspaceId,
        locale: 'en',
        limit: 100,
        offset: 0
    })) as RuntimeRowsResponse
    const aliases = buildColumnAliases(data.columns)
    return (data.rows ?? []).map((row) => {
        const mappedRow = withColumnAliases(row, aliases)
        return {
            rowId: requireString(mappedRow.id, 'Material row id'),
            title: readLocalizedText(readRuntimeRowValue(mappedRow, 'Title')),
            description: readLocalizedText(readRuntimeRowValue(mappedRow, 'Description')),
            body: readRuntimeRowValue(mappedRow, 'Body'),
            row: mappedRow
        }
    })
}

export const createMaterialForCell = async (
    api: InterpretationNetworkApi,
    applicationId: string,
    runtimeIds: InterpretationNetworkRuntimeIds,
    input: {
        interpretationId: string
        cellId: string
        title: string
        description: string
        body?: unknown
    }
): Promise<{ id: string; matrixRowId: string }> => {
    const widgetContext = runtimeIds
    const response = await sendWithCsrf(api, 'POST', aggregateUrl(applicationId, '/materials', runtimeIds.workspaceId, widgetContext), {
        interpretationId: input.interpretationId,
        cellId: input.cellId,
        data: {
            Title: localizedContent(input.title),
            Description: localizedContent(input.description),
            ...(input.body === undefined ? {} : { Body: input.body })
        }
    })
    await assertApiOk(response, 'material create', 201)
    const body = (await response.json()) as { id: string; matrixRowId: string }
    expect(body.id).toMatch(uuidV7Pattern)
    expect(body.matrixRowId).toMatch(uuidV7Pattern)
    return body
}

export const setPrimaryMaterialForCell = async (
    api: InterpretationNetworkApi,
    applicationId: string,
    runtimeIds: InterpretationNetworkRuntimeIds,
    input: { interpretationId: string; cellId: string; materialId: string; expectedCellVersion: number }
): Promise<void> => {
    const widgetContext = runtimeIds
    const response = await sendWithCsrf(
        api,
        'PUT',
        aggregateUrl(applicationId, '/materials/primary', runtimeIds.workspaceId, widgetContext),
        input
    )
    await assertApiOk(response, 'set Primary Material')
}

export const expectSingleSystemMatrix = async (page: Page): Promise<void> => {
    const pane = page.getByTestId('interpretation-network-structure-pane')
    const matrixWorkspace = page.getByTestId('interpretation-network-matrix-workspace')
    await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
    await expect(matrixWorkspace).toBeVisible({ timeout: 30_000 })
    const workspaceTabs = matrixWorkspace.getByRole('tablist', { name: 'Workspace sections' })
    await expect(workspaceTabs.getByRole('tab', { name: 'Matrix', exact: true })).toBeVisible()
    await expect(workspaceTabs.getByRole('tab', { name: 'Favorites', exact: true })).toBeVisible()
    await expect(workspaceTabs.getByRole('tab', { name: 'Templates', exact: true })).toBeVisible()
    await expect(workspaceTabs.getByRole('tab')).toHaveCount(3)
    await expect(pane.getByRole('tablist', { name: 'Structure list sections' })).toHaveCount(0)
    await expect(pane.getByRole('heading', { name: 'Structures' })).toHaveCount(0)
    await expect(page.getByTestId('interpretation-network-structure-header')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Structures' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Universe/ }).first()).toBeVisible()
}

export const openStructures = async (page: Page): Promise<void> => {
    const navigation = page
        .getByRole('navigation')
        .filter({ has: page.getByRole('link', { name: 'Structures' }).or(page.getByRole('button', { name: 'Structures' })) })
        .filter({ visible: true })
        .first()
    await expect(navigation).toBeVisible({ timeout: 30_000 })
    await navigation
        .getByRole('link', { name: 'Structures' })
        .or(navigation.getByRole('button', { name: 'Structures' }))
        .first()
        .click()
}

export const addRussianVariant = async (page: Page, field: Locator, value: string): Promise<void> => {
    const fieldLabel = await field.evaluate((element) => {
        if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return ''
        return element.labels?.[0]?.textContent?.replace(/\s*\*\s*$/, '').trim() ?? ''
    })
    expect(fieldLabel, 'localized field label').toBeTruthy()
    const localeFieldWrapper = field.locator('xpath=ancestor::*[.//button[normalize-space(.)="EN"]][1]')
    const languageButton = localeFieldWrapper.getByRole('button', { name: 'EN', exact: true })
    await expect(languageButton).toBeVisible()
    await languageButton.click()
    await page.getByRole('menuitem', { name: 'Add language' }).click()
    await page.getByRole('menuitem', { name: /^(Russian|Русский)$/ }).click()
    const russianField = field
        .locator('xpath=ancestor::*[@role="dialog"][1]')
        .getByRole('textbox', { name: fieldLabel, exact: true })
        .last()
    await expect(russianField).toBeVisible()
    await russianField.fill(value)
}

export const openTemplateAction = async (page: Page, templateTitle: string, action: 'Open' | 'Edit' | 'Delete'): Promise<void> => {
    const actionButton = page.getByRole('button', { name: `Template actions: ${templateTitle}`, exact: true })
    await expect(actionButton).toBeVisible()
    await actionButton.click()
    const actionsMenu = page.getByRole('menu', { name: 'Template actions' })
    await expect(actionsMenu).toBeVisible()
    await actionsMenu.getByRole('menuitem', { name: action, exact: true }).click()
}

export const attachViewportEvidence = async (
    page: Page,
    testInfo: TestInfo,
    name: string,
    viewport: { width: number; height: number },
    options: { fullPage?: boolean } = {}
): Promise<void> => {
    await page.setViewportSize(viewport)
    await expectNoPageHorizontalOverflow(page, `${name} ${viewport.width}x${viewport.height}`)
    const screenshot = await page.screenshot({ fullPage: options.fullPage ?? true, animations: 'disabled' })
    expect(screenshot.byteLength, `${name} screenshot must not be empty`).toBeGreaterThan(5_000)
    await testInfo.attach(`${name}-${viewport.width}x${viewport.height}`, { body: screenshot, contentType: 'image/png' })
}

export const attachDialogViewportEvidence = async (
    page: Page,
    testInfo: TestInfo,
    dialog: Locator,
    name: string,
    viewport: { width: number; height: number },
    visibleActionNames: string[] = []
): Promise<void> => {
    await page.setViewportSize(viewport)
    await expect(dialog).toBeVisible()
    for (const actionName of visibleActionNames) {
        await expect(dialog.getByRole('button', { name: actionName, exact: true })).toBeVisible()
    }
    await expectNoPageHorizontalOverflow(page, `${name} ${viewport.width}x${viewport.height}`)
    const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled' })
    expect(screenshot.byteLength, `${name} screenshot must not be empty`).toBeGreaterThan(5_000)
    await testInfo.attach(`${name}-${viewport.width}x${viewport.height}`, { body: screenshot, contentType: 'image/png' })
}
