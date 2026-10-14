import { expect } from '../fixtures/test'
import type { Locator, Page } from '@playwright/test'
import { switchRuntimeLocale } from './browser/preferences'
import {
    expectLocalizedValidation,
    expectDataGridHorizontalScrollConstrained,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectSemanticFieldControls,
    RUNTIME_UX_VIEWPORT_MATRIX
} from './browser/runtimeUx'
import { expectNoAccessibilityViolations, readLocalizedText } from './lmsMarathonGuestShortLinkAssertions'
import { entityDialogSelectors } from './selectors/contracts'
import { waitForApplicationObjectId, waitForApplicationRuntimeRow } from './lmsRuntime'
import { readApplicationTabularChildFieldMetadata, readPublishedQuizAccessLinkTargets } from './lmsMarathonGuestShortLinkDatabase'
import { confirmDeleteSelectors } from './selectors/contracts'
import type { LmsMarathonApplicationContext, LmsMarathonAuthoredQuizLink } from './lmsMarathonGuestShortLinkTypes'

type QuizAuthoringLocale = 'en' | 'ru'

type QuizAuthoringCopy = {
    contentProjects: string
    quizzes: string
    quiz: string
    edit: string
    title: string
    description: string
    timeLimit: string
    completionMessage: string
    addRow: string
    prompt: string
    questionType: string
    singleChoice: string
    editAnswers: (count: number) => string
    optionsDialog: string
    option: (number: number) => string
    correctOption: (number: number) => string
    correctAnswerGroup: string
    correctAnswerRequired: string
    optionRequired: string
    openMenu: string
    rowActions: (name: string) => string
    addOption: string
    save: string
    cancel: string
}

const QUIZ_AUTHORING_COPY: Record<QuizAuthoringLocale, QuizAuthoringCopy> = {
    en: {
        contentProjects: 'Content Projects',
        quizzes: 'Quizzes',
        quiz: 'Quiz',
        edit: 'Edit',
        title: 'Title *',
        description: 'Description',
        timeLimit: 'Time Limit (seconds)',
        completionMessage: 'Completion Message',
        addRow: 'Add Row',
        prompt: 'Prompt',
        questionType: 'Question Type',
        singleChoice: 'Single Choice',
        editAnswers: (count) => `Edit answers (${count})`,
        optionsDialog: 'Answer options',
        option: (number) => `Option ${number}`,
        correctOption: (number) => `Option ${number} is correct`,
        correctAnswerGroup: 'Correct answer',
        correctAnswerRequired: 'Select exactly one correct answer.',
        optionRequired: 'Enter an answer option.',
        openMenu: 'Open menu',
        rowActions: (name) => `Actions for ${name}`,
        addOption: 'Add option',
        save: 'Save',
        cancel: 'Cancel'
    },
    ru: {
        contentProjects: 'Проекты контента',
        quizzes: 'Тесты',
        quiz: 'Тест',
        edit: 'Редактировать',
        title: 'Заголовок *',
        description: 'Описание',
        timeLimit: 'Ограничение времени (секунды)',
        completionMessage: 'Текст завершения',
        addRow: 'Добавить строку',
        prompt: 'Текст вопроса',
        questionType: 'Тип вопроса',
        singleChoice: 'Одиночный выбор',
        editAnswers: (count) => `Изменить варианты (${count})`,
        optionsDialog: 'Варианты ответа',
        option: (number) => `Вариант ${number}`,
        correctOption: (number) => `Вариант ${number} правильный`,
        correctAnswerGroup: 'Правильный ответ',
        correctAnswerRequired: 'Выберите ровно один правильный ответ.',
        optionRequired: 'Введите вариант ответа.',
        openMenu: 'Открыть меню',
        rowActions: (name) => `Действия для ${name}`,
        addOption: 'Добавить вариант',
        save: 'Сохранить',
        cancel: 'Отмена'
    }
}

async function verifyDialogAtSupportedViewports(
    flow: LmsMarathonApplicationContext,
    dialog: Locator,
    requiredControl: Locator,
    label: string,
    screenshotPrefix: string
): Promise<void> {
    const { page, testInfo } = flow
    for (const viewport of RUNTIME_UX_VIEWPORT_MATRIX) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await expect(dialog, `${label} must remain visible at ${viewport.width}px`).toBeVisible()
        await expect(requiredControl, `${label} must keep its primary field available at ${viewport.width}px`).toBeVisible()
        await expectNoPageHorizontalOverflow(page, `${label} at ${viewport.width}px`)
        const bounds = await dialog.boundingBox()
        expect(bounds, `${label} must be measurable at ${viewport.width}px`).not.toBeNull()
        expect(bounds!.x).toBeGreaterThanOrEqual(-1)
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1)
        expect(bounds!.y).toBeGreaterThanOrEqual(-1)
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1)
        if ((await dialog.locator('.MuiDataGrid-root').count()) > 0) {
            await expectDataGridHorizontalScrollConstrained(page, `${label} DataGrid at ${viewport.width}px`)
        }
        await page.screenshot({
            path: testInfo.outputPath(`${screenshotPrefix}-${viewport.name}.png`),
            fullPage: false,
            animations: 'disabled'
        })
    }
    await page.setViewportSize({ width: 1920, height: 1080 })
}

type PersistedOption = { id: string; labelEn: string; labelRu: string; isCorrect: boolean }

