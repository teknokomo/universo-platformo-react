import type { Locator, Page, Response, TestInfo } from '@playwright/test'
import { createLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import {
    createLoggedInApiContext,
    createMetahub,
    createLinkedCollection,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    disposeApiContext,
    getApplicationRuntime,
    getLayout,
    listFieldDefinitions,
    listOptionValues,
    listLayoutZoneWidgets,
    listLayouts,
    listLinkedCollections,
    listOptionLists,
    listValueGroups,
    listFixedValues,
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
    catalog?: {
        id?: string
    }
    columns?: Array<{
        field?: string
        headerName?: string
    }>
}

const SHARED_LIBRARY_SOURCE = `import { SharedLibraryScript } from '@universo/extension-sdk'

export default class QuizSharedLibrary extends SharedLibraryScript {
  static buildTitle(locale = 'en') {
    return String(locale).toLowerCase().startsWith('ru') ? 'Общая космическая викторина' : 'Shared Space Quiz'
  }

  static buildDescription(locale = 'en') {
    return String(locale).toLowerCase().startsWith('ru')
      ? 'Этот заголовок и описание приходят из general/library script.'
      : 'This title and description come from the general/library script.'
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

const SHARED_WIDGET_SOURCE = `import { AtClient, AtServer, ExtensionScript } from '@universo/extension-sdk'
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

export default class SharedQuizWidget extends ExtensionScript {
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

async function waitForListEntity<T extends { id?: string }>(loader: () => Promise<ListPayload<T>>, expectedId: string, label: string): Promise<T> {
    let matched: T | undefined

    await expect
        .poll(async () => {
            const payload = await loader()
            matched = payload.items?.find((item) => item.id === expectedId)
            return Boolean(matched?.id)
        }, { message: `Waiting for ${label} ${expectedId} to appear` })
        .toBe(true)

    if (!matched) {
        throw new Error(`${label} ${expectedId} did not appear`)
    }

    return matched
}

async function waitForEntityAbsence<T extends { id?: string }>(loader: () => Promise<ListPayload<T>>, expectedId: string, label: string) {
    await expect
        .poll(async () => {
            const payload = await loader()
            return payload.items?.some((item) => item.id === expectedId) ?? false
        }, { message: `Waiting for ${label} ${expectedId} to disappear` })
        .toBe(false)
}

async function waitForFirstEntityId<T extends { id?: string }>(loader: () => Promise<ListPayload<T>>, label: string): Promise<string> {
    let firstId: string | undefined

    await expect
        .poll(async () => {
            const payload = await loader()
            firstId = payload.items?.[0]?.id
            return typeof firstId === 'string'
        }, { message: `Waiting for first ${label} id` })
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

async function waitForRuntimeState(api: ApiContext, applicationId: string, catalogId: string) {
    let runtimeState: RuntimeState | null = null

    await expect
        .poll(async () => {
            runtimeState = (await getApplicationRuntime(api, applicationId, { catalogId })) as RuntimeState
            return typeof runtimeState?.catalog?.id === 'string' && Array.isArray(runtimeState?.columns)
        })
        .toBe(true)

    if (!runtimeState?.catalog?.id) {
        throw new Error(`Runtime catalog ${catalogId} did not become available for application ${applicationId}`)
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

    throw new Error(`Catalog menu item not found: ${candidateNames.join(', ')}`)
}

async function expectEmbeddedCommonControlsAlignedEnd(page: Page) {
    const controlsRegion = page.locator(`[data-testid="${viewHeaderSelectors.controlsRegion}"]:visible`).first()
    await expect(controlsRegion).toBeVisible()
    await expect
        .poll(async () =>
            controlsRegion.evaluate((element) => Number.parseFloat(window.getComputedStyle(element).marginLeft || '0'))
        )
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
        (response) => response.request().method() === 'POST' && response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows`),
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

async function createSharedLibraryScriptThroughBrowser(
    page: Page,
    metahubId: string,
    scriptName: string,
    scriptCodename: string,
    sourceCode = SHARED_LIBRARY_SOURCE
) {
    await page.goto(`/metahub/${metahubId}/common`)
    await expect(page.getByRole('heading', { name: /Common|Shared/ })).toBeVisible()
    await expect(page.getByTestId(pageSpacingSelectors.metahubCommonTabs)).toBeVisible()
    await page.getByRole('tab', { name: 'Scripts', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Attached scripts' })).toBeVisible()
    await page.getByRole('button', { name: 'New', exact: true }).click()

    await expect(page.getByRole('combobox').first()).toBeDisabled()
    await expect(page.getByRole('combobox').first()).toHaveText(/Library/i)
    await fillLocalizedField(page.locator('body'), 'Name', scriptName)
    await fillLocalizedField(page.locator('body'), 'Codename', scriptCodename)
    await replaceCodeMirrorSource(page, page.locator('body'), sourceCode)

    const createRequest = page.waitForRequest(
        (request) => request.method() === 'POST' && request.url().endsWith(`/api/v1/metahub/${metahubId}/scripts`)
    )
    const createResponse = page.waitForResponse(
        (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahubId}/scripts`) && response.ok()
    )

    await page.getByRole('button', { name: 'Create script', exact: true }).click()

    const requestPayload = (await createRequest).postDataJSON()
    expect(requestPayload?.attachedToKind).toBe('general')
    expect(requestPayload?.moduleRole).toBe('library')
    expect(requestPayload?.attachedToId).toBeNull()

    const createdScript = await (await createResponse).json()
    expect(createdScript?.codename?.locales?.en?.content).toBe(scriptCodename)
    await expect(page.getByText(scriptName, { exact: true })).toBeVisible({ timeout: 15_000 })
    return createdScript
}

async function createImportedWidgetScriptThroughBrowser(page: Page, metahubId: string, scriptName: string, scriptCodename: string) {
    await page.goto('/metahubs')
    await expect(page.getByText(scriptName, { exact: true })).toHaveCount(0)
    await page.getByTestId(buildEntityMenuTriggerSelector('metahub', metahubId)).click()
    await page.getByTestId(buildEntityMenuItemSelector('metahub', 'edit', metahubId)).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('tab', { name: 'Scripts', exact: true }).click()
    await expect(dialog.getByRole('heading', { name: 'Attached scripts' })).toBeVisible()

    await dialog.getByRole('combobox').first().click()
    await page.getByRole('option', { name: 'Widget' }).click()
    await fillLocalizedField(dialog, 'Name', scriptName)
    await fillLocalizedField(dialog, 'Codename', scriptCodename)
    await replaceCodeMirrorSource(page, dialog, SHARED_WIDGET_SOURCE)

    const createRequest = page.waitForRequest(
        (request) => request.method() === 'POST' && request.url().endsWith(`/api/v1/metahub/${metahubId}/scripts`)
    )
    const createResponse = page.waitForResponse(
        (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahubId}/scripts`) && response.ok()
    )

    await dialog.getByRole('button', { name: 'Create script', exact: true }).click()

    const requestPayload = (await createRequest).postDataJSON()
    expect(requestPayload?.attachedToKind).toBe('metahub')
    expect(requestPayload?.moduleRole).toBe('widget')
    expect(String(requestPayload?.sourceCode ?? '')).toContain("@shared/quiz-shared")

    const createdScript = await (await createResponse).json()
    expect(createdScript?.codename?.locales?.en?.content).toBe(scriptCodename)

    await dialog.getByTestId(entityDialogSelectors.cancelButton).click()
    await expect(dialog).toHaveCount(0)
}

async function openCommonScriptsTab(page: Page, metahubId: string) {
    await page.goto(`/metahub/${metahubId}/common`)
    await expect(page.getByRole('heading', { name: /Common|Shared/ })).toBeVisible()
    await expect(page.getByTestId(pageSpacingSelectors.metahubCommonTabs)).toBeVisible()
    await page.getByRole('tab', { name: 'Scripts', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Attached scripts' })).toBeVisible()
}

async function selectAttachedScript(page: Page, scriptName: string) {
    const sidebar = page.getByTestId('entity-scripts-sidebar')
    await expect(sidebar).toBeVisible()
    await sidebar.getByText(scriptName, { exact: true }).click()
    await expect(page.getByLabel('Name').first()).toHaveValue(scriptName)
}

async function saveSelectedScript(page: Page, metahubId: string) {
    const responsePromise = waitForSettledMutationResponse(
        page,
        (response) => response.request().method() === 'PATCH' && response.url().includes(`/api/v1/metahub/${metahubId}/script/`),
        { label: 'Saving script' }
    )

    await page.getByRole('button', { name: 'Save script', exact: true }).click()
    return responsePromise
}

async function deleteSelectedScript(page: Page, metahubId: string) {
    const responsePromise = waitForSettledMutationResponse(
        page,
        (response) => response.request().method() === 'DELETE' && response.url().includes(`/api/v1/metahub/${metahubId}/script/`),
        { label: 'Deleting script' }
    )

    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    return responsePromise
}

async function configureQuizWidgetThroughBrowser(page: Page, api: ApiContext, metahubId: string, layoutId: string, scriptCodename: string) {
    await applyCenteredQuizLayout(api, metahubId, layoutId)
    await page.goto(`/metahub/${metahubId}/common/layouts/${layoutId}`)

    const centerZone = page.getByTestId(buildLayoutZoneSelector('center'))
    await expect(centerZone).toBeVisible()
    await centerZone.getByRole('button', { name: 'Add widget' }).click()
    await page.getByRole('menuitem', { name: 'Quiz widget' }).click()

    const dialog = page.getByRole('dialog', { name: 'Quiz widget' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('combobox').nth(1).click()
    await page.getByRole('option', { name: new RegExp(scriptCodename) }).click()

    const saveResponse = waitForSettledMutationResponse(
        page,
        (response) => response.request().method() === 'PUT' && response.url().includes(`/api/v1/metahub/${metahubId}/layout/${layoutId}/zone-widget`),
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
    const excludedCatalogName = `Excluded Catalog ${runManifest.runId}`
    const excludedCatalogCodename = `${runManifest.runId}-excluded-catalog`
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
            () => listLinkedCollections(api, metahub.id, { limit: 100, offset: 0 }),
            'catalog'
        )
        const enumerationId = await waitForFirstEntityId(
            () => listOptionLists(api, metahub.id, { limit: 100, offset: 0 }),
            'enumeration'
        )
        const setId = await waitForFirstEntityId(() => listValueGroups(api, metahub.id, { limit: 100, offset: 0 }), 'set')

        const excludedCatalog = await createLinkedCollection(api, metahub.id, {
            name: { en: excludedCatalogName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', excludedCatalogCodename)
        })

        if (!excludedCatalog?.id) {
            throw new Error('Excluded catalog creation did not return an id for shared Common coverage')
        }

        const catalogsPayload = await listLinkedCollections(api, metahub.id, { limit: 100, offset: 0 })
        const defaultCatalogName = readLocalizedText(catalogsPayload.items?.find((item) => item.id === defaultCatalogId)?.name, 'en')
        if (!defaultCatalogName) {
            throw new Error('Default catalog name could not be resolved for shared Common coverage')
        }

        await page.goto(`/metahub/${metahub.id}/common`)
        await expect(page.getByRole('heading', { name: /Common|Shared/ })).toBeVisible()
        await expect(page.getByTestId(pageSpacingSelectors.metahubCommonTabs)).toBeVisible()
        await expectEmbeddedCommonControlsAlignedEnd(page)

        await page.getByRole('tab', { name: 'Attributes', exact: true }).click()
        await expectEmbeddedCommonControlsAlignedEnd(page)
        await captureProofScreenshot(page, testInfo, 'shared-common-toolbar-alignment.png')
        const attributeDialog = await openEntityDialog(page, 'Add Attribute')
        await fillNameAndCodename(attributeDialog, { name: sharedAttributeName, codename: sharedAttributeCodename })
        await expect(attributeDialog.getByRole('tab', { name: 'Presentation', exact: true })).toBeVisible()
        await expect(attributeDialog.getByRole('tab', { name: 'Exclusions', exact: true })).toBeVisible()

        const createAttributeResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().includes(`/api/v1/metahub/${metahub.id}/entities/catalog/instance/`) &&
                response.url().endsWith('/field-definitions'),
            { label: 'Creating shared attribute' }
        )
        await attributeDialog.getByTestId(entityDialogSelectors.submitButton).click()
        const createdAttribute = await parseJsonResponse<EntityRecord>(await createAttributeResponse, 'Creating shared attribute')
        if (!createdAttribute.id) {
            throw new Error('Shared attribute creation did not return an id')
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

        await page.getByRole('tab', { name: 'Attributes', exact: true }).click()
        await expect(page.getByText(sharedAttributeName, { exact: true })).toBeVisible({ timeout: 15_000 })

        await page.getByTestId(buildEntityMenuTriggerSelector('attribute', createdAttribute.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('attribute', 'edit', createdAttribute.id)).click()

        const editAttributeDialog = page.getByRole('dialog', { name: 'Edit Attribute' })
        await expect(editAttributeDialog).toBeVisible()
        await editAttributeDialog.getByRole('tab', { name: 'Presentation', exact: true }).click()
        await expect(editAttributeDialog.getByLabel('Can be excluded', { exact: true })).toBeChecked()
        await editAttributeDialog.getByRole('tab', { name: 'Exclusions', exact: true }).click()
        const openExclusionsPickerButton = editAttributeDialog.getByTestId('entity-selection-add-button')
        await expect(openExclusionsPickerButton).toBeVisible({ timeout: 30_000 })
        await openExclusionsPickerButton.click()

        const exclusionsPicker = page.getByRole('dialog', { name: 'Select exclusions' })
        await expect(exclusionsPicker).toBeVisible({ timeout: 30_000 })
        await exclusionsPicker.getByTestId(`entity-selection-option-${excludedCatalog.id}`).click()
        await exclusionsPicker.getByTestId('entity-selection-confirm').click()
        await expect(exclusionsPicker).toHaveCount(0)
        await expect(editAttributeDialog.getByText(excludedCatalogName, { exact: true })).toBeVisible({ timeout: 30_000 })

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
            () => listFieldDefinitions(api, metahub.id, defaultCatalogId, { limit: 100, offset: 0, includeShared: true }),
            createdAttribute.id,
            'shared attribute in included catalog'
        )
        await waitForEntityAbsence(
            () => listFieldDefinitions(api, metahub.id, excludedCatalog.id, { limit: 100, offset: 0, includeShared: true }),
            createdAttribute.id,
            'shared attribute in excluded catalog'
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

        await page.goto(`/metahub/${metahub.id}/entities/catalog/instance/${defaultCatalogId}/field-definitions`)
        await expect(page.getByRole('heading', { name: 'Field Definitions' })).toBeVisible()
        await expect(page.getByText(sharedAttributeName, { exact: true })).toBeVisible()
        await expect(page.getByText('Shared', { exact: true }).first()).toBeVisible()
        await expect(page.getByTestId(buildEntityMenuTriggerSelector('attribute', createdAttribute.id))).toBeVisible()

        await page.goto(`/metahub/${metahub.id}/entities/catalog/instance/${excludedCatalog.id}/field-definitions`)
        await expect(page.getByRole('heading', { name: 'Field Definitions' })).toBeVisible()
        await expect(page.getByText(sharedAttributeName, { exact: true })).toHaveCount(0)

        await page.goto(`/metahub/${metahub.id}/entities/set/instance/${setId}/fixed-values`)
        await expect(page.getByRole('heading', { name: 'Fixed values' })).toBeVisible()
        await expect(page.getByText(sharedConstantName, { exact: true })).toBeVisible()
        await expect(page.getByTestId(buildEntityMenuTriggerSelector('constant', createdConstant.id))).toBeVisible()

        await page.goto(`/metahub/${metahub.id}/entities/enumeration/instance/${enumerationId}/values`)
        await expect(page.getByRole('heading', { name: 'Values' })).toBeVisible()
        await expect(page.getByText(sharedValueName, { exact: true })).toBeVisible()
        await expect(page.getByTestId(buildEntityMenuTriggerSelector('enumerationValue', createdValue.id))).toBeVisible()

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/metahub/${metahub.id}/entities/catalog/instance/${defaultCatalogId}/field-definitions`)
        await expect(page.getByText('Общая', { exact: true }).first()).toBeVisible()
        await captureProofScreenshot(page, testInfo, 'shared-common-ru-badge.png')
        await page.getByTestId(buildEntityMenuTriggerSelector('attribute', createdAttribute.id)).click()
        await expect(page.getByRole('menuitem', { name: 'Деактивировать' })).toBeVisible()
        await expect(page.getByRole('menuitem', { name: 'Исключить' })).toBeVisible()

        await page.goto(`/metahub/${metahub.id}/common`)
        await expect(page.getByRole('tab', { name: 'Атрибуты', exact: true })).toBeVisible()
        await page.getByRole('tab', { name: 'Атрибуты', exact: true }).click()
        await page.getByTestId(buildEntityMenuTriggerSelector('attribute', createdAttribute.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('attribute', 'edit', createdAttribute.id)).click()
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
            createApplicationSchema: false,
            workspacesEnabled: false
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
        const excludedRuntime = await waitForRuntimeState(api, applicationId, excludedCatalog.id)

        expect(findRuntimeFieldKey(includedRuntime, sharedAttributeName, sharedAttributeCodename)).toBeTruthy()
        expect(findRuntimeFieldKey(excludedRuntime, sharedAttributeName, sharedAttributeCodename)).toBeNull()

        await page.goto(`/a/${applicationId}`)
        await clickCatalogMenuItem(page, defaultCatalogName, ['Основной'])
        await createRuntimeRowViaBrowser(page, applicationId, sharedAttributeName, runtimeValue)

        await clickCatalogMenuItem(page, excludedCatalogName)
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

test('@flow Common shared library scripts publish into runtime consumers without breaking widget scopes', async ({ page, runManifest }) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} shared scripts`
    const metahubCodename = `${runManifest.runId}-shared-scripts`
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
            throw new Error('Metahub creation did not return an id for shared scripts coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        await createSharedLibraryScriptThroughBrowser(page, metahub.id, libraryName, libraryCodename)
        await createImportedWidgetScriptThroughBrowser(page, metahub.id, widgetName, widgetCodename)
        await openCommonScriptsTab(page, metahub.id)
        await selectAttachedScript(page, libraryName)

        const deleteResponse = await deleteSelectedScript(page, metahub.id)
        expect(deleteResponse.ok()).toBe(false)
        expect(deleteResponse.status()).toBe(409)
        const deletePayload = await parseJsonBody(deleteResponse)
        expect(String(deletePayload?.error ?? '')).toBe('Shared library is still imported by other scripts')

        await fillLocalizedField(page.locator('body'), 'Codename', `${libraryCodename}-renamed`)
        const renameResponse = await saveSelectedScript(page, metahub.id)
        expect(renameResponse.ok()).toBe(false)
        expect(renameResponse.status()).toBe(409)
        const renamePayload = await parseJsonBody(renameResponse)
        expect(String(renamePayload?.error ?? '')).toBe('Shared library codename is still used by dependent scripts')
        await fillLocalizedField(page.locator('body'), 'Codename', libraryCodename)

        const layoutId = await waitForLayoutId(api, metahub.id)
        await configureQuizWidgetThroughBrowser(page, api, metahub.id, layoutId, widgetCodename)

        const publication = await createPublication(api, metahub.id, {
            name: { en: `E2E ${runManifest.runId} Shared Script Publication` },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })

        if (!publication?.id) {
            throw new Error('Publication creation did not return an id for shared scripts coverage')
        }

        await recordCreatedPublication({
            id: publication.id,
            metahubId: metahub.id,
            schemaName: publication.schemaName
        })

        await createPublicationVersion(api, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} Shared Script Version` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, metahub.id, publication.id)
        await waitForPublicationReady(api, metahub.id, publication.id)

        const linkedApplication = await createPublicationLinkedApplication(api, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} Shared Script App` },
            namePrimaryLocale: 'en',
            createApplicationSchema: false,
            workspacesEnabled: false
        })

        const applicationId = linkedApplication?.application?.id
        if (typeof applicationId !== 'string') {
            throw new Error('Linked application creation did not return an id for shared scripts coverage')
        }

        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.application.slug
        })

        await syncApplicationSchema(api, applicationId)

        const runtimeScriptsResponse = page.waitForResponse(
            (response) =>
                response.request().method() === 'GET' &&
                response.url().includes(`/api/v1/applications/${applicationId}/runtime/scripts?`) &&
                response.url().includes('attachedToKind=metahub')
        )
        const clientBundleResponse = page.waitForResponse(
            (response) =>
                response.request().method() === 'GET' &&
                response.url().includes(`/api/v1/applications/${applicationId}/runtime/scripts/`) &&
                response.url().includes('/client')
        )

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/a/${applicationId}`)

        expect((await runtimeScriptsResponse).ok()).toBe(true)
        expect((await clientBundleResponse).ok()).toBe(true)

        await expect(page.getByText('Shared Space Quiz', { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Which planet is known as the Red Planet?', { exact: true })).toBeVisible({ timeout: 30_000 })

        const submitResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().includes(`/api/v1/applications/${applicationId}/runtime/scripts/`) &&
                response.url().endsWith('/call'),
            { label: 'Submitting runtime script call' }
        )
        await page.getByLabel('Mars', { exact: true }).click()
        await page.getByRole('button', { name: 'Check answer', exact: true }).click()
        expect((await submitResponse).ok()).toBe(true)
        await expect(page.getByRole('heading', { name: 'Quiz complete!', exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Score: 1 / 1', exact: true })).toBeVisible({ timeout: 30_000 })
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

    const metahubName = `E2E ${runManifest.runId} circular shared scripts`
    const metahubCodename = `${runManifest.runId}-circular-shared-scripts`
    const libraryAName = 'Circular shared A'
    const libraryBName = 'Circular shared B'
    const libraryACodename = 'shared-a'
    const libraryBCodename = 'shared-b'
    const libraryABaseSource = `import { SharedLibraryScript } from '@universo/extension-sdk'

export default class SharedA extends SharedLibraryScript {}
`
    const libraryBBaseSource = `import { SharedLibraryScript } from '@universo/extension-sdk'

export default class SharedB extends SharedLibraryScript {}
`
    const libraryAWithDependency = `import { SharedLibraryScript } from '@universo/extension-sdk'
import SharedB from '@shared/shared-b'

export default class SharedA extends SharedLibraryScript {
  static value() {
    return typeof SharedB === 'function'
  }
}
`
    const libraryBWithCycle = `import { SharedLibraryScript } from '@universo/extension-sdk'
import SharedA from '@shared/shared-a'

export default class SharedB extends SharedLibraryScript {
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
            throw new Error('Metahub creation did not return an id for circular shared scripts coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        const createLibraryAResponse = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahub.id}/scripts`, {
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

        const createLibraryBResponse = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahub.id}/scripts`, {
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

        const patchAResponse = await sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahub.id}/script/${createdLibraryA.id}`, {
            sourceCode: libraryAWithDependency
        })
        expect(patchAResponse.ok).toBe(true)

        const patchBResponse = await sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahub.id}/script/${createdLibraryB.id}`, {
            sourceCode: libraryBWithCycle
        })
        expect(patchBResponse.ok).toBe(false)
        expect(patchBResponse.status).toBe(400)

        const patchBPayload = await parseJsonBody(patchBResponse)
        expect(String(patchBPayload?.error ?? patchBPayload?.message ?? '')).toBe('Script compilation failed')
        if (typeof patchBPayload?.message === 'string' && patchBPayload.message.length > 0) {
            expect(patchBPayload.message).toContain('Circular @shared imports detected:')
        }

        await openCommonScriptsTab(page, metahub.id)
        await expect(page.getByText('Circular shared A', { exact: true })).toBeVisible({ timeout: 15_000 })
        await expect(page.getByText('Circular shared B', { exact: true })).toBeVisible({ timeout: 15_000 })
    } finally {
        await disposeApiContext(api)
    }
})