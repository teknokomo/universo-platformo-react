import { readFileSync } from 'node:fs'
import { createLocalizedContent, generateUuidV7 } from '@universo-react/utils'

type SixthMuseOption = { id: string; text: string; isCorrect: boolean }
type SixthMuseQuestion = {
    id: string
    sourceQuestionNumber: number
    orderWithinBlock: number
    runtimePrompt: string
    verifiedCorrectOptionId: string
    verifiedCorrectAnswer: string
    options: SixthMuseOption[]
}
type SixthMuseBlock = {
    id: string
    order: number
    title: string
    introduction: string | null
    questions: SixthMuseQuestion[]
}
type SixthMuseSource = {
    datasetId: string
    title: string
    language: string
    promotionStatus: string
    quizPolicies: {
        timeLimitSeconds: number
        confirmAnswerBeforeNext: boolean
        pauseTimerOnBlockIntro: boolean
        blockRelativeNumbering: boolean
        passingScorePercent: number
        maxAttempts: number
        classKey: string | null
        guestAccess: {
            anonymousAccess: boolean
            firstNameRequired: boolean
            lastNameRequired: boolean
            captchaEnabled: boolean
            accessLinkSlugProposal: string
        }
    }
    answerPositionSchedule: {
        verifiedCorrectPositionCounts: Record<string, number>
    }
    blocks: SixthMuseBlock[]
}

export const LMS_SIXTH_MUSE_SOURCE = JSON.parse(
    readFileSync(new URL('../../../fixtures/sixth-muse/source.json', import.meta.url), 'utf8')
) as SixthMuseSource

export const LMS_SIXTH_MUSE_QUIZ_KEY = 'sixth-muse'
export const LMS_SIXTH_MUSE_QUESTION_COUNT = LMS_SIXTH_MUSE_SOURCE.blocks.reduce((count, block) => count + block.questions.length, 0)
export const LMS_SIXTH_MUSE_OPTION_COUNT = LMS_SIXTH_MUSE_SOURCE.blocks.reduce(
    (count, block) => count + block.questions.reduce((questionCount, question) => questionCount + question.options.length, 0),
    0
)
export const LMS_SIXTH_MUSE_ACCESS_LINK = {
    key: 'sixth-muse',
    slug: LMS_SIXTH_MUSE_SOURCE.quizPolicies.guestAccess.accessLinkSlugProposal,
    quizKey: LMS_SIXTH_MUSE_QUIZ_KEY,
    title: { en: 'Sixth Muse', ru: LMS_SIXTH_MUSE_SOURCE.title }
} as const

export const LMS_SIXTH_MUSE_ACCESS_POLICY = {
    isActive: true,
    maxUses: 30,
    showFirstName: true,
    requireFirstName: LMS_SIXTH_MUSE_SOURCE.quizPolicies.guestAccess.firstNameRequired,
    showLastName: true,
    requireLastName: LMS_SIXTH_MUSE_SOURCE.quizPolicies.guestAccess.lastNameRequired,
    showEmail: false,
    requireEmail: false,
    showPhone: false,
    requirePhone: false,
    captchaEnabled: LMS_SIXTH_MUSE_SOURCE.quizPolicies.guestAccess.captchaEnabled
} as const