async function readPersistedOptions(
    flow: LmsMarathonApplicationContext,
    quizId: string,
    quizzesObjectId: string,
    questionIndex = 0
): Promise<PersistedOption[]> {
    const { tableComponentId, childColumnName } = await readApplicationTabularChildFieldMetadata(
        flow.applicationId,
        'Quizzes',
        'Questions',
        'Options'
    )
    const params = new URLSearchParams({
        objectCollectionId: quizzesObjectId,
        workspaceId: flow.publicWorkspaceId
    })
    const response = await flow.page.request.get(
        `/api/v1/applications/${flow.applicationId}/runtime/rows/${quizId}/tabular/${tableComponentId}?${params.toString()}`
    )
    expect(response.status(), 'Quiz questions must be readable to the authorized editor').toBe(200)
    const payload = (await response.json()) as { items?: Array<Record<string, unknown>>; total?: number }
    const questions = Array.isArray(payload.items) ? payload.items : []
    expect(questions, 'The authored quiz must persist both question rows').toHaveLength(2)
    const rawOptions = questions[questionIndex]?.[childColumnName]
    const options = Array.isArray(rawOptions)
        ? rawOptions.filter((option): option is Record<string, unknown> => Boolean(option) && typeof option === 'object')
        : []
    return options.map((option) => ({
        id: String(option.id ?? ''),
        labelEn: readLocalizedText(option.label ?? option.Label ?? option.text ?? option.Text, 'en') ?? '',
        labelRu: readLocalizedText(option.label ?? option.Label ?? option.text ?? option.Text, 'ru') ?? '',
        isCorrect: option.isCorrect === true || option.IsCorrect === true
    }))
}

async function openOptionsEditor(page: Page, quizDialog: Locator, copy: QuizAuthoringCopy, count: number) {
    const questionsGrid = quizDialog.getByRole('grid').first()
    await quizDialog.getByRole('button', { name: copy.addRow, exact: true }).click()
    const promptInput = questionsGrid.getByRole('textbox', { name: copy.prompt, exact: true })
    await expect(promptInput, 'A new question row must expose its labelled prompt field').toBeVisible()
    await expectSemanticFieldControls(questionsGrid, { longTextLabels: [copy.prompt] })
    await promptInput.fill(`E2E authored prompt ${count}`)
    await promptInput.press('Enter')

    const questionRow = questionsGrid.getByRole('row').filter({ hasText: `E2E authored prompt ${count}` })
    const questionType = questionRow.getByRole('combobox', { name: copy.questionType, exact: true })
    if (!(await questionType.innerText()).includes(copy.singleChoice)) {
        await questionType.click()
        await page.getByRole('option', { name: copy.singleChoice, exact: true }).click()
    }

    const editAnswers = questionRow.getByRole('button', { name: copy.editAnswers(0), exact: true })
    await expect(editAnswers, 'The Questions table must provide the structured four-choice editor').toBeVisible()
    const questionCells = questionRow.getByRole('gridcell')
    const answerCell = questionRow.getByRole('gridcell', { name: copy.editAnswers(0), exact: true })
    await expectNoTechnicalLeakage(answerCell, {
        label: 'LMS quiz answer-options table cell',
        checkUuidSubstrings: true
    })
    const answerCellIndex = await answerCell.evaluate((cell) =>
        Array.from(cell.parentElement?.querySelectorAll<HTMLElement>('[role="gridcell"]') ?? []).indexOf(cell as HTMLElement)
    )
    expect(answerCellIndex, 'The structured answer editor must be inside the authored question row').toBeGreaterThan(0)
    await questionCells.first().click()
    for (let index = 0; index < answerCellIndex; index += 1) {
        await page.keyboard.press('ArrowRight')
    }
    await expect(editAnswers, 'Arrow-key navigation must focus the answer-options cell button').toBeFocused()
    await page.keyboard.press('Enter')
    return {
        questionsGrid,
        optionsDialog: page.getByRole('dialog', { name: copy.optionsDialog, exact: true })
    }
}

async function tabUntilFocused(page: Page, target: Locator, label: string, maximumTabs = 48): Promise<void> {
    for (let tabCount = 0; tabCount <= maximumTabs; tabCount += 1) {
        if (await target.evaluate((element) => element === document.activeElement)) return
        await page.keyboard.press('Tab')
    }
    throw new Error(`${label} was not reachable through ${maximumTabs} Tab presses`)
}

async function verifyOptionEditorAtSupportedWidths(
    flow: LmsMarathonApplicationContext,
    optionsDialog: Locator,
    locale: QuizAuthoringLocale,
    copy: QuizAuthoringCopy
): Promise<void> {
    const { page, testInfo } = flow
    for (const viewport of RUNTIME_UX_VIEWPORT_MATRIX) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await expect(optionsDialog, `${locale} answer editor must remain visible at ${viewport.width}px`).toBeVisible()
        await expectNoPageHorizontalOverflow(page, `${locale} LMS quiz answer editor at ${viewport.width}px`)
        const bounds = await optionsDialog.boundingBox()
        expect(bounds, `${locale} answer editor must be measurable at ${viewport.width}px`).not.toBeNull()
        expect(bounds!.x).toBeGreaterThanOrEqual(0)
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1)
        expect(bounds!.y).toBeGreaterThanOrEqual(0)
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1)
        expect(bounds!.height).toBeLessThanOrEqual(viewport.height + 1)
        const firstOption = optionsDialog.getByRole('textbox', { name: copy.option(1), exact: true })
        const save = optionsDialog.getByRole('button', { name: copy.save, exact: true })
        await expect(firstOption, `${locale} first answer must remain available at ${viewport.width}px`).toBeVisible()
        await expect(optionsDialog.getByRole('button', { name: copy.addOption, exact: true })).toBeVisible()
        await page.screenshot({
            path: testInfo.outputPath(`lms-marathon-quiz-options-${locale}-${viewport.width}x${viewport.height}.png`),
            fullPage: false,
            animations: 'disabled'
        })
        await save.scrollIntoViewIfNeeded()
        await expect(save, `${locale} Save must be reachable at ${viewport.width}px`).toBeVisible()
        const saveBounds = await save.boundingBox()
        expect(saveBounds, `${locale} Save must have a viewport position at ${viewport.width}px`).not.toBeNull()
        expect(saveBounds!.y).toBeGreaterThanOrEqual(0)
        expect(saveBounds!.y + saveBounds!.height).toBeLessThanOrEqual(viewport.height + 1)
        if (viewport.width < 1920) {
            await page.screenshot({
                path: testInfo.outputPath(`lms-marathon-quiz-options-${locale}-${viewport.width}x${viewport.height}-save-visible.png`),
                fullPage: false,
                animations: 'disabled'
            })
        }
        if (viewport.width === 1920) {
            await expectNoAccessibilityViolations(page, `${locale.toUpperCase()} LMS quiz answer editor`)
        }
    }
    await page.setViewportSize({ width: 1920, height: 1080 })
}

