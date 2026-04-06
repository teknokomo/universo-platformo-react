import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '../../fixtures/test'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    createLoggedInApiContext,
    createPublicationLinkedApplication,
    disposeApiContext,
    listLayouts,
    listLayoutZoneWidgets,
    listMetahubScripts,
    syncApplicationSchema,
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { toolbarSelectors } from '../../support/selectors/contracts'
import {
    QUIZ_CONTENT,
    QUIZ_FIXTURE_FILENAME,
    QUIZ_I18N_LEAK_MARKERS,
    QUIZ_PUBLICATION,
    QUIZ_SCRIPT_CODENAME,
    QUIZ_UI_COPY,
    assertQuizFixtureEnvelopeContract,
    getCorrectAnswerLabels,
    getWrongSingleChoiceAnswerLabel,
    type QuizFixtureQuestion,
    type QuizLocale
} from '../../support/quizFixtureContract'

type SnapshotFixture = Record<string, unknown>
type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

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

async function loadQuizFixture(): Promise<{ fixturePath: string; metahubName: string }> {
    const fixturePath = path.join(process.cwd(), 'tools', 'fixtures', QUIZ_FIXTURE_FILENAME)
    const rawFixture = await fs.readFile(fixturePath, 'utf8')
    const fixture = JSON.parse(rawFixture) as SnapshotFixture

    assertQuizFixtureEnvelopeContract(fixture)

    const metahubName = readLocalizedText((fixture as { metahub?: { name?: unknown } }).metahub?.name)
    if (!metahubName) {
        throw new Error('Quiz snapshot fixture does not contain a metahub name')
    }

    return { fixturePath, metahubName }
}

async function waitForLayoutId(api: ApiContext, metahubId: string) {
    let layoutId: string | undefined

    await expect
        .poll(async () => {
            const response = await listLayouts(api, metahubId, { limit: 20, offset: 0 })
            layoutId = response?.items?.find((layout) => layout?.isDefault)?.id ?? response?.items?.[0]?.id
            return typeof layoutId === 'string'
        })
        .toBe(true)

    if (!layoutId) {
        throw new Error(`No layout was returned for imported metahub ${metahubId}`)
    }

    return layoutId
}

async function assertNoQuizI18nKeyLeak(page: Parameters<typeof test>[0]['page']) {
    const body = page.locator('body')
    for (const marker of QUIZ_I18N_LEAK_MARKERS) {
        await expect(body).not.toContainText(marker)
    }
}

function getQuizAnswerControl(page: Parameters<typeof test>[0]['page'], label: string) {
    return page.getByLabel(label, { exact: true })
}

async function assertQuizQuestionUi(options: {
    page: Parameters<typeof test>[0]['page']
    locale: QuizLocale
    questionIndex: number
    score: number
}) {
    const quiz = QUIZ_CONTENT[options.locale]
    const ui = QUIZ_UI_COPY[options.locale]
    const question = quiz.questions[options.questionIndex]

    await expect(options.page.locator('html')).toHaveAttribute('lang', options.locale)
    await expect(options.page.getByText(quiz.title)).toBeVisible()
    await expect(options.page.getByText(quiz.description)).toBeVisible()
    await expect(options.page.getByText(ui.questionOf(options.questionIndex + 1, quiz.questions.length))).toBeVisible()
    await expect(options.page.getByText(ui.currentScore(options.score, quiz.questions.length))).toBeVisible()
    await expect(options.page.getByRole('button', { name: quiz.submitLabel })).toBeVisible()
    await expect(options.page.getByRole('button', { name: ui.resetLabel })).toBeVisible()
    await expect(options.page.getByText(question.prompt)).toBeVisible()
    await expect(options.page.getByText(question.description)).toBeVisible()

    for (const option of question.options) {
        await expect(getQuizAnswerControl(options.page, option.label)).toBeVisible()
    }

    await assertNoQuizI18nKeyLeak(options.page)
}

