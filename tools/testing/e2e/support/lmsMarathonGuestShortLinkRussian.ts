import { expect } from '../fixtures/test'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from './browser/runtimeUx'
import {
    assertPublicAssessmentAttemptState,
    expectCurrentAttemptQuestion,
    expectNoAccessibilityViolations,
    getRuntimeField,
    readLocalizedText,
    runtimeRecords,
    selectGuestQuizAnswer
} from './lmsMarathonGuestShortLinkAssertions'
import type { LmsMarathonPreparedFlow } from './lmsMarathonGuestShortLinkTypes'

export async function runLmsMarathonRussianGuestQuiz(flow: LmsMarathonPreparedFlow): Promise<void> {
    const { browser, testInfo, applicationId, gradeQuiz, gradeQuestionCount, shortLinkSlug, origin, resources } = flow
    const russianContext = await browser.newContext({
        storageState: { cookies: [], origins: [] },
        locale: 'ru-RU',
        timezoneId: 'UTC',
        colorScheme: 'light',
        reducedMotion: 'reduce',
        viewport: { width: 1920, height: 1080 }
    })
    resources.russianContext = russianContext
    await russianContext.clearCookies()
    expect(await russianContext.cookies(origin), 'The Russian guest flow must also start without authenticated cookies').toHaveLength(0)
    const russianPage = await russianContext.newPage()
    await russianPage.goto(new URL(`/l/${shortLinkSlug}?locale=ru`, origin).toString())
    await expect(russianPage.getByLabel('Имя')).toBeVisible({ timeout: 30_000 })
    await expect(russianPage.getByLabel('Фамилия')).toBeVisible()
    await expect(russianPage.getByRole('link', { name: 'Пользовательское соглашение', exact: true })).toHaveAttribute('href', '/terms')
    await expect(russianPage.getByRole('link', { name: 'Политику конфиденциальности', exact: true })).toHaveAttribute('href', '/privacy')
    await expect(russianPage.getByRole('group', { name: 'Проверка безопасности' })).toHaveCount(0)
    const russianConsentCheckboxes = russianPage.getByRole('checkbox')
    await expect(russianConsentCheckboxes).toHaveCount(2)
    let russianGuestSessionRequestCount = 0
    russianPage.on('request', (request) => {
        const requestUrl = new URL(request.url())
        if (request.method() === 'POST' && requestUrl.pathname === `/api/v1/public/a/${applicationId}/guest-session`) {
            russianGuestSessionRequestCount += 1
        }
    })
    const russianStartButton = russianPage.getByRole('button', { name: 'Начать обучение' })
    await russianPage.setViewportSize({ width: 390, height: 844 })
    await expectNoPageHorizontalOverflow(russianPage, 'Russian LMS Marathon guest introduction at 390px')
    await expect(russianPage.getByLabel('Имя')).toBeVisible()
    await expect(russianPage.getByLabel('Фамилия')).toBeVisible()
    await expect(russianStartButton).toBeVisible()
    await expect(russianStartButton, 'Empty required fields and consents must keep guest intake disabled').toBeDisabled()
    expect(russianGuestSessionRequestCount, 'The guest session must wait for required identity data and consents').toBe(0)
    await russianPage.screenshot({
        path: testInfo.outputPath('lms-marathon-guest-intro-mobile-ru.png'),
        fullPage: true,
        animations: 'disabled'
    })

    const firstNameInput = russianPage.getByLabel('Имя')
    const lastNameInput = russianPage.getByLabel('Фамилия')
    const termsConsent = russianPage.getByRole('checkbox', { name: 'Я принимаю Пользовательское соглашение' })
    const privacyConsent = russianPage.getByRole('checkbox', { name: 'Я принимаю Политику конфиденциальности' })
    await firstNameInput.fill('Мария')
    await lastNameInput.fill('Марафон')
    await expect(russianStartButton, 'Both legal consents are required before continuing').toBeDisabled()
    await termsConsent.check()
    await expect(russianStartButton, 'Accepting only the terms must keep guest intake disabled').toBeDisabled()
    await expectNoPageHorizontalOverflow(russianPage, 'Russian LMS Marathon consent validation at 390px')
    expect(russianGuestSessionRequestCount, 'Incomplete legal consent must not create a guest session').toBe(0)
    await russianPage.screenshot({
        path: testInfo.outputPath('lms-marathon-guest-consent-validation-mobile-ru.png'),
        fullPage: true,
        animations: 'disabled'
    })
    await privacyConsent.check()
    await termsConsent.uncheck()
    await expect(russianStartButton, 'Accepting only the privacy policy must keep guest intake disabled').toBeDisabled()
    await termsConsent.check()
    await expect(russianStartButton, 'Complete identity data and both consents must enable guest intake').toBeEnabled()
    await firstNameInput.fill('')
    await expect(russianStartButton, 'A missing required name must disable guest intake even after consent').toBeDisabled()
    expect(russianGuestSessionRequestCount, 'Incomplete guest intake must not create a session').toBe(0)
    await firstNameInput.fill('Мария')
    await expect(russianStartButton).toBeEnabled()
    await lastNameInput.fill('')
    await expect(russianStartButton, 'A missing required surname must disable guest intake even after consent').toBeDisabled()
    expect(russianGuestSessionRequestCount, 'An incomplete guest identity must not create a session').toBe(0)
    await lastNameInput.fill('Марафон')
    await expect(russianStartButton).toBeEnabled()
    await expectNoPageHorizontalOverflow(russianPage, 'Russian LMS Marathon guest introduction at 390px')
    await russianPage.screenshot({
        path: testInfo.outputPath('lms-marathon-guest-intro-filled-mobile-ru.png'),
        fullPage: true,
        animations: 'disabled'
    })
    await russianPage.setViewportSize({ width: 768, height: 1024 })
    await expectNoPageHorizontalOverflow(russianPage, 'Russian LMS Marathon guest introduction at 768px')
    await expect(russianPage.getByLabel('Имя')).toBeVisible()
    await expect(russianPage.getByLabel('Фамилия')).toBeVisible()
    await expect(russianStartButton).toBeVisible()
    await russianPage.setViewportSize({ width: 1920, height: 1080 })
    await expectNoPageHorizontalOverflow(russianPage, 'Russian LMS Marathon guest introduction at 1920px')
    await russianPage.screenshot({
        path: testInfo.outputPath('lms-marathon-guest-intro-ru.png'),
        fullPage: true,
        animations: 'disabled'
    })
    await russianPage.setViewportSize({ width: 390, height: 844 })
    await expectNoAccessibilityViolations(russianPage, 'Russian guest intake at 390px')

    const russianAttemptStartPromise = russianPage.waitForResponse((response) => {
        const responseUrl = new URL(response.url())
        return response.request().method() === 'POST' && responseUrl.pathname === `/api/v1/public/a/${applicationId}/runtime/attempts/start`
    })
    await russianStartButton.click()
    const russianAttemptStartResponse = await russianAttemptStartPromise
    expect(russianAttemptStartResponse.ok()).toBe(true)
    expect(new URL(russianAttemptStartResponse.url()).searchParams.get('locale')).toBe('ru')
    const russianAttempt = await russianAttemptStartResponse.json()
    assertPublicAssessmentAttemptState(russianAttempt, 'Russian attempt start response')
    expect(russianAttempt.completionText).toBe(gradeQuiz.completionText.ru)
    expect(russianAttempt.attemptNumber).toBe(1)
    let currentAttempt = russianAttempt
    expectCurrentAttemptQuestion(currentAttempt, gradeQuiz.questions[0]!, 0, gradeQuestionCount, 'ru', 'Russian attempt start')
    await expect(russianPage.getByText(`Вопрос 1 из ${gradeQuestionCount}`, { exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(russianPage.getByRole('timer')).toHaveText(/^(?:44|45):[0-5]\d$/)
    await expect(russianPage.getByRole('timer')).toHaveAttribute('aria-label', /^Осталось времени: (?:44|45):[0-5]\d$/)
    await expectNoAccessibilityViolations(russianPage, 'Russian guest quiz question')
    for (const viewport of [
        { width: 1920, height: 1080 },
        { width: 768, height: 1024 },
        { width: 390, height: 844 }
    ]) {
        await russianPage.setViewportSize(viewport)
        await expectNoPageHorizontalOverflow(russianPage, `Russian LMS Marathon guest question at ${viewport.width}px`)
        await expect(russianPage.getByRole('timer')).toBeVisible()
        if (viewport.width === 390) {
            await russianPage.screenshot({
                path: testInfo.outputPath('lms-marathon-guest-question-mobile-ru.png'),
                fullPage: true,
                animations: 'disabled'
            })
        }
    }
    await russianPage.setViewportSize({ width: 1440, height: 900 })
    await russianPage.screenshot({
        path: testInfo.outputPath('lms-marathon-guest-question-ru.png'),
        fullPage: true,
        animations: 'disabled'
    })

    for (let index = 0; index < gradeQuestionCount; index += 1) {
        const canonicalQuestion = gradeQuiz.questions[index]
        if (!canonicalQuestion) throw new Error(`The Russian canonical quiz is missing question ${index + 1}`)
        const question = expectCurrentAttemptQuestion(
            currentAttempt,
            canonicalQuestion,
            index,
            gradeQuestionCount,
            'ru',
            `Russian question ${index + 1}`
        )
        const prompt = readLocalizedText(getRuntimeField(question, 'Prompt'), 'ru')
        const options = runtimeRecords(getRuntimeField(question, 'Options'))
        const canonicalCorrectOption = canonicalQuestion?.options.find((option) => option.isCorrect)
        const canonicalPrompt = readLocalizedText(canonicalQuestion?.prompt, 'ru')
        if (!prompt || !canonicalQuestion || !canonicalPrompt || !canonicalCorrectOption || options.length !== 4) {
            throw new Error(`The Russian server question ${index + 1} is missing its prompt, options, or source answer`)
        }
        expect(prompt).toBe(canonicalPrompt)
        expect(Object.keys(question).some((key) => /correct|explanation/iu.test(key))).toBe(false)
        expect(options.every((option) => !Object.keys(option).some((key) => /correct/iu.test(key)))).toBe(true)
        const displayedCorrectOption = options.find((option) => getRuntimeField(option, 'Id') === canonicalCorrectOption.id)
        if (!displayedCorrectOption) throw new Error(`The Russian server omitted the correct choice for question ${index + 1}`)
        const correctLabel = readLocalizedText(
            getRuntimeField(displayedCorrectOption, 'Label') ?? getRuntimeField(displayedCorrectOption, 'Text'),
            'ru'
        )
        if (!correctLabel) throw new Error(`The imported LMS Russian question ${index + 1} has no localized correct answer`)

        await expect(russianPage.getByRole('heading', { name: prompt, exact: true })).toBeVisible({ timeout: 30_000 })
        await expectNoTechnicalLeakage(russianPage.getByRole('main'), {
            label: `Russian LMS Marathon question ${index + 1}`,
            checkUuidSubstrings: true
        })
        await expect(russianPage.getByText(`Вопрос ${index + 1} из ${gradeQuestionCount}`, { exact: true })).toBeVisible()
        await expect(russianPage.getByRole('radio')).toHaveCount(4)
        const correctAnswer = russianPage.getByRole('radiogroup').getByRole('radio', { name: correctLabel, exact: true })
        const nextAttempt = await selectGuestQuizAnswer({
            page: russianPage,
            applicationId,
            attemptId: russianAttempt.attemptId,
            option: correctAnswer,
            label: `Russian quiz answer ${index + 1}`
        })
        expect(nextAttempt.currentQuestionIndex).toBe(index + 1)
        expect(nextAttempt.totalQuestions).toBe(gradeQuestionCount)
        expect(nextAttempt.answeredCount).toBe(index + 1)
        expect(nextAttempt.questions).toHaveLength(index + 1 < gradeQuestionCount ? 1 : 0)
        if (index + 1 < gradeQuestionCount) {
            const nextCanonicalQuestion = gradeQuiz.questions[index + 1]
            if (!nextCanonicalQuestion) throw new Error(`The Russian canonical quiz is missing question ${index + 2}`)
            expectCurrentAttemptQuestion(
                nextAttempt,
                nextCanonicalQuestion,
                index + 1,
                gradeQuestionCount,
                'ru',
                `Russian question ${index + 2} after answer`
            )
        }
        currentAttempt = nextAttempt
    }

    await expect(russianPage.getByRole('heading', { name: 'Тест завершён', exact: true })).toBeVisible({ timeout: 30_000 })
    await expectNoTechnicalLeakage(russianPage.getByRole('main'), {
        label: 'Russian LMS Marathon quiz result',
        checkUuidSubstrings: true
    })
    await expectNoAccessibilityViolations(russianPage, 'Russian guest quiz result')
    await expect(russianPage.getByRole('status').last()).toContainText(`Правильных ответов: ${gradeQuestionCount} из ${gradeQuestionCount}`)
    const russianCompletionText = gradeQuiz.completionText.ru
    await expect(russianPage.getByText(russianCompletionText, { exact: true })).toBeVisible()
    for (const viewport of [
        { width: 1920, height: 1080 },
        { width: 768, height: 1024 },
        { width: 390, height: 844 }
    ]) {
        await russianPage.setViewportSize(viewport)
        await expectNoPageHorizontalOverflow(russianPage, `Russian LMS Marathon guest result at ${viewport.width}px`)
        await expect(russianPage.getByRole('status').last()).toContainText(
            `Правильных ответов: ${gradeQuestionCount} из ${gradeQuestionCount}`
        )
        if (viewport.width === 390) {
            await russianPage.screenshot({
                path: testInfo.outputPath('lms-marathon-guest-result-mobile-ru.png'),
                fullPage: true,
                animations: 'disabled'
            })
        }
    }
    await russianPage.setViewportSize({ width: 1920, height: 1080 })
    await russianPage.screenshot({
        path: testInfo.outputPath('lms-marathon-guest-result-ru.png'),
        fullPage: true,
        animations: 'disabled'
    })
}
