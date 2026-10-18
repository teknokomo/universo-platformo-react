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
import { LMS_SIXTH_MUSE_ACCESS_LINK, LMS_SIXTH_MUSE_QUESTION_COUNT, LMS_SIXTH_MUSE_SOURCE } from './lmsSixthMuseFixtureContract.ts'

type RuntimeColumn = { field?: unknown; codename?: unknown }
type RuntimeRow = Record<string, unknown>
type RuntimeTable = { columns?: RuntimeColumn[]; rows?: RuntimeRow[] }
type QuizAccessLinkTarget = { slug: string; targetType: string; targetId: string }
type ReadRuntimeRowValue = (row: RuntimeRow, columns: RuntimeColumn[], ...keys: string[]) => unknown
type ReadLocalizedText = (value: unknown, locale?: string) => string | undefined

/** Validates imported Sixth Muse block order and question membership against the reviewed source fixture. */
export function expectImportedLmsSixthMuseRuntimeContent(args: {
    questions: RuntimeRow[]
    blocks: RuntimeRow[]
    readRuntimeRowValue: ReadRuntimeRowValue
    readLocalizedText: ReadLocalizedText
}): void {
    const { questions, blocks, readRuntimeRowValue, readLocalizedText } = args
    const expectedBlocks = LMS_SIXTH_MUSE_SOURCE.blocks

    expect(blocks).toHaveLength(expectedBlocks.length)
    expect(
        blocks.map((block) => readLocalizedText(readRuntimeRowValue(block, [], 'Title', 'title'), 'ru')),
        'Imported Sixth Muse blocks must retain source order and titles'
    ).toEqual(expectedBlocks.map((block) => block.title))

    const importedBlockKeys = blocks.map((block) => readRuntimeRowValue(block, [], 'BlockKey', 'blockKey'))
    expect(
        importedBlockKeys.every(
            (key) => typeof key === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(key)
        )
    ).toBe(true)
    expect(new Set(importedBlockKeys).size).toBe(expectedBlocks.length)

    const questionBlockKeys = questions.map((question) => readRuntimeRowValue(question, [], 'BlockKey', 'blockKey'))
    expect(
        questionBlockKeys.every(
            (key) => typeof key === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(key)
        )
    ).toBe(true)
    expect(new Set(questionBlockKeys).size).toBe(expectedBlocks.length)
    expect(questionBlockKeys.every((key) => importedBlockKeys.includes(key))).toBe(true)

    for (const [blockIndex, sourceBlock] of expectedBlocks.entries()) {
        expect(sourceBlock.questions, `Source block ${blockIndex + 1} must contain ten questions`).toHaveLength(10)
        const importedBlockKey = importedBlockKeys[blockIndex]
        if (typeof importedBlockKey !== 'string') continue

        const importedBlockQuestions = questions.filter(
            (question) => readRuntimeRowValue(question, [], 'BlockKey', 'blockKey') === importedBlockKey
        )
        expect(importedBlockQuestions, `Imported block ${blockIndex + 1} must contain its source questions`).toHaveLength(
            sourceBlock.questions.length
        )
        expect(
            importedBlockQuestions.map((question) => readLocalizedText(readRuntimeRowValue(question, [], 'Prompt', 'prompt'), 'ru')),
            `Imported block ${blockIndex + 1} questions must match source membership and order`
        ).toEqual(sourceBlock.questions.map((question) => question.runtimePrompt))
    }
}

export function expectImportedLmsMarathonRuntime(args: {
    quizTable: RuntimeTable
    quizQuestionsById: Map<string, RuntimeRow[]>
    quizBlocksById: Map<string, RuntimeRow[]>
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
        quizBlocksById,
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
    expect(seededQuizRows).toHaveLength(LMS_LYCEUM_MARATHON_QUIZ_COUNT + 1)
    expect(seededAccessLinkRows).toHaveLength(demoAccessLinkCount + LMS_LYCEUM_MARATHON_ACCESS_LINKS.length + 1)
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

    expect(quizAccessLinkTargets).toHaveLength(LMS_LYCEUM_MARATHON_ACCESS_LINKS.length + 1)
    expect(quizAccessLinkTargets.every((row) => row.targetType === 'quiz')).toBe(true)
    for (const expectedLink of LMS_LYCEUM_MARATHON_ACCESS_LINKS) {
        const linkRow = quizAccessLinkTargets.find((row) => row.slug === expectedLink.slug)
        expect(linkRow, `Quiz AccessLinks row ${expectedLink.slug} must be seeded`).toBeTruthy()
        expect(linkRow?.targetId).toBe(quizIdsByKey.get(expectedLink.quizKey))
    }

    const sixthMuseQuiz = quizRows.find(
        (row) => readLocalizedText(readRuntimeRowValue(row, quizColumns, 'Title', 'title'), 'ru') === LMS_SIXTH_MUSE_SOURCE.title
    )
    expect(sixthMuseQuiz, 'The imported Sixth Muse quiz must exist').toBeTruthy()
    if (typeof sixthMuseQuiz?.id === 'string') {
        const questions = quizQuestionsById.get(sixthMuseQuiz.id) ?? []
        const blocks = quizBlocksById.get(sixthMuseQuiz.id) ?? []
        expect(questions).toHaveLength(LMS_SIXTH_MUSE_QUESTION_COUNT)
        expectImportedLmsSixthMuseRuntimeContent({ questions, blocks, readRuntimeRowValue, readLocalizedText })
    }
    const sixthMuseLink = quizAccessLinkTargets.find((row) => row.slug === LMS_SIXTH_MUSE_ACCESS_LINK.slug)
    expect(sixthMuseLink, 'The Sixth Muse guest link must be imported').toBeTruthy()
    expect(sixthMuseLink?.targetType).toBe('quiz')
    expect(sixthMuseLink?.targetId).toBe(sixthMuseQuiz?.id)
}