async function submitQuestionAnswer(options: {
    page: Parameters<typeof test>[0]['page']
    applicationId: string
    locale: QuizLocale
    question: QuizFixtureQuestion
    answerLabels: string[]
}) {
    const submitResponsePromise = options.page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes(`/api/v1/applications/${options.applicationId}/runtime/scripts/`) &&
            response.url().endsWith('/call')
    )

    for (const answerLabel of options.answerLabels) {
        await getQuizAnswerControl(options.page, answerLabel).click()
    }

    await options.page.getByRole('button', { name: QUIZ_CONTENT[options.locale].submitLabel }).click()

    const submitResponse = await submitResponsePromise
    expect(submitResponse.ok()).toBe(true)
    expect(submitResponse.request().postDataJSON()).toMatchObject({
        methodName: 'submit',
        args: [expect.objectContaining({ questionId: options.question.id, locale: options.locale })]
    })
}

async function assertQuizCompletion(options: { page: Parameters<typeof test>[0]['page']; locale: QuizLocale; score: number }) {
    const quiz = QUIZ_CONTENT[options.locale]
    const ui = QUIZ_UI_COPY[options.locale]

    await expect(options.page.getByText(ui.completeLabel)).toBeVisible()
    await expect(options.page.getByText(ui.scoreSummary(options.score, quiz.questions.length))).toBeVisible()
    await expect(options.page.getByText(ui.perfectScoreMessage)).toBeVisible()
    await expect(options.page.getByRole('button', { name: ui.backToQuestionsLabel })).toBeVisible()
    await expect(options.page.getByRole('button', { name: ui.resetLabel })).toBeVisible()
    await assertNoQuizI18nKeyLeak(options.page)
}

async function completeQuizWithCorrectAnswers(options: {
    page: Parameters<typeof test>[0]['page']
    applicationId: string
    locale: QuizLocale
    startIndex: number
    startScore: number
}) {
    const quiz = QUIZ_CONTENT[options.locale]

    for (let index = options.startIndex; index < quiz.questions.length; index += 1) {
        const question = quiz.questions[index]
        await assertQuizQuestionUi({
            page: options.page,
            locale: options.locale,
            questionIndex: index,
            score: options.startScore + index - options.startIndex
        })

        await submitQuestionAnswer({
            page: options.page,
            applicationId: options.applicationId,
            locale: options.locale,
            question,
            answerLabels: getCorrectAnswerLabels(question)
        })

        const nextQuestion = quiz.questions[index + 1]
        if (nextQuestion) {
            await expect(options.page.getByText(nextQuestion.prompt)).toBeVisible({ timeout: 30_000 })
            await expect(
                options.page.getByText(
                    QUIZ_UI_COPY[options.locale].currentScore(options.startScore + index - options.startIndex + 1, quiz.questions.length)
                )
            ).toBeVisible()
        }
    }
}

