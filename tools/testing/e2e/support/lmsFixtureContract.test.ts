import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { LMS_DEMO_QUIZZES } from './lmsFixtureDataLearning.ts'
import { assertLmsDashboardFixtureContract } from './lmsDashboardFixtureContract.ts'
import {
    assertLmsMarathonSeedRowsContract,
    LMS_LYCEUM_MARATHON_ACCESS_LINKS,
    LMS_LYCEUM_MARATHON_ACCESS_POLICY,
    LMS_LYCEUM_MARATHON_CLASSES,
    LMS_LYCEUM_MARATHON_OPTION_COUNT,
    LMS_LYCEUM_MARATHON_POSITION_ALGORITHM_VERSION,
    LMS_LYCEUM_MARATHON_QUESTION_COUNT,
    LMS_LYCEUM_MARATHON_QUIZ_COUNT,
    LMS_LYCEUM_MARATHON_QUIZZES,
    LMS_LYCEUM_MARATHON_REVIEWED_ANSWER_KEYS,
    LMS_LYCEUM_MARATHON_SEEDED_RESULT_COUNTS,
    LMS_LYCEUM_MARATHON_SOURCE_LANGUAGE,
    LMS_LYCEUM_MARATHON_TIME_LIMIT_SECONDS
} from './lmsMarathonFixtureContract.ts'
import {
    assertLmsSixthMuseSeedRowsContract,
    buildLmsSixthMuseQuizRecord,
    LMS_SIXTH_MUSE_ACCESS_LINK,
    LMS_SIXTH_MUSE_ACCESS_POLICY,
    LMS_SIXTH_MUSE_OPTION_COUNT,
    LMS_SIXTH_MUSE_QUESTION_COUNT,
    LMS_SIXTH_MUSE_SOURCE
} from './lmsSixthMuseFixtureContract.ts'

type MarathonSource = {
    datasetId: string
    language: string
    contentApproval: string
    correctPositionAlgorithm: { version: string }
    grades: Array<{
        grade: number
        sourceFile: string
        sourceSha256: string
        questions: Array<{
            id: string
            number: number
            prompt: string
            answer: string
            correctPosition: number
            options: Array<{ id: string; text: string; isCorrect: boolean }>
            source: { openAnswerBlock: { prompt: string; answer: string } }
            edits: Array<{ field: string; before: string; after: string; evidenceRef?: string }>
            reviewNotes: string[]
        }>
    }>
}

const marathonSource = JSON.parse(
    readFileSync(new URL('../../../fixtures/lyceum-marathon/source.json', import.meta.url), 'utf8')
) as MarathonSource

const findMarathonQuestion = (grade: number, number: number): MarathonSource['grades'][number]['questions'][number] => {
    const question = marathonSource.grades
        .find((candidate) => candidate.grade === grade)
        ?.questions.find((entry) => entry.number === number)
    assert.ok(question, `Grade ${grade} question ${number} must exist`)
    return question
}

const localizedValue = (en: string, ru: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: { en: { content: en }, ru: { content: ru } }
})

test('builds the reviewed Sixth Muse quiz with ordered blocks, UUID v7 keys, and balanced answer positions', () => {
    let generatedId = 1
    const quizId = '019f2000-0000-7000-8000-000000000100'
    const linkId = '019f2000-0000-7000-8000-000000000101'
    const quizData = buildLmsSixthMuseQuizRecord('single-choice-enum-id', () => {
        const id = `019f2000-0000-7000-8000-${String(generatedId).padStart(12, '0')}`
        generatedId += 1
        return id
    })
    const quizRows = [{ id: quizId, data: quizData }]
    const accessLinkRows = [
        {
            id: linkId,
            data: {
                Slug: LMS_SIXTH_MUSE_ACCESS_LINK.slug,
                TargetType: 'quiz',
                TargetId: quizId,
                LinkClassId: null,
                ContentNodeIdRef: null,
                IsActive: LMS_SIXTH_MUSE_ACCESS_POLICY.isActive,
                MaxUses: LMS_SIXTH_MUSE_ACCESS_POLICY.maxUses,
                ShowFirstName: LMS_SIXTH_MUSE_ACCESS_POLICY.showFirstName,
                RequireFirstName: LMS_SIXTH_MUSE_ACCESS_POLICY.requireFirstName,
                ShowLastName: LMS_SIXTH_MUSE_ACCESS_POLICY.showLastName,
                RequireLastName: LMS_SIXTH_MUSE_ACCESS_POLICY.requireLastName,
                ShowEmail: LMS_SIXTH_MUSE_ACCESS_POLICY.showEmail,
                RequireEmail: LMS_SIXTH_MUSE_ACCESS_POLICY.requireEmail,
                ShowPhone: LMS_SIXTH_MUSE_ACCESS_POLICY.showPhone,
                RequirePhone: LMS_SIXTH_MUSE_ACCESS_POLICY.requirePhone,
                CaptchaEnabled: LMS_SIXTH_MUSE_ACCESS_POLICY.captchaEnabled,
                LinkTitle: localizedValue(LMS_SIXTH_MUSE_ACCESS_LINK.title.en, LMS_SIXTH_MUSE_ACCESS_LINK.title.ru)
            }
        }
    ]
    const errors: string[] = []

    assert.equal(quizData.Questions.length, LMS_SIXTH_MUSE_QUESTION_COUNT)
    assert.equal(
        quizData.Questions.reduce((count, question) => count + question.Options.length, 0),
        LMS_SIXTH_MUSE_OPTION_COUNT
    )
    assertLmsSixthMuseSeedRowsContract({
        quizRows,
        accessLinkRows,
        errors,
        readLocalizedText,
        assertLocalizedFixtureValue: (targetErrors, value, expected, label) => {
            for (const locale of ['en', 'ru'] as const) {
                if (readLocalizedText(value, locale) !== expected[locale]) targetErrors.push(`${label} is missing ${locale}`)
            }
        }
    })

    assert.deepEqual(errors, [])
    assert.equal(quizData.Blocks.length, LMS_SIXTH_MUSE_SOURCE.blocks.length)
    assert.equal(new Set(quizData.Blocks.map(({ BlockKey }) => BlockKey)).size, quizData.Blocks.length)
})

test('uses unique UUID v7 option identifiers for LMS demo quizzes', () => {
    const optionIds = LMS_DEMO_QUIZZES.flatMap((quiz) => quiz.questions.en.flatMap((question) => question.options.map(({ id }) => id)))

    assert.equal(new Set(optionIds).size, optionIds.length, 'LMS demo quiz option identifiers must be unique')
    for (const id of optionIds) {
        assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
    }
})

test('keeps Marathon question keys unique and option identifiers globally unique UUID v7 values', () => {
    const questions = LMS_LYCEUM_MARATHON_QUIZZES.flatMap(({ questions }) => questions)
    const questionIds = questions.map(({ id }) => id)
    const optionIds = questions.flatMap(({ options }) => options.map(({ id }) => id))

    assert.equal(questionIds.length, LMS_LYCEUM_MARATHON_QUESTION_COUNT)
    assert.equal(new Set(questionIds).size, questionIds.length, 'Marathon question keys must be globally unique')
    assert.equal(optionIds.length, LMS_LYCEUM_MARATHON_OPTION_COUNT)
    assert.equal(new Set(optionIds).size, optionIds.length, 'Marathon option identifiers must be globally unique')
    for (const id of optionIds) {
        assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
    }
})

const russianSourceValue = (ru: string) => ({ _schema: '1', _primary: 'ru', locales: { ru: { content: ru } } })

const readLocalizedText = (value: unknown, locale = 'en'): string | undefined => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return undefined
    const locales = (value as { locales?: Record<string, { content?: unknown }> }).locales
    const content = locales?.[locale]?.content ?? Object.values(locales ?? {}).find((entry) => typeof entry.content === 'string')?.content
    return typeof content === 'string' ? content : undefined
}

const createMarathonSeedRows = () => {
    const quizRows = LMS_LYCEUM_MARATHON_QUIZZES.map((quiz) => ({
        id: `quiz-${quiz.grade}`,
        data: {
            Title: localizedValue(quiz.title.en, quiz.title.ru),
            Description: localizedValue(quiz.description.en, quiz.description.ru),
            CompletionText: localizedValue(quiz.completionText.en, quiz.completionText.ru),
            TimeLimitSeconds: LMS_LYCEUM_MARATHON_TIME_LIMIT_SECONDS,
            PassingScorePercent: quiz.passingScorePercent,
            MaxAttempts: quiz.maxAttempts,
            Questions: quiz.questions.map((question) => ({
                Id: question.id,
                SortOrder: question.sortOrder,
                Prompt: russianSourceValue(question.sourceQuestion.prompt),
                QuestionDescription: localizedValue('Choose one answer.', 'Выберите один вариант.'),
                Options: question.options.map((option) => ({
                    id: option.id,
                    label: russianSourceValue(option.sourceOption.text),
                    isCorrect: option.isCorrect
                }))
            }))
        }
    }))
    const classRowsByKey = new Map(
        LMS_LYCEUM_MARATHON_CLASSES.map((classRecord) => [classRecord.key, { id: `class-${classRecord.grade}`, data: {} }])
    )
    const quizRowsByKey = new Map(LMS_LYCEUM_MARATHON_QUIZZES.map((quiz, index) => [quiz.key, quizRows[index]?.id ?? '']))
    const accessLinkRows = LMS_LYCEUM_MARATHON_ACCESS_LINKS.map((accessLink) => ({
        id: `access-link-${accessLink.slug}`,
        data: {
            Slug: accessLink.slug,
            TargetType: 'quiz',
            TargetId: quizRowsByKey.get(accessLink.quizKey),
            LinkClassId: classRowsByKey.get(accessLink.classKey)?.id,
            ContentNodeIdRef: null,
            IsActive: LMS_LYCEUM_MARATHON_ACCESS_POLICY.isActive,
            MaxUses: LMS_LYCEUM_MARATHON_ACCESS_POLICY.maxUses,
            ShowFirstName: LMS_LYCEUM_MARATHON_ACCESS_POLICY.showFirstName,
            RequireFirstName: LMS_LYCEUM_MARATHON_ACCESS_POLICY.requireFirstName,
            ShowLastName: LMS_LYCEUM_MARATHON_ACCESS_POLICY.showLastName,
            RequireLastName: LMS_LYCEUM_MARATHON_ACCESS_POLICY.requireLastName,
            ShowEmail: LMS_LYCEUM_MARATHON_ACCESS_POLICY.showEmail,
            RequireEmail: LMS_LYCEUM_MARATHON_ACCESS_POLICY.requireEmail,
            ShowPhone: LMS_LYCEUM_MARATHON_ACCESS_POLICY.showPhone,
            RequirePhone: LMS_LYCEUM_MARATHON_ACCESS_POLICY.requirePhone,
            CaptchaEnabled: LMS_LYCEUM_MARATHON_ACCESS_POLICY.captchaEnabled,
            LinkTitle: localizedValue(accessLink.title.en, accessLink.title.ru)
        }
    }))

    return { quizRows, accessLinkRows, classRowsByKey }
}

const validateMarathonSeedRows = (rows: ReturnType<typeof createMarathonSeedRows>) => {
    const errors: string[] = []
    const quizRowsByKey = assertLmsMarathonSeedRowsContract({
        ...rows,
        errors,
        readLocalizedText,
        assertLocalizedFixtureValue: (targetErrors, value, expected, label) => {
            for (const locale of ['en', 'ru'] as const) {
                if (readLocalizedText(value, locale) !== expected[locale]) {
                    targetErrors.push(`${label} is missing the canonical ${locale} value`)
                }
            }
        }
    })
    return { errors, quizRowsByKey }
}

test('rejects Marathon access links that target a different quiz', () => {
    const rows = createMarathonSeedRows()
    rows.accessLinkRows[0]!.data.TargetId = 'another-quiz'

    const { errors } = validateMarathonSeedRows(rows)
    assert.ok(errors.some((error) => error.includes('must target exactly its seeded grade quiz')))
})

test('rejects Marathon quiz titles that do not preserve the approved Russian locale', () => {
    const rows = createMarathonSeedRows()
    const title = rows.quizRows[0]!.data.Title as { locales: { ru: { content: string } } }
    title.locales.ru.content = 'Wrong Russian title'

    const { errors } = validateMarathonSeedRows(rows)
    assert.ok(errors.some((error) => error.includes('missing the canonical Russian title')))
})

test('rejects Marathon questions whose option key differs from the approved answer', () => {
    const rows = createMarathonSeedRows()
    const firstQuizQuestion = (rows.quizRows[0]!.data.Questions as Array<Record<string, unknown>>)[0]!
    const firstQuestionOptions = firstQuizQuestion.Options as Array<Record<string, unknown>>
    firstQuestionOptions[0]!.isCorrect = !firstQuestionOptions[0]!.isCorrect

    const { errors } = validateMarathonSeedRows(rows)
    assert.ok(errors.some((error) => error.includes('must preserve the canonical answer-key flag')))
})

test('accepts the canonical Marathon seed rows with evidence-reviewed answer keys', () => {
    const { errors } = validateMarathonSeedRows(createMarathonSeedRows())
    assert.deepEqual(errors, [])
})

test('rejects scored Marathon questions with an unresolved answer-key review note', () => {
    const gradeEleven = LMS_LYCEUM_MARATHON_QUIZZES.find(({ grade }) => grade === 11)
    assert.ok(gradeEleven)
    const question = gradeEleven.questions.find(({ id }) => id === 'lm-g11-q06')
    assert.ok(question)
    question.sourceQuestion.reviewNotes.push('The answer key still needs content-owner confirmation.')

    try {
        const { errors } = validateMarathonSeedRows(createMarathonSeedRows())
        assert.ok(errors.some((error) => error.includes('has unresolved answer-key review notes')))
    } finally {
        question.sourceQuestion.reviewNotes.pop()
    }
})

test('rejects missing or mismatched evidence references for reviewed answer keys', () => {
    const evidenceCases = [
        { id: 'lm-g11-q06', evidenceRef: undefined },
        { id: 'lm-g11-q10', evidenceRef: 'https://example.invalid/unrelated-source' }
    ]

    for (const { id, evidenceRef } of evidenceCases) {
        const question = LMS_LYCEUM_MARATHON_QUIZZES.flatMap(({ questions }) => questions).find((candidate) => candidate.id === id)
        assert.ok(question)
        const promptEdit = question.sourceQuestion.edits.find(({ field }) => field === 'prompt')
        assert.ok(promptEdit)
        const originalEvidenceRef = promptEdit.evidenceRef
        promptEdit.evidenceRef = evidenceRef

        try {
            const { errors } = validateMarathonSeedRows(createMarathonSeedRows())
            assert.ok(errors.some((error) => error.includes(`${id} must retain its answer-key evidence reference`)))
        } finally {
            promptEdit.evidenceRef = originalEvidenceRef
        }
    }
})

test('rejects retired widget config.cards and datasource locators', () => {
    const errors: string[] = []
    const readRecord = (value: unknown): Record<string, unknown> | null =>
        value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null

    assertLmsDashboardFixtureContract({
        envelope: {
            snapshot: {
                layoutZoneWidgets: [
                    {
                        widgetKey: 'detailsTable',
                        config: {
                            cards: [{ source: 'legacy' }],
                            nested: { datasource: { objectCodename: 'CourseItems' } }
                        }
                    }
                ]
            }
        },
        entityByCodename: new Map(),
        modules: [],
        errors,
        readRecord,
        readWidgetConfig: (value) => readRecord(value) ?? {},
        readLocalizedText: (value) => (typeof value === 'string' ? value : undefined),
        assertLocalizedFixtureValue: () => undefined
    })

    assert.ok(errors.some((error) => error.includes('retired config.cards')))
    assert.ok(errors.some((error) => error.includes('retired config.nested.datasource')))
})

test('uses approved Russian Lyceum Marathon content with logged editorial clarification', () => {
    assert.equal(marathonSource.language, 'ru')
    assert.match(marathonSource.contentApproval, /source answer key remains provisional/i)
    assert.equal(LMS_LYCEUM_MARATHON_SOURCE_LANGUAGE, marathonSource.language)
    assert.equal(LMS_LYCEUM_MARATHON_POSITION_ALGORITHM_VERSION, marathonSource.correctPositionAlgorithm.version)
    assert.equal(LMS_LYCEUM_MARATHON_TIME_LIMIT_SECONDS, 2700)
    assert.deepEqual(LMS_LYCEUM_MARATHON_SEEDED_RESULT_COUNTS, { guestStudents: 0, quizAttempts: 0, quizResponses: 0 })
    assert.equal(LMS_LYCEUM_MARATHON_QUIZZES.length, LMS_LYCEUM_MARATHON_QUIZ_COUNT)
    assert.equal(LMS_LYCEUM_MARATHON_QUIZ_COUNT, 7)
    assert.equal(LMS_LYCEUM_MARATHON_ACCESS_LINKS.length, LMS_LYCEUM_MARATHON_QUIZ_COUNT)
    assert.equal(new Set(LMS_LYCEUM_MARATHON_ACCESS_LINKS.map(({ quizKey }) => quizKey)).size, LMS_LYCEUM_MARATHON_QUIZ_COUNT)

    const sourceQuestionCount = marathonSource.grades.reduce((sum, grade) => sum + grade.questions.length, 0)
    const sourceOptionCount = marathonSource.grades.reduce(
        (sum, grade) => sum + grade.questions.reduce((questionSum, question) => questionSum + question.options.length, 0),
        0
    )
    assert.equal(sourceQuestionCount, LMS_LYCEUM_MARATHON_QUESTION_COUNT)
    assert.equal(sourceQuestionCount, 210)
    assert.equal(sourceOptionCount, LMS_LYCEUM_MARATHON_OPTION_COUNT)
    assert.equal(sourceOptionCount, 840)
    assert.deepEqual(
        LMS_LYCEUM_MARATHON_QUIZZES.map(({ grade }) => grade),
        marathonSource.grades.map(({ grade }) => grade)
    )

    assert.deepEqual(
        marathonSource.grades.flatMap(({ questions }) => questions.filter(({ reviewNotes }) => reviewNotes.length > 0).map(({ id }) => id)),
        ['lm-g10-q03']
    )

    const leapYearFolkloreQuestion = findMarathonQuestion(11, 6)
    assert.equal(
        leapYearFolkloreQuestion.prompt,
        'Какой год в фольклоре связывают с новым началом в отношениях, когда женщина может сделать предложение мужчине?'
    )
    assert.equal(leapYearFolkloreQuestion.answer, 'Високосный')
    assert.equal(leapYearFolkloreQuestion.reviewNotes.length, 0)
    assert.deepEqual(
        LMS_LYCEUM_MARATHON_REVIEWED_ANSWER_KEYS.map(({ id, answer }) => ({ id, answer })),
        [
            { id: 'lm-g11-q06', answer: 'Високосный' },
            { id: 'lm-g11-q10', answer: 'После смерти' }
        ]
    )

    const kurganRiddleQuestion = findMarathonQuestion(11, 10)
    assert.equal(
        kurganRiddleQuestion.prompt,
        'В результате какого события древние скифы оказывались в погребальных камерах курганов, а живые покидали свои дома?'
    )
    assert.equal(kurganRiddleQuestion.answer, 'После смерти')
    assert.equal(kurganRiddleQuestion.reviewNotes.length, 0)

    const valentineQuestion = findMarathonQuestion(5, 6)
    assert.equal(valentineQuestion.prompt, 'В какой современной стране находится город Терни, связанный с почитанием святого Валентина?')
    assert.equal(valentineQuestion.answer, 'Италия')
    assert.equal(valentineQuestion.source.openAnswerBlock.prompt, 'В какой стране жил Святой Валентин?')
    assert.equal(valentineQuestion.reviewNotes.length, 0)

    const proxemicsQuestion = findMarathonQuestion(6, 29)
    assert.equal(proxemicsQuestion.prompt, 'Какую зону дистанции в модели проксемики Э. Холла обычно связывают с общением со знакомыми?')
    assert.equal(proxemicsQuestion.answer, 'Социальная зона: 1,2–3,7 м')
    assert.equal(proxemicsQuestion.correctPosition, 2)
    assert.equal(proxemicsQuestion.source.openAnswerBlock.answer, '1 метр')
    assert.equal(proxemicsQuestion.reviewNotes.length, 0)

    const exothermicQuestion = findMarathonQuestion(9, 24)
    assert.equal(exothermicQuestion.prompt, 'Какие химические реакции сопровождаются выделением теплоты?')
    assert.equal(exothermicQuestion.answer, 'Экзотермических')
    assert.deepEqual(
        exothermicQuestion.options.map(({ text }) => text),
        ['Эндотермических', 'Изотермические', 'Адиабатические', 'Экзотермических']
    )

    const luxembourgQuestion = findMarathonQuestion(11, 16)
    assert.equal(luxembourgQuestion.answer, 'Люксембург')
    assert.equal(luxembourgQuestion.reviewNotes.length, 0)

    const sourcePaperQuestion = marathonSource.grades.find(({ grade }) => grade === 11)?.questions[28]
    const canonicalPaperQuestion = LMS_LYCEUM_MARATHON_QUIZZES.find(({ grade }) => grade === 11)?.questions[28]
    assert.ok(sourcePaperQuestion)
    assert.ok(canonicalPaperQuestion)
    assert.equal(
        canonicalPaperQuestion.prompt.locales.ru?.content,
        'Как называют белые пигменты, которые добавляют в бумажную массу для повышения её белизны?'
    )
    assert.equal(canonicalPaperQuestion.answer, 'Белила')
    assert.equal(canonicalPaperQuestion.sourceQuestion.source.openAnswerBlock.prompt, sourcePaperQuestion.source.openAnswerBlock.prompt)
    assert.equal(canonicalPaperQuestion.sourceQuestion.source.openAnswerBlock.answer, 'Белила')
    assert.deepEqual(
        canonicalPaperQuestion.sourceQuestion.edits.map(({ field }) => field),
        ['prompt', 'options[1]']
    )
    assert.equal(canonicalPaperQuestion.sourceQuestion.reviewNotes.length, 0)

    for (const [gradeIndex, sourceGrade] of marathonSource.grades.entries()) {
        const quiz = LMS_LYCEUM_MARATHON_QUIZZES[gradeIndex]
        assert.ok(quiz)
        assert.equal(quiz.grade, sourceGrade.grade)
        assert.equal(quiz.questions.length, 30)
        assert.equal(quiz.timeLimitSeconds, 2700)
        assert.equal(quiz.sourceLanguage, 'ru')

        const positionCounts = [0, 0, 0, 0]
        for (const [questionIndex, sourceQuestion] of sourceGrade.questions.entries()) {
            const question = quiz.questions[questionIndex]
            assert.ok(question)
            assert.equal(question.id, sourceQuestion.id)
            assert.equal(question.prompt._primary, marathonSource.language)
            assert.equal(question.prompt.locales.ru?.content, sourceQuestion.prompt)
            assert.equal(question.prompt.locales.en, undefined)
            assert.equal(question.sourceQuestion.prompt, sourceQuestion.prompt)
            assert.equal(question.sourceQuestion.answer, sourceQuestion.answer)
            assert.equal(question.correctPosition, sourceQuestion.correctPosition)
            assert.equal(question.options.length, 4)
            assert.equal(new Set(question.options.map(({ id }) => id)).size, 4)
            assert.equal(new Set(question.options.map(({ text }) => text)).size, 4)

            const correctOptions = question.options.filter(({ isCorrect }) => isCorrect)
            assert.equal(correctOptions.length, 1)
            assert.equal(correctOptions[0]?.text, sourceQuestion.answer)
            assert.equal(question.options[question.correctPosition - 1]?.isCorrect, true)
            positionCounts[question.correctPosition - 1] += 1

            for (const [optionIndex, sourceOption] of sourceQuestion.options.entries()) {
                const option = question.options[optionIndex]
                assert.ok(option)
                assert.equal(option.id, sourceOption.id)
                assert.equal(option.sourceOption.text, sourceOption.text)
                assert.equal(option.label._primary, 'ru')
                assert.equal(option.label.locales.ru?.content, sourceOption.text)
                assert.equal(option.label.locales.en, undefined)
                assert.equal(option.isCorrect, sourceOption.isCorrect)
            }
        }

        assert.ok(positionCounts.every((count) => count === 7 || count === 8))
        assert.equal(new Set(positionCounts).size > 1, true)
    }
})

test('keeps the three clarified Marathon prompts tied to their source and approved answer keys', () => {
    const cases = [
        {
            grade: 6,
            number: 2,
            prompt: 'Какому персонажу трагедии Уильяма Шекспира «Юлий Цезарь» принадлежит реплика «И ты, Брут»?',
            answer: 'Юлию Цезарю',
            sourcePrompt: 'Кому принадлежат слова "И ты, Брут"?',
            sourceAnswer: 'Юлий Цезарь',
            evidenceRef: 'https://www.folger.edu/explore/shakespeares-works/julius-caesar/read/3/1/'
        },
        {
            grade: 7,
            number: 21,
            prompt: 'В каких единицах выражают общие коэффициенты рождаемости и смертности населения?',
            answer: 'Промилле',
            sourcePrompt: 'В каких единицах рассчитываются относительные показатели, характеризующие население?',
            sourceAnswer: 'Промилле',
            evidenceRef: 'https://unstats.un.org/unsd/demographic-social/products/dyb/dybsets/2022.pdf'
        },
        {
            grade: 8,
            number: 16,
            prompt: 'Какая этническая группа является самой многочисленной в Китае?',
            answer: 'Ханьцы',
            sourcePrompt: 'Как именуют себя китайцы?',
            sourceAnswer: 'Ханьцами',
            evidenceRef: 'https://www.stats.gov.cn/english/PressRelease/202105/t20210510_1817185.html'
        }
    ]

    for (const expected of cases) {
        const question = findMarathonQuestion(expected.grade, expected.number)
        const promptEdit = question.edits.find(({ field }) => field === 'prompt')
        assert.ok(promptEdit, `${question.id} must log its prompt clarification`)
        assert.equal(question.prompt, expected.prompt)
        assert.equal(question.answer, expected.answer)
        assert.equal(question.options.length, 4)
        assert.equal(question.options.filter(({ isCorrect }) => isCorrect).length, 1)
        assert.equal(question.options.find(({ isCorrect }) => isCorrect)?.text, expected.answer)
        assert.deepEqual(question.source.openAnswerBlock, { prompt: expected.sourcePrompt, answer: expected.sourceAnswer })
        assert.equal(promptEdit.before, expected.sourcePrompt)
        assert.equal(promptEdit.after, expected.prompt)
        assert.equal(promptEdit.evidenceRef, expected.evidenceRef)
    }

    const paperQuestion = findMarathonQuestion(11, 29)
    assert.equal(paperQuestion.answer, 'Белила')
    assert.equal(paperQuestion.source.openAnswerBlock.answer, 'Белила')
    assert.equal(paperQuestion.options.find(({ isCorrect }) => isCorrect)?.text, 'Белила')
})

test('keeps Marathon source filenames and SHA-256 values on the approved per-grade allowlist', () => {
    assert.deepEqual(
        marathonSource.grades.map(({ grade, sourceFile, sourceSha256 }) => ({ grade, sourceFile, sourceSha256 })),
        [
            {
                grade: 5,
                sourceFile: 'Интеллектуальный-марафон-5-класс.txt',
                sourceSha256: '1432510be557c9dedb571ef45c6b7d44f220bd4ec8146fd2f86898b843dd722f'
            },
            {
                grade: 6,
                sourceFile: 'Интеллектуальный-марафон-6-класс.txt',
                sourceSha256: 'fe52a41a22df42ab058b9acc296a55e159606ea9d63c4386f98885e18adaddd6'
            },
            {
                grade: 7,
                sourceFile: 'Интеллектуальный-марафон-7-класс.txt',
                sourceSha256: '564bce0b6ee210b226c168959099c7d6ab9f802a81e6793deb5ba45b0dd9e5dd'
            },
            {
                grade: 8,
                sourceFile: 'Интеллектуальный-марафон-8-класс.txt',
                sourceSha256: 'aeb9350e42ce59e7fac4d2741c31dc28ca03be002c8ec2ba851c605f0f08c589'
            },
            {
                grade: 9,
                sourceFile: 'Интеллектуальный-марафон-9-класс.txt',
                sourceSha256: '8f16e094abcbb4d43c83165447233977b15216de4617630a741583519553f2d0'
            },
            {
                grade: 10,
                sourceFile: 'Интеллектуальный-марафон-10-класс.txt',
                sourceSha256: '38ed471be69ec7a63ebb1984d8960433bc041580b3f60757e505ad242a502e1d'
            },
            {
                grade: 11,
                sourceFile: 'Интеллектуальный-марафон-11-класс.txt',
                sourceSha256: '857ebcdf7ac7281519e6d7bc32744ac0395b1684e5896641f852603885b4e9cc'
            }
        ]
    )
})
