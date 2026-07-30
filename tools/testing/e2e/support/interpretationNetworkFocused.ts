import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'
import { getApplicationRuntime, getRuntimeAppData, listApplicationWorkspaces, sendWithCsrf } from './backend/api-session.mjs'
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
    cellId: string
    templateOwnerId: string | null
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

export const resolveRuntimeIds = async (api: InterpretationNetworkApi, applicationId: string): Promise<InterpretationNetworkRuntimeIds> => {
    const workspaces = (await listApplicationWorkspaces(api, applicationId)) as {
        items?: Array<{ id?: string; isDefault?: boolean }>
    }
    const workspaceId = requireString(workspaces.items?.find((workspace) => workspace.isDefault === true)?.id, 'default workspace id')
    const [structures, interpretations, materials, templates] = (await Promise.all(
        ['Structure', 'Interpretation', 'Material', 'TableTemplate'].map((objectCollectionCodename) =>
            getRuntimeAppData(api, applicationId, {
                objectCollectionCodename,
                workspaceId,
                locale: 'en',
                limit: 100,
                offset: 0
            })
        )
    )) as [RuntimeRowsResponse, RuntimeRowsResponse, RuntimeRowsResponse, RuntimeRowsResponse]

    const matrixComponentId = requireString(findColumn(interpretations, 'InterpretationMatrix')?.id, 'matrix TABLE component id')
    const templateMatrixComponentId = requireString(findColumn(templates, 'TemplateMatrix')?.id, 'template matrix TABLE component id')
    return {
        workspaceId,
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

export const setInterpretationNetworkWidgetConfig = async (
    api: InterpretationNetworkApi,
    applicationId: string,
    patch: Record<string, unknown>
): Promise<void> => {
    const runtime = (await getApplicationRuntime(api, applicationId)) as {
        zoneWidgets?: Record<string, Array<{ id?: string; widgetKey?: string; config?: Record<string, unknown>; layoutId?: string }>>
    }
    const updates = Object.values(runtime.zoneWidgets ?? {})
        .flat()
        .filter((widget) => widget.widgetKey === 'interpretationNetworkWorkspace' && typeof widget.id === 'string')
        .map((widget) => ({
            layoutId: widget.layoutId,
            widgetId: widget.id,
            config: { ...(widget.config ?? {}), ...patch }
        }))
    expect(updates.length, 'Interpretation Network widget config updates').toBeGreaterThan(0)
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
    const response = await sendWithCsrf(
        api,
        'POST',
        `/api/v1/applications/${applicationId}/runtime/interpretation-network/system-structure/ensure?workspaceId=${encodeURIComponent(
            workspaceId
        )}`,
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

const aggregateUrl = (applicationId: string, suffix: string, workspaceId: string) =>
    `/api/v1/applications/${applicationId}/runtime/interpretation-network${suffix}?workspaceId=${encodeURIComponent(workspaceId)}`

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
    const response = await fetchApi(api, aggregateUrl(applicationId, '/templates', workspaceId))
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
    const response = await fetchApi(api, aggregateUrl(applicationId, `/templates/${encodeURIComponent(templateId)}`, workspaceId))
    await assertApiOk(response, 'template detail')
    return (await response.json()) as TemplateDetail
}

export const saveTemplate = async (
    api: InterpretationNetworkApi,
    applicationId: string,
    workspaceId: string,
    input: { sourceStructureId: string; name: string; description: string; includeMaterials: boolean }
): Promise<TemplateSummary> => {
    const response = await sendWithCsrf(api, 'POST', aggregateUrl(applicationId, '/templates', workspaceId), {
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
    const response = await sendWithCsrf(
        api,
        'POST',
        aggregateUrl(applicationId, `/templates/${encodeURIComponent(template.id)}/instantiate`, workspaceId),
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
    const body = (await response.json()) as { items?: Array<Record<string, unknown>> }
    return body.items ?? []
}

const readRuntimeRowValue = (row: Record<string, unknown>, key: string): unknown => {
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key]
    const data = row.data
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
    const body = (await response.json()) as { items?: Array<Record<string, unknown>> }
    return body.items ?? []
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
    return (data.rows ?? []).map((row) => ({
        rowId: requireString(row.id, 'Material row id'),
        cellId: requireString(readRuntimeRowValue(row, 'CellId'), 'Material CellId'),
        templateOwnerId: readReferenceId(readRuntimeRowValue(row, 'TemplateOwnerId')),
        title: readLocalizedText(readRuntimeRowValue(row, 'Title')),
        description: readLocalizedText(readRuntimeRowValue(row, 'Description')),
        body: readRuntimeRowValue(row, 'Body'),
        row
    }))
}

export const createMaterialForCell = async (
    api: InterpretationNetworkApi,
    applicationId: string,
    runtimeIds: InterpretationNetworkRuntimeIds,
    input: {
        interpretationId: string
        matrixRowId: string
        cellId: string
        title: string
        description: string
        body?: unknown
    }
): Promise<{ id: string; matrixRowId: string }> => {
    const response = await sendWithCsrf(api, 'POST', aggregateUrl(applicationId, '/materials', runtimeIds.workspaceId), {
        interpretationId: input.interpretationId,
        matrixRowId: input.matrixRowId,
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
    expect(body.matrixRowId).toBe(input.matrixRowId)
    return body
}

export const expectSingleSystemMatrix = async (page: Page): Promise<void> => {
    const pane = page.getByTestId('interpretation-network-structure-pane')
    await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('interpretation-network-matrix-workspace')).toBeVisible({ timeout: 30_000 })
    await expect(pane.getByRole('tab', { name: 'Matrix' })).toBeVisible()
    await expect(pane.getByRole('tab', { name: 'Templates' })).toBeVisible()
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
    await page.getByRole('menuitem', { name: 'Russian' }).click()
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
    viewport: { width: number; height: number }
): Promise<void> => {
    await page.setViewportSize(viewport)
    await expectNoPageHorizontalOverflow(page, `${name} ${viewport.width}x${viewport.height}`)
    const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled' })
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