export const buildLmsSixthMuseQuizRecord = (singleChoiceValueId: string, createId: () => string = generateUuidV7) => {
    if (LMS_SIXTH_MUSE_SOURCE.promotionStatus !== 'ready-for-generation') {
        throw new Error('Sixth Muse source has not passed its content promotion gate')
    }

    const blockKeys = new Map(LMS_SIXTH_MUSE_SOURCE.blocks.map((block) => [block.id, createId()]))
    const blocks = LMS_SIXTH_MUSE_SOURCE.blocks.map((block, index) => ({
        BlockKey: blockKeys.get(block.id),
        Title: createLocalizedContent(LMS_SIXTH_MUSE_SOURCE.language, block.title),
        Introduction: block.introduction ? createLocalizedContent(LMS_SIXTH_MUSE_SOURCE.language, block.introduction) : null,
        SortOrder: index + 1
    }))
    const questions = LMS_SIXTH_MUSE_SOURCE.blocks.flatMap((block) =>
        block.questions.map((question) => ({
            Id: question.id,
            Prompt: createLocalizedContent(LMS_SIXTH_MUSE_SOURCE.language, question.runtimePrompt),
            QuestionDescription: createLocalizedContent(LMS_SIXTH_MUSE_SOURCE.language, 'Выберите один вариант ответа.'),
            QuestionType: singleChoiceValueId,
            Difficulty: 1,
            BlockKey: blockKeys.get(block.id),
            Options: question.options.map((option) => ({
                id: createId(),
                label: createLocalizedContent(LMS_SIXTH_MUSE_SOURCE.language, option.text),
                isCorrect: option.isCorrect
            })),
            SortOrder: question.orderWithinBlock
        }))
    )

    return {
        SortOrder: 8,
        Title: createLocalizedContent(LMS_SIXTH_MUSE_SOURCE.language, LMS_SIXTH_MUSE_SOURCE.title),
        Description: createLocalizedContent(
            LMS_SIXTH_MUSE_SOURCE.language,
            'Тест по прозвищам, достижениям и судьбам лицеистов Царскосельского лицея.'
        ),
        CompletionText: createLocalizedContent(LMS_SIXTH_MUSE_SOURCE.language, 'Тест завершён. Ваш результат сохранён.'),
        PassingScorePercent: LMS_SIXTH_MUSE_SOURCE.quizPolicies.passingScorePercent,
        MaxAttempts: LMS_SIXTH_MUSE_SOURCE.quizPolicies.maxAttempts,
        TimeLimitSeconds: LMS_SIXTH_MUSE_SOURCE.quizPolicies.timeLimitSeconds,
        PauseTimerOnBlockIntro: LMS_SIXTH_MUSE_SOURCE.quizPolicies.pauseTimerOnBlockIntro,
        BlockRelativeNumbering: LMS_SIXTH_MUSE_SOURCE.quizPolicies.blockRelativeNumbering,
        ConfirmAnswerBeforeNext: LMS_SIXTH_MUSE_SOURCE.quizPolicies.confirmAnswerBeforeNext,
        Blocks: blocks,
        Questions: questions
    }
}

type LmsSixthMuseSeedRowsOptions = {
    quizRows: Array<{ id?: string; data?: Record<string, unknown> }>
    accessLinkRows: Array<{ id?: string; data?: Record<string, unknown> }>
    errors: string[]
    readLocalizedText: (value: unknown, locale?: string) => string | undefined
    assertLocalizedFixtureValue: (errors: string[], value: unknown, expected: { en: string; ru: string }, label: string) => void
}

const readRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null

const isUuidV7 = (value: unknown): value is string =>
    typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)

