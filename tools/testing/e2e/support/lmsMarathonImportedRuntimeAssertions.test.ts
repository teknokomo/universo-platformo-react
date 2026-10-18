import assert from 'node:assert/strict'
import test from 'node:test'
import { expectImportedLmsMarathonRuntime, expectImportedLmsSixthMuseRuntimeContent } from './lmsMarathonImportedRuntimeAssertions.ts'
import {
    LMS_LYCEUM_MARATHON_ACCESS_LINKS,
    LMS_LYCEUM_MARATHON_QUIZZES,
    LMS_LYCEUM_MARATHON_TIME_LIMIT_SECONDS
} from './lmsMarathonFixtureContract.ts'
import { LMS_SIXTH_MUSE_ACCESS_LINK, LMS_SIXTH_MUSE_SOURCE } from './lmsSixthMuseFixtureContract.ts'

const BLOCK_KEYS = ['019f2000-0000-7000-8000-000000000001', '019f2000-0000-7000-8000-000000000002', '019f2000-0000-7000-8000-000000000003']

const localizedText = (content: string) => ({ locales: { ru: { content } } })
const localizedTextBoth = (en: string, ru: string) => ({ locales: { en: { content: en }, ru: { content: ru } } })

const readRuntimeRowValue = (row: Record<string, unknown>, _columns: unknown[], ...keys: string[]): unknown =>
    keys.map((key) => row[key]).find((value) => value !== undefined)

const readLocalizedText = (value: unknown, locale = 'ru'): string | undefined => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return undefined
    const locales = (value as { locales?: Record<string, { content?: unknown }> }).locales
    const content = locales?.[locale]?.content
    return typeof content === 'string' ? content : undefined
}

const createImportedRuntimeRows = () => ({
    blocks: LMS_SIXTH_MUSE_SOURCE.blocks.map((block, index) => ({
        BlockKey: BLOCK_KEYS[index],
        Title: localizedText(block.title)
    })),
    questions: LMS_SIXTH_MUSE_SOURCE.blocks.flatMap((block, blockIndex) =>
        block.questions.map((question) => ({
            BlockKey: BLOCK_KEYS[blockIndex],
            Prompt: localizedText(question.runtimePrompt)
        }))
    )
})

const assertImportedRuntimeContent = (rows: ReturnType<typeof createImportedRuntimeRows>): void => {
    expectImportedLmsSixthMuseRuntimeContent({
        ...rows,
        readRuntimeRowValue,
        readLocalizedText
    })
}

const createIntegratedRuntimeArgs = () => {
    const marathonQuizRows = LMS_LYCEUM_MARATHON_QUIZZES.map((quiz) => ({
        id: `marathon-${quiz.grade}`,
        Title: localizedTextBoth(quiz.title.en, quiz.title.ru),
        TimeLimitSeconds: LMS_LYCEUM_MARATHON_TIME_LIMIT_SECONDS
    }))
    const quizIdsByKey = new Map(LMS_LYCEUM_MARATHON_QUIZZES.map((quiz) => [quiz.key, `marathon-${quiz.grade}`]))
    const sixthMuseQuizId = 'sixth-muse-imported'
    const sixthMuseQuizRow = { id: sixthMuseQuizId, Title: localizedText(LMS_SIXTH_MUSE_SOURCE.title) }
    const quizRows = [...marathonQuizRows, sixthMuseQuizRow]
    const quizQuestionsById = new Map<string, Array<Record<string, unknown>>>()

    for (const quiz of LMS_LYCEUM_MARATHON_QUIZZES) {
        const quizId = quizIdsByKey.get(quiz.key)
        assert.ok(quizId)
        quizQuestionsById.set(
            quizId,
            quiz.questions.map((question) => ({
                Prompt: localizedTextBoth(question.sourceQuestion.prompt, question.sourceQuestion.prompt),
                Options: question.options.map((option) => ({
                    id: option.id,
                    label: localizedTextBoth(option.sourceOption.text, option.sourceOption.text),
                    isCorrect: option.isCorrect
                }))
            }))
        )
    }

    quizQuestionsById.set(
        sixthMuseQuizId,
        LMS_SIXTH_MUSE_SOURCE.blocks.flatMap((block, blockIndex) =>
            block.questions.map((question) => ({
                BlockKey: BLOCK_KEYS[blockIndex],
                Prompt: localizedText(question.runtimePrompt)
            }))
        )
    )

    const quizBlocksById = new Map([
        [
            sixthMuseQuizId,
            LMS_SIXTH_MUSE_SOURCE.blocks.map((block, index) => ({
                BlockKey: BLOCK_KEYS[index],
                Title: localizedText(block.title)
            }))
        ]
    ])
    const quizAccessLinkTargets = [
        ...LMS_LYCEUM_MARATHON_ACCESS_LINKS.map((link) => ({
            slug: link.slug,
            targetType: 'quiz',
            targetId: quizIdsByKey.get(link.quizKey)!
        })),
        { slug: LMS_SIXTH_MUSE_ACCESS_LINK.slug, targetType: 'quiz', targetId: sixthMuseQuizId }
    ]

    return {
        quizTable: { columns: [], rows: quizRows },
        quizQuestionsById,
        quizBlocksById,
        quizAccessLinkTargets,
        studentTable: { columns: [], rows: [] },
        seededQuizRows: quizRows,
        seededAccessLinkRows: quizAccessLinkTargets,
        seededStudents: [],
        seededQuizAttempts: [],
        seededQuizResponses: [],
        demoAccessLinkCount: 0,
        demoStudentCount: 0,
        readRuntimeRowValue,
        readLocalizedText
    }
}

test('accepts imported Sixth Muse blocks and ten source-ordered questions per block', () => {
    assertImportedRuntimeContent(createImportedRuntimeRows())
})

test('applies imported Sixth Muse block checks through the complete LMS runtime acceptance assertion', () => {
    const runtimeArgs = createIntegratedRuntimeArgs()
    expectImportedLmsMarathonRuntime(runtimeArgs)

    const importedQuestions = runtimeArgs.quizQuestionsById.get('sixth-muse-imported')
    assert.ok(importedQuestions)
    const firstQuestionInSecondBlock = importedQuestions[LMS_SIXTH_MUSE_SOURCE.blocks[0]!.questions.length]
    assert.ok(firstQuestionInSecondBlock)
    importedQuestions[0]!.BlockKey = firstQuestionInSecondBlock.BlockKey
    firstQuestionInSecondBlock.BlockKey = BLOCK_KEYS[0]

    assert.throws(() => expectImportedLmsMarathonRuntime(runtimeArgs))
})

test('rejects imported Sixth Muse blocks in a different order from the source', () => {
    const rows = createImportedRuntimeRows()
    ;[rows.blocks[0], rows.blocks[1]] = [rows.blocks[1]!, rows.blocks[0]!]

    assert.throws(() => assertImportedRuntimeContent(rows))
})

test('rejects cross-block question assignments even when each block still has ten questions', () => {
    const rows = createImportedRuntimeRows()
    const firstQuestion = rows.questions[0]!
    const firstQuestionInSecondBlock = rows.questions[LMS_SIXTH_MUSE_SOURCE.blocks[0]!.questions.length]!
    firstQuestion.BlockKey = firstQuestionInSecondBlock.BlockKey
    firstQuestionInSecondBlock.BlockKey = BLOCK_KEYS[0]

    assert.throws(() => assertImportedRuntimeContent(rows))
})

test('rejects questions reordered inside an imported block', () => {
    const rows = createImportedRuntimeRows()
    ;[rows.questions[0], rows.questions[1]] = [rows.questions[1]!, rows.questions[0]!]

    assert.throws(() => assertImportedRuntimeContent(rows))
})
