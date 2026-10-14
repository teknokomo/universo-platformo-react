import { expect } from '@playwright/test'
import {
    LMS_LYCEUM_MARATHON_ACCESS_LINKS,
    LMS_LYCEUM_MARATHON_OPTION_COUNT,
    LMS_LYCEUM_MARATHON_QUESTION_COUNT,
    LMS_LYCEUM_MARATHON_QUIZ_COUNT,
    LMS_LYCEUM_MARATHON_QUIZZES,
    LMS_LYCEUM_MARATHON_SEEDED_RESULT_COUNTS,
    LMS_LYCEUM_MARATHON_TIME_LIMIT_SECONDS
} from './lmsMarathonFixtureContract.ts'

type RuntimeColumn = { field?: unknown; codename?: unknown }
type RuntimeRow = Record<string, unknown>
type RuntimeTable = { columns?: RuntimeColumn[]; rows?: RuntimeRow[] }
type QuizAccessLinkTarget = { slug: string; targetType: string; targetId: string }
type ReadRuntimeRowValue = (row: RuntimeRow, columns: RuntimeColumn[], ...keys: string[]) => unknown
type ReadLocalizedText = (value: unknown, locale?: string) => string | undefined

export function expectImportedLmsMarathonRuntime(args: {
    quizTable: RuntimeTable
    quizQuestionsById: Map<string, RuntimeRow[]>
    quizAccessLinkTargets: QuizAccessLinkTarget[]
    studentTable: RuntimeTable
    seededQuizRows: unknown[]
    seededAccessLinkRows: unknown[]
    seededStudents: unknown[]
    seededQuizAttempts: unknown[]
    seededQuizResponses: unknown[]
    demoAccessLinkCount: number
    demoStudentCount: number
    readRuntimeRowValue: ReadRuntimeRowValue
    readLocalizedText: ReadLocalizedText
}): void {
    const {
        quizTable,
        quizQuestionsById,
        quizAccessLinkTargets,
        studentTable,
        seededQuizRows,
        seededAccessLinkRows,
        seededStudents,
        seededQuizAttempts,
        seededQuizResponses,
        demoAccessLinkCount,
        demoStudentCount,
        readRuntimeRowValue,
        readLocalizedText
    } = args
    const quizColumns = Array.isArray(quizTable.columns) ? quizTable.columns : []
    const quizRows = Array.isArray(quizTable.rows) ? quizTable.rows : []
    const studentColumns = Array.isArray(studentTable.columns) ? studentTable.columns : []
    const studentRows = Array.isArray(studentTable.rows) ? studentTable.rows : []

    expect(seededStudents).toHaveLength(demoStudentCount)
    expect(seededQuizRows).toHaveLength(LMS_LYCEUM_MARATHON_QUIZ_COUNT)
    expect(seededAccessLinkRows).toHaveLength(demoAccessLinkCount + LMS_LYCEUM_MARATHON_ACCESS_LINKS.length)
    expect(seededQuizAttempts).toHaveLength(LMS_LYCEUM_MARATHON_SEEDED_RESULT_COUNTS.quizAttempts)
    expect(seededQuizResponses).toHaveLength(LMS_LYCEUM_MARATHON_SEEDED_RESULT_COUNTS.quizResponses)
    expect(studentRows.filter((row) => readRuntimeRowValue(row, studentColumns, 'IsGuest', 'is_guest') === true)).toHaveLength(
        LMS_LYCEUM_MARATHON_SEEDED_RESULT_COUNTS.guestStudents
    )

    let importedQuestionCount = 0
    let importedOptionCount = 0
    const quizIdsByKey = new Map<string, string>()
    for (const expectedQuiz of LMS_LYCEUM_MARATHON_QUIZZES) {
        const actualQuiz = quizRows.find(
            (row) => readLocalizedText(readRuntimeRowValue(row, quizColumns, 'Title', 'title'), 'en') === expectedQuiz.title.en
        )
        expect(actualQuiz, `Imported ${expectedQuiz.title.en} quiz must exist`).toBeTruthy()
        if (!actualQuiz) continue
        expect(Number(readRuntimeRowValue(actualQuiz, quizColumns, 'TimeLimitSeconds', 'time_limit_seconds'))).toBe(
            LMS_LYCEUM_MARATHON_TIME_LIMIT_SECONDS
        )
        if (typeof actualQuiz.id === 'string') quizIdsByKey.set(expectedQuiz.key, actualQuiz.id)

        const questions = typeof actualQuiz.id === 'string' ? quizQuestionsById.get(actualQuiz.id) ?? [] : []
        expect(questions).toHaveLength(30)
        importedQuestionCount += questions.length
        for (const [questionIndex, expectedQuestion] of expectedQuiz.questions.entries()) {
            const actualQuestion = questions[questionIndex]
            expect(actualQuestion).toBeTruthy()
            if (!actualQuestion || typeof actualQuestion !== 'object') continue
            const questionRecord = actualQuestion as RuntimeRow
            const actualPrompt = readRuntimeRowValue(questionRecord, [], 'Prompt', 'prompt')
            expect(readLocalizedText(actualPrompt, 'ru')).toBe(expectedQuestion.sourceQuestion.prompt)
            expect(readLocalizedText(actualPrompt, 'en')).toBe(expectedQuestion.sourceQuestion.prompt)

            const optionsValue = readRuntimeRowValue(questionRecord, [], 'Options', 'options')
            const options = Array.isArray(optionsValue) ? optionsValue : []
            expect(options).toHaveLength(4)
            importedOptionCount += options.length
            const actualCorrectIndexes: number[] = []
            for (const [optionIndex, expectedOption] of expectedQuestion.options.entries()) {
                const actualOption = options[optionIndex]
                expect(actualOption).toBeTruthy()
                if (!actualOption || typeof actualOption !== 'object') continue
                const optionRecord = actualOption as RuntimeRow
                expect(optionRecord.id).toBe(expectedOption.id)
                expect(readLocalizedText(optionRecord.label, 'ru')).toBe(expectedOption.sourceOption.text)
                expect(readLocalizedText(optionRecord.label, 'en')).toBe(expectedOption.sourceOption.text)
                if (optionRecord.isCorrect === true) actualCorrectIndexes.push(optionIndex)
            }
            expect(actualCorrectIndexes).toEqual([expectedQuestion.correctPosition - 1])
        }
    }

    expect(importedQuestionCount).toBe(LMS_LYCEUM_MARATHON_QUESTION_COUNT)
    expect(importedOptionCount).toBe(LMS_LYCEUM_MARATHON_OPTION_COUNT)

    expect(quizAccessLinkTargets).toHaveLength(LMS_LYCEUM_MARATHON_ACCESS_LINKS.length)
    expect(quizAccessLinkTargets.every((row) => row.targetType === 'quiz')).toBe(true)
    for (const expectedLink of LMS_LYCEUM_MARATHON_ACCESS_LINKS) {
        const linkRow = quizAccessLinkTargets.find((row) => row.slug === expectedLink.slug)
        expect(linkRow, `Quiz AccessLinks row ${expectedLink.slug} must be seeded`).toBeTruthy()
        expect(linkRow?.targetId).toBe(quizIdsByKey.get(expectedLink.quizKey))
    }
}
