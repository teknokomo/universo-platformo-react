import { expect } from '../fixtures/test'
import { expectNoPageHorizontalOverflow } from './browser/runtimeUx'
import {
    acceptGuestLegalConsents,
    expectNoAccessibilityViolations,
    expectCurrentAttemptQuestion,
    getRuntimeField,
    readLocalizedText,
    runtimeRecords,
    selectGuestQuizAnswer,
    assertPublicAssessmentAttemptState
} from './lmsMarathonGuestShortLinkAssertions'
import type { LmsMarathonPreparedFlow } from './lmsMarathonGuestShortLinkTypes'

export async function runLmsMarathonGradeTenGuestCheck(flow: LmsMarathonPreparedFlow): Promise<void> {
    const { browser, testInfo, runManifest, applicationId, gradeTenShortLinkSlug, gradeTenQuiz, origin, resources } = flow
    const gradeTenContext = await browser.newContext({
        storageState: { cookies: [], origins: [] },
        locale: 'ru-RU',
        timezoneId: 'UTC',
        colorScheme: 'light',
        reducedMotion: 'reduce',
        viewport: { width: 1920, height: 1080 }
    })
    resources.gradeTenContext = gradeTenContext
    await gradeTenContext.clearCookies()
    expect(await gradeTenContext.cookies(origin), 'The grade 10 guest flow must start without authenticated cookies').toHaveLength(0)
    const gradeTenPage = await gradeTenContext.newPage()
    await gradeTenPage.goto(new URL(`/l/${gradeTenShortLinkSlug}?locale=ru`, origin).toString())
    await expect(gradeTenPage.getByLabel('Имя')).toBeVisible({ timeout: 30_000 })
    await gradeTenPage.getByLabel('Имя').fill('E2E Проверка')
    await gradeTenPage.getByLabel('Фамилия').fill(runManifest.runId.slice(16, 28))
    const gradeTenConsentCheckboxes = gradeTenPage.getByRole('checkbox')
    await expect(gradeTenConsentCheckboxes).toHaveCount(2)
    await acceptGuestLegalConsents(gradeTenPage, 'ru')
    const gradeTenAttemptStartPromise = gradeTenPage.waitForResponse((response) => {
        const responseUrl = new URL(response.url())
        return response.request().method() === 'POST' && responseUrl.pathname === `/api/v1/public/a/${applicationId}/runtime/attempts/start`
    })
    await gradeTenPage.getByRole('button', { name: 'Начать обучение' }).click()
    const gradeTenAttemptStartResponse = await gradeTenAttemptStartPromise
    expect(gradeTenAttemptStartResponse.ok()).toBe(true)
    const gradeTenAttempt = await gradeTenAttemptStartResponse.json()
    assertPublicAssessmentAttemptState(gradeTenAttempt, 'grade 10 attempt start response')
    let currentAttempt = gradeTenAttempt
    expectCurrentAttemptQuestion(currentAttempt, gradeTenQuiz.questions[0]!, 0, gradeTenQuiz.questions.length, 'ru', 'grade 10 start')
    for (let index = 0; index < 5; index += 1) {
        const expectedQuestion = gradeTenQuiz.questions[index]
        if (!expectedQuestion) throw new Error(`The grade 10 fixture is missing question ${index + 1}`)
        const question = expectCurrentAttemptQuestion(
            currentAttempt,
            expectedQuestion,
            index,
            gradeTenQuiz.questions.length,
            'ru',
            `grade 10 question ${index + 1}`
        )
        const prompt = readLocalizedText(expectedQuestion.prompt, 'ru')
        if (!prompt) throw new Error(`The grade 10 fixture question ${index + 1} has no Russian prompt`)
        await expect(gradeTenPage.getByRole('heading', { name: prompt, exact: true })).toBeVisible()
        const firstOptionId = getRuntimeField(runtimeRecords(getRuntimeField(question, 'Options'))[0] ?? {}, 'Id')
        const firstOption = gradeTenPage.getByRole('radio').first()
        if (typeof firstOptionId !== 'string') throw new Error(`The grade 10 question ${index + 1} has no first option id`)
        await expect(firstOption).toBeVisible()
        currentAttempt = await selectGuestQuizAnswer({
            page: gradeTenPage,
            applicationId,
            attemptId: gradeTenAttempt.attemptId,
            option: firstOption,
            label: `grade 10 answer ${index + 1}`
        })
        if (index < 4) {
            const nextQuestion = gradeTenQuiz.questions[index + 1]
            if (!nextQuestion) throw new Error(`The grade 10 fixture is missing question ${index + 2}`)
            expectCurrentAttemptQuestion(
                currentAttempt,
                nextQuestion,
                index + 1,
                gradeTenQuiz.questions.length,
                'ru',
                `grade 10 question ${index + 2} after save`
            )
        }
    }
    const gradeTenQuestionSix = runtimeRecords(currentAttempt.questions)[0]
    const expectedQuestionSix = gradeTenQuiz.questions[5]
    const questionSixPrompt = readLocalizedText(getRuntimeField(gradeTenQuestionSix ?? {}, 'Prompt'), 'ru')
    const expectedQuestionSixPrompt = readLocalizedText(expectedQuestionSix?.prompt, 'ru')
    const expectedQuestionSixOption = expectedQuestionSix?.options.find((option) => option.isCorrect)
    const expectedQuestionSixAnswer = readLocalizedText(expectedQuestionSixOption?.label, 'ru')
    expect(questionSixPrompt).toBe(expectedQuestionSixPrompt)
    expect(expectedQuestionSixAnswer).toBe('Анне Керн')
    await expect(gradeTenPage.getByText('Вопрос 6 из 30', { exact: true })).toBeVisible()
    await expect(gradeTenPage.getByRole('heading', { name: expectedQuestionSixPrompt ?? '', exact: true })).toBeVisible()
    await expect(gradeTenPage.getByRole('radio', { name: expectedQuestionSixAnswer ?? '', exact: true })).toBeVisible()
    await expectNoAccessibilityViolations(gradeTenPage, 'Grade 10 question 6 about Anna Kern')
    await gradeTenPage.screenshot({
        path: testInfo.outputPath('lms-marathon-grade10-question6-anna-kern.png'),
        fullPage: true,
        animations: 'disabled'
    })
    for (const viewport of [
        { width: 768, height: 1024 },
        { width: 390, height: 844 }
    ]) {
        await gradeTenPage.setViewportSize(viewport)
        await expectNoPageHorizontalOverflow(gradeTenPage, `Grade 10 question 6 at ${viewport.width}px`)
        await expect(gradeTenPage.getByRole('radio', { name: expectedQuestionSixAnswer ?? '', exact: true })).toBeVisible()
        if (viewport.width === 390) {
            await gradeTenPage.screenshot({
                path: testInfo.outputPath('lms-marathon-grade10-question6-mobile.png'),
                fullPage: true,
                animations: 'disabled'
            })
        }
    }
    await gradeTenPage.close()
}
