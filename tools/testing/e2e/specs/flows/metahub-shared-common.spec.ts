import type { Locator, Page, Response, TestInfo } from '@playwright/test'
import fs from 'fs/promises'
import path from 'path'
import { createLocalizedContent } from '@universo-react/utils'
import { expect, test } from '../../fixtures/test'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage, RUNTIME_UX_VIEWPORT_MATRIX } from '../../support/browser/runtimeUx'
import {
    createLoggedInApiContext,
    createMetahub,
    createObjectCollection,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    disposeApiContext,
    getApplicationRuntime,
    getLayout,
    listComponents,
    listOptionValues,
    listLayoutZoneWidgets,
    listLayouts,
    listObjectCollections,
    listOptionLists,
    listValueGroups,
    listFixedValues,
    listMetahubBranches,
    listMetahubModules,
    sendWithCsrf,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { QUIZ_CENTERED_LAYOUT_CONFIG, QUIZ_REMOVED_LAYOUT_WIDGET_KEYS } from '../../support/quizFixtureContract'
import {
    applicationSelectors,
    buildEntityMenuItemSelector,
    buildEntityMenuTriggerSelector,
    buildLayoutZoneSelector,
    entityDialogSelectors,
    pageSpacingSelectors,
    toolbarSelectors,
    viewHeaderSelectors
} from '../../support/selectors/contracts'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

type ListPayload<T> = {
    items?: T[]
}

type EntityRecord = {
    id?: string
    name?: unknown
    codename?: unknown
}

type RuntimeState = {
    object?: {
        id?: string
    }
    columns?: Array<{
        field?: string
        headerName?: string
    }>
}

type MetahubBranchRecord = {
    id?: string
    branchNumber?: number
    branch_number?: number
    schemaName?: string
    schema_name?: string
    isDefault?: boolean
    is_default?: boolean
}

type MetahubModuleRecord = {
    id?: string
    checksum?: string | null
    sourceChecksum?: string | null
    sourceCode?: string | null
    sourcePath?: string | null
    sourceStorage?: {
        checksum?: string | null
        content?: string | null
        path?: string | null
    }
}

const SHARED_LIBRARY_SOURCE = `import { SharedLibraryModule } from '@universo-react/extension-sdk'

export default class QuizSharedLibrary extends SharedLibraryModule {
  static buildTitle(locale = 'en') {
    return String(locale).toLowerCase().startsWith('ru') ? 'Общая космическая викторина' : 'Shared Space Quiz'
  }

  static buildDescription(locale = 'en') {
    return String(locale).toLowerCase().startsWith('ru')
      ? 'Этот заголовок и описание приходят из general/library module.'
      : 'This title and description come from the general/library module.'
  }

  static buildPrompt(locale = 'en') {
    return String(locale).toLowerCase().startsWith('ru')
      ? 'Какая планета известна как Красная планета?'
      : 'Which planet is known as the Red Planet?'
  }

  static buildExplanation(locale = 'en') {
    return String(locale).toLowerCase().startsWith('ru')
      ? 'Марс кажется красным из-за железистой пыли на поверхности.'
      : 'Mars looks red because iron-rich dust covers its surface.'
  }
}
`

const FILE_BACKED_LIBRARY_SOURCE_V1 = `import { SharedLibraryModule } from '@universo-react/extension-sdk'

export default class FileBackedSharedLibrary extends SharedLibraryModule {
  static marker() {
    return 'file-backed-v1'
  }
}
`

const FILE_BACKED_LIBRARY_SOURCE_V2 = `import { SharedLibraryModule } from '@universo-react/extension-sdk'

export default class FileBackedSharedLibrary extends SharedLibraryModule {
  static marker() {
    return 'file-backed-v2'
  }
}
`

const SHARED_WIDGET_SOURCE = `import { AtClient, AtServer, ExtensionModule } from '@universo-react/extension-sdk'
import QuizSharedLibrary from '@shared/quiz-shared'

const buildQuiz = (locale = 'en') => ({
  title: QuizSharedLibrary.buildTitle(locale),
  description: QuizSharedLibrary.buildDescription(locale),
  submitLabel: locale.toLowerCase().startsWith('ru') ? 'Проверить ответ' : 'Check answer',
  nextLabel: locale.toLowerCase().startsWith('ru') ? 'Следующий вопрос' : 'Next question',
  questions: [
    {
      id: 'q1',
      prompt: QuizSharedLibrary.buildPrompt(locale),
      description: QuizSharedLibrary.buildDescription(locale),
      multiple: false,
      difficulty: 1,
      options: [
        { id: 'a', label: locale.toLowerCase().startsWith('ru') ? 'Венера' : 'Venus' },
        { id: 'b', label: locale.toLowerCase().startsWith('ru') ? 'Марс' : 'Mars' },
        { id: 'c', label: locale.toLowerCase().startsWith('ru') ? 'Меркурий' : 'Mercury' },
        { id: 'd', label: locale.toLowerCase().startsWith('ru') ? 'Юпитер' : 'Jupiter' }
      ]
    }
  ]
})

export default class SharedQuizWidget extends ExtensionModule {
  @AtClient()
  async mount(locale = 'en') {
    return this.ctx.callServerMethod('getQuiz', [{ locale }])
  }

  @AtServer()
  async getQuiz(payload) {
    const locale = typeof payload?.[0]?.locale === 'string' ? payload[0].locale : 'en'
    return buildQuiz(locale)
  }

  @AtServer()
  async submit(payload) {
    const locale = typeof payload?.locale === 'string' ? payload.locale : 'en'
    const selected = Array.isArray(payload?.answerIds) ? payload.answerIds.map((entry) => String(entry)) : []
    const correct = selected.length === 1 && selected[0] === 'b'
    return {
      questionId: 'q1',
      correct,
      score: correct ? 1 : 0,
      total: 1,
      completed: true,
      message: correct
        ? locale.toLowerCase().startsWith('ru')
          ? 'Верно!'
          : 'Correct!'
        : locale.toLowerCase().startsWith('ru')
          ? 'Попробуйте еще раз.'
          : 'Try again.',
      explanation: QuizSharedLibrary.buildExplanation(locale),
      correctOptionIds: {
        q1: ['b']
      }
    }
  }
}
`

function readLocalizedText(value: unknown, locale = 'en'): string | undefined {
    if (typeof value === 'string') {
        return value
    }

    if (!value || typeof value !== 'object' || !('locales' in value)) {
        return undefined
    }

    const localized = value as { _primary?: string; locales?: Record<string, { content?: string }> }
    const normalizedLocale = locale.split(/[-_]/)[0]?.toLowerCase() || 'en'
    const locales = localized.locales ?? {}

    const directValue = locales[normalizedLocale]?.content
    if (typeof directValue === 'string' && directValue.length > 0) {
        return directValue
    }

    const primaryValue = localized._primary ? locales[localized._primary]?.content : undefined
    if (typeof primaryValue === 'string' && primaryValue.length > 0) {
        return primaryValue
    }

    const fallbackValue = Object.values(locales).find((entry) => typeof entry?.content === 'string' && entry.content.length > 0)?.content
    return typeof fallbackValue === 'string' ? fallbackValue : undefined
}

async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
    const bodyText = await response.text()

    if (!response.ok()) {
        throw new Error(`${label} failed with ${response.status()} ${response.statusText()}: ${bodyText}`)
    }

    return JSON.parse(bodyText) as T
}

