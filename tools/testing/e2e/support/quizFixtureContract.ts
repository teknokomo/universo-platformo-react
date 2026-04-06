import { buildVLC, computeSnapshotHash } from '@universo/utils'

export type QuizLocale = 'en' | 'ru'

export type QuizFixtureOption = {
    id: string
    label: string
}

export type QuizFixtureQuestion = {
    id: string
    prompt: string
    description: string
    difficulty: number
    multiple?: boolean
    options: QuizFixtureOption[]
    correctOptionIds: string[]
    explanation: string
}

export type QuizFixtureLocale = {
    title: string
    description: string
    submitLabel: string
    nextLabel: string
    questions: QuizFixtureQuestion[]
}

export type QuizUiCopy = {
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

export const QUIZ_FIXTURE_FILENAME = 'metahubs-quiz-app-snapshot.json'
export const QUIZ_SCRIPT_CODENAME = 'quiz-widget'
export const QUIZ_CENTERED_LAYOUT_CONFIG = {
    showFooter: false,
    showHeader: true,
    showSearch: false,
    showSideMenu: false,
    showAppNavbar: true,
    showDatePicker: false,
    showBreadcrumbs: false,
    showOptionsMenu: false,
    showProductTree: false,
    showDetailsTable: false,
    showDetailsTitle: false,
    showOverviewCards: false,
    showOverviewTitle: false,
    showRightSideMenu: false,
    showSessionsChart: false,
    showPageViewsChart: false,
    showColumnsContainer: false,
    showLanguageSwitcher: false,
    showUsersByCountryChart: false
} as const
export const QUIZ_REMOVED_LAYOUT_WIDGET_KEYS = ['detailsTable', 'detailsTitle', 'menuWidget'] as const

export const QUIZ_CANONICAL_METAHUB = {
    name: {
        en: 'Space Quiz Metahub',
        ru: 'Метахаб космической викторины'
    },
    description: {
        en: 'Canonical metahub fixture for the full scripting-powered Space Quiz experience with 10 questions, scoring, and restart flow.',
        ru: 'Канонический fixture метахаба для полноценной космической викторины на скриптах: 10 вопросов, подсчёт баллов и перезапуск.'
    },
    codename: {
        en: 'SpaceQuizMetahub',
        ru: 'МетахабКосмическойВикторины'
    }
}

export const QUIZ_PUBLICATION = {
    name: {
        en: 'Space Quiz Publication',
        ru: 'Публикация космической викторины'
    },
    versionName: {
        en: 'Space Quiz Imported Release',
        ru: 'Импортированный релиз космической викторины'
    },
    applicationName: {
        en: 'Space Quiz Application',
        ru: 'Приложение космической викторины'
    }
}

export const QUIZ_CONTENT: Record<QuizLocale, QuizFixtureLocale> = {
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

export const QUIZ_UI_COPY: Record<QuizLocale, QuizUiCopy> = {
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

export const QUIZ_I18N_LEAK_MARKERS = [
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

export const QUIZ_WIDGET_SOURCE = `const AtClient = () => () => undefined
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

const readLocalizedText = (value: unknown, locale = 'en'): string | undefined => {
    if (typeof value === 'string') {
        return value
    }
    if (!value || typeof value !== 'object') {
        return undefined
    }

    const localizedValue = value as {
        _primary?: string
        locales?: Record<string, { content?: string }>
    }

    const normalizedLocale = locale.split(/[-_]/)[0]?.toLowerCase() || 'en'
    const locales = localizedValue.locales ?? {}
    const directValue = locales[normalizedLocale]?.content
    if (typeof directValue === 'string' && directValue.length > 0) {
        return directValue
    }

    const primaryValue = localizedValue._primary ? locales[localizedValue._primary]?.content : undefined
    if (typeof primaryValue === 'string' && primaryValue.length > 0) {
        return primaryValue
    }

    const fallbackValue = Object.values(locales).find((entry) => typeof entry?.content === 'string' && entry.content.length > 0)?.content
    return typeof fallbackValue === 'string' ? fallbackValue : undefined
}

const setLocalizedContent = (value: Record<string, unknown>, locale: string, content: string) => {
    if (!value.locales || typeof value.locales !== 'object') {
        value.locales = {}
    }
    const locales = value.locales as Record<string, Record<string, unknown>>
    if (!locales[locale] || typeof locales[locale] !== 'object') {
        locales[locale] = {}
    }
    locales[locale].content = content
    if (!value._primary) {
        value._primary = locale
    }
}

const ensureLocalizedField = (container: Record<string, unknown> | null | undefined, key: string): Record<string, unknown> | null => {
    if (!container || typeof container !== 'object') {
        return null
    }
    if (!container[key] || typeof container[key] !== 'object') {
        container[key] = {
            _schema: 'v1',
            _primary: 'en',
            locales: {}
        }
    }
    return container[key] as Record<string, unknown>
}

const findDefaultLayout = (envelope: Record<string, any>) => {
    const layouts = Array.isArray(envelope?.snapshot?.layouts) ? envelope.snapshot.layouts : []
    const defaultLayoutId = envelope?.snapshot?.defaultLayoutId

    return layouts.find((layout: Record<string, any>) => layout?.id === defaultLayoutId) ?? layouts.find((layout: Record<string, any>) => layout?.isDefault) ?? layouts[0] ?? null
}

const QUIZ_REMOVED_LAYOUT_WIDGET_KEY_SET = new Set<string>(QUIZ_REMOVED_LAYOUT_WIDGET_KEYS)

const sortQuizWidgets = (widgets: Array<Record<string, any>>) =>
    [...widgets].sort((left, right) => {
        const leftKey = `${left?.layoutId ?? ''}:${left?.zone ?? ''}:${left?.widgetKey ?? ''}:${Number(left?.sortOrder ?? 0)}`
        const rightKey = `${right?.layoutId ?? ''}:${right?.zone ?? ''}:${right?.widgetKey ?? ''}:${Number(right?.sortOrder ?? 0)}`
        return leftKey.localeCompare(rightKey)
    })

export function buildQuizLiveMetahubName(_suffix?: string) {
    return { ...QUIZ_CANONICAL_METAHUB.name }
}

export function buildQuizLiveMetahubCodename(_suffix?: string) {
    return buildVLC(QUIZ_CANONICAL_METAHUB.codename.en, QUIZ_CANONICAL_METAHUB.codename.ru)
}

export function canonicalizeQuizFixtureEnvelope(envelope: Record<string, any>) {
    const nextEnvelope = JSON.parse(JSON.stringify(envelope))

    if (nextEnvelope?.metahub?.name) {
        setLocalizedContent(nextEnvelope.metahub.name, 'en', QUIZ_CANONICAL_METAHUB.name.en)
        setLocalizedContent(nextEnvelope.metahub.name, 'ru', QUIZ_CANONICAL_METAHUB.name.ru)
    }
    if (nextEnvelope?.metahub?.description) {
        setLocalizedContent(nextEnvelope.metahub.description, 'en', QUIZ_CANONICAL_METAHUB.description.en)
        setLocalizedContent(nextEnvelope.metahub.description, 'ru', QUIZ_CANONICAL_METAHUB.description.ru)
    }
    if (nextEnvelope?.metahub?.codename) {
        setLocalizedContent(nextEnvelope.metahub.codename, 'en', QUIZ_CANONICAL_METAHUB.codename.en)
        setLocalizedContent(nextEnvelope.metahub.codename, 'ru', QUIZ_CANONICAL_METAHUB.codename.ru)
    }

    if (Array.isArray(nextEnvelope?.snapshot?.scripts)) {
        nextEnvelope.snapshot.scripts = [...nextEnvelope.snapshot.scripts]
            .sort((left, right) => String(left?.codename ?? '').localeCompare(String(right?.codename ?? '')))
            .map((script) => {
                if (script?.codename !== QUIZ_SCRIPT_CODENAME) {
                    return script
                }

                return {
                    ...script,
                    attachedToKind: 'metahub',
                    attachedToId: null,
                    sourceKind: 'embedded',
                    sourceCode: QUIZ_WIDGET_SOURCE,
                    isActive: true,
                    config: script?.config && typeof script.config === 'object' ? script.config : {}
                }
            })
    }

    const defaultLayout = findDefaultLayout(nextEnvelope)
    if (defaultLayout && typeof defaultLayout === 'object') {
        const currentLayoutConfig = defaultLayout.config && typeof defaultLayout.config === 'object' ? defaultLayout.config : {}
        defaultLayout.config = {
            ...currentLayoutConfig,
            ...QUIZ_CENTERED_LAYOUT_CONFIG
        }
    }

    if (nextEnvelope?.snapshot && typeof nextEnvelope.snapshot === 'object') {
        const currentSnapshotLayoutConfig =
            nextEnvelope.snapshot.layoutConfig && typeof nextEnvelope.snapshot.layoutConfig === 'object' ? nextEnvelope.snapshot.layoutConfig : {}
        nextEnvelope.snapshot.layoutConfig = {
            ...currentSnapshotLayoutConfig,
            ...QUIZ_CENTERED_LAYOUT_CONFIG
        }
    }

    if (defaultLayout && Array.isArray(nextEnvelope?.snapshot?.layoutZoneWidgets)) {
        const canonicalWidgets = nextEnvelope.snapshot.layoutZoneWidgets.map((widget: Record<string, any>) => {
            if (widget?.layoutId !== defaultLayout.id || widget?.widgetKey !== 'quizWidget') {
                return widget
            }

            return {
                ...widget,
                zone: 'center',
                sortOrder: 1,
                config: {
                    ...(widget?.config && typeof widget.config === 'object' ? widget.config : {}),
                    attachedToKind: 'metahub',
                    scriptCodename: QUIZ_SCRIPT_CODENAME
                }
            }
        })

        nextEnvelope.snapshot.layoutZoneWidgets = sortQuizWidgets(
            canonicalWidgets.filter((widget: Record<string, any>) => {
                if (widget?.layoutId !== defaultLayout.id) {
                    return true
                }

                if (QUIZ_REMOVED_LAYOUT_WIDGET_KEY_SET.has(String(widget?.widgetKey ?? ''))) {
                    return false
                }

                return widget?.zone !== 'right'
            })
        )
    }

    if (nextEnvelope?.snapshot && typeof nextEnvelope.snapshot === 'object') {
        nextEnvelope.snapshotHash = computeSnapshotHash(nextEnvelope.snapshot)
    }

    return nextEnvelope
}

export function assertQuizFixtureEnvelopeContract(envelope: Record<string, any>) {
    const errors: string[] = []

    const metahubNameEn = readLocalizedText(envelope?.metahub?.name, 'en')
    const metahubNameRu = readLocalizedText(envelope?.metahub?.name, 'ru')
    const metahubDescriptionEn = readLocalizedText(envelope?.metahub?.description, 'en')
    const metahubDescriptionRu = readLocalizedText(envelope?.metahub?.description, 'ru')
    const metahubCodenameEn = readLocalizedText(envelope?.metahub?.codename, 'en')
    const metahubCodenameRu = readLocalizedText(envelope?.metahub?.codename, 'ru')

    if (metahubNameEn !== QUIZ_CANONICAL_METAHUB.name.en) {
        errors.push(`Unexpected quiz fixture metahub name: ${metahubNameEn ?? '<missing>'}`)
    }
    if (metahubNameRu !== QUIZ_CANONICAL_METAHUB.name.ru) {
        errors.push(`Unexpected Russian quiz fixture metahub name: ${metahubNameRu ?? '<missing>'}`)
    }
    if (metahubDescriptionEn !== QUIZ_CANONICAL_METAHUB.description.en) {
        errors.push('Quiz fixture is missing the canonical English metahub description')
    }
    if (metahubDescriptionRu !== QUIZ_CANONICAL_METAHUB.description.ru) {
        errors.push('Quiz fixture is missing the canonical Russian metahub description')
    }
    if (metahubCodenameEn !== QUIZ_CANONICAL_METAHUB.codename.en) {
        errors.push(`Unexpected quiz fixture codename: ${metahubCodenameEn ?? '<missing>'}`)
    }
    if (metahubCodenameRu !== QUIZ_CANONICAL_METAHUB.codename.ru) {
        errors.push(`Unexpected Russian quiz fixture codename: ${metahubCodenameRu ?? '<missing>'}`)
    }

    if ([metahubNameEn, metahubNameRu, metahubCodenameEn, metahubCodenameRu].some((value) => typeof value === 'string' && /e2e|runid|imported-/i.test(value))) {
        errors.push('Quiz fixture identity still contains run-specific markers')
    }

    const scripts = Array.isArray(envelope?.snapshot?.scripts) ? envelope.snapshot.scripts : []
    if (scripts.length !== 1) {
        errors.push(`Quiz fixture must contain exactly one exported script, received ${scripts.length}`)
    }

    const quizScript = scripts.find((script: Record<string, any>) => script?.codename === QUIZ_SCRIPT_CODENAME)
    if (!quizScript) {
        errors.push(`Quiz fixture is missing the canonical ${QUIZ_SCRIPT_CODENAME} script`)
    } else {
        if (quizScript.attachedToKind !== 'metahub') {
            errors.push(`Quiz fixture script must attach to metahub, received ${String(quizScript.attachedToKind)}`)
        }
        if (quizScript.attachedToId !== null) {
            errors.push('Quiz fixture script must keep a null metahub attachment id')
        }
        if (quizScript.moduleRole !== 'widget') {
            errors.push(`Quiz fixture script must keep widget moduleRole, received ${String(quizScript.moduleRole)}`)
        }
        if (quizScript.sourceKind !== 'embedded') {
            errors.push(`Quiz fixture script must keep embedded sourceKind, received ${String(quizScript.sourceKind)}`)
        }
        if (quizScript.isActive !== true) {
            errors.push('Quiz fixture script must stay active')
        }
        if (typeof quizScript.sourceCode !== 'string' || quizScript.sourceCode !== QUIZ_WIDGET_SOURCE) {
            errors.push('Quiz fixture script sourceCode drifted from the canonical quiz widget source')
        }
        if (!Array.isArray(quizScript?.manifest?.capabilities) || !quizScript.manifest.capabilities.includes('rpc.client')) {
            errors.push('Quiz fixture script manifest must include rpc.client capability')
        }
        if (typeof quizScript.serverBundle !== 'string' || quizScript.serverBundle.length === 0) {
            errors.push('Quiz fixture script is missing the server bundle')
        }
        if (typeof quizScript.clientBundle !== 'string' || quizScript.clientBundle.length === 0) {
            errors.push('Quiz fixture script is missing the client bundle')
        }
        if (typeof quizScript.checksum !== 'string' || quizScript.checksum.length === 0) {
            errors.push('Quiz fixture script is missing the checksum')
        }
    }

    const defaultLayout = findDefaultLayout(envelope)
    if (!defaultLayout) {
        errors.push('Quiz fixture is missing a default layout')
    } else {
        const defaultLayoutConfig = defaultLayout?.config && typeof defaultLayout.config === 'object' ? defaultLayout.config : {}
        if (defaultLayoutConfig.showSideMenu !== false) {
            errors.push('Quiz fixture default layout must disable the left side menu')
        }
        if (defaultLayoutConfig.showDetailsTable !== false) {
            errors.push('Quiz fixture default layout must disable the center details table')
        }
        if (defaultLayoutConfig.showDetailsTitle !== false) {
            errors.push('Quiz fixture default layout must disable the center details title')
        }
        if (defaultLayoutConfig.showRightSideMenu !== false) {
            errors.push('Quiz fixture default layout must disable the right side menu')
        }
    }

    const snapshotLayoutConfig = envelope?.snapshot?.layoutConfig && typeof envelope.snapshot.layoutConfig === 'object' ? envelope.snapshot.layoutConfig : {}
    if (snapshotLayoutConfig.showSideMenu !== false) {
        errors.push('Quiz fixture snapshot layoutConfig must disable the left side menu')
    }
    if (snapshotLayoutConfig.showDetailsTable !== false) {
        errors.push('Quiz fixture snapshot layoutConfig must disable the center details table')
    }
    if (snapshotLayoutConfig.showDetailsTitle !== false) {
        errors.push('Quiz fixture snapshot layoutConfig must disable the center details title')
    }
    if (snapshotLayoutConfig.showRightSideMenu !== false) {
        errors.push('Quiz fixture snapshot layoutConfig must disable the right side menu')
    }

    const quizWidgets = Array.isArray(envelope?.snapshot?.layoutZoneWidgets)
        ? envelope.snapshot.layoutZoneWidgets.filter(
              (widget: Record<string, any>) => widget?.widgetKey === 'quizWidget' && widget?.config?.scriptCodename === QUIZ_SCRIPT_CODENAME
          )
        : []
    if (quizWidgets.length !== 1) {
        errors.push(`Quiz fixture must contain exactly one quizWidget binding, received ${quizWidgets.length}`)
    }
    if (quizWidgets[0]?.config?.attachedToKind !== 'metahub') {
        errors.push('Quiz fixture quizWidget binding must target metahub scripts')
    }
    if (quizWidgets[0]?.zone !== 'center') {
        errors.push('Quiz fixture quizWidget binding must render in the center zone')
    }

    const defaultLayoutWidgets = Array.isArray(envelope?.snapshot?.layoutZoneWidgets)
        ? envelope.snapshot.layoutZoneWidgets.filter((widget: Record<string, any>) => widget?.layoutId === defaultLayout?.id)
        : []
    const removedWidgets = defaultLayoutWidgets.filter((widget: Record<string, any>) => QUIZ_REMOVED_LAYOUT_WIDGET_KEY_SET.has(String(widget?.widgetKey ?? '')))
    if (removedWidgets.length > 0) {
        errors.push(`Quiz fixture default layout must not keep legacy menu/details widgets, received ${removedWidgets.length}`)
    }

    const rightZoneWidgets = defaultLayoutWidgets.filter((widget: Record<string, any>) => widget?.zone === 'right')
    if (rightZoneWidgets.length > 0) {
        errors.push(`Quiz fixture default layout must not keep right-zone widgets, received ${rightZoneWidgets.length}`)
    }

    const questionCountEn = QUIZ_CONTENT.en.questions.length
    const questionCountRu = QUIZ_CONTENT.ru.questions.length
    if (questionCountEn !== 10 || questionCountRu !== 10) {
        errors.push(`Quiz contract must keep 10 questions per locale, received en=${questionCountEn}, ru=${questionCountRu}`)
    }
    if (QUIZ_CONTENT.en.questions.some((question) => question.options.length !== 4) || QUIZ_CONTENT.ru.questions.some((question) => question.options.length !== 4)) {
        errors.push('Quiz contract must keep exactly 4 answers per question in both locales')
    }

    if (errors.length > 0) {
        throw new Error(errors.join('\n'))
    }
}

export const getCorrectAnswerLabels = (question: QuizFixtureQuestion): string[] =>
    question.options.filter((option) => question.correctOptionIds.includes(option.id)).map((option) => option.label)

export const getWrongSingleChoiceAnswerLabel = (question: QuizFixtureQuestion): string => {
    if (question.multiple) {
        throw new Error(`Question ${question.id} is multiple-choice and cannot provide a single wrong answer label`)
    }

    const wrongOption = question.options.find((candidate) => !question.correctOptionIds.includes(candidate.id))
    if (!wrongOption) {
        throw new Error(`Question ${question.id} does not expose a wrong answer label`)
    }

    return wrongOption.label
}