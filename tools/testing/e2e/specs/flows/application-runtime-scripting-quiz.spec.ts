import { createLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    createLoggedInApiContext,
    createMetahub,
    createFieldDefinition,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    disposeApiContext,
    getLayout,
    listLayoutZoneWidgets,
    listLayouts,
    listLinkedCollections,
    sendWithCsrf,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { QUIZ_CENTERED_LAYOUT_CONFIG, QUIZ_REMOVED_LAYOUT_WIDGET_KEYS } from '../../support/quizFixtureContract'

type QuizLocale = 'en' | 'ru'

type QuizFixtureOption = {
    id: string
    label: string
}

type QuizFixtureQuestion = {
    id: string
    prompt: string
    description: string
    difficulty: number
    multiple?: boolean
    options: QuizFixtureOption[]
    correctOptionIds: string[]
    explanation: string
}

type QuizFixtureLocale = {
    title: string
    description: string
    submitLabel: string
    nextLabel: string
    questions: QuizFixtureQuestion[]
}

type QuizUiCopy = {
    resetLabel: string
    previousQuestionLabel: string
    backToQuestionsLabel: string
    completeLabel: string
    explanationLabel: string
    incorrectMessage: string
    perfectScoreMessage: string
    questionOf(current: number, total: number): string
    currentScore(score: number, total: number): string
    scoreSummary(score: number, total: number): string
}

const QUIZ_CONTENT: Record<QuizLocale, QuizFixtureLocale> = {
    en: {
        title: 'Space Quiz',
        description: 'Answer ten astronomy questions one by one. Correct answers move you forward automatically.',
        submitLabel: 'Check answer',
        nextLabel: 'Next question',
        questions: [
            {
                id: 'q1',
                prompt: 'Which planet is known as the Red Planet?',
                description: 'Think about the rusty world explored by many rovers.',
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
                difficulty: 1,
                options: [
                    { id: 'a', label: 'Earth' },
                    { id: 'b', label: 'The Moon' },
                    { id: 'c', label: 'Mars' },
                    { id: 'd', label: 'Io' }
                ],
                correctOptionIds: ['c'],
                explanation: 'Olympus Mons is a giant shield volcano on Mars, towering far above Everest.'
            },
            {
                id: 'q3',
                prompt: 'The Great Red Spot is a storm on which planet?',
                description: 'This world is the largest planet in the Solar System.',
                difficulty: 1,
                options: [
                    { id: 'a', label: 'Saturn' },
                    { id: 'b', label: 'Jupiter' },
                    { id: 'c', label: 'Neptune' },
                    { id: 'd', label: 'Uranus' }
                ],
                correctOptionIds: ['b'],
                explanation: "The Great Red Spot is a long-lived storm system in Jupiter's atmosphere."
            },
            {
                id: 'q4',
                prompt: 'Which mission first landed humans on the Moon?',
                description: 'It carried Neil Armstrong and Buzz Aldrin to the lunar surface.',
                difficulty: 1,
                options: [
                    { id: 'a', label: 'Apollo 8' },
                    { id: 'b', label: 'Apollo 11' },
                    { id: 'c', label: 'Apollo 13' },
                    { id: 'd', label: 'Gemini 4' }
                ],
                correctOptionIds: ['b'],
                explanation: 'Apollo 11 completed the first crewed lunar landing in July 1969.'
            },
            {
                id: 'q5',
                prompt: 'What is at the center of our Solar System?',
                description: 'Every planet in our system orbits this star.',
                difficulty: 1,
                options: [
                    { id: 'a', label: 'The Moon' },
                    { id: 'b', label: 'Polaris' },
                    { id: 'c', label: 'The Sun' },
                    { id: 'd', label: 'Sagittarius A*' }
                ],
                correctOptionIds: ['c'],
                explanation: "The Sun contains almost all of the Solar System's mass and anchors its orbits."
            },
            {
                id: 'q6',
                prompt: 'Which planet is most famous for its bright ring system?',
                description: 'Several gas giants have rings, but one is the classic example.',
                difficulty: 1,
                options: [
                    { id: 'a', label: 'Jupiter' },
                    { id: 'b', label: 'Saturn' },
                    { id: 'c', label: 'Mars' },
                    { id: 'd', label: 'Mercury' }
                ],
                correctOptionIds: ['b'],
                explanation: "Saturn's icy rings are the most extensive and visually striking in the Solar System."
            },
            {
                id: 'q7',
                prompt: 'What protects Earth from much of the solar wind?',
                description: 'Without it, charged particles would strip away much more of our atmosphere.',
                difficulty: 2,
                options: [
                    { id: 'a', label: 'Its magnetic field' },
                    { id: 'b', label: 'The asteroid belt' },
                    { id: 'c', label: 'Ocean tides' },
                    { id: 'd', label: "The Moon's gravity" }
                ],
                correctOptionIds: ['a'],
                explanation: "Earth's magnetosphere deflects many charged particles streaming from the Sun."
            },
            {
                id: 'q8',
                prompt: 'Which space observatory primarily studies the universe in infrared light?',
                description: 'Its segmented mirror was designed to see through cosmic dust.',
                difficulty: 2,
                options: [
                    { id: 'a', label: 'Hubble Space Telescope' },
                    { id: 'b', label: 'James Webb Space Telescope' },
                    { id: 'c', label: 'Chandra X-ray Observatory' },
                    { id: 'd', label: 'Kepler Space Telescope' }
                ],
                correctOptionIds: ['b'],
                explanation: 'The James Webb Space Telescope is optimized for infrared observations.'
            },
            {
                id: 'q9',
                prompt: 'Which spacecraft is widely recognized as the first human-made object to enter interstellar space?',
                description: 'It launched in 1977 and still sends data today.',
                difficulty: 3,
                options: [
                    { id: 'a', label: 'Pioneer 10' },
                    { id: 'b', label: 'Voyager 2' },
                    { id: 'c', label: 'Voyager 1' },
                    { id: 'd', label: 'New Horizons' }
                ],
                correctOptionIds: ['c'],
                explanation: 'Voyager 1 crossed into interstellar space in 2012, ahead of Voyager 2.'
            },
            {
                id: 'q10',
                prompt: 'Which two planets are classified as ice giants?',
                description: 'Select two answers.',
                difficulty: 3,
                multiple: true,
                options: [
                    { id: 'a', label: 'Jupiter' },
                    { id: 'b', label: 'Saturn' },
                    { id: 'c', label: 'Uranus' },
                    { id: 'd', label: 'Neptune' }
                ],
                correctOptionIds: ['c', 'd'],
                explanation:
                    'Uranus and Neptune are called ice giants because their interiors contain more water, ammonia, and methane ices than Jupiter or Saturn.'
            }
        ]
    },
    ru: {
        title: 'Космическая викторина',
        description: 'Ответьте по очереди на десять вопросов по астрономии. После правильного ответа виджет автоматически перейдёт дальше.',
        submitLabel: 'Проверить ответ',
        nextLabel: 'Следующий вопрос',
        questions: [
            {
                id: 'q1',
                prompt: 'Какую планету называют Красной планетой?',
                description: 'Подумайте о ржаво-красном мире, который исследуют марсоходы.',
                difficulty: 1,
                options: [
                    { id: 'a', label: 'Венера' },
                    { id: 'b', label: 'Марс' },
                    { id: 'c', label: 'Меркурий' },
                    { id: 'd', label: 'Юпитер' }
                ],
                correctOptionIds: ['b'],
                explanation: 'Марс кажется красным из-за богатой железом пыли на поверхности, которая окисляется как ржавчина.'
            },
            {
                id: 'q2',
                prompt: 'Где находится Олимп Монс?',
                description: 'Это самый высокий известный вулкан в Солнечной системе.',
                difficulty: 1,
                options: [
                    { id: 'a', label: 'На Земле' },
                    { id: 'b', label: 'На Луне' },
                    { id: 'c', label: 'На Марсе' },
                    { id: 'd', label: 'На Ио' }
                ],
                correctOptionIds: ['c'],
                explanation: 'Олимп Монс — гигантский щитовой вулкан на Марсе, намного выше Эвереста.'
            },
            {
                id: 'q3',
                prompt: 'На какой планете находится Большое красное пятно?',
                description: 'Это крупнейшая планета Солнечной системы.',
                difficulty: 1,
                options: [
                    { id: 'a', label: 'Сатурн' },
                    { id: 'b', label: 'Юпитер' },
                    { id: 'c', label: 'Нептун' },
                    { id: 'd', label: 'Уран' }
                ],
                correctOptionIds: ['b'],
                explanation: 'Большое красное пятно — это долгоживущий шторм в атмосфере Юпитера.'
            },
            {
                id: 'q4',
                prompt: 'Какая миссия первой высадила людей на Луну?',
                description: 'Именно она доставила Нила Армстронга и Базза Олдрина на лунную поверхность.',
                difficulty: 1,
                options: [
                    { id: 'a', label: 'Apollo 8' },
                    { id: 'b', label: 'Apollo 11' },
                    { id: 'c', label: 'Apollo 13' },
                    { id: 'd', label: 'Gemini 4' }
                ],
                correctOptionIds: ['b'],
                explanation: 'Apollo 11 совершила первую пилотируемую посадку на Луну в июле 1969 года.'
            },
            {
                id: 'q5',
                prompt: 'Что находится в центре нашей Солнечной системы?',
                description: 'Все планеты обращаются вокруг этой звезды.',
                difficulty: 1,
                options: [
                    { id: 'a', label: 'Луна' },
                    { id: 'b', label: 'Полярная звезда' },
                    { id: 'c', label: 'Солнце' },
                    { id: 'd', label: 'Стрелец A*' }
                ],
                correctOptionIds: ['c'],
                explanation: 'Солнце содержит почти всю массу Солнечной системы и удерживает планеты на орбитах.'
            },
            {
                id: 'q6',
                prompt: 'Какая планета больше всего известна своей яркой системой колец?',
                description: 'Кольца есть у нескольких газовых гигантов, но именно эта планета стала классическим примером.',
                difficulty: 1,
                options: [
                    { id: 'a', label: 'Юпитер' },
                    { id: 'b', label: 'Сатурн' },
                    { id: 'c', label: 'Марс' },
                    { id: 'd', label: 'Меркурий' }
                ],
                correctOptionIds: ['b'],
                explanation: 'Ледяные кольца Сатурна — самые обширные и заметные в Солнечной системе.'
            },
            {
                id: 'q7',
                prompt: 'Что защищает Землю от значительной части солнечного ветра?',
                description: 'Без этого слоя заряжённые частицы гораздо сильнее разрушали бы атмосферу.',
                difficulty: 2,
                options: [
                    { id: 'a', label: 'Магнитное поле' },
                    { id: 'b', label: 'Пояс астероидов' },
                    { id: 'c', label: 'Океанские приливы' },
                    { id: 'd', label: 'Гравитация Луны' }
                ],
                correctOptionIds: ['a'],
                explanation: 'Магнитосфера Земли отклоняет значительную часть заряжённых частиц, летящих от Солнца.'
            },
            {
                id: 'q8',
                prompt: 'Какая космическая обсерватория в основном изучает Вселенную в инфракрасном диапазоне?',
                description: 'Её сегментированное зеркало создано для наблюдений сквозь космическую пыль.',
                difficulty: 2,
                options: [
                    { id: 'a', label: 'Космический телескоп Хаббл' },
                    { id: 'b', label: 'Космический телескоп Джеймса Уэбба' },
                    { id: 'c', label: 'Рентгеновская обсерватория Чандра' },
                    { id: 'd', label: 'Космический телескоп Кеплер' }
                ],
                correctOptionIds: ['b'],
                explanation: 'Телескоп Джеймса Уэбба оптимизирован именно для инфракрасных наблюдений.'
            },
            {
                id: 'q9',
                prompt: 'Какой аппарат обычно считают первым рукотворным объектом, вошедшим в межзвёздное пространство?',
                description: 'Он был запущен в 1977 году и до сих пор передаёт данные.',
                difficulty: 3,
                options: [
                    { id: 'a', label: 'Pioneer 10' },
                    { id: 'b', label: 'Voyager 2' },
                    { id: 'c', label: 'Voyager 1' },
                    { id: 'd', label: 'New Horizons' }
                ],
                correctOptionIds: ['c'],
                explanation: 'Voyager 1 пересёк границу межзвёздного пространства в 2012 году, раньше Voyager 2.'
            },
            {
                id: 'q10',
                prompt: 'Какие две планеты относятся к ледяным гигантам?',
                description: 'Выберите два ответа.',
                difficulty: 3,
                multiple: true,
                options: [
                    { id: 'a', label: 'Юпитер' },
                    { id: 'b', label: 'Сатурн' },
                    { id: 'c', label: 'Уран' },
                    { id: 'd', label: 'Нептун' }
                ],
                correctOptionIds: ['c', 'd'],
                explanation:
                    'Уран и Нептун называют ледяными гигантами, потому что в их недрах больше воды, аммиака и метановых льдов, чем у Юпитера или Сатурна.'
            }
        ]
    }
}

const QUIZ_UI_COPY: Record<QuizLocale, QuizUiCopy> = {
    en: {
        resetLabel: 'Restart',
        previousQuestionLabel: 'Previous question',
        backToQuestionsLabel: 'Back to questions',
        completeLabel: 'Quiz complete!',
        explanationLabel: 'Explanation',
        incorrectMessage: 'Not quite yet.',
        perfectScoreMessage: 'Excellent! You really know your space.',
        questionOf: (current, total) => `Question ${current} of ${total}`,
        currentScore: (score, total) => `Current score: ${score} / ${total}`,
        scoreSummary: (score, total) => `Score: ${score} / ${total}`
    },
    ru: {
        resetLabel: 'Начать заново',
        previousQuestionLabel: 'Предыдущий вопрос',
        backToQuestionsLabel: 'Вернуться к вопросам',
        completeLabel: 'Викторина завершена!',
        explanationLabel: 'Пояснение',
        incorrectMessage: 'Пока неверно.',
        perfectScoreMessage: 'Отлично! Вы действительно хорошо знаете космос.',
        questionOf: (current, total) => `Вопрос ${current} из ${total}`,
        currentScore: (score, total) => `Текущий результат: ${score} / ${total}`,
        scoreSummary: (score, total) => `Результат: ${score} / ${total}`
    }
}

const QUIZ_I18N_LEAK_MARKERS = [
    'quiz.defaultTitle',
    'quiz.questionOf',
    'quiz.currentScore',
    'quiz.scoreSummary',
    'quiz.previousQuestion',
    'quiz.backToQuestions',
    'questionOf',
    'currentScore',
    'scoreSummary',
    'previousQuestion',
    'backToQuestions'
]

const QUIZ_WIDGET_SOURCE = `const AtClient = () => () => undefined
const AtServer = () => () => undefined

class ExtensionScript {}

const QUIZ_DATA = ${JSON.stringify(QUIZ_CONTENT)}

const normalizeLocale = (locale) => (typeof locale === 'string' && locale.toLowerCase().startsWith('ru') ? 'ru' : 'en')

const sortSelection = (value) => (Array.isArray(value) ? value.map((item) => String(item)).sort() : [])

const isSameSelection = (selected, correct) => {
    if (selected.length !== correct.length) {
        return false
    }

    return selected.every((item, index) => item === correct[index])
}

const buildQuizDefinition = (localeInput) => {
    const locale = normalizeLocale(localeInput)

    return QUIZ_DATA[locale] || QUIZ_DATA.en
}

export default class SpaceQuizWidget extends ExtensionScript {
    @AtClient()
    async mount(locale = 'en') {
        return this.ctx.callServerMethod('getQuiz', [{ locale }])
    }

    @AtServer()
    async getQuiz(payload) {
        const quiz = buildQuizDefinition(payload?.locale)

        return {
            title: quiz.title,
            description: quiz.description,
            submitLabel: quiz.submitLabel,
            nextLabel: quiz.nextLabel,
            questions: quiz.questions.map((question) => ({
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
        const quiz = buildQuizDefinition(payload?.locale)
        const locale = normalizeLocale(payload?.locale)
        const questionId = typeof payload?.questionId === 'string' ? payload.questionId : ''
        const question = quiz.questions.find((item) => item.id === questionId)

        if (!question) {
            return {
                questionId,
                correct: false,
                score: 0,
                total: quiz.questions.length,
                completed: false,
                message: locale === 'ru' ? 'Вопрос не найден. Обновите квиз и попробуйте снова.' : 'Question not found. Refresh the quiz and try again.',
                correctOptionIds: {}
            }
        }

        const responses = payload?.responses && typeof payload.responses === 'object' ? payload.responses : {}
        const selectedAnswerIds = sortSelection(payload?.answerIds)
        const normalizedCorrect = sortSelection(question.correctOptionIds)
        const correct = isSameSelection(selectedAnswerIds, normalizedCorrect)

        let score = 0
        let answeredCount = 0

        for (const candidate of quiz.questions) {
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
            total: quiz.questions.length,
            completed: answeredCount >= quiz.questions.length,
            message: correct ? (locale === 'ru' ? 'Верно!' : 'Correct!') : locale === 'ru' ? 'Пока неверно.' : 'Not quite yet.',
            explanation: question.explanation,
            correctOptionIds: {
                [question.id]: normalizedCorrect
            }
        }
    }
}
`

const getCorrectAnswerLabels = (question: QuizFixtureQuestion): string[] =>
    question.options.filter((option) => question.correctOptionIds.includes(option.id)).map((option) => option.label)

const getWrongSingleChoiceAnswerLabel = (question: QuizFixtureQuestion): string => {
    if (question.multiple) {
        throw new Error(`Question ${question.id} is multiple-choice and cannot provide a single wrong answer label`)
    }

    const option = question.options.find((candidate) => !question.correctOptionIds.includes(candidate.id))
    if (!option) {
        throw new Error(`Question ${question.id} does not expose a wrong answer label`)
    }

    return option.label
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
        await expect(options.page.getByText(question.prompt)).toBeVisible({ timeout: 30_000 })

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

async function expectJsonResponse(response: Response, label: string) {
    const text = await response.text()
    const payload = text ? JSON.parse(text) : null

    if (!response.ok) {
        throw new Error(`${label} failed with ${response.status} ${response.statusText}: ${text}`)
    }

    return payload
}

async function waitForLayoutId(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, metahubId: string) {
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

async function applyCenteredQuizLayout(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, metahubId: string, layoutId: string) {
    const layout = await getLayout(api, metahubId, layoutId)
    const currentConfig = layout?.config && typeof layout.config === 'object' ? layout.config : {}
    const removableWidgetKeys = new Set<string>(QUIZ_REMOVED_LAYOUT_WIDGET_KEYS)

    await expectJsonResponse(
        await sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahubId}/layout/${layoutId}`, {
            name: layout?.name,
            namePrimaryLocale: layout?.name?._primary ?? 'en',
            description: layout?.description,
            descriptionPrimaryLocale: layout?.description?._primary ?? 'en',
            config: {
                ...currentConfig,
                ...QUIZ_CENTERED_LAYOUT_CONFIG
            }
        }),
        'Applying centered quiz layout config'
    )

    const zoneWidgets = await listLayoutZoneWidgets(api, metahubId, layoutId)
    for (const widget of zoneWidgets?.items?.filter((item) => removableWidgetKeys.has(String(item?.widgetKey ?? ''))) ?? []) {
        const removeResponse = await sendWithCsrf(api, 'DELETE', `/api/v1/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widget.id}`)
        expect(removeResponse.status).toBe(204)
    }
}

async function waitForCatalogId(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, metahubId: string) {
    let catalogId: string | undefined

    await expect
        .poll(async () => {
            const response = await listLinkedCollections(api, metahubId, { limit: 100, offset: 0 })
            catalogId = response?.items?.[0]?.id
            return typeof catalogId === 'string'
        })
        .toBe(true)

    if (!catalogId) {
        throw new Error(`No catalog was returned for metahub ${metahubId}`)
    }

    return catalogId
}

test('@flow quiz widget scripts publish into runtime and execute through the real /a browser surface', async ({ page, runManifest }) => {
    test.setTimeout(180_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} scripting quiz metahub`
    const metahubCodename = `${runManifest.runId}-scripting-quiz`
    const publicationName = `E2E ${runManifest.runId} Scripting Quiz Publication`
    const applicationName = `E2E ${runManifest.runId} Scripting Quiz Application`
    const scriptCodename = 'quiz-widget'

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for scripting quiz coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        const catalogId = await waitForCatalogId(api, metahub.id)
        const layoutId = await waitForLayoutId(api, metahub.id)

        await createFieldDefinition(api, metahub.id, catalogId, {
            name: { en: 'Title' },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', 'title'),
            dataType: 'STRING',
            isRequired: false
        })

        await applyCenteredQuizLayout(api, metahub.id, layoutId)

        await expectJsonResponse(
            await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahub.id}/scripts`, {
                codename: scriptCodename,
                name: 'Quiz widget',
                description: 'Runtime scripting quiz widget',
                attachedToKind: 'metahub',
                attachedToId: null,
                moduleRole: 'widget',
                sourceKind: 'embedded',
                capabilities: ['rpc.client'],
                sourceCode: QUIZ_WIDGET_SOURCE,
                isActive: true
            }),
            'Creating metahub script'
        )

        await expectJsonResponse(
            await sendWithCsrf(api, 'PUT', `/api/v1/metahub/${metahub.id}/layout/${layoutId}/zone-widget`, {
                zone: 'center',
                widgetKey: 'quizWidget',
                config: {
                    attachedToKind: 'metahub',
                    scriptCodename
                }
            }),
            'Assigning quiz widget to layout'
        )

        await expect
            .poll(async () => {
                const response = await listLayoutZoneWidgets(api, metahub.id, layoutId)
                const items = response?.items ?? []
                const quizWidget = items.find((item) => item.widgetKey === 'quizWidget' && item.config?.scriptCodename === scriptCodename)
                const removableWidgetKeys = new Set<string>(QUIZ_REMOVED_LAYOUT_WIDGET_KEYS)
                const hasLegacyWidgets = items.some((item) => removableWidgetKeys.has(String(item?.widgetKey ?? '')))
                const hasRightZoneWidgets = items.some((item) => item.zone === 'right')

                return quizWidget?.zone === 'center' && !hasLegacyWidgets && !hasRightZoneWidgets
            })
            .toBe(true)

        const publication = await createPublication(api, metahub.id, {
            name: { en: publicationName },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })

        if (!publication?.id) {
            throw new Error('Publication creation did not return an id for scripting quiz coverage')
        }

        await recordCreatedPublication({
            id: publication.id,
            metahubId: metahub.id,
            schemaName: publication.schemaName
        })

        await createPublicationVersion(api, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} Scripting Quiz Version` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, metahub.id, publication.id)
        await waitForPublicationReady(api, metahub.id, publication.id)

        const linkedApplication = await createPublicationLinkedApplication(api, metahub.id, publication.id, {
            name: { en: applicationName },
            namePrimaryLocale: 'en',
            createApplicationSchema: false,
            workspacesEnabled: false
        })

        const applicationId = linkedApplication?.application?.id
        if (typeof applicationId !== 'string') {
            throw new Error('Linked application creation did not return an id for scripting quiz coverage')
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

        const listScriptsPayload = await listScriptsResponse.json()
        const selectedScript = listScriptsPayload?.items?.find((item) => item.codename === scriptCodename)
        expect(selectedScript?.clientBundle ?? null).toBeNull()
        expect(selectedScript?.serverBundle ?? null).toBeNull()

        await test.step('English runtime flow proves scoring semantics and backward navigation', async () => {
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
            await assertNoQuizI18nKeyLeak(page)

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

        await test.step('Russian runtime flow proves localized copy integrity and final result rendering', async () => {
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
    } finally {
        await disposeApiContext(api)
    }
})