async function fillAndSaveOptionEditor(
    flow: LmsMarathonApplicationContext,
    optionsDialog: Locator,
    copy: QuizAuthoringCopy,
    labels: string[],
    correctIndex: number,
    locale: QuizAuthoringLocale
): Promise<void> {
    const { page } = flow
    const addOption = optionsDialog.getByRole('button', { name: copy.addOption, exact: true })
    await addOption.click()
    const firstOption = optionsDialog.getByRole('textbox', { name: copy.option(1), exact: true })
    await expect(firstOption).toHaveAttribute('aria-invalid', 'true')
    const firstOptionDescribedBy = await firstOption.getAttribute('aria-describedby')
    expect(firstOptionDescribedBy).toBeTruthy()
    await expect(optionsDialog.getByText(copy.optionRequired, { exact: true })).toHaveAttribute('id', firstOptionDescribedBy!)

    const correctGroup = optionsDialog.getByRole('radiogroup', { name: copy.correctAnswerGroup, exact: true })
    await expect(correctGroup).toHaveAttribute('aria-invalid', 'true')
    const groupDescriptionId = await correctGroup.getAttribute('aria-describedby')
    expect(groupDescriptionId).toBeTruthy()
    await expect(optionsDialog.getByText(copy.correctAnswerRequired, { exact: true })).toHaveAttribute('id', groupDescriptionId!)
    await expectLocalizedValidation(optionsDialog, locale, { label: `${locale.toUpperCase()} answer option validation` })

    await firstOption.fill(labels[0] ?? '')
    for (let index = 1; index < 4; index += 1) {
        await addOption.click()
        await optionsDialog.getByRole('textbox', { name: copy.option(index + 1), exact: true }).fill(labels[index] ?? '')
    }
    await expect(optionsDialog.getByRole('textbox')).toHaveCount(4)
    await expect(
        addOption,
        'The general answer editor supports up to twenty choices; this authored question has exactly four'
    ).toBeEnabled()

    const radios = correctGroup.getByRole('radio')
    const firstRadio = radios.first()
    await firstRadio.click()
    await expect(firstRadio).toBeChecked()
    for (let index = 0; index < correctIndex; index += 1) {
        await page.keyboard.press('ArrowDown')
        await expect(radios.nth(index + 1), 'Arrow navigation must move the single correct answer selection').toBeChecked()
    }
    const correctRadio = radios.nth(correctIndex)
    await expect(correctRadio).toHaveAccessibleName(copy.correctOption(correctIndex + 1))
    await expect(correctRadio).toBeChecked()
    await expect(correctGroup).toHaveAttribute('aria-invalid', 'false')
    await expect(optionsDialog.getByText(copy.correctAnswerRequired, { exact: true })).toHaveCount(0)
    await expect(optionsDialog.getByRole('button', { name: copy.save, exact: true })).toBeEnabled()
    await expectNoPageHorizontalOverflow(page, `${locale.toUpperCase()} LMS structured answer editor`)
    await expectNoTechnicalLeakage(optionsDialog, {
        label: `${locale.toUpperCase()} LMS structured answer editor`,
        checkUuidSubstrings: true
    })
    await verifyOptionEditorAtSupportedWidths(flow, optionsDialog, locale, copy)

    const save = optionsDialog.getByRole('button', { name: copy.save, exact: true })
    await save.scrollIntoViewIfNeeded()
    await tabUntilFocused(page, save, `${locale.toUpperCase()} save button`)
    await page.keyboard.press('Enter')
}

function assertStableOptionIdentity(options: PersistedOption[], label: string): void {
    const ids = options.map(({ id }) => id)
    expect(ids, `${label} must keep all four persisted option ids`).toHaveLength(4)
    expect(new Set(ids).size, `${label} option ids must be unique`).toBe(4)
    expect(ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id))).toBe(true)
}

export async function verifyLmsMarathonQuizAuthoring(flow: LmsMarathonApplicationContext): Promise<LmsMarathonAuthoredQuizLink> {
    const { page, api, applicationId, publicWorkspaceId, testInfo, runManifest } = flow
    const quizzesObjectId = await waitForApplicationObjectId(api, applicationId, 'Quizzes')
    const quizTitle = `E2E runtime authored quiz ${runManifest.runId}`
    const optionLabelsEn = Array.from({ length: 4 }, (_, index) => `E2E answer ${index + 1} ${runManifest.runId}`)
    const optionLabelsRu = Array.from({ length: 4 }, (_, index) => `Тестовый ответ ${index + 1} ${runManifest.runId}`)
    const secondOptionLabelsEn = Array.from({ length: 4 }, (_, index) => `E2E second answer ${index + 1} ${runManifest.runId}`)
    const secondOptionLabelsRu = Array.from({ length: 4 }, (_, index) => `Второй тестовый ответ ${index + 1} ${runManifest.runId}`)
    const en = QUIZ_AUTHORING_COPY.en

    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(`/a/${applicationId}?locale=en&workspaceId=${encodeURIComponent(publicWorkspaceId)}`)
    const contentProjects = page.getByRole('link', { name: en.contentProjects, exact: true })
    await expect(contentProjects, 'The published LMS app must expose its Content Projects workspace').toBeVisible({ timeout: 30_000 })
    await contentProjects.click()
    const quizzesTab = page.getByRole('tab', { name: en.quizzes, exact: true })
    await expect(quizzesTab, 'The LMS dashboard must expose its Quizzes tab').toBeVisible({ timeout: 30_000 })
    await quizzesTab.click()

    const table = page.getByTestId('dashboard-entity-table')
    await expect(table).toBeVisible({ timeout: 30_000 })
    await table.getByTestId('records-union-create-target-menu-button').click()
    await page.getByRole('menuitem', { name: en.quiz, exact: true }).click()
    const createDialog = page.getByRole('dialog').filter({ has: page.getByLabel(en.title, { exact: true }) })
    await expect(createDialog, 'The Quiz create form must open from the LMS dashboard').toBeVisible()
    await verifyDialogAtSupportedViewports(
        flow,
        createDialog,
        createDialog.getByLabel(en.title, { exact: true }),
        'LMS quiz creation dialog',
        'lms-marathon-quiz-create-dialog'
    )
    await expectNoPageHorizontalOverflow(page, 'LMS quiz creation dialog')
    await expectNoTechnicalLeakage(createDialog, { label: 'LMS quiz creation dialog', checkUuidSubstrings: true })
    await expectNoAccessibilityViolations(page, 'LMS quiz creation dialog')
    await expectSemanticFieldControls(createDialog, { longTextLabels: [en.description, en.completionMessage] })

    await createDialog.getByLabel(en.title, { exact: true }).fill(quizTitle)
    await createDialog.getByLabel(en.description, { exact: true }).fill('Created through the published LMS application authoring screen.')
    await createDialog.getByLabel(en.timeLimit, { exact: true }).fill('2700')
    await createDialog.getByLabel(en.completionMessage, { exact: true }).fill('Your authored quiz is complete.')

    const { questionsGrid, optionsDialog } = await openOptionsEditor(page, createDialog, en, 1)
    await expect(optionsDialog).toBeVisible()
    await fillAndSaveOptionEditor(flow, optionsDialog, en, optionLabelsEn, 2, 'en')
    await expect(optionsDialog).toHaveCount(0)
    const savedAnswersTrigger = questionsGrid.getByRole('button', { name: en.editAnswers(4), exact: true })
    await expect(savedAnswersTrigger, 'Closing the nested editor must return focus to its updated trigger').toBeFocused()
    await expect(savedAnswersTrigger).toBeVisible()

    const { optionsDialog: secondOptionsDialog } = await openOptionsEditor(page, createDialog, en, 2)
    await expect(secondOptionsDialog).toBeVisible()
    await fillAndSaveOptionEditor(flow, secondOptionsDialog, en, secondOptionLabelsEn, 1, 'en')
    await expect(secondOptionsDialog).toHaveCount(0)

    const createRequestPromise = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            new URL(response.url()).pathname === `/api/v1/applications/${applicationId}/runtime/rows`
    )
    await createDialog.getByTestId(entityDialogSelectors.submitButton).click()
    const createResponse = await createRequestPromise
    expect(createResponse.status(), 'The runtime must persist the authored quiz').toBe(201)
    const createdQuiz = (await createResponse.json()) as { id?: string }
    expect(createdQuiz.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
    await expect(createDialog).toHaveCount(0, { timeout: 30_000 })
    await waitForApplicationRuntimeRow(api, applicationId, quizzesObjectId, createdQuiz.id as string, { workspaceId: publicWorkspaceId })

    const persistedEn = await readPersistedOptions(flow, createdQuiz.id as string, quizzesObjectId, 0)
    expect(persistedEn.map(({ labelEn }) => labelEn)).toEqual(optionLabelsEn)
    expect(persistedEn.filter(({ isCorrect }) => isCorrect)).toHaveLength(1)
    expect(persistedEn[2]?.isCorrect).toBe(true)
    assertStableOptionIdentity(persistedEn, 'English quiz authoring')
    const optionIdsBeforeRuEdit = persistedEn.map(({ id }) => id)
    const persistedSecondEn = await readPersistedOptions(flow, createdQuiz.id as string, quizzesObjectId, 1)
    expect(persistedSecondEn.map(({ labelEn }) => labelEn)).toEqual(secondOptionLabelsEn)
    expect(persistedSecondEn.filter(({ isCorrect }) => isCorrect)).toHaveLength(1)
    expect(persistedSecondEn[1]?.isCorrect).toBe(true)
    assertStableOptionIdentity(persistedSecondEn, 'Second English quiz question authoring')
    expect(new Set([...optionIdsBeforeRuEdit, ...persistedSecondEn.map(({ id }) => id)]).size).toBe(8)
    const secondOptionIdsBeforeRuEdit = persistedSecondEn.map(({ id }) => id)

    await switchRuntimeLocale(page, 'ru')
    const ru = QUIZ_AUTHORING_COPY.ru
    const russianContentProjects = page.getByRole('link', { name: ru.contentProjects, exact: true })
    const viewport = page.viewportSize()
    if (viewport && viewport.width < 600) {
        await page.getByRole('button', { name: ru.openMenu, exact: true }).click()
    }
    await expect(russianContentProjects, 'Published LMS authoring navigation must be localized in Russian').toBeVisible({ timeout: 30_000 })
    await russianContentProjects.click()
    const russianQuizzesTab = page.getByRole('tab', { name: ru.quizzes, exact: true })
    await expect(russianQuizzesTab).toBeVisible({ timeout: 30_000 })
    await russianQuizzesTab.click()
    const authoredQuizRow = page.getByRole('row').filter({ hasText: quizTitle })
    await expect(authoredQuizRow, 'The newly authored quiz must remain available in the Russian dashboard').toBeVisible({ timeout: 30_000 })
    const rowActions = authoredQuizRow.getByRole('button', { name: ru.rowActions(quizTitle), exact: true })
    await expect(rowActions, 'The authored quiz row must expose its accessible action menu').toBeVisible()
    await rowActions.click()
    await page.getByRole('menuitem', { name: ru.edit, exact: true }).click()

    const editDialog = page.getByRole('dialog').filter({ has: page.getByLabel(ru.title, { exact: true }) })
    await expect(editDialog, 'The Russian quiz editor must open for the saved row').toBeVisible()
    await expectSemanticFieldControls(editDialog, { longTextLabels: [ru.description, ru.completionMessage] })
    const editGrid = editDialog.getByRole('grid').first()
    const firstQuestionRow = editGrid.getByRole('row').filter({ hasText: 'E2E authored prompt 1' })
    const russianEditAnswers = firstQuestionRow.getByRole('button', { name: ru.editAnswers(4), exact: true })
    await expect(russianEditAnswers).toBeVisible()
    await russianEditAnswers.click()
    const russianOptionsDialog = page.getByRole('dialog', { name: ru.optionsDialog, exact: true })
    await expect(russianOptionsDialog).toBeVisible()

    for (let index = 0; index < 4; index += 1) {
        const optionInput = russianOptionsDialog.getByRole('textbox', { name: ru.option(index + 1), exact: true })
        await expect(optionInput).toHaveValue(optionLabelsEn[index] ?? '')
        await optionInput.fill(optionLabelsRu[index] ?? '')
    }
    const russianCorrectGroup = russianOptionsDialog.getByRole('radiogroup', { name: ru.correctAnswerGroup, exact: true })
    const russianRadios = russianCorrectGroup.getByRole('radio')
    await russianRadios.first().click()
    await expect(russianRadios.first()).toBeChecked()
    for (let index = 0; index < 3; index += 1) {
        await page.keyboard.press('ArrowDown')
        await expect(russianRadios.nth(index + 1), 'Russian arrow navigation must move the correct answer selection').toBeChecked()
    }
    const russianCorrectRadio = russianRadios.nth(3)
    await expect(russianCorrectRadio).toHaveAccessibleName(ru.correctOption(4))
    await expect(russianCorrectRadio).toBeChecked()
    await expectNoTechnicalLeakage(russianOptionsDialog, {
        label: 'Russian LMS quiz answer editor',
        checkUuidSubstrings: true
    })
    await verifyOptionEditorAtSupportedWidths(flow, russianOptionsDialog, 'ru', ru)
    const russianSave = russianOptionsDialog.getByRole('button', { name: ru.save, exact: true })
    await russianSave.scrollIntoViewIfNeeded()
    await tabUntilFocused(page, russianSave, 'Russian save button')
    await page.keyboard.press('Enter')
    await expect(russianOptionsDialog).toHaveCount(0)
    await expect(russianEditAnswers, 'Saving Russian options must restore focus to the answer editor trigger').toBeFocused()

    const secondQuestionRow = editGrid.getByRole('row').filter({ hasText: 'E2E authored prompt 2' })
    const secondRussianEditAnswers = secondQuestionRow.getByRole('button', { name: ru.editAnswers(4), exact: true })
    await expect(secondRussianEditAnswers).toBeVisible()
    await secondRussianEditAnswers.click()
    const secondRussianOptionsDialog = page.getByRole('dialog', { name: ru.optionsDialog, exact: true })
    await expect(secondRussianOptionsDialog).toBeVisible()
    for (let index = 0; index < 4; index += 1) {
        await secondRussianOptionsDialog
            .getByRole('textbox', { name: ru.option(index + 1), exact: true })
            .fill(secondOptionLabelsRu[index] ?? '')
    }
    const secondRussianCorrectGroup = secondRussianOptionsDialog.getByRole('radiogroup', { name: ru.correctAnswerGroup, exact: true })
    const secondRussianRadios = secondRussianCorrectGroup.getByRole('radio')
    await secondRussianRadios.nth(1).click()
    await expect(secondRussianRadios.nth(1)).toBeChecked()
    await page.keyboard.press('ArrowUp')
    await expect(secondRussianRadios.first(), 'The second question must preserve independent answer-key selection').toBeChecked()
    await expect(secondRussianOptionsDialog.getByRole('button', { name: ru.save, exact: true })).toBeEnabled()
    await verifyOptionEditorAtSupportedWidths(flow, secondRussianOptionsDialog, 'ru', ru)
    const secondRussianSave = secondRussianOptionsDialog.getByRole('button', { name: ru.save, exact: true })
    await secondRussianSave.scrollIntoViewIfNeeded()
    await tabUntilFocused(page, secondRussianSave, 'Second Russian answer save button')
    await page.keyboard.press('Enter')
    await expect(secondRussianOptionsDialog).toHaveCount(0)

    const updateRequestPromise = page.waitForResponse((response) => {
        const path = new URL(response.url()).pathname
        const rowsPath = `/api/v1/applications/${applicationId}/runtime/rows/`
        const rowId = path.startsWith(rowsPath) ? path.slice(rowsPath.length) : ''
        return response.request().method() === 'PATCH' && rowId.length > 0 && !rowId.includes('/')
    })
    await editDialog.getByTestId(entityDialogSelectors.submitButton).click()
    const updateResponse = await updateRequestPromise
    expect(updateResponse.ok(), 'The runtime must persist the Russian option translations').toBe(true)
    await expect(editDialog).toHaveCount(0, { timeout: 30_000 })

    await expect
        .poll(async () => {
            const options = await readPersistedOptions(flow, createdQuiz.id as string, quizzesObjectId, 0)
            return options.map(({ labelRu, isCorrect }) => ({ labelRu, isCorrect }))
        })
        .toEqual(optionLabelsRu.map((labelRu, index) => ({ labelRu, isCorrect: index === 3 })))
    const persistedAfterRuEdit = await readPersistedOptions(flow, createdQuiz.id as string, quizzesObjectId, 0)
    expect(persistedAfterRuEdit.map(({ labelEn }) => labelEn)).toEqual(optionLabelsEn)
    expect(persistedAfterRuEdit.map(({ id }) => id)).toEqual(optionIdsBeforeRuEdit)
    assertStableOptionIdentity(persistedAfterRuEdit, 'Russian quiz authoring')
    const persistedSecondAfterRuEdit = await readPersistedOptions(flow, createdQuiz.id as string, quizzesObjectId, 1)
    expect(persistedSecondAfterRuEdit.map(({ labelEn }) => labelEn)).toEqual(secondOptionLabelsEn)
    expect(persistedSecondAfterRuEdit.map(({ labelRu, isCorrect }) => ({ labelRu, isCorrect }))).toEqual(
        secondOptionLabelsRu.map((labelRu, index) => ({ labelRu, isCorrect: index === 0 }))
    )
    expect(persistedSecondAfterRuEdit.map(({ id }) => id)).toEqual(secondOptionIdsBeforeRuEdit)
    assertStableOptionIdentity(persistedSecondAfterRuEdit, 'Second Russian quiz question authoring')

    await page.getByRole('tab', { name: ru.quizzes, exact: true }).click()
    const savedQuizTable = page.getByTestId('dashboard-entity-table')
    await expect(savedQuizTable, 'The localized quiz list must remain available after saving').toBeVisible()
    await expect(savedQuizTable.getByRole('row').filter({ hasText: quizTitle })).toBeVisible()
    await expectNoPageHorizontalOverflow(page, 'LMS authored quiz dashboard after localization edit')
    await expectNoTechnicalLeakage(savedQuizTable, {
        label: 'LMS authored quiz dashboard',
        checkUuidSubstrings: true
    })
    await expectNoAccessibilityViolations(page, 'Russian LMS quiz authoring dashboard')
    await page.screenshot({
        path: testInfo.outputPath('lms-marathon-quiz-authoring-saved-ru.png'),
        fullPage: true,
        animations: 'disabled'
    })

    const russianGuestLinksTab = page.getByRole('tab', { name: 'Ссылки для гостей', exact: true })
    await expect(russianGuestLinksTab, 'The guest-link authoring tab must be localized in Russian').toBeVisible()

    const accessLinkSlug = `e2e-${runManifest.runId.slice(0, 16).toLowerCase()}-authored-quiz`
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(`/a/${applicationId}?locale=en&workspaceId=${encodeURIComponent(publicWorkspaceId)}`)
    await page.getByRole('link', { name: en.contentProjects, exact: true }).click()
    await page.getByRole('tab', { name: 'Guest links', exact: true }).click()
    const relationBuilder = page.getByTestId('runtime-relation-builder')
    await expect(relationBuilder, 'The workspace must expose quiz-scoped guest-link authoring').toBeVisible({ timeout: 30_000 })
    await expect(relationBuilder.getByText('Use Count', { exact: true })).toHaveCount(0)
    await relationBuilder.getByRole('tab', { name: quizTitle, exact: true }).click()
    await expect(relationBuilder.getByRole('heading', { name: 'Guest access links', exact: true })).toBeVisible()
    await expectNoTechnicalLeakage(relationBuilder, {
        label: 'LMS quiz guest-link authoring',
        checkUuidSubstrings: true,
        checkOpaqueRuntimeHandles: true
    })
    await expectNoPageHorizontalOverflow(page, 'LMS quiz guest-link authoring')
    await expectNoAccessibilityViolations(page, 'LMS quiz guest-link authoring')
    await page.screenshot({
        path: testInfo.outputPath('lms-marathon-quiz-guest-links-desktop.png'),
        fullPage: true,
        animations: 'disabled'
    })

    const createGuestLinkButton = relationBuilder.getByRole('button', { name: 'Create', exact: true })
    await createGuestLinkButton.click()
    const guestLinkDialog = page.getByRole('dialog', { name: 'Create element', exact: true })
    await expect(guestLinkDialog, 'The selected quiz must open the standard Access Links form').toBeVisible()
    await verifyDialogAtSupportedViewports(
        flow,
        guestLinkDialog,
        guestLinkDialog.getByRole('textbox', { name: 'Access Key', exact: true }),
        'LMS quiz guest-link form',
        'lms-marathon-guest-link-create-dialog'
    )
    await expect(guestLinkDialog.getByLabel('Use Count')).toHaveCount(0)
    await expect(guestLinkDialog.getByLabel('Target ID')).toHaveCount(0)
    await expectNoTechnicalLeakage(guestLinkDialog, {
        label: 'Quiz guest-link form',
        checkUuidSubstrings: true,
        checkOpaqueRuntimeHandles: true
    })
    await guestLinkDialog.getByRole('textbox', { name: 'Access Key', exact: true }).fill(accessLinkSlug)
    await guestLinkDialog.getByRole('textbox', { name: 'Title', exact: true }).fill(quizTitle)
    const nextStep = guestLinkDialog.getByTestId('entity-form-next')
    await expect(nextStep).toBeEnabled()
    await nextStep.click()
    await expect(
        guestLinkDialog.getByText('Choose which identity fields guests see and which are required. Terms and Privacy remain required.', {
            exact: true
        })
    ).toBeVisible()

    for (const requiredName of ['Show First Name', 'Require First Name', 'Show Last Name', 'Require Last Name']) {
        await expect(guestLinkDialog.getByRole('checkbox', { name: requiredName, exact: true })).toBeChecked()
    }
    const showEmail = guestLinkDialog.getByRole('checkbox', { name: 'Show Email', exact: true })
    const requireEmail = guestLinkDialog.getByRole('checkbox', { name: 'Require Email', exact: true })
    await expect(showEmail).not.toBeChecked()
    await expect(requireEmail).not.toBeChecked()
    await showEmail.check()
    await expect(guestLinkDialog.getByRole('checkbox', { name: 'Enable CAPTCHA', exact: true })).not.toBeChecked()
    await expectNoPageHorizontalOverflow(page, 'LMS quiz guest-link intake settings')
    await expectNoAccessibilityViolations(page, 'LMS quiz guest-link intake settings')
    await page.screenshot({
        path: testInfo.outputPath('lms-marathon-quiz-guest-link-intake-settings.png'),
        fullPage: true,
        animations: 'disabled'
    })

    const accessLinksObjectId = await waitForApplicationObjectId(api, applicationId, 'AccessLinks')
    const createAccessLinkResponsePromise = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            new URL(response.url()).pathname === `/api/v1/applications/${applicationId}/runtime/rows`
    )
    await guestLinkDialog.getByTestId(entityDialogSelectors.submitButton).click()
    const createAccessLinkResponse = await createAccessLinkResponsePromise
    const createAccessLinkPayload = (await createAccessLinkResponse.json()) as { id?: string; error?: string; code?: string }
    expect(
        createAccessLinkResponse.status(),
        `The workspace must persist the configured quiz access link: ${JSON.stringify(createAccessLinkPayload)}`
    ).toBe(201)
    const createdAccessLink = createAccessLinkPayload
    expect(createdAccessLink.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
    await expect(guestLinkDialog).toHaveCount(0, { timeout: 30_000 })
    await waitForApplicationRuntimeRow(api, applicationId, accessLinksObjectId, createdAccessLink.id as string, {
        workspaceId: publicWorkspaceId
    })
    const savedAccessLinks = await readPublishedQuizAccessLinkTargets(applicationId, publicWorkspaceId)
    const savedAccessLink = savedAccessLinks.find(({ slug }) => slug === accessLinkSlug)
    expect(savedAccessLink, 'The new access link must persist in the selected workspace').toBeTruthy()
    expect(savedAccessLink?.targetType).toBe('quiz')
    expect(savedAccessLink?.targetId).toBe(createdQuiz.id)
    expect(readLocalizedText(savedAccessLink?.quizTitle, 'en')).toBe(quizTitle)
    expect(readLocalizedText(savedAccessLink?.linkTitle, 'en')).toBe(quizTitle)
    await page.getByRole('tab', { name: 'Guest links', exact: true }).click()
    await relationBuilder.getByRole('tab', { name: quizTitle, exact: true }).click()
    const savedAccessLinkRow = relationBuilder.getByRole('row').filter({ hasText: quizTitle })
    await expect(savedAccessLinkRow, 'The saved quiz guest link must be visible in its relation panel').toBeVisible()
    const guestAccessUrl = `${new URL(page.url()).origin}/public/a/${applicationId}/links/${encodeURIComponent(
        accessLinkSlug
    )}?workspaceId=${encodeURIComponent(publicWorkspaceId)}`
    const guestAccessAnchor = savedAccessLinkRow.getByRole('link', { name: guestAccessUrl, exact: true })
    await expect(guestAccessAnchor, 'The relation row must expose the complete guest URL in the current app origin').toHaveAttribute(
        'href',
        guestAccessUrl
    )
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(page.url()).origin })
    await savedAccessLinkRow.getByRole('button', { name: `Copy guest link for ${quizTitle}` }).click()
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(guestAccessUrl)
    await expect(page.getByRole('status').filter({ hasText: 'Guest link copied to clipboard.' })).toBeVisible()
    await expectNoPageHorizontalOverflow(page, 'LMS quiz guest link after save')
    await page.screenshot({
        path: testInfo.outputPath('lms-marathon-quiz-guest-link-saved.png'),
        fullPage: true,
        animations: 'disabled'
    })

    return {
        title: quizTitle,
        quizId: createdQuiz.id as string,
        accessLinkSlug,
        accessLinkId: createdAccessLink.id as string,
        correctAnswers: [
            { prompt: 'E2E authored prompt 1', label: optionLabelsEn[3] as string },
            { prompt: 'E2E authored prompt 2', label: secondOptionLabelsEn[0] as string }
        ],
        completionText: 'Your authored quiz is complete.'
    }
}

export async function verifyLmsMarathonUsedAccessLinkCopy(
    flow: LmsMarathonApplicationContext,
    authoredQuiz: LmsMarathonAuthoredQuizLink
): Promise<void> {
    const { page, applicationId, publicWorkspaceId, testInfo } = flow
    const copiedAccessLinkSlug = `${authoredQuiz.accessLinkSlug}-used-copy`
    const copiedAccessLinkTitle = `${authoredQuiz.title} used copy`

    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(`/a/${applicationId}?locale=en&workspaceId=${encodeURIComponent(publicWorkspaceId)}`)
    await page.getByRole('link', { name: 'Content Projects', exact: true }).click()
    await page.getByRole('tab', { name: 'Guest links', exact: true }).click()

    const relationBuilder = page.getByTestId('runtime-relation-builder')
    await expect(relationBuilder, 'Used quiz links must remain available in the workspace editor').toBeVisible({ timeout: 30_000 })
    await relationBuilder.getByRole('tab', { name: authoredQuiz.title, exact: true }).click()
    const originalAccessLinkRow = relationBuilder.getByRole('row').filter({ hasText: authoredQuiz.title })
    await expect(originalAccessLinkRow, 'The completed guest link must remain available for management').toBeVisible()

    const linksBeforeCopy = await readPublishedQuizAccessLinkTargets(applicationId, publicWorkspaceId)
    const originalBeforeCopy = linksBeforeCopy.find(({ slug }) => slug === authoredQuiz.accessLinkSlug)
    expect(originalBeforeCopy?.targetId).toBe(authoredQuiz.quizId)
    expect(originalBeforeCopy?.useCount, 'One completed guest attempt must consume one use of its access link').toBe(1)

    await originalAccessLinkRow.getByRole('button', { name: `Actions for ${authoredQuiz.title}`, exact: true }).click()
    await page.getByRole('menuitem', { name: 'Copy', exact: true }).click()
    const copyDialog = page.getByRole('dialog', { name: 'Copy element', exact: true })
    await expect(copyDialog, 'Copying a used guest link must use the standard relation-scoped form').toBeVisible()
    await verifyDialogAtSupportedViewports(
        flow,
        copyDialog,
        copyDialog.getByRole('textbox', { name: 'Access Key', exact: true }),
        'LMS quiz guest-link copy form',
        'lms-marathon-guest-link-copy-dialog'
    )
    await expect(copyDialog.getByLabel('Use Count')).toHaveCount(0)
    await expect(copyDialog.getByLabel('Target ID')).toHaveCount(0)
    await copyDialog.getByRole('textbox', { name: 'Access Key', exact: true }).fill(copiedAccessLinkSlug)
    await copyDialog.getByRole('textbox', { name: 'Title', exact: true }).fill(copiedAccessLinkTitle)

    const copyResponsePromise = page.waitForResponse((response) => {
        const path = new URL(response.url()).pathname
        const rowsPath = `/api/v1/applications/${applicationId}/runtime/rows/`
        return response.request().method() === 'POST' && path.startsWith(rowsPath) && path.endsWith('/copy')
    })
    await copyDialog.getByTestId(entityDialogSelectors.submitButton).click()
    const copyResponse = await copyResponsePromise
    expect(copyResponse.status(), 'Copying a guest link must allocate a fresh runtime row').toBe(201)
    const copiedAccessLink = (await copyResponse.json()) as { id?: string }
    expect(copiedAccessLink.id).toMatch(/^rh1\.[A-Za-z0-9_-]+$/u)
    await expect(copyDialog).toHaveCount(0, { timeout: 30_000 })

    const guestLinksTab = page.getByRole('tab', { name: 'Guest links', exact: true })
    const authoredQuizParentTab = relationBuilder.getByRole('tab', { name: authoredQuiz.title, exact: true })
    await expect(guestLinksTab, 'Copying a link must return to the selected Guest links section').toHaveAttribute('aria-selected', 'true')
    await expect(relationBuilder).toBeVisible()
    await expect(authoredQuizParentTab, 'Copying a link must preserve the selected quiz parent').toHaveAttribute('aria-selected', 'true')
    const copiedAccessLinkRow = relationBuilder.getByRole('row').filter({ hasText: copiedAccessLinkTitle })
    await expect(copiedAccessLinkRow, 'The copy must stay attached to the same quiz').toBeVisible({ timeout: 30_000 })
    const copiedGuestAccessUrl = `${new URL(page.url()).origin}/public/a/${applicationId}/links/${encodeURIComponent(
        copiedAccessLinkSlug
    )}?workspaceId=${encodeURIComponent(publicWorkspaceId)}`
    const copiedGuestAccessAnchor = copiedAccessLinkRow.getByRole('link', { name: copiedGuestAccessUrl, exact: true })
    await expect(copiedGuestAccessAnchor, 'The copied link must show its complete same-application guest URL').toHaveAttribute(
        'href',
        copiedGuestAccessUrl
    )
    const copiedLinkNameCell = copiedAccessLinkRow.getByRole('cell').filter({ hasText: copiedAccessLinkTitle })
    await expect(copiedLinkNameCell, 'The copied link title must not expose an application UUID').not.toContainText(
        /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu
    )
    await expectNoTechnicalLeakage(relationBuilder, {
        label: 'Copied quiz access-link table',
        // A full guest URL intentionally contains the application UUID; the exact URL is asserted above.
        checkUuidSubstrings: false,
        checkOpaqueRuntimeHandles: true
    })
    await expectNoPageHorizontalOverflow(page, 'Copied quiz access-link table')
    await expectNoAccessibilityViolations(page, 'Copied quiz access-link table')
    await page.screenshot({
        path: testInfo.outputPath('lms-marathon-used-access-link-copy.png'),
        fullPage: true,
        animations: 'disabled'
    })

    const linksAfterCopy = await readPublishedQuizAccessLinkTargets(applicationId, publicWorkspaceId)
    const copiedLink = linksAfterCopy.find(({ slug }) => slug === copiedAccessLinkSlug)
    const originalAfterCopy = linksAfterCopy.find(({ slug }) => slug === authoredQuiz.accessLinkSlug)
    expect(copiedLink?.targetType).toBe('quiz')
    expect(copiedLink?.targetId).toBe(authoredQuiz.quizId)
    expect(copiedLink?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
    expect(copiedLink?.id).not.toBe(originalBeforeCopy?.id)
    expect(copiedLink?.useCount, 'A new access link must start with a fresh usage quota').toBe(0)
    expect(originalAfterCopy?.useCount, 'Copying must not mutate the source link usage counter').toBe(1)

    await copiedAccessLinkRow.getByRole('button', { name: `Actions for ${copiedAccessLinkTitle}`, exact: true }).click()
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
    const deleteDialog = page.getByRole('dialog', { name: 'Delete element?', exact: true })
    await expect(deleteDialog, 'Deleting a copied guest link must ask for confirmation').toBeVisible()
    const deleteResponsePromise = page.waitForResponse((response) => {
        const path = new URL(response.url()).pathname
        return response.request().method() === 'DELETE' && path.startsWith(`/api/v1/applications/${applicationId}/runtime/rows/rh1.`)
    })
    await deleteDialog.getByTestId(confirmDeleteSelectors.confirmButton).click()
    const deleteResponse = await deleteResponsePromise
    expect(deleteResponse.ok(), 'Deleting the copied link must succeed without deleting its quiz').toBe(true)
    await expect(guestLinksTab, 'Deleting a copied link must return to the selected Guest links section').toHaveAttribute(
        'aria-selected',
        'true'
    )
    await expect(relationBuilder).toBeVisible()
    await expect(authoredQuizParentTab, 'Deleting a copied link must preserve the selected quiz parent').toHaveAttribute(
        'aria-selected',
        'true'
    )
    await expect(copiedAccessLinkRow).toHaveCount(0, { timeout: 30_000 })
    await expect(originalAccessLinkRow, 'Deleting the copy must leave its source link available').toBeVisible()

    const linksAfterDelete = await readPublishedQuizAccessLinkTargets(applicationId, publicWorkspaceId)
    expect(linksAfterDelete.some(({ slug }) => slug === copiedAccessLinkSlug)).toBe(false)
    const originalAfterDelete = linksAfterDelete.find(({ slug }) => slug === authoredQuiz.accessLinkSlug)
    expect(originalAfterDelete?.targetId).toBe(authoredQuiz.quizId)
    expect(originalAfterDelete?.useCount).toBe(1)
}
