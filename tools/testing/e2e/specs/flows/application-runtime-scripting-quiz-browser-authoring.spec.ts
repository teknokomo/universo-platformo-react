import type { Locator, Page } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    createLoggedInApiContext,
    disposeApiContext,
    getApplication,
    getLayout,
    listLayoutZoneWidgets,
    listMetahubs,
    listPublicationApplications,
    listLayouts,
    sendWithCsrf,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { QUIZ_CENTERED_LAYOUT_CONFIG, QUIZ_REMOVED_LAYOUT_WIDGET_KEYS } from '../../support/quizFixtureContract'
import {
    buildEntityMenuItemSelector,
    buildEntityMenuTriggerSelector,
    buildLayoutZoneSelector,
    entityDialogSelectors,
    toolbarSelectors
} from '../../support/selectors/contracts'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const BROWSER_AUTHORED_QUIZ_WIDGET_SOURCE = `const AtClient = () => () => undefined
const AtServer = () => () => undefined

class ExtensionScript {}

const QUIZ = {
    title: 'Space Quiz',
    description: 'Answer ten astronomy questions one by one. Correct answers move you forward automatically.',
    submitLabel: 'Check answer',
    nextLabel: 'Next question',
    questions: [
        {
            id: 'q1',
            prompt: 'Which planet is known as the Red Planet?',
            description: 'Think about the rusty world explored by many rovers.',
            multiple: false,
            difficulty: 1,
            options: [
                { id: 'a', label: 'Venus' },
                { id: 'b', label: 'Mars' },
                { id: 'c', label: 'Mercury' },
                { id: 'd', label: 'Jupiter' }
            ],
            correctOptionIds: ['b'],
            explanation: 'Mars looks red because iron-rich dust on its surface oxidizes like rust.'
        },
        {
            id: 'q2',
            prompt: 'Where is Olympus Mons located?',
            description: 'It is the tallest volcano known in the Solar System.',
            multiple: false,
            difficulty: 1,
            options: [
                { id: 'a', label: 'Earth' },
                { id: 'b', label: 'The Moon' },
                { id: 'c', label: 'Mars' },
                { id: 'd', label: 'Io' }
            ],
            correctOptionIds: ['c'],
            explanation: 'Olympus Mons is a giant shield volcano on Mars, towering far above Everest.'
        }
    ]
}

const sortSelection = (value) => (Array.isArray(value) ? value.map((item) => String(item)).sort() : [])

const isSameSelection = (selected, correct) => {
    if (selected.length !== correct.length) {
        return false
    }

    return selected.every((item, index) => item === correct[index])
}

export default class SpaceQuizWidget extends ExtensionScript {
    @AtClient()
    async mount(locale = 'en') {
        return this.ctx.callServerMethod('getQuiz', [{ locale }])
    }

    @AtServer()
    async getQuiz() {
        return {
            title: QUIZ.title,
            description: QUIZ.description,
            submitLabel: QUIZ.submitLabel,
            nextLabel: QUIZ.nextLabel,
            questions: QUIZ.questions.map((question) => ({
                id: question.id,
                prompt: question.prompt,
                description: question.description,
                multiple: Boolean(question.multiple),
                difficulty: question.difficulty,
                options: question.options
            }))
        }
    }

    @AtServer()
    async submit(payload) {
        const questionId = typeof payload?.questionId === 'string' ? payload.questionId : ''
        const question = QUIZ.questions.find((item) => item.id === questionId)

        if (!question) {
            return {
                questionId,
                correct: false,
                score: 0,
                total: QUIZ.questions.length,
                completed: false,
                message: 'Question not found. Refresh the quiz and try again.',
                correctOptionIds: {}
            }
        }

        const responses = payload?.responses && typeof payload.responses === 'object' ? payload.responses : {}
        const selectedAnswerIds = sortSelection(payload?.answerIds)
        const normalizedCorrect = sortSelection(question.correctOptionIds)
        const correct = isSameSelection(selectedAnswerIds, normalizedCorrect)

        let score = 0
        let answeredCount = 0

        for (const candidate of QUIZ.questions) {
            const submitted = sortSelection(responses[candidate.id])
            if (submitted.length > 0) {
                answeredCount += 1
            }

            if (isSameSelection(submitted, sortSelection(candidate.correctOptionIds))) {
                score += 1
            }
        }

        return {
            questionId,
            correct,
            score,
            total: QUIZ.questions.length,
            completed: answeredCount >= QUIZ.questions.length,
            message: correct ? 'Correct!' : 'Not quite yet.',
            explanation: question.explanation,
            correctOptionIds: {
                [question.id]: normalizedCorrect
            }
        }
    }
}
`

type LoggedInApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

async function fillLocalizedField(dialog: Locator, label: string, value: string) {
    await dialog.getByLabel(label).first().fill(value)
}

async function replaceCodeMirrorSource(page: Page, dialog: Locator, value: string) {
    const editorContent = dialog.locator('.cm-content').first()
    await expect(editorContent).toBeVisible()
    await editorContent.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Delete')
    await page.keyboard.insertText(value)
}

async function fillMetahubForm(dialog: Locator, values: { name: string; codename: string }) {
    await fillLocalizedField(dialog, 'Name', values.name)
    await fillLocalizedField(dialog, 'Codename', values.codename)
}

async function waitForMetahubByName(api: LoggedInApiContext, expectedName: string, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
        const response = await listMetahubs(api, { limit: 100, offset: 0 })
        const item = (response.items ?? []).find((entry) =>
            Object.values(entry.name?.locales ?? {}).some((localeValue) => localeValue?.content === expectedName)
        )

        if (item) {
            return item
        }

        await sleep(500)
    }

    throw new Error(`Metahub ${expectedName} was not found within ${timeoutMs}ms`)
}

async function waitForLayoutId(api: LoggedInApiContext, metahubId: string) {
    let layoutId

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

async function applyCenteredQuizLayout(api: LoggedInApiContext, metahubId: string, layoutId: string) {
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

async function ensureMetahubActionMenuVisible(page: Page, metahubId: string, expectedName: string) {
    const menuTrigger = page.getByTestId(buildEntityMenuTriggerSelector('metahub', metahubId))

    if ((await menuTrigger.count()) === 0) {
        await page.reload()
    }

    await expect(menuTrigger).toBeVisible()
    await expect(page.getByText(expectedName, { exact: true })).toBeVisible()
}

async function enableSwitch(dialog: Locator, name: string) {
    const toggle = dialog.getByLabel(name, { exact: true })

    await expect(toggle).toBeEnabled()

    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (await toggle.isChecked()) {
            return
        }

        try {
            await toggle.evaluate((element) => {
                ;(element as HTMLInputElement).click()
            })
        } catch {
            await toggle.setChecked(true, { force: true })
        }

        if (await toggle.isChecked()) {
            return
        }

        await toggle.click({ force: true })
    }

    await expect(toggle).toBeChecked()
}

async function createMetahubThroughBrowser(page: Page, api: LoggedInApiContext, options: { name: string; codename: string }) {
    await page.goto('/metahubs')
    await page.getByTestId(toolbarSelectors.primaryAction).click()

    const dialog = page.getByRole('dialog')
    await fillMetahubForm(dialog, options)
    await dialog.getByTestId(entityDialogSelectors.submitButton).click()
    await expect(dialog).toHaveCount(0)

    const metahub = await waitForMetahubByName(api, options.name)
    if (!metahub?.id) {
        throw new Error(`Create metahub flow did not expose a persisted id for ${options.name}`)
    }

    await ensureMetahubActionMenuVisible(page, metahub.id, options.name)
    return metahub
}

async function createQuizScriptThroughBrowser(page: Page, metahubId: string, scriptName: string, scriptCodename: string) {
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
    await replaceCodeMirrorSource(page, dialog, BROWSER_AUTHORED_QUIZ_WIDGET_SOURCE)

    const createScriptRequest = page.waitForRequest(
        (request) => request.method() === 'POST' && request.url().endsWith(`/api/v1/metahub/${metahubId}/scripts`)
    )
    const createScriptResponse = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahubId}/scripts`) && response.ok()
    )

    await dialog.getByRole('button', { name: 'Create script' }).click()

    const request = await createScriptRequest
    const requestPayload = request.postDataJSON()
    expect(requestPayload?.sourceCode).toContain('SpaceQuizWidget')
    expect(requestPayload?.capabilities).toContain('rpc.client')

    const response = await createScriptResponse
    const createdScript = await response.json()
    expect(typeof createdScript?.id).toBe('string')
    expect(createdScript?.codename?.locales?.en?.content).toBe(scriptCodename)
    await dialog.getByTestId(entityDialogSelectors.cancelButton).click()
    await expect(dialog).toHaveCount(0)
}

async function configureQuizWidgetThroughBrowser(
    page: Page,
    api: LoggedInApiContext,
    metahubId: string,
    layoutId: string,
    scriptCodename: string
) {
    await applyCenteredQuizLayout(api, metahubId, layoutId)
    await page.goto(`/metahub/${metahubId}/layouts/${layoutId}`)

    const centerZone = page.getByTestId(buildLayoutZoneSelector('center'))
    await expect(centerZone).toBeVisible()
    await centerZone.getByRole('button', { name: 'Add widget' }).click()
    await page.getByRole('menuitem', { name: 'Quiz widget' }).click()

    const dialog = page.getByRole('dialog', { name: 'Quiz widget' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Bind the quiz widget to a published widget script.')).toBeVisible()

    await dialog.getByRole('combobox').nth(1).click()
    await page.getByRole('option', { name: /quiz-widget/ }).click()

    const saveResponse = page.waitForResponse(
        (response) =>
            response.request().method() === 'PUT' && response.url().includes(`/api/v1/metahub/${metahubId}/layout/${layoutId}/zone-widget`)
    )

    await dialog.getByRole('button', { name: 'Save' }).click()
    const response = await saveResponse
    expect(response.ok()).toBe(true)

    await expect
        .poll(async () => {
            const payload = await listLayoutZoneWidgets(api, metahubId, layoutId)
            const items = payload?.items ?? []
            const quizWidget = items.find((item) => item.widgetKey === 'quizWidget' && item.config?.scriptCodename === scriptCodename)
            const removableWidgetKeys = new Set<string>(QUIZ_REMOVED_LAYOUT_WIDGET_KEYS)
            const hasLegacyWidgets = items.some((item) => removableWidgetKeys.has(String(item?.widgetKey ?? '')))
            const hasRightZoneWidgets = items.some((item) => item.zone === 'right')

            return quizWidget?.zone === 'center' && !hasLegacyWidgets && !hasRightZoneWidgets
        })
        .toBe(true)
}

async function createPublicationThroughBrowser(page: Page, metahubId: string, publicationName: string) {
    await page.goto(`/metahub/${metahubId}/publications`)
    await expect(page.getByRole('heading', { name: 'Publications' })).toBeVisible()

    const createPublicationResponse = page.waitForResponse(
        (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahubId}/publications`)
    )

    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const dialog = page.getByRole('dialog', { name: 'Create Publication' })
    await fillLocalizedField(dialog, 'Name', publicationName)
    await dialog.getByTestId(entityDialogSelectors.submitButton).click()
    await expect(dialog).toHaveCount(0)

    const response = await createPublicationResponse
    expect(response.ok()).toBe(true)

    const payload = await response.json()
    const publicationId = payload?.id
    if (typeof publicationId !== 'string') {
        throw new Error(`Creating publication ${publicationName} did not return a publication id`)
    }

    return publicationId
}