test.describe('Quiz Snapshot Import Runtime Flow', () => {
    let api: ApiContext

    test.afterEach(async () => {
        if (api) {
            await disposeApiContext(api)
        }
    })

    test('@flow quiz snapshot fixture imports through the browser UI and preserves publication/application/runtime behavior', async ({ page, runManifest }) => {
        test.setTimeout(240_000)

        const fixture = await loadQuizFixture()
        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })

        await page.goto('/metahubs')

        const primaryActionBtn = page.getByTestId(toolbarSelectors.primaryAction)
        await expect(primaryActionBtn).toBeVisible({ timeout: 15_000 })

        const dropdownArrow = page.getByTestId(`${toolbarSelectors.primaryAction}-menu-trigger`)
        await dropdownArrow.click()

        const importOption = page.getByRole('menuitem', { name: /import/i })
        await expect(importOption).toBeVisible()
        await importOption.click()

        const dialog = page.getByRole('dialog', { name: /import/i })
        await expect(dialog).toBeVisible()

        await dialog.locator('input[type="file"]').setInputFiles(fixture.fixturePath)
        await expect(dialog.getByText(QUIZ_FIXTURE_FILENAME)).toBeVisible()

        const importResponsePromise = page.waitForResponse(
            (response) => response.request().method() === 'POST' && response.url().endsWith('/api/v1/metahubs/import'),
            { timeout: 60_000 }
        )

        await dialog.getByRole('button', { name: /import/i }).last().click()

        const importResponse = await importResponsePromise
        expect(importResponse.status()).toBe(201)

        const importBody = await importResponse.json()
        const importedId = importBody?.metahub?.id
        const importedPublicationId = importBody?.publication?.id
        expect(typeof importedId).toBe('string')
        expect(typeof importedPublicationId).toBe('string')

        await recordCreatedMetahub({
            id: importedId,
            name: fixture.metahubName,
            codename: 'quiz-fixture-imported'
        })
        await recordCreatedPublication({
            id: importedPublicationId,
            metahubId: importedId
        })

        await expect(dialog).toHaveCount(0)
        await expect(page.getByText(fixture.metahubName, { exact: true }).first()).toBeVisible({ timeout: 15_000 })

        const layoutId = await waitForLayoutId(api, importedId)
        const [scriptsPayload, layoutWidgets] = await Promise.all([
            listMetahubScripts(api, importedId, { attachedToKind: 'metahub', onlyActive: true }),
            listLayoutZoneWidgets(api, importedId, layoutId)
        ])

        const importedScript = (scriptsPayload.items ?? []).find(
            (item: Record<string, any>) => item?.codename?.locales?.en?.content === QUIZ_SCRIPT_CODENAME
        )
        expect(importedScript?.attachedToKind).toBe('metahub')
        expect(importedScript?.attachedToId ?? null).toBeNull()
        expect(importedScript?.sourceCode).toContain('SpaceQuizWidget')

        const quizWidgetBinding = (layoutWidgets.items ?? []).find(
            (item: Record<string, any>) => item?.widgetKey === 'quizWidget' && item?.config?.scriptCodename === QUIZ_SCRIPT_CODENAME
        )
        expect(quizWidgetBinding).toBeTruthy()

        const linkedApplication = await createPublicationLinkedApplication(api, importedId, importedPublicationId, {
            name: QUIZ_PUBLICATION.applicationName,
            namePrimaryLocale: 'en',
            createApplicationSchema: false,
            workspacesEnabled: false
        })

        const applicationId = linkedApplication?.application?.id
        if (typeof applicationId !== 'string') {
            throw new Error('Import flow did not create an application id from the imported quiz publication')
        }

        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.application.slug
        })

        await syncApplicationSchema(api, applicationId)

        const listScriptsResponsePromise = page.waitForResponse(
            (response) =>
                response.request().method() === 'GET' &&
                response.url().includes(`/api/v1/applications/${applicationId}/runtime/scripts?`) &&
                response.url().includes('attachedToKind=metahub')
        )
        const clientBundleResponsePromise = page.waitForResponse(
            (response) =>
                response.request().method() === 'GET' &&
                response.url().includes(`/api/v1/applications/${applicationId}/runtime/scripts/`) &&
                response.url().includes('/client')
        )

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/a/${applicationId}`)

        const listScriptsResponse = await listScriptsResponsePromise
        const clientBundleResponse = await clientBundleResponsePromise
        expect(listScriptsResponse.ok()).toBe(true)
        expect(clientBundleResponse.ok()).toBe(true)

        const runtimeScriptsPayload = await listScriptsResponse.json()
        const selectedRuntimeScript = runtimeScriptsPayload?.items?.find((item: Record<string, any>) => item?.codename === QUIZ_SCRIPT_CODENAME)
        expect(selectedRuntimeScript?.clientBundle ?? null).toBeNull()
        expect(selectedRuntimeScript?.serverBundle ?? null).toBeNull()

        await test.step('English runtime proves wrong-answer scoring, full completion, and restart', async () => {
            const quiz = QUIZ_CONTENT.en
            const firstQuestion = quiz.questions[0]
            const secondQuestion = quiz.questions[1]
            const wrongAnswerLabel = getWrongSingleChoiceAnswerLabel(firstQuestion)

            await assertQuizQuestionUi({
                page,
                locale: 'en',
                questionIndex: 0,
                score: 0
            })

            await submitQuestionAnswer({
                page,
                applicationId,
                locale: 'en',
                question: firstQuestion,
                answerLabels: [wrongAnswerLabel]
            })

            await expect(page.getByText(QUIZ_UI_COPY.en.incorrectMessage)).toBeVisible()
            await expect(page.getByText(`${QUIZ_UI_COPY.en.explanationLabel}: ${firstQuestion.explanation}`)).toBeVisible()
            await expect(page.getByText(QUIZ_UI_COPY.en.currentScore(0, quiz.questions.length))).toBeVisible()
            await expect(page.getByRole('button', { name: quiz.nextLabel })).toBeVisible()

            await page.getByRole('button', { name: quiz.nextLabel }).click()
            await assertQuizQuestionUi({
                page,
                locale: 'en',
                questionIndex: 1,
                score: 0
            })
            await expect(page.getByRole('button', { name: QUIZ_UI_COPY.en.previousQuestionLabel })).toBeVisible()

            await page.getByRole('button', { name: QUIZ_UI_COPY.en.previousQuestionLabel }).click()
            await assertQuizQuestionUi({
                page,
                locale: 'en',
                questionIndex: 0,
                score: 0
            })
            await expect(getQuizAnswerControl(page, wrongAnswerLabel)).toBeChecked()

            await submitQuestionAnswer({
                page,
                applicationId,
                locale: 'en',
                question: firstQuestion,
                answerLabels: getCorrectAnswerLabels(firstQuestion)
            })

            await expect(page.getByText(secondQuestion.prompt)).toBeVisible({ timeout: 30_000 })
            await expect(page.getByText(QUIZ_UI_COPY.en.currentScore(1, quiz.questions.length))).toBeVisible()

            await completeQuizWithCorrectAnswers({
                page,
                applicationId,
                locale: 'en',
                startIndex: 1,
                startScore: 1
            })

            await assertQuizCompletion({ page, locale: 'en', score: quiz.questions.length })

            await page.getByRole('button', { name: QUIZ_UI_COPY.en.backToQuestionsLabel }).click()
            await expect(page.getByText(quiz.questions[quiz.questions.length - 1].prompt)).toBeVisible({ timeout: 30_000 })
            await expect(page.getByRole('button', { name: QUIZ_UI_COPY.en.previousQuestionLabel })).toBeVisible()

            await page.getByRole('button', { name: QUIZ_UI_COPY.en.resetLabel }).click()
            await assertQuizQuestionUi({
                page,
                locale: 'en',
                questionIndex: 0,
                score: 0
            })
        })

        await test.step('Russian runtime proves localized completion state and result rendering', async () => {
            const quiz = QUIZ_CONTENT.ru

            await applyBrowserPreferences(page, { language: 'ru' })
            await page.goto(`/a/${applicationId}`)

            await assertQuizQuestionUi({
                page,
                locale: 'ru',
                questionIndex: 0,
                score: 0
            })

            await submitQuestionAnswer({
                page,
                applicationId,
                locale: 'ru',
                question: quiz.questions[0],
                answerLabels: getCorrectAnswerLabels(quiz.questions[0])
            })

            await expect(page.getByText(quiz.questions[1].prompt)).toBeVisible({ timeout: 30_000 })
            await expect(page.getByText(QUIZ_UI_COPY.ru.currentScore(1, quiz.questions.length))).toBeVisible()

            await completeQuizWithCorrectAnswers({
                page,
                applicationId,
                locale: 'ru',
                startIndex: 1,
                startScore: 1
            })

            await assertQuizCompletion({ page, locale: 'ru', score: quiz.questions.length })
            await page.getByRole('button', { name: QUIZ_UI_COPY.ru.backToQuestionsLabel }).click()
            await expect(page.getByText(quiz.questions[quiz.questions.length - 1].prompt)).toBeVisible({ timeout: 30_000 })
        })
    })
})