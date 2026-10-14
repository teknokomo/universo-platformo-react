import { readFileSync } from 'node:fs'
import { buildVLC, createLocalizedContent } from '@universo-react/utils'

interface MarathonSourceOption {
    id: string
    text: string
    isCorrect: boolean
    sourceNumber: number
}

interface MarathonSourceQuestion {
    id: string
    number: number
    language: string
    prompt: string
    answer: string
    correctPosition: number
    options: MarathonSourceOption[]
    source: {
        openAnswerBlock: { prompt: string; answer: string }
        preparedMultipleChoiceBlock: {
            prompt: string
            options: Array<{ text: string; markedCorrectInSource: boolean }>
        }
    }
    edits: Array<{ field: string; evidenceRef?: string }>
    reviewNotes: string[]
}

const lyceumMarathonSource = JSON.parse(
    readFileSync(new URL('../../../fixtures/lyceum-marathon/source.json', import.meta.url), 'utf8')
) as {
    datasetId: string
    language: string
    correctPositionAlgorithm: { version: string }
    grades: Array<{ grade: number; questions: MarathonSourceQuestion[] }>
}

export const LMS_LYCEUM_MARATHON_SOURCE_LANGUAGE = lyceumMarathonSource.language
export const LMS_LYCEUM_MARATHON_POSITION_ALGORITHM_VERSION = lyceumMarathonSource.correctPositionAlgorithm.version
export const LMS_LYCEUM_MARATHON_QUIZ_COUNT = 7
export const LMS_LYCEUM_MARATHON_QUESTION_COUNT = 210
export const LMS_LYCEUM_MARATHON_OPTION_COUNT = 840
export const LMS_LYCEUM_MARATHON_TIME_LIMIT_SECONDS = 2700
export const LMS_LYCEUM_MARATHON_SEEDED_RESULT_COUNTS = {
    guestStudents: 0,
    quizAttempts: 0,
    quizResponses: 0
} as const

export const LMS_LYCEUM_MARATHON_REVIEWED_ANSWER_KEYS = [
    {
        id: 'lm-g11-q06',
        grade: 11,
        number: 6,
        answer: 'Високосный',
        evidenceRef: 'https://folklife.si.edu/magazine/leap-day-origins-lore'
    },
    {
        id: 'lm-g11-q10',
        grade: 11,
        number: 10,
        answer: 'После смерти',
        evidenceRef:
            'https://www.thebritishacademy.ac.uk/publishing/journal-british-academy/5/burial-mounds-scythian-elites-eurasian-steppe-new-discoveries/'
    }
] as const

const LMS_LYCEUM_MARATHON_RESOLVED_ATTRIBUTION_REVIEW = {
    id: 'lm-g10-q03',
    prompt: 'Кому приписывают слова: «Фельдмаршала на солдат не меняю»?',
    answer: 'Сталину',
    note: 'The source attributes the phrase to Stalin; research describes the attribution as uncertain/disputed. The corrected wording asks whom it is attributed to, not whether Stalin is verified to have said it.'
} as const

const isResolvedAttributionReview = (question: MarathonSourceQuestion): boolean =>
    question.id === LMS_LYCEUM_MARATHON_RESOLVED_ATTRIBUTION_REVIEW.id &&
    question.prompt === LMS_LYCEUM_MARATHON_RESOLVED_ATTRIBUTION_REVIEW.prompt &&
    question.answer === LMS_LYCEUM_MARATHON_RESOLVED_ATTRIBUTION_REVIEW.answer &&
    question.reviewNotes.length === 1 &&
    question.reviewNotes[0] === LMS_LYCEUM_MARATHON_RESOLVED_ATTRIBUTION_REVIEW.note

export const LMS_LYCEUM_MARATHON_CLASSES = lyceumMarathonSource.grades.map(({ grade }) => ({
    key: `lyceum-grade-${grade}`,
    grade,
    name: {
        en: `Lyceum Marathon — Grade ${grade}`,
        ru: `Интеллектуальный марафон «Лицей» — ${grade} класс`
    },
    description: {
        en: `Grade ${grade} cohort for the Lyceum Intellectual Marathon.`,
        ru: `Класс ${grade} для интеллектуального марафона «Лицей».`
    },
    schoolYear: '2026/2027',
    studentCountLimit: 30
}))

const legacyContentQuizKeysByGrade: Record<number, string> = {
    5: 'learning-path',
    6: 'docking-corridor',
    7: 'lunar-logistics'
}

export const LMS_LYCEUM_MARATHON_QUIZZES = lyceumMarathonSource.grades.map(({ grade, questions }) => ({
    key: legacyContentQuizKeysByGrade[grade] ?? `lyceum-marathon-grade-${grade}`,
    grade,
    classKey: `lyceum-grade-${grade}`,
    sourceLanguage: LMS_LYCEUM_MARATHON_SOURCE_LANGUAGE,
    title: {
        en: `Lyceum Intellectual Marathon — Grade ${grade}`,
        ru: `Интеллектуальный марафон «Лицей» — ${grade} класс`
    },
    description: {
        en: `30 questions from the Russian-language Lyceum Intellectual Marathon source for grade ${grade}.`,
        ru: `30 вопросов интеллектуального марафона «Лицей» из русскоязычного источника для ${grade} класса.`
    },
    completionText: {
        en: 'Thank you for completing the Lyceum Intellectual Marathon.',
        ru: 'Спасибо, что прошли интеллектуальный марафон «Лицей».'
    },
    passingScorePercent: 50,
    maxAttempts: 3,
    timeLimitSeconds: LMS_LYCEUM_MARATHON_TIME_LIMIT_SECONDS,
    questions: questions.map((sourceQuestion) => ({
        id: sourceQuestion.id,
        number: sourceQuestion.number,
        prompt: createLocalizedContent('ru', sourceQuestion.prompt),
        answer: sourceQuestion.answer,
        correctPosition: sourceQuestion.correctPosition,
        sourceQuestion,
        description: buildVLC('Choose one answer.', 'Выберите один вариант.'),
        sortOrder: sourceQuestion.number,
        options: sourceQuestion.options.map((sourceOption) => ({
            id: sourceOption.id,
            text: sourceOption.text,
            sourceOption,
            label: createLocalizedContent('ru', sourceOption.text),
            isCorrect: sourceOption.isCorrect
        }))
    }))
}))

export const LMS_LYCEUM_MARATHON_ACCESS_POLICY = {
    isActive: true,
    maxUses: 30,
    showFirstName: true,
    requireFirstName: true,
    showLastName: true,
    requireLastName: true,
    showEmail: false,
    requireEmail: false,
    showPhone: false,
    requirePhone: false,
    captchaEnabled: false
} as const

export const LMS_LYCEUM_MARATHON_ACCESS_LINKS = LMS_LYCEUM_MARATHON_QUIZZES.map((quiz) => ({
    key: `lyceum-marathon-grade-${quiz.grade}`,
    slug: `lyceum-marathon-grade-${quiz.grade}`,
    title: {
        en: `Lyceum Marathon — Grade ${quiz.grade}`,
        ru: `Марафон «Лицей» — ${quiz.grade} класс`
    },
    quizKey: quiz.key,
    classKey: quiz.classKey
}))

export type LmsMarathonSnapshotRow = { id?: string; data?: Record<string, unknown> }

type LmsMarathonRowContractOptions = {
    quizRows: LmsMarathonSnapshotRow[]
    accessLinkRows: LmsMarathonSnapshotRow[]
    classRowsByKey: Map<string, LmsMarathonSnapshotRow>
    errors: string[]
    readLocalizedText: (value: unknown, locale?: string) => string | undefined
    assertLocalizedFixtureValue: (errors: string[], value: unknown, expected: { en: string; ru: string }, label: string) => void
}

const readRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null

export function assertLmsMarathonSeedRowsContract({
    quizRows,
    accessLinkRows,
    classRowsByKey,
    errors,
    readLocalizedText,
    assertLocalizedFixtureValue
}: LmsMarathonRowContractOptions): Map<string, LmsMarathonSnapshotRow> {
    const findRowByField = (rows: LmsMarathonSnapshotRow[], field: string, expected: string, locale = 'en') =>
        rows.find((row) => {
            const value = row.data?.[field]
            return typeof value === 'string' ? value === expected : readLocalizedText(value, locale) === expected
        })
    const assertRussianSourceFallback = (value: unknown, expected: string, label: string) => {
        const record = readRecord(value)
        const locales = readRecord(record?.locales)
        if (record?._primary !== LMS_LYCEUM_MARATHON_SOURCE_LANGUAGE) {
            errors.push(`${label} must keep ${LMS_LYCEUM_MARATHON_SOURCE_LANGUAGE} as its primary source language`)
        }
        if (readLocalizedText(value, 'ru') !== expected) {
            errors.push(`${label} must preserve the canonical Russian source wording exactly`)
        }
        if (readLocalizedText(value, 'en') !== expected) {
            errors.push(`${label} must fall back to the unchanged Russian source wording in English`)
        }
        if (locales && Object.prototype.hasOwnProperty.call(locales, 'en')) {
            errors.push(`${label} must not contain a fabricated English translation`)
        }
    }

    const quizRowsByKey = new Map<string, LmsMarathonSnapshotRow>()
    let totalMarathonQuestions = 0
    let totalMarathonOptions = 0
    for (const seededQuiz of LMS_LYCEUM_MARATHON_QUIZZES) {
        const quizRow = findRowByField(quizRows, 'Title', seededQuiz.title.en)
        if (!quizRow) {
            errors.push(`LMS fixture is missing quiz ${seededQuiz.title.en}`)
            continue
        }
        quizRowsByKey.set(seededQuiz.key, quizRow)

        const quizData = quizRow.data ?? {}
        if (readLocalizedText(quizData.Title, 'ru') !== seededQuiz.title.ru) {
            errors.push(`LMS quiz ${seededQuiz.title.en} is missing the canonical Russian title`)
        }
        if (readLocalizedText(quizData.Description, 'en') !== seededQuiz.description.en) {
            errors.push(`LMS quiz ${seededQuiz.title.en} is missing the canonical English description`)
        }
        if (readLocalizedText(quizData.Description, 'ru') !== seededQuiz.description.ru) {
            errors.push(`LMS quiz ${seededQuiz.title.en} is missing the canonical Russian description`)
        }
        if (readLocalizedText(quizData.CompletionText, 'en') !== seededQuiz.completionText.en) {
            errors.push(`LMS quiz ${seededQuiz.title.en} is missing the canonical English completion text`)
        }
        if (readLocalizedText(quizData.CompletionText, 'ru') !== seededQuiz.completionText.ru) {
            errors.push(`LMS quiz ${seededQuiz.title.en} is missing the canonical Russian completion text`)
        }
        if (quizData.TimeLimitSeconds !== LMS_LYCEUM_MARATHON_TIME_LIMIT_SECONDS) {
            errors.push(`LMS quiz ${seededQuiz.title.en} must use TimeLimitSeconds=${LMS_LYCEUM_MARATHON_TIME_LIMIT_SECONDS}`)
        }
        if (quizData.PassingScorePercent !== seededQuiz.passingScorePercent) {
            errors.push(`LMS quiz ${seededQuiz.title.en} must keep PassingScorePercent=${seededQuiz.passingScorePercent}`)
        }
        if (quizData.MaxAttempts !== seededQuiz.maxAttempts) {
            errors.push(`LMS quiz ${seededQuiz.title.en} must keep MaxAttempts=${seededQuiz.maxAttempts}`)
        }

        const quizQuestions = Array.isArray(quizData.Questions) ? quizData.Questions : []
        totalMarathonQuestions += quizQuestions.length
        if (quizQuestions.length !== seededQuiz.questions.length) {
            errors.push(`LMS quiz ${seededQuiz.title.en} must contain ${seededQuiz.questions.length} source questions`)
        }

        for (const [index, expectedQuestion] of seededQuiz.questions.entries()) {
            const reviewedAnswerKey = LMS_LYCEUM_MARATHON_REVIEWED_ANSWER_KEYS.find(({ id }) => id === expectedQuestion.id)
            if (reviewedAnswerKey) {
                const sourceCorrectOptions = expectedQuestion.options.filter(({ isCorrect }) => isCorrect)
                const hasDocumentedEvidence = expectedQuestion.sourceQuestion.edits.some(
                    (edit) => edit.field === 'prompt' && edit.evidenceRef === reviewedAnswerKey.evidenceRef
                )
                if (
                    seededQuiz.grade !== reviewedAnswerKey.grade ||
                    expectedQuestion.number !== reviewedAnswerKey.number ||
                    expectedQuestion.answer !== reviewedAnswerKey.answer ||
                    sourceCorrectOptions.length !== 1 ||
                    sourceCorrectOptions[0]?.text !== reviewedAnswerKey.answer
                ) {
                    errors.push(`${expectedQuestion.id} must preserve its evidence-reviewed answer key`)
                }
                if (!hasDocumentedEvidence) {
                    errors.push(`${expectedQuestion.id} must retain its answer-key evidence reference`)
                }
            }

            const actualQuestion = readRecord(quizQuestions[index])
            if (!actualQuestion) continue

            const questionLabel = `LMS quiz ${seededQuiz.title.en} question ${index + 1}`
            if (actualQuestion.Id !== expectedQuestion.id || actualQuestion.SortOrder !== expectedQuestion.sortOrder) {
                errors.push(`${questionLabel} must preserve the canonical source ID and order`)
            }
            assertRussianSourceFallback(actualQuestion.Prompt, expectedQuestion.sourceQuestion.prompt, `${questionLabel} prompt`)
            assertLocalizedFixtureValue(
                errors,
                actualQuestion.QuestionDescription,
                { en: 'Choose one answer.', ru: 'Выберите один вариант.' },
                `${questionLabel} description`
            )

            const actualOptions = Array.isArray(actualQuestion.Options) ? actualQuestion.Options : []
            totalMarathonOptions += actualOptions.length
            if (actualOptions.length !== 4) {
                errors.push(`${questionLabel} must contain exactly four answer options`)
            }

            const optionIds = new Set<string>()
            const optionLabels = new Set<string>()
            const correctIndexes: number[] = []
            for (const [optionIndex, expectedOption] of expectedQuestion.options.entries()) {
                const actualOption = readRecord(actualOptions[optionIndex])
                if (!actualOption) continue

                const optionLabel = `${questionLabel} option ${optionIndex + 1}`
                if (actualOption.id !== expectedOption.id) {
                    errors.push(`${optionLabel} must preserve the canonical source option ID`)
                }
                if (typeof actualOption.id === 'string') optionIds.add(actualOption.id)
                assertRussianSourceFallback(actualOption.label, expectedOption.sourceOption.text, `${optionLabel} label`)
                const localizedLabel = readLocalizedText(actualOption.label, 'ru')
                if (localizedLabel) optionLabels.add(localizedLabel)
                if (actualOption.isCorrect === true) correctIndexes.push(optionIndex)
                if (actualOption.isCorrect !== expectedOption.isCorrect) {
                    errors.push(`${optionLabel} must preserve the canonical answer-key flag`)
                }
            }
            if (optionIds.size !== 4 || optionLabels.size !== 4) {
                errors.push(`${questionLabel} must contain four unique option IDs and labels`)
            }

            if (
                expectedQuestion.sourceQuestion.reviewNotes.length > 0 &&
                !isResolvedAttributionReview(expectedQuestion.sourceQuestion) &&
                correctIndexes.length > 0
            ) {
                errors.push(`${questionLabel} has unresolved answer-key review notes and cannot be published with scored options`)
            }

            const expectedCorrectIndex = expectedQuestion.correctPosition - 1
            if (correctIndexes.length !== 1 || correctIndexes[0] !== expectedCorrectIndex) {
                errors.push(
                    `${questionLabel} must have exactly one correct option at the source-stable position ${expectedQuestion.correctPosition}`
                )
            }
        }
    }

    if (LMS_LYCEUM_MARATHON_QUIZZES.length !== LMS_LYCEUM_MARATHON_QUIZ_COUNT) {
        errors.push(`LMS Marathon fixture must contain exactly ${LMS_LYCEUM_MARATHON_QUIZ_COUNT} grade quizzes`)
    }
    if (totalMarathonQuestions !== LMS_LYCEUM_MARATHON_QUESTION_COUNT) {
        errors.push(`LMS Marathon fixture must contain exactly ${LMS_LYCEUM_MARATHON_QUESTION_COUNT} questions`)
    }
    if (totalMarathonOptions !== LMS_LYCEUM_MARATHON_OPTION_COUNT) {
        errors.push(`LMS Marathon fixture must contain exactly ${LMS_LYCEUM_MARATHON_OPTION_COUNT} answer options`)
    }

    for (const seededLink of LMS_LYCEUM_MARATHON_ACCESS_LINKS) {
        const accessLinkRow = accessLinkRows.find((row) => row.data?.Slug === seededLink.slug)
        if (!accessLinkRow) {
            errors.push(`LMS fixture is missing Marathon quiz access link ${seededLink.slug}`)
            continue
        }

        const accessLinkData = accessLinkRow.data ?? {}
        const quizRow = quizRowsByKey.get(seededLink.quizKey)
        const classRow = classRowsByKey.get(seededLink.classKey)
        if (accessLinkData.TargetType !== 'quiz' || !quizRow?.id || accessLinkData.TargetId !== quizRow.id) {
            errors.push(`LMS Marathon access link ${seededLink.slug} must target exactly its seeded grade quiz`)
        }
        if (classRow?.id && accessLinkData.LinkClassId !== classRow.id) {
            errors.push(`LMS Marathon access link ${seededLink.slug} must target its grade class`)
        }
        if (accessLinkData.ContentNodeIdRef !== null) {
            errors.push(`LMS Marathon access link ${seededLink.slug} must not reference a content node`)
        }
        if (
            accessLinkData.IsActive !== LMS_LYCEUM_MARATHON_ACCESS_POLICY.isActive ||
            accessLinkData.MaxUses !== LMS_LYCEUM_MARATHON_ACCESS_POLICY.maxUses ||
            accessLinkData.ShowFirstName !== LMS_LYCEUM_MARATHON_ACCESS_POLICY.showFirstName ||
            accessLinkData.RequireFirstName !== LMS_LYCEUM_MARATHON_ACCESS_POLICY.requireFirstName ||
            accessLinkData.ShowLastName !== LMS_LYCEUM_MARATHON_ACCESS_POLICY.showLastName ||
            accessLinkData.RequireLastName !== LMS_LYCEUM_MARATHON_ACCESS_POLICY.requireLastName ||
            accessLinkData.ShowEmail !== LMS_LYCEUM_MARATHON_ACCESS_POLICY.showEmail ||
            accessLinkData.RequireEmail !== LMS_LYCEUM_MARATHON_ACCESS_POLICY.requireEmail ||
            accessLinkData.ShowPhone !== LMS_LYCEUM_MARATHON_ACCESS_POLICY.showPhone ||
            accessLinkData.RequirePhone !== LMS_LYCEUM_MARATHON_ACCESS_POLICY.requirePhone ||
            accessLinkData.CaptchaEnabled !== LMS_LYCEUM_MARATHON_ACCESS_POLICY.captchaEnabled
        ) {
            errors.push(`LMS Marathon access link ${seededLink.slug} must keep the canonical participant intake policy`)
        }
        if (readLocalizedText(accessLinkData.LinkTitle, 'en') !== seededLink.title.en) {
            errors.push(`LMS Marathon access link ${seededLink.slug} must keep its English title`)
        }
        if (readLocalizedText(accessLinkData.LinkTitle, 'ru') !== seededLink.title.ru) {
            errors.push(`LMS Marathon access link ${seededLink.slug} must keep its Russian title`)
        }
    }

    return quizRowsByKey
}