async function createVersionThroughBrowser(page: Page, metahubId: string, publicationId: string, versionName: string) {
    await page.goto(`/metahub/${metahubId}/publication/${publicationId}/versions`)
    await expect(page.getByRole('heading', { name: 'Versions' })).toBeVisible()

    const createVersionResponse = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(`/api/v1/metahub/${metahubId}/publication/${publicationId}/versions`)
    )

    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const dialog = page.getByRole('dialog', { name: 'Create version' })
    await fillLocalizedField(dialog, 'Name', versionName)
    await dialog.getByRole('button', { name: 'Create' }).click()
    await expect(dialog).toHaveCount(0)

    const response = await createVersionResponse
    expect(response.ok()).toBe(true)
    await expect(page.getByText(versionName, { exact: true })).toBeVisible()
}

async function createApplicationThroughBrowser(
    page: Page,
    api: LoggedInApiContext,
    metahubId: string,
    publicationId: string,
    applicationName: string
) {
    await page.goto(`/metahub/${metahubId}/publication/${publicationId}/applications`)
    await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible()

    const createApplicationResponse = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(`/api/v1/metahub/${metahubId}/publication/${publicationId}/applications`)
    )

    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const dialog = page.getByRole('dialog', { name: 'Create Application' })
    await fillLocalizedField(dialog, 'Name', applicationName)
    await enableSwitch(dialog, 'Create application schema')

    const createButton = dialog.getByRole('button', { name: 'Create' })
    await expect(createButton).toBeEnabled()

    const responsePromise = createApplicationResponse
    await createButton.click()

    const response = await responsePromise
    expect(response.ok()).toBe(true)

    await expect(dialog).toHaveCount(0, { timeout: 30_000 })

    let application = null
    await expect
        .poll(async () => {
            const payload = await listPublicationApplications(api, metahubId, publicationId)
            application = (payload.items ?? []).find((item) =>
                Object.values(item.name?.locales ?? {}).some((localeValue) => localeValue?.content === applicationName)
            )
            return typeof application?.id === 'string'
        })
        .toBe(true)

    if (!application?.id) {
        throw new Error(`Creating application ${applicationName} did not expose a persisted id`)
    }

    await expect
        .poll(async () => {
            const persisted = await getApplication(api, application.id)
            return persisted?.schemaStatus ?? null
        })
        .toBe('synced')

    return application
}

test('@flow quiz widget scripting authoring can be completed through browser surfaces before runtime verification', async ({
    page,
    runManifest
}) => {
    test.setTimeout(240_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} browser authored quiz metahub`
    const metahubCodename = `${runManifest.runId}-browser-authored-quiz`
    const scriptName = 'Runtime quiz widget'
    const scriptCodename = 'quiz-widget'
    const publicationName = `E2E ${runManifest.runId} Browser Authored Publication`
    const versionName = `E2E ${runManifest.runId} Browser Authored Version`
    const applicationName = `E2E ${runManifest.runId} Browser Authored Application`

    try {
        const metahub = await createMetahubThroughBrowser(page, api, {
            name: metahubName,
            codename: metahubCodename
        })

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        await createQuizScriptThroughBrowser(page, metahub.id, scriptName, scriptCodename)

        const layoutId = await waitForLayoutId(api, metahub.id)
        await configureQuizWidgetThroughBrowser(page, api, metahub.id, layoutId, scriptCodename)

        const publicationId = await createPublicationThroughBrowser(page, metahub.id, publicationName)
        await recordCreatedPublication({
            id: publicationId,
            metahubId: metahub.id
        })

        await createVersionThroughBrowser(page, metahub.id, publicationId, versionName)

        await syncPublication(api, metahub.id, publicationId)
        await waitForPublicationReady(api, metahub.id, publicationId)

        const application = await createApplicationThroughBrowser(page, api, metahub.id, publicationId, applicationName)
        await recordCreatedApplication({
            id: application.id,
            slug: application.slug
        })

        const runtimeScriptsResponse = page.waitForResponse(
            (response) =>
                response.request().method() === 'GET' &&
                response.url().includes(`/api/v1/applications/${application.id}/runtime/scripts?`) &&
                response.url().includes('attachedToKind=metahub')
        )
        const clientBundleResponse = page.waitForResponse(
            (response) =>
                response.request().method() === 'GET' &&
                response.url().includes(`/api/v1/applications/${application.id}/runtime/scripts/`) &&
                response.url().includes('/client')
        )

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/a/${application.id}`)

        expect((await runtimeScriptsResponse).ok()).toBe(true)
        expect((await clientBundleResponse).ok()).toBe(true)

        await expect(page.getByText('Space Quiz', { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Which planet is known as the Red Planet?', { exact: true })).toBeVisible({ timeout: 30_000 })
        const submitResponse = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                response.url().includes(`/api/v1/applications/${application.id}/runtime/scripts/`) &&
                response.url().endsWith('/call')
        )
        await page.getByLabel('Mars', { exact: true }).click()
        await page.getByRole('button', { name: 'Check answer', exact: true }).click()
        expect((await submitResponse).ok()).toBe(true)
        await expect(page.getByText('Where is Olympus Mons located?', { exact: true })).toBeVisible({ timeout: 30_000 })
    } finally {
        await disposeApiContext(api)
    }
})