export function assertLmsSixthMuseSeedRowsContract({
    quizRows,
    accessLinkRows,
    errors,
    readLocalizedText,
    assertLocalizedFixtureValue
}: LmsSixthMuseSeedRowsOptions): void {
    const quizMatches = quizRows.filter(
        (row) => readLocalizedText(row.data?.Title, LMS_SIXTH_MUSE_SOURCE.language) === LMS_SIXTH_MUSE_SOURCE.title
    )
    if (quizMatches.length !== 1) {
        errors.push(`LMS fixture must contain exactly one Sixth Muse quiz row; found ${quizMatches.length}`)
        return
    }

    const quizRow = quizMatches[0]
    const data = quizRow?.data ?? {}
    if (!isUuidV7(quizRow?.id)) errors.push('LMS Sixth Muse quiz must keep its UUID v7 identity')
    if (data.TimeLimitSeconds !== LMS_SIXTH_MUSE_SOURCE.quizPolicies.timeLimitSeconds) {
        errors.push('LMS Sixth Muse quiz must keep its reviewed time limit')
    }
    if (data.PassingScorePercent !== LMS_SIXTH_MUSE_SOURCE.quizPolicies.passingScorePercent) {
        errors.push('LMS Sixth Muse quiz must keep its reviewed passing score')
    }
    if (data.MaxAttempts !== LMS_SIXTH_MUSE_SOURCE.quizPolicies.maxAttempts) errors.push('LMS Sixth Muse quiz must keep its attempt limit')
    if (data.PauseTimerOnBlockIntro !== LMS_SIXTH_MUSE_SOURCE.quizPolicies.pauseTimerOnBlockIntro) {
        errors.push('LMS Sixth Muse quiz must keep its reviewed intro timer policy')
    }
    if (data.BlockRelativeNumbering !== LMS_SIXTH_MUSE_SOURCE.quizPolicies.blockRelativeNumbering) {
        errors.push('LMS Sixth Muse quiz must keep its reviewed question numbering policy')
    }

    const blocks = Array.isArray(data.Blocks)
        ? data.Blocks.map(readRecord).filter((block): block is Record<string, unknown> => block !== null)
        : []
    if (blocks.length !== LMS_SIXTH_MUSE_SOURCE.blocks.length) {
        errors.push(`LMS Sixth Muse quiz must contain ${LMS_SIXTH_MUSE_SOURCE.blocks.length} ordered blocks`)
    }
    const blockKeys = new Set<string>()
    for (const [index, sourceBlock] of LMS_SIXTH_MUSE_SOURCE.blocks.entries()) {
        const block = blocks[index]
        if (!block) continue
        if (readLocalizedText(block.Title, LMS_SIXTH_MUSE_SOURCE.language) !== sourceBlock.title) {
            errors.push(`LMS Sixth Muse block ${index + 1} must preserve its reviewed Russian title`)
        }
        const introduction =
            sourceBlock.introduction === null ? null : readLocalizedText(block.Introduction, LMS_SIXTH_MUSE_SOURCE.language)
        if (introduction !== sourceBlock.introduction) {
            errors.push(`LMS Sixth Muse block ${index + 1} must preserve its reviewed introduction`)
        }
        if (!isUuidV7(block.BlockKey) || blockKeys.has(block.BlockKey)) {
            errors.push(`LMS Sixth Muse block ${index + 1} must use a unique UUID v7 key`)
        } else {
            blockKeys.add(block.BlockKey)
        }
        if (block.SortOrder !== index + 1) errors.push(`LMS Sixth Muse block ${index + 1} must have canonical order`)
    }

    const questions = Array.isArray(data.Questions)
        ? data.Questions.map(readRecord).filter((question): question is Record<string, unknown> => question !== null)
        : []
    if (questions.length !== LMS_SIXTH_MUSE_QUESTION_COUNT) {
        errors.push(`LMS Sixth Muse quiz must contain ${LMS_SIXTH_MUSE_QUESTION_COUNT} reviewed questions`)
    }
    const positionCounts = [0, 0, 0, 0]
    const sourceQuestions = LMS_SIXTH_MUSE_SOURCE.blocks.flatMap((block) => block.questions)
    for (const [index, sourceQuestion] of sourceQuestions.entries()) {
        const question = questions[index]
        if (!question) continue
        if (readLocalizedText(question.Prompt, LMS_SIXTH_MUSE_SOURCE.language) !== sourceQuestion.runtimePrompt) {
            errors.push(`LMS Sixth Muse question ${index + 1} must preserve its reviewed runtime prompt`)
        }
        const sourceBlock = LMS_SIXTH_MUSE_SOURCE.blocks.find((block) => block.questions.includes(sourceQuestion))
        const expectedBlockKey = sourceBlock ? blocks[LMS_SIXTH_MUSE_SOURCE.blocks.indexOf(sourceBlock)]?.BlockKey : null
        if (question.BlockKey !== expectedBlockKey) errors.push(`LMS Sixth Muse question ${index + 1} must reference its source block`)
        if (question.SortOrder !== sourceQuestion.orderWithinBlock) {
            errors.push(`LMS Sixth Muse question ${index + 1} must preserve its order within the block`)
        }
        const options = Array.isArray(question.Options)
            ? question.Options.map(readRecord).filter((option): option is Record<string, unknown> => option !== null)
            : []
        if (options.length !== 4) errors.push(`LMS Sixth Muse question ${index + 1} must have four options`)
        if (options.some((option) => !isUuidV7(option.id)))
            errors.push(`LMS Sixth Muse question ${index + 1} options must use UUID v7 identities`)
        if (new Set(options.map((option) => option.id)).size !== options.length) {
            errors.push(`LMS Sixth Muse question ${index + 1} option identities must be unique`)
        }
        const correctOptions = options.filter((option) => option.isCorrect === true)
        if (correctOptions.length !== 1) errors.push(`LMS Sixth Muse question ${index + 1} must have one correct answer`)
        const correctIndex = options.findIndex((option) => option.isCorrect === true)
        if (correctIndex >= 0) positionCounts[correctIndex] += 1
        if (readLocalizedText(correctOptions[0]?.label, LMS_SIXTH_MUSE_SOURCE.language) !== sourceQuestion.verifiedCorrectAnswer) {
            errors.push(`LMS Sixth Muse question ${index + 1} must preserve its verified correct answer`)
        }
        if (
            options.some(
                (option) =>
                    !sourceQuestion.options.some(
                        (sourceOption) => sourceOption.text === readLocalizedText(option.label, LMS_SIXTH_MUSE_SOURCE.language)
                    )
            )
        ) {
            errors.push(`LMS Sixth Muse question ${index + 1} contains an answer option outside its reviewed source`)
        }
    }
    const expectedPositions = [1, 2, 3, 4].map(
        (position) => LMS_SIXTH_MUSE_SOURCE.answerPositionSchedule.verifiedCorrectPositionCounts[String(position)]
    )
    if (JSON.stringify(positionCounts) !== JSON.stringify(expectedPositions)) {
        errors.push('LMS Sixth Muse correct answer positions must match the reviewed balanced schedule')
    }

    const linkMatches = accessLinkRows.filter((row) => row.data?.Slug === LMS_SIXTH_MUSE_ACCESS_LINK.slug)
    if (linkMatches.length !== 1) {
        errors.push('LMS fixture must contain exactly one Sixth Muse guest access link')
        return
    }
    const link = linkMatches[0]
    if (!isUuidV7(link?.id)) errors.push('LMS Sixth Muse access link must keep its UUID v7 identity')
    if (link?.data?.TargetType !== 'quiz' || link.data.TargetId !== quizRow?.id || link.data.LinkClassId !== null) {
        errors.push('LMS Sixth Muse access link must target the new quiz without assigning a class')
    }
    for (const [field, expected] of [
        ['IsActive', LMS_SIXTH_MUSE_ACCESS_POLICY.isActive],
        ['MaxUses', LMS_SIXTH_MUSE_ACCESS_POLICY.maxUses],
        ['ShowFirstName', LMS_SIXTH_MUSE_ACCESS_POLICY.showFirstName],
        ['RequireFirstName', LMS_SIXTH_MUSE_ACCESS_POLICY.requireFirstName],
        ['ShowLastName', LMS_SIXTH_MUSE_ACCESS_POLICY.showLastName],
        ['RequireLastName', LMS_SIXTH_MUSE_ACCESS_POLICY.requireLastName],
        ['ShowEmail', LMS_SIXTH_MUSE_ACCESS_POLICY.showEmail],
        ['RequireEmail', LMS_SIXTH_MUSE_ACCESS_POLICY.requireEmail],
        ['ShowPhone', LMS_SIXTH_MUSE_ACCESS_POLICY.showPhone],
        ['RequirePhone', LMS_SIXTH_MUSE_ACCESS_POLICY.requirePhone],
        ['CaptchaEnabled', LMS_SIXTH_MUSE_ACCESS_POLICY.captchaEnabled]
    ] as const) {
        if (link?.data?.[field] !== expected) errors.push(`LMS Sixth Muse access link must keep ${field}=${String(expected)}`)
    }
    assertLocalizedFixtureValue(errors, link?.data?.LinkTitle, LMS_SIXTH_MUSE_ACCESS_LINK.title, 'LMS Sixth Muse access link title')
}