async function parseJsonBody(response: Response): Promise<Record<string, unknown> | null> {
    const bodyText = await response.text()
    if (!bodyText) {
        return null
    }

    return JSON.parse(bodyText) as Record<string, unknown>
}

function resolveModuleSourceRoot(): string {
    const configured = process.env.UPL_MODULE_SOURCE_ROOT?.trim()
    return path.resolve(configured && configured.length > 0 ? configured : 'packages/universo-react-core-backend/bin/storage')
}

async function resolveDefaultBranchSchemaName(api: ApiContext, metahubId: string): Promise<string> {
    let branch: MetahubBranchRecord | undefined

    await expect
        .poll(
            async () => {
                const payload = (await listMetahubBranches(api, metahubId, { limit: 100, offset: 0 })) as
                    | ListPayload<MetahubBranchRecord>
                    | MetahubBranchRecord[]
                const branches = Array.isArray(payload) ? payload : payload.items ?? []
                branch = branches.find((item) => item.isDefault === true || item.is_default === true) ?? branches[0]
                return Boolean(branch?.id)
            },
            { message: `Waiting for metahub ${metahubId} default branch before file-backed module coverage` }
        )
        .toBe(true)

    const schemaName = branch?.schemaName ?? branch?.schema_name
    if (schemaName) {
        return schemaName
    }

    const branchNumber = branch?.branchNumber ?? branch?.branch_number
    if (typeof branchNumber === 'number' && Number.isInteger(branchNumber) && branchNumber > 0) {
        return `mhb_${metahubId.replace(/-/g, '')}_b${branchNumber}`
    }

    if (!schemaName) {
        throw new Error(`Metahub ${metahubId} did not return a branch schema name for file-backed module coverage`)
    }
    return schemaName
}

function buildExternalModuleSourcePath(input: { metahubId: string; schemaName: string; sourcePath: string }): string {
    return path.join(resolveModuleSourceRoot(), 'metahubs', input.metahubId, 'branches', input.schemaName, ...input.sourcePath.split('/'))
}

async function fillLocalizedField(container: Locator, label: string, value: string) {
    await container.getByLabel(label).first().fill(value)
}

async function fillNameAndCodename(container: Locator, values: { name?: string; codename: string }) {
    if (typeof values.name === 'string') {
        await fillLocalizedField(container, 'Name', values.name)
    }

    await fillLocalizedField(container, 'Codename', values.codename)
}

async function replaceCodeMirrorSource(page: Page, container: Locator, value: string) {
    const editorContent = container.locator('.cm-content').first()
    await expect(editorContent).toBeVisible()
    await editorContent.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Delete')
    await page.keyboard.insertText(value)
}

async function openEntityDialog(page: Page, dialogName: string): Promise<Locator> {
    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const dialog = page.getByRole('dialog', { name: dialogName })
    await expect(dialog).toBeVisible()
    return dialog
}

async function waitForListEntity<T extends { id?: string }>(
    loader: () => Promise<ListPayload<T>>,
    expectedId: string,
    label: string
): Promise<T> {
    let matched: T | undefined

    await expect
        .poll(
            async () => {
                const payload = await loader()
                matched = payload.items?.find((item) => item.id === expectedId)
                return Boolean(matched?.id)
            },
            { message: `Waiting for ${label} ${expectedId} to appear` }
        )
        .toBe(true)

    if (!matched) {
        throw new Error(`${label} ${expectedId} did not appear`)
    }

    return matched
}

async function waitForEntityAbsence<T extends { id?: string }>(loader: () => Promise<ListPayload<T>>, expectedId: string, label: string) {
    await expect
        .poll(
            async () => {
                const payload = await loader()
                return payload.items?.some((item) => item.id === expectedId) ?? false
            },
            { message: `Waiting for ${label} ${expectedId} to disappear` }
        )
        .toBe(false)
}

async function waitForFirstEntityId<T extends { id?: string }>(loader: () => Promise<ListPayload<T>>, label: string): Promise<string> {
    let firstId: string | undefined

    await expect
        .poll(
            async () => {
                const payload = await loader()
                firstId = payload.items?.[0]?.id
                return typeof firstId === 'string'
            },
            { message: `Waiting for first ${label} id` }
        )
        .toBe(true)

    if (!firstId) {
        throw new Error(`Unable to resolve first ${label} id`)
    }

    return firstId
}

async function waitForLayoutId(api: ApiContext, metahubId: string) {
    let layoutId: string | undefined

    await expect
        .poll(async () => {
            const response = await listLayouts(api, metahubId, { limit: 20, offset: 0 })
            layoutId = response?.items?.[0]?.id
            return typeof layoutId === 'string'
        })
        .toBe(true)

    if (!layoutId) {
        throw new Error(`No layout was returned for metahub ${metahubId}`)
    }

    return layoutId
}

async function applyCenteredQuizLayout(api: ApiContext, metahubId: string, layoutId: string) {
    const layout = await getLayout(api, metahubId, layoutId)
    const currentConfig = layout?.config && typeof layout.config === 'object' ? layout.config : {}
    const removableWidgetKeys = new Set<string>(QUIZ_REMOVED_LAYOUT_WIDGET_KEYS)

    const response = await sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahubId}/layout/${layoutId}`, {
        name: layout?.name,
        namePrimaryLocale: layout?.name?._primary ?? 'en',
        description: layout?.description,
        descriptionPrimaryLocale: layout?.description?._primary ?? 'en',
        config: {
            ...currentConfig,
            ...QUIZ_CENTERED_LAYOUT_CONFIG
        }
    })
    expect(response.ok).toBe(true)

    const zoneWidgets = await listLayoutZoneWidgets(api, metahubId, layoutId)
    for (const widget of zoneWidgets?.items?.filter((item) => removableWidgetKeys.has(String(item?.widgetKey ?? ''))) ?? []) {
        const removeResponse = await sendWithCsrf(api, 'DELETE', `/api/v1/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widget.id}`)
        expect(removeResponse.status).toBe(204)
    }
}

async function waitForRuntimeState(api: ApiContext, applicationId: string, objectId: string) {
    let runtimeState: RuntimeState | null = null

    await expect
        .poll(
            async () => {
                runtimeState = (await getApplicationRuntime(api, applicationId, { objectId })) as RuntimeState
                return typeof runtimeState?.object?.id === 'string' && Array.isArray(runtimeState?.columns)
            },
            { timeout: 60_000, message: `Waiting for runtime object ${objectId} in application ${applicationId}` }
        )
        .toBe(true)

    if (!runtimeState?.object?.id) {
        throw new Error(`Runtime object ${objectId} did not become available for application ${applicationId}`)
    }

    return runtimeState
}

function findRuntimeFieldKey(runtimeState: RuntimeState, expectedLabel: string, expectedCodename: string) {
    const matchingColumn = (runtimeState.columns ?? []).find((column) => {
        const header = typeof column.headerName === 'string' ? column.headerName.toLowerCase() : ''
        const field = typeof column.field === 'string' ? column.field.toLowerCase() : ''

        return (
            header === expectedLabel.toLowerCase() ||
            field === expectedCodename.toLowerCase() ||
            field.includes(expectedCodename.toLowerCase())
        )
    })

    return matchingColumn?.field ?? null
}

async function clickCatalogMenuItem(page: Page, catalogName: string, fallbackNames: string[] = []) {
    const candidateNames = [catalogName, ...fallbackNames]

    for (const candidateName of candidateNames) {
        const catalogButton = page.getByRole('button', { name: candidateName, exact: true })

        try {
            await expect(catalogButton).toBeVisible({ timeout: 5_000 })
            await catalogButton.click()
            return
        } catch {
            // Try the next localized fallback.
        }
    }

    throw new Error(`Object menu item not found: ${candidateNames.join(', ')}`)
}

async function expectEmbeddedCommonControlsAlignedEnd(page: Page) {
    const controlsRegion = page.locator(`[data-testid="${viewHeaderSelectors.controlsRegion}"]:visible`).first()
    await expect(controlsRegion).toBeVisible()
    await expect
        .poll(async () => controlsRegion.evaluate((element) => Number.parseFloat(window.getComputedStyle(element).marginLeft || '0')))
        .toBeGreaterThan(0)
}

async function createRuntimeRowViaBrowser(page: Page, applicationId: string, label: string, value: string) {
    await expect(page.getByTestId(applicationSelectors.runtimeCreateButton)).toBeEnabled({ timeout: 30_000 })
    await page.getByTestId(applicationSelectors.runtimeCreateButton).click()

    const createDialog = page.getByRole('dialog', { name: /^(Create element|Создать элемент)$/ })
    await expect(createDialog).toBeVisible()
    await createDialog.getByLabel(label).first().fill(value)

    const createResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' && response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows`),
        { label: 'Creating runtime row' }
    )
    await createDialog.getByTestId(entityDialogSelectors.submitButton).click()
    const createdRow = await parseJsonResponse<EntityRecord>(await createResponse, 'Creating runtime row')
    if (!createdRow.id) {
        throw new Error('Runtime create response did not return an id')
    }

    await expect(createDialog).toHaveCount(0)
    await expect(page.locator('[role="rowgroup"] [role="row"]').first()).toBeVisible({ timeout: 30_000 })
}

async function createSharedLibraryModuleThroughBrowser(
    page: Page,
    metahubId: string,
    moduleName: string,
    moduleCodename: string,
    sourceCode = SHARED_LIBRARY_SOURCE
) {
    await page.goto(`/metahub/${metahubId}/resources`)
    await expect(page.getByRole('heading', { name: /Resources|Ресурсы/ })).toBeVisible()
    await expect(page.getByTestId(pageSpacingSelectors.metahubResourcesTabs)).toBeVisible()
    await page.getByRole('tab', { name: 'Modules', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Attached modules' })).toBeVisible()
    await page.getByRole('button', { name: 'New', exact: true }).click()

    await expect(page.getByRole('combobox').first()).toBeDisabled()
    await expect(page.getByRole('combobox').first()).toHaveText(/Library/i)
    await fillLocalizedField(page.locator('body'), 'Name', moduleName)
    await fillLocalizedField(page.locator('body'), 'Codename', moduleCodename)
    await replaceCodeMirrorSource(page, page.locator('body'), sourceCode)

    const createRequest = page.waitForRequest(
        (request) => request.method() === 'POST' && request.url().endsWith(`/api/v1/metahub/${metahubId}/modules`)
    )
    const createResponse = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahubId}/modules`) && response.ok()
    )

    await page.getByRole('button', { name: 'Create module', exact: true }).click()

    const requestPayload = (await createRequest).postDataJSON()
    expect(requestPayload?.attachedToKind).toBe('general')
    expect(requestPayload?.moduleRole).toBe('library')
    expect(requestPayload?.attachedToId).toBeNull()

    const createdModule = await (await createResponse).json()
    expect(createdModule?.codename?.locales?.en?.content).toBe(moduleCodename)
    await expect(page.getByText(moduleName, { exact: true })).toBeVisible({ timeout: 15_000 })
    return createdModule
}

async function createImportedWidgetModuleThroughBrowser(page: Page, metahubId: string, moduleName: string, moduleCodename: string) {
    await page.goto('/metahubs')
    await expect(page.getByText(moduleName, { exact: true })).toHaveCount(0)
    await page.getByTestId(buildEntityMenuTriggerSelector('metahub', metahubId)).click()
    await page.getByTestId(buildEntityMenuItemSelector('metahub', 'edit', metahubId)).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('tab', { name: 'Modules', exact: true }).click()
    await expect(dialog.getByRole('heading', { name: 'Attached modules' })).toBeVisible()

    await dialog.getByRole('combobox').first().click()
    await page.getByRole('option', { name: 'Widget' }).click()
    await fillLocalizedField(dialog, 'Name', moduleName)
    await fillLocalizedField(dialog, 'Codename', moduleCodename)
    await replaceCodeMirrorSource(page, dialog, SHARED_WIDGET_SOURCE)

    const createRequest = page.waitForRequest(
        (request) => request.method() === 'POST' && request.url().endsWith(`/api/v1/metahub/${metahubId}/modules`)
    )
    const createResponse = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahubId}/modules`) && response.ok()
    )

    await dialog.getByRole('button', { name: 'Create module', exact: true }).click()

    const requestPayload = (await createRequest).postDataJSON()
    expect(requestPayload?.attachedToKind).toBe('metahub')
    expect(requestPayload?.moduleRole).toBe('widget')
    expect(String(requestPayload?.sourceCode ?? '')).toContain('@shared/quiz-shared')

    const createdModule = await (await createResponse).json()
    expect(createdModule?.codename?.locales?.en?.content).toBe(moduleCodename)

    await dialog.getByTestId(entityDialogSelectors.cancelButton).click()
    await expect(dialog).toHaveCount(0)
}

async function openCommonModulesTab(page: Page, metahubId: string) {
    await page.goto(`/metahub/${metahubId}/resources`)
    await expect(page.getByRole('heading', { name: /Resources|Ресурсы/ })).toBeVisible()
    await expect(page.getByTestId(pageSpacingSelectors.metahubResourcesTabs)).toBeVisible()
    await page.getByRole('tab', { name: /^(Modules|Модули)$/ }).click()
    await expect(page.getByRole('heading', { name: /Attached modules|Прикреплённые модули/ })).toBeVisible()
}

async function selectAttachedModule(page: Page, moduleName: string) {
    const sidebar = page.getByTestId('entity-modules-sidebar')
    await expect(sidebar).toBeVisible()
    await sidebar.getByText(moduleName, { exact: true }).click()
    await expect(page.getByLabel('Name').first()).toHaveValue(moduleName)
}

async function saveSelectedModule(page: Page, metahubId: string) {
    const responsePromise = waitForSettledMutationResponse(
        page,
        (response) => response.request().method() === 'PATCH' && response.url().includes(`/api/v1/metahub/${metahubId}/module/`),
        { label: 'Saving module' }
    )

    await page.getByRole('button', { name: 'Save module', exact: true }).click()
    return responsePromise
}

async function deleteSelectedModule(page: Page, metahubId: string) {
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    const confirmDialog = page.getByRole('dialog', { name: 'Delete module?' })
    await expect(confirmDialog).toBeVisible()
    await expect(confirmDialog.getByText(/file-backed source|delete the module/i)).toBeVisible()

    const responsePromise = waitForSettledMutationResponse(
        page,
        (response) => response.request().method() === 'DELETE' && response.url().includes(`/api/v1/metahub/${metahubId}/module/`),
        { label: 'Deleting module' }
    )

    await confirmDialog.getByRole('button', { name: 'Delete module', exact: true }).focus()
    await page.keyboard.press('Enter')
    return responsePromise
}

async function expectNoModulesSurfaceTechnicalLeakage(page: Page, label: string) {
    await expectNoTechnicalLeakage(page.getByRole('main'), {
        label,
        checkUuidSubstrings: false
    })
}

async function configureQuizWidgetThroughBrowser(page: Page, api: ApiContext, metahubId: string, layoutId: string, moduleCodename: string) {
    await applyCenteredQuizLayout(api, metahubId, layoutId)
    await page.goto(`/metahub/${metahubId}/resources/layouts/${layoutId}`)

    const centerZone = page.getByTestId(buildLayoutZoneSelector('center'))
    await expect(centerZone).toBeVisible()
    await centerZone.getByRole('button', { name: 'Add widget' }).click()
    await page.getByRole('menuitem', { name: 'Quiz widget' }).click()

    const dialog = page.getByRole('dialog', { name: 'Quiz widget' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('combobox').nth(1).click()
    await page.getByRole('option', { name: new RegExp(moduleCodename) }).click()

    const saveResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'PUT' && response.url().includes(`/api/v1/metahub/${metahubId}/layout/${layoutId}/zone-widget`),
        { label: 'Saving layout widget' }
    )
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    expect((await saveResponse).ok()).toBe(true)
}

async function captureProofScreenshot(page: Page, testInfo: TestInfo, name: string) {
    await page.screenshot({
        path: testInfo.outputPath(name),
        fullPage: true,
        animations: 'disabled'
    })
}

test('@flow Common shared entities merge, exclusion, publication, and runtime stay aligned', async ({ page, runManifest }, testInfo) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} shared common`
    const metahubCodename = `${runManifest.runId}-shared-common`
    const excludedObjectName = `Excluded Object ${runManifest.runId}`
    const excludedObjectCodename = `${runManifest.runId}-excluded-object`
    const sharedAttributeName = `Shared Title ${runManifest.runId}`
    const sharedAttributeCodename = `${runManifest.runId}-shared-title`
    const sharedConstantName = `Shared Constant ${runManifest.runId}`
    const sharedConstantCodename = `${runManifest.runId}-shared-constant`
    const sharedValueName = `Shared Value ${runManifest.runId}`
    const sharedValueCodename = `${runManifest.runId}-shared-value`
    const runtimeValue = `Shared Runtime Row ${runManifest.runId}`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for shared Common coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        const defaultCatalogId = await waitForFirstEntityId(
            () => listObjectCollections(api, metahub.id, { limit: 100, offset: 0 }),
            'object'
        )
        const enumerationId = await waitForFirstEntityId(() => listOptionLists(api, metahub.id, { limit: 100, offset: 0 }), 'enumeration')
        const setId = await waitForFirstEntityId(() => listValueGroups(api, metahub.id, { limit: 100, offset: 0 }), 'set')

        const excludedObject = await createObjectCollection(api, metahub.id, {
            name: { en: excludedObjectName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', excludedObjectCodename)
        })

        if (!excludedObject?.id) {
            throw new Error('Excluded object creation did not return an id for shared Common coverage')
        }

        const catalogsPayload = await listObjectCollections(api, metahub.id, { limit: 100, offset: 0 })
        const defaultCatalogName = readLocalizedText(catalogsPayload.items?.find((item) => item.id === defaultCatalogId)?.name, 'en')
        if (!defaultCatalogName) {
            throw new Error('Default object name could not be resolved for shared Common coverage')
        }

        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByRole('heading', { name: /Resources|Ресурсы/ })).toBeVisible()
        await expect(page.getByTestId(pageSpacingSelectors.metahubResourcesTabs)).toBeVisible()
        await expectEmbeddedCommonControlsAlignedEnd(page)

        await page.getByRole('tab', { name: 'Components', exact: true }).click()
        await expectEmbeddedCommonControlsAlignedEnd(page)
        await captureProofScreenshot(page, testInfo, 'shared-common-toolbar-alignment.png')
        const attributeDialog = await openEntityDialog(page, 'Create Component')
        await fillNameAndCodename(attributeDialog, { name: sharedAttributeName, codename: sharedAttributeCodename })
        await expect(attributeDialog.getByRole('tab', { name: 'Presentation', exact: true })).toBeVisible()
        await expect(attributeDialog.getByRole('tab', { name: 'Exclusions', exact: true })).toBeVisible()

        const createAttributeResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().includes(`/api/v1/metahub/${metahub.id}/entities/object/instance/`) &&
                response.url().endsWith('/components'),
            { label: 'Creating shared component' }
        )
        await attributeDialog.getByTestId(entityDialogSelectors.submitButton).click()
        const createdAttribute = await parseJsonResponse<EntityRecord>(await createAttributeResponse, 'Creating shared component')
        if (!createdAttribute.id) {
            throw new Error('Shared component creation did not return an id')
        }

        await page.getByRole('tab', { name: 'Constants', exact: true }).click()
        await expectEmbeddedCommonControlsAlignedEnd(page)
        const constantDialog = await openEntityDialog(page, 'Create Constant')
        await fillNameAndCodename(constantDialog, { name: sharedConstantName, codename: sharedConstantCodename })
        await expect(constantDialog.getByRole('tab', { name: 'Presentation', exact: true })).toBeVisible()
        await expect(constantDialog.getByRole('tab', { name: 'Exclusions', exact: true })).toBeVisible()
        const createConstantResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().includes(`/api/v1/metahub/${metahub.id}/entities/set/instance/`) &&
                response.url().endsWith('/fixed-values'),
            { label: 'Creating shared constant' }
        )
        await constantDialog.getByTestId(entityDialogSelectors.submitButton).click()
        const createdConstant = await parseJsonResponse<EntityRecord>(await createConstantResponse, 'Creating shared constant')
        if (!createdConstant.id) {
            throw new Error('Shared constant creation did not return an id')
        }

        await page.getByRole('tab', { name: 'Values', exact: true }).click()
        await expectEmbeddedCommonControlsAlignedEnd(page)
        const valueDialog = await openEntityDialog(page, 'Create value')
        await fillNameAndCodename(valueDialog, { name: sharedValueName, codename: sharedValueCodename })
        await expect(valueDialog.getByRole('tab', { name: 'Presentation', exact: true })).toBeVisible()
        await expect(valueDialog.getByRole('tab', { name: 'Exclusions', exact: true })).toBeVisible()
        const createValueResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().includes(`/api/v1/metahub/${metahub.id}/entities/enumeration/instance/`) &&
                response.url().endsWith('/values'),
            { label: 'Creating shared enumeration value' }
        )
        await valueDialog.getByTestId(entityDialogSelectors.submitButton).click()
        const createdValue = await parseJsonResponse<EntityRecord>(await createValueResponse, 'Creating shared enumeration value')
        if (!createdValue.id) {
            throw new Error('Shared enumeration value creation did not return an id')
        }

        await page.getByRole('tab', { name: 'Components', exact: true }).click()
        await expect(page.getByText(sharedAttributeName, { exact: true })).toBeVisible({ timeout: 15_000 })

        await page.getByTestId(buildEntityMenuTriggerSelector('component', createdAttribute.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('component', 'edit', createdAttribute.id)).click()

        const editAttributeDialog = page.getByRole('dialog', { name: 'Edit Component' })
        await expect(editAttributeDialog).toBeVisible()
        await editAttributeDialog.getByRole('tab', { name: 'Presentation', exact: true }).click()
        await expect(editAttributeDialog.getByLabel('Can be excluded', { exact: true })).toBeChecked()
        await editAttributeDialog.getByRole('tab', { name: 'Exclusions', exact: true }).click()
        const openExclusionsPickerButton = editAttributeDialog.getByTestId('entity-selection-add-button')
        await expect(openExclusionsPickerButton).toBeVisible({ timeout: 30_000 })
        await openExclusionsPickerButton.click()

        const exclusionsPicker = page.getByRole('dialog', { name: 'Select exclusions' })
        await expect(exclusionsPicker).toBeVisible({ timeout: 30_000 })
        await exclusionsPicker.getByTestId(`entity-selection-option-${excludedObject.id}`).click()
        await exclusionsPicker.getByTestId('entity-selection-confirm').click()
        await expect(exclusionsPicker).toHaveCount(0)
        await expect(editAttributeDialog.getByText(excludedObjectName, { exact: true })).toBeVisible({ timeout: 30_000 })

        const exclusionResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/shared-entity-overrides`),
            { label: 'Saving shared entity exclusions' }
        )
        await editAttributeDialog.getByTestId(entityDialogSelectors.submitButton).click()
        expect((await exclusionResponse).ok()).toBe(true)
        await expect(editAttributeDialog).toHaveCount(0)

        await waitForListEntity(
            () => listComponents(api, metahub.id, defaultCatalogId, { limit: 100, offset: 0, includeShared: true }),
            createdAttribute.id,
            'shared component in included object'
        )
        await waitForEntityAbsence(
            () => listComponents(api, metahub.id, excludedObject.id, { limit: 100, offset: 0, includeShared: true }),
            createdAttribute.id,
            'shared component in excluded object'
        )
        await waitForListEntity(
            () => listFixedValues(api, metahub.id, setId, { limit: 100, offset: 0, includeShared: true }),
            createdConstant.id,
            'shared constant in merged list'
        )
        await waitForListEntity(
            () => listOptionValues(api, metahub.id, enumerationId, { includeShared: true }),
            createdValue.id,
            'shared enumeration value in merged list'
        )

        await page.goto(`/metahub/${metahub.id}/entities/object/instance/${defaultCatalogId}/components`)
        await expect(page.getByRole('heading', { name: 'Components' })).toBeVisible()
        await expect(page.getByText(sharedAttributeName, { exact: true })).toBeVisible()
        await expect(page.getByText('Shared', { exact: true }).first()).toBeVisible()
        await expect(page.getByTestId(buildEntityMenuTriggerSelector('component', createdAttribute.id))).toBeVisible()

        await page.goto(`/metahub/${metahub.id}/entities/object/instance/${excludedObject.id}/components`)
        await expect(page.getByRole('heading', { name: 'Components' })).toBeVisible()
        await expect(page.getByText(sharedAttributeName, { exact: true })).toHaveCount(0)

        await page.goto(`/metahub/${metahub.id}/entities/set/instance/${setId}/fixed-values`)
        await expect(page.getByRole('heading', { name: 'Constants' })).toBeVisible()
        await expect(page.getByText(sharedConstantName, { exact: true })).toBeVisible()
        await expect(page.getByTestId(buildEntityMenuTriggerSelector('constant', createdConstant.id))).toBeVisible()

        await page.goto(`/metahub/${metahub.id}/entities/enumeration/instance/${enumerationId}/values`)
        await expect(page.getByRole('heading', { name: 'Values' })).toBeVisible()
        await expect(page.getByText(sharedValueName, { exact: true })).toBeVisible()
        await expect(page.getByTestId(buildEntityMenuTriggerSelector('enumerationValue', createdValue.id))).toBeVisible()

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/metahub/${metahub.id}/entities/object/instance/${defaultCatalogId}/components`)
        await expect(page.getByText('Общая', { exact: true }).first()).toBeVisible()
        await captureProofScreenshot(page, testInfo, 'shared-common-ru-badge.png')
        await page.getByTestId(buildEntityMenuTriggerSelector('component', createdAttribute.id)).click()
        await expect(page.getByRole('menuitem', { name: 'Деактивировать' })).toBeVisible()
        await expect(page.getByRole('menuitem', { name: 'Исключить' })).toBeVisible()

        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByRole('tab', { name: 'Компоненты', exact: true })).toBeVisible()
        await page.getByRole('tab', { name: 'Компоненты', exact: true }).click()
        await page.getByTestId(buildEntityMenuTriggerSelector('component', createdAttribute.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('component', 'edit', createdAttribute.id)).click()
        const localizedEditDialog = page.locator('[role="dialog"]').last()
        await expect(localizedEditDialog.getByRole('tab', { name: 'Исключения', exact: true })).toBeVisible()
        await localizedEditDialog.getByRole('tab', { name: 'Представление', exact: true }).click()
        await expect(localizedEditDialog.getByLabel('Можно исключать', { exact: true })).toBeVisible()
        await localizedEditDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(localizedEditDialog).toHaveCount(0)

        const publication = await createPublication(api, metahub.id, {
            name: { en: `E2E ${runManifest.runId} Shared Common Publication` },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })

        if (!publication?.id) {
            throw new Error('Publication creation did not return an id for shared Common coverage')
        }

        await recordCreatedPublication({
            id: publication.id,
            metahubId: metahub.id,
            schemaName: publication.schemaName
        })

        await createPublicationVersion(api, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} Shared Common Version` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, metahub.id, publication.id)
        await waitForPublicationReady(api, metahub.id, publication.id)

        const linkedApplication = await createPublicationLinkedApplication(api, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} Shared Common App` },
            namePrimaryLocale: 'en',
            createApplicationSchema: false
        })

        const applicationId = linkedApplication?.application?.id
        if (typeof applicationId !== 'string') {
            throw new Error('Linked application creation did not return an id for shared Common coverage')
        }

        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.application.slug
        })

        await syncApplicationSchema(api, applicationId)

        const includedRuntime = await waitForRuntimeState(api, applicationId, defaultCatalogId)
        const excludedRuntime = await waitForRuntimeState(api, applicationId, excludedObject.id)

        expect(findRuntimeFieldKey(includedRuntime, sharedAttributeName, sharedAttributeCodename)).toBeTruthy()
        expect(findRuntimeFieldKey(excludedRuntime, sharedAttributeName, sharedAttributeCodename)).toBeNull()

        await page.goto(`/a/${applicationId}`)
        await clickCatalogMenuItem(page, defaultCatalogName, ['Основной'])
        await createRuntimeRowViaBrowser(page, applicationId, sharedAttributeName, runtimeValue)

        await clickCatalogMenuItem(page, excludedObjectName)
        await expect(page.getByTestId(applicationSelectors.runtimeCreateButton)).toBeEnabled({ timeout: 30_000 })
        await page.getByTestId(applicationSelectors.runtimeCreateButton).click()
        const excludedCreateDialog = page.getByRole('dialog', { name: /^(Create element|Создать элемент)$/ })
        await expect(excludedCreateDialog).toBeVisible()
        await expect(excludedCreateDialog.getByLabel(sharedAttributeName)).toHaveCount(0)
        await excludedCreateDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(excludedCreateDialog).toHaveCount(0)
    } finally {
        await disposeApiContext(api)
    }
})

test('@flow file-backed Common module sources recompile after external file edits through browser', async ({
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} file-backed modules`
    const metahubCodename = `${runManifest.runId}-file-backed-modules`
    const moduleName = 'File-backed shared library'
    const moduleCodename = `file-backed-shared-${runManifest.runId.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}`
    const sourcePath = `modules/general/${moduleCodename}.ts`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for file-backed module coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        const schemaName = await resolveDefaultBranchSchemaName(api, metahub.id)
        const absoluteSourcePath = buildExternalModuleSourcePath({ metahubId: metahub.id, schemaName, sourcePath })

        await applyBrowserPreferences(page, { language: 'ru' })
        await openCommonModulesTab(page, metahub.id)
        await page.getByRole('button', { name: 'Новый', exact: true }).click()
        await page.getByLabel('Режим хранения').click()
        await page.getByRole('option', { name: 'Файловый' }).click()
        await fillLocalizedField(page.locator('body'), 'Название', moduleName)
        await fillLocalizedField(page.locator('body'), 'Кодовое имя', moduleCodename)
        await replaceCodeMirrorSource(page, page.locator('body'), FILE_BACKED_LIBRARY_SOURCE_V1)
        await page.getByLabel('Путь к исходному файлу').fill('../bad.ts')
        const invalidRuCreateResponse = page.waitForResponse(
            (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/modules`)
        )
        await page.getByRole('button', { name: 'Создать модуль', exact: true }).click()
        const invalidRuCreate = await invalidRuCreateResponse
        expect(invalidRuCreate.ok()).toBe(false)
        expect(invalidRuCreate.status()).toBe(400)
        await expect(page.getByText('Путь к исходному файлу должен начинаться с modules/.')).toBeVisible()
        await expectNoModulesSurfaceTechnicalLeakage(page, 'RU file-backed source path validation')

        await applyBrowserPreferences(page, { language: 'en' })
        await openCommonModulesTab(page, metahub.id)
        await page.getByRole('button', { name: 'New', exact: true }).click()

        await page.getByLabel('Storage mode').click()
        await page.getByRole('option', { name: 'File-backed' }).click()
        await expect(page.getByText('This source will be written to the selected file path when the module is saved.')).toBeVisible()
        await fillLocalizedField(page.locator('body'), 'Name', moduleName)
        await fillLocalizedField(page.locator('body'), 'Codename', moduleCodename)
        await replaceCodeMirrorSource(page, page.locator('body'), FILE_BACKED_LIBRARY_SOURCE_V1)
        await page.getByLabel('Source path').fill('../bad.ts')

        const invalidCreateResponse = page.waitForResponse(
            (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/modules`)
        )
        await page.getByRole('button', { name: 'Create module', exact: true }).click()
        const invalidCreate = await invalidCreateResponse
        expect(invalidCreate.ok()).toBe(false)
        expect(invalidCreate.status()).toBe(400)
        await expect(page.getByText('Source paths must start with modules/.')).toBeVisible()

        await page.getByLabel('Source path').fill('modules/../bad.ts')
        const parentSegmentCreateResponse = page.waitForResponse(
            (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/modules`)
        )
        await page.getByRole('button', { name: 'Create module', exact: true }).click()
        const parentSegmentCreate = await parentSegmentCreateResponse
        expect(parentSegmentCreate.ok()).toBe(false)
        expect(parentSegmentCreate.status()).toBe(400)
        await expect(page.getByText('Source paths cannot contain hidden or parent directory segments.')).toBeVisible()

        await page.getByLabel('Source path').fill(sourcePath)

        await expectNoModulesSurfaceTechnicalLeakage(page, 'file-backed Common module create dialog')
        for (const viewport of RUNTIME_UX_VIEWPORT_MATRIX) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height })
            await expect(page.getByLabel('Source path')).toHaveValue(sourcePath)
            await expectNoPageHorizontalOverflow(page, `file-backed Common module create form ${viewport.name}`)
            await captureProofScreenshot(page, testInfo, `common-file-backed-module-create-${viewport.name}.png`)
        }
        await page.setViewportSize({ width: 1920, height: 1080 })

        const createModuleResponse = page.waitForResponse(
            (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/modules`)
        )

        await page.getByRole('button', { name: 'Create module', exact: true }).focus()
        await page.keyboard.press('Enter')

        const createdModuleResponse = await createModuleResponse
        const createdModuleBody = await createdModuleResponse.text()
        expect(createdModuleResponse.ok(), createdModuleBody).toBe(true)
        const createdModule = JSON.parse(createdModuleBody) as MetahubModuleRecord
        expect(createdModule?.id).toBeTruthy()
        expect(createdModule?.sourcePath ?? createdModule?.sourceStorage?.path).toBe(sourcePath)
        expect(createdModule?.sourceChecksum ?? createdModule?.sourceStorage?.checksum).toBeTruthy()
        const initialSourceChecksum = createdModule.sourceChecksum ?? createdModule.sourceStorage?.checksum
        const initialCompiledChecksum = createdModule.checksum

        await expect(page.getByText(moduleName, { exact: true })).toBeVisible({ timeout: 15_000 })
        await expect(async () => {
            const source = await fs.readFile(absoluteSourcePath, 'utf8')
            expect(source).toContain('file-backed-v1')
        }).toPass({ timeout: 15_000 })

        await fs.writeFile(absoluteSourcePath, FILE_BACKED_LIBRARY_SOURCE_V2, 'utf8')
        await selectAttachedModule(page, moduleName)
        await expect(page.getByLabel('Source path')).toHaveValue(sourcePath)
        await expect(page.getByTestId('entity-module-source-metadata')).toContainText('Source status')
        await expect(page.getByTestId('entity-module-source-metadata')).toContainText('Source checksum')
        await captureProofScreenshot(page, testInfo, 'common-file-backed-module-after-external-edit.png')

        const saveResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => response.request().method() === 'PATCH' && response.url().includes(`/api/v1/metahub/${metahub.id}/module/`),
            { label: 'Saving file-backed module after external file edit' }
        )
        await page.getByRole('button', { name: 'Save module', exact: true }).click()
        const saveResponse = await saveResponsePromise
        expect(saveResponse.ok()).toBe(true)
        const savedModule = (await saveResponse.json()) as MetahubModuleRecord
        expect(savedModule.sourceChecksum ?? savedModule.sourceStorage?.checksum).not.toBe(initialSourceChecksum)
        expect(savedModule.checksum).not.toBe(initialCompiledChecksum)

        const persistedModules = await listMetahubModules(api, metahub.id, {
            attachedToKind: 'general',
            onlyActive: true,
            limit: 100,
            offset: 0
        })
        const persistedModule = (persistedModules.items ?? []).find((item: MetahubModuleRecord) => item.id === createdModule.id)
        expect(persistedModule?.sourceCode ?? persistedModule?.sourceStorage?.content).toContain('file-backed-v2')
        expect(persistedModule?.sourceChecksum ?? persistedModule?.sourceStorage?.checksum).not.toBe(initialSourceChecksum)
        await expectNoModulesSurfaceTechnicalLeakage(page, 'file-backed Common modules tab')
        await expectNoPageHorizontalOverflow(page, 'file-backed Common module saved form')
        await captureProofScreenshot(page, testInfo, 'common-file-backed-module-recompiled.png')

        const deleteResponse = await deleteSelectedModule(page, metahub.id)
        expect(deleteResponse.ok()).toBe(true)
        await expect(page.getByText(moduleName, { exact: true })).toHaveCount(0)
        await expect(async () => {
            await expect(fs.stat(absoluteSourcePath)).rejects.toMatchObject({ code: 'ENOENT' })
        }).toPass({ timeout: 15_000 })
        await expectNoModulesSurfaceTechnicalLeakage(page, 'file-backed Common module after delete')
    } finally {
        await disposeApiContext(api)
    }
})

test('@flow Common shared library modules publish into runtime consumers without breaking widget scopes', async ({ page, runManifest }) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} shared modules`
    const metahubCodename = `${runManifest.runId}-shared-modules`
    const libraryName = 'Quiz shared library'
    const libraryCodename = 'quiz-shared'
    const widgetName = 'Shared quiz widget'
    const widgetCodename = 'shared-quiz-widget'

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for shared modules coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        await createSharedLibraryModuleThroughBrowser(page, metahub.id, libraryName, libraryCodename)
        await createImportedWidgetModuleThroughBrowser(page, metahub.id, widgetName, widgetCodename)
        await openCommonModulesTab(page, metahub.id)
        await selectAttachedModule(page, libraryName)

        const deleteResponse = await deleteSelectedModule(page, metahub.id)
        expect(deleteResponse.ok()).toBe(false)
        expect(deleteResponse.status()).toBe(409)
        const deletePayload = await parseJsonBody(deleteResponse)
        expect(String(deletePayload?.error ?? '')).toBe('Shared library is still imported by other modules')
        await expect(page.getByText('This shared library is used by other modules.')).toBeVisible()

        await fillLocalizedField(page.locator('body'), 'Codename', `${libraryCodename}-renamed`)
        const renameResponse = await saveSelectedModule(page, metahub.id)
        expect(renameResponse.ok()).toBe(false)
        expect(renameResponse.status()).toBe(409)
        const renamePayload = await parseJsonBody(renameResponse)
        expect(String(renamePayload?.error ?? '')).toBe('Shared library codename is still used by dependent modules')
        await expect(page.getByText('This shared library is used by other modules.')).toBeVisible()
        await fillLocalizedField(page.locator('body'), 'Codename', libraryCodename)

        const layoutId = await waitForLayoutId(api, metahub.id)
        await configureQuizWidgetThroughBrowser(page, api, metahub.id, layoutId, widgetCodename)

        const publication = await createPublication(api, metahub.id, {
            name: { en: `E2E ${runManifest.runId} Shared Module Publication` },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })

        if (!publication?.id) {
            throw new Error('Publication creation did not return an id for shared modules coverage')
        }

        await recordCreatedPublication({
            id: publication.id,
            metahubId: metahub.id,
            schemaName: publication.schemaName
        })

        await createPublicationVersion(api, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} Shared Module Version` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, metahub.id, publication.id)
        await waitForPublicationReady(api, metahub.id, publication.id)

        const linkedApplication = await createPublicationLinkedApplication(api, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} Shared Module App` },
            namePrimaryLocale: 'en',
            createApplicationSchema: false
        })

        const applicationId = linkedApplication?.application?.id
        if (typeof applicationId !== 'string') {
            throw new Error('Linked application creation did not return an id for shared modules coverage')
        }

        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.application.slug
        })

        await syncApplicationSchema(api, applicationId)

        const runtimeModulesResponse = page.waitForResponse(
            (response) =>
                response.request().method() === 'GET' &&
                response.url().includes(`/api/v1/applications/${applicationId}/runtime/modules?`) &&
                response.url().includes('attachedToKind=metahub')
        )
        const clientBundleResponse = page.waitForResponse(
            (response) =>
                response.request().method() === 'GET' &&
                response.url().includes(`/api/v1/applications/${applicationId}/runtime/modules/`) &&
                response.url().includes('/client')
        )

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/a/${applicationId}`)

        expect((await runtimeModulesResponse).ok()).toBe(true)
        expect((await clientBundleResponse).ok()).toBe(true)

        await expect(page.getByText('Shared Space Quiz', { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Which planet is known as the Red Planet?', { exact: true })).toBeVisible({ timeout: 30_000 })

        await page.getByLabel('Mars', { exact: true }).click()
        await page.getByRole('button', { name: 'Check answer', exact: true }).click()
        await expect(page.getByText('Answers saved locally. Add answer checking before publishing to show feedback here.')).toBeVisible()
    } finally {
        await disposeApiContext(api)
    }
})

test('@flow Common shared library authoring fails closed on circular @shared imports', async ({ page, runManifest }) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} circular shared modules`
    const metahubCodename = `${runManifest.runId}-circular-shared-modules`
    const libraryAName = 'Circular shared A'
    const libraryBName = 'Circular shared B'
    const libraryACodename = 'shared-a'
    const libraryBCodename = 'shared-b'
    const libraryABaseSource = `import { SharedLibraryModule } from '@universo-react/extension-sdk'

export default class SharedA extends SharedLibraryModule {}
`
    const libraryBBaseSource = `import { SharedLibraryModule } from '@universo-react/extension-sdk'

export default class SharedB extends SharedLibraryModule {}
`
    const libraryAWithDependency = `import { SharedLibraryModule } from '@universo-react/extension-sdk'
import SharedB from '@shared/shared-b'

export default class SharedA extends SharedLibraryModule {
  static value() {
    return typeof SharedB === 'function'
  }
}
`
    const libraryBWithCycle = `import { SharedLibraryModule } from '@universo-react/extension-sdk'
import SharedA from '@shared/shared-a'

export default class SharedB extends SharedLibraryModule {
  static value() {
    return typeof SharedA === 'function'
  }
}
`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for circular shared modules coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        const createLibraryAResponse = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahub.id}/modules`, {
            name: libraryAName,
            codename: libraryACodename,
            attachedToKind: 'general',
            attachedToId: null,
            moduleRole: 'library',
            sourceCode: libraryABaseSource
        })
        expect(createLibraryAResponse.ok).toBe(true)
        const createdLibraryA = await parseJsonBody(createLibraryAResponse)
        if (typeof createdLibraryA?.id !== 'string') {
            throw new Error('Shared library A creation did not return an id for circular coverage')
        }

        const createLibraryBResponse = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahub.id}/modules`, {
            name: libraryBName,
            codename: libraryBCodename,
            attachedToKind: 'general',
            attachedToId: null,
            moduleRole: 'library',
            sourceCode: libraryBBaseSource
        })
        expect(createLibraryBResponse.ok).toBe(true)
        const createdLibraryB = await parseJsonBody(createLibraryBResponse)
        if (typeof createdLibraryB?.id !== 'string') {
            throw new Error('Shared library B creation did not return an id for circular coverage')
        }

        const patchAResponse = await sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahub.id}/module/${createdLibraryA.id}`, {
            sourceCode: libraryAWithDependency
        })
        expect(patchAResponse.ok).toBe(true)

        const patchBResponse = await sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahub.id}/module/${createdLibraryB.id}`, {
            sourceCode: libraryBWithCycle
        })
        expect(patchBResponse.ok).toBe(false)
        expect(patchBResponse.status).toBe(400)

        const patchBPayload = await parseJsonBody(patchBResponse)
        expect(String(patchBPayload?.error ?? patchBPayload?.message ?? '')).toBe('Module compilation failed')
        if (typeof patchBPayload?.message === 'string' && patchBPayload.message.length > 0) {
            expect(patchBPayload.message).toContain('Circular @shared imports detected:')
        }

        await openCommonModulesTab(page, metahub.id)
        await expect(page.getByText('Circular shared A', { exact: true })).toBeVisible({ timeout: 15_000 })
        await expect(page.getByText('Circular shared B', { exact: true })).toBeVisible({ timeout: 15_000 })
    } finally {
        await disposeApiContext(api)
    }
})
