import type { LmsTemplateEntity } from './lms.seed-entity-helpers'
import { vlc } from './basic.template'
import { buildTransactionalObjectConfig } from './lms.seed-entity-helpers'

export const lmsSeedQuizEntities: LmsTemplateEntity[] = [
    {
        codename: 'Quizzes',
        kind: 'object',
        name: vlc('Quizzes', 'Тесты'),
        description: vlc(
            'Quiz assessments with ordered questions and optional introduction blocks.',
            'Тестовые задания с упорядоченными вопросами и необязательными вводными блоками.'
        ),
        config: {
            runtime: {
                menuVisibility: 'primary',
                icon: 'school'
            }
        },
        components: [
            {
                codename: 'Title',
                dataType: 'STRING',
                name: vlc('Title', 'Заголовок'),
                isRequired: true,
                isDisplayComponent: true,
                sortOrder: 1,
                validationRules: { maxLength: 255, localized: true, versioned: true }
            },
            {
                codename: 'Description',
                dataType: 'STRING',
                name: vlc('Description', 'Описание'),
                sortOrder: 2,
                validationRules: { localized: true, versioned: true }
            },
            {
                codename: 'PassingScorePercent',
                dataType: 'NUMBER',
                name: vlc('Passing Score %', 'Проходной балл %'),
                sortOrder: 3,
                validationRules: { min: 0, max: 100 }
            },
            {
                codename: 'MaxAttempts',
                dataType: 'NUMBER',
                name: vlc('Max Attempts', 'Макс. попыток'),
                sortOrder: 4,
                validationRules: { min: 1 }
            },
            {
                codename: 'TimeLimitSeconds',
                dataType: 'NUMBER',
                name: vlc('Time Limit (seconds)', 'Ограничение времени (секунды)'),
                sortOrder: 5,
                validationRules: { min: 0, max: 86400 }
            },
            {
                codename: 'PauseTimerOnBlockIntro',
                dataType: 'BOOLEAN',
                name: vlc('Pause timer on block introductions', 'Останавливать таймер на вводных страницах блоков'),
                sortOrder: 6,
                uiConfig: { defaultValue: false }
            },
            {
                codename: 'BlockRelativeNumbering',
                dataType: 'BOOLEAN',
                name: vlc('Number questions within each block', 'Нумеровать вопросы внутри каждого блока'),
                sortOrder: 7,
                uiConfig: { defaultValue: false }
            },
            {
                codename: 'ConfirmAnswerBeforeNext',
                dataType: 'BOOLEAN',
                name: vlc('Confirm answer before continuing', 'Подтверждать ответ перед переходом'),
                sortOrder: 8,
                uiConfig: { defaultValue: false }
            },
            {
                codename: 'CompletionText',
                dataType: 'STRING',
                name: vlc('Completion Message', 'Текст завершения'),
                sortOrder: 9,
                validationRules: { maxLength: 2000, localized: true, versioned: true },
                uiConfig: { widget: 'textarea', rows: 4 }
            },
            {
                codename: 'Blocks',
                dataType: 'TABLE',
                name: vlc('Blocks', 'Блоки'),
                sortOrder: 10,
                validationRules: { maxRows: 100 },
                uiConfig: { rowOrdering: { orderFieldCodename: 'SortOrder', labelFieldCodename: 'Title' } },
                childComponents: [
                    {
                        codename: 'BlockKey',
                        dataType: 'STRING',
                        name: vlc('Block Key', 'Ключ блока'),
                        isRequired: true,
                        sortOrder: 1,
                        uiConfig: {
                            hidden: true,
                            resetOnCopy: true,
                            generateUuidV7: true,
                            siblingRowSelectKey: true
                        }
                    },
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        sortOrder: 2,
                        validationRules: { localized: true, versioned: true, maxLength: 255 }
                    },
                    {
                        codename: 'Introduction',
                        dataType: 'STRING',
                        name: vlc('Introduction', 'Введение'),
                        sortOrder: 3,
                        validationRules: { localized: true, versioned: true, maxLength: 10000 },
                        uiConfig: { widget: 'textarea', rows: 4 }
                    },
                    {
                        codename: 'SortOrder',
                        dataType: 'NUMBER',
                        name: vlc('Order', 'Порядок'),
                        sortOrder: 4,
                        validationRules: { min: 0 },
                        uiConfig: { hidden: true, resetOnCopy: true, defaultValue: 0 }
                    }
                ]
            },
            {
                codename: 'Questions',
                dataType: 'TABLE',
                name: vlc('Questions', 'Вопросы'),
                sortOrder: 11,
                uiConfig: { rowOrdering: { orderFieldCodename: 'SortOrder', labelFieldCodename: 'Prompt' } },
                childComponents: [
                    {
                        codename: 'Prompt',
                        dataType: 'STRING',
                        name: vlc('Prompt', 'Текст вопроса'),
                        isRequired: true,
                        sortOrder: 1,
                        validationRules: { localized: true, versioned: true },
                        uiConfig: { widget: 'textarea', rows: 4 }
                    },
                    {
                        codename: 'QuestionDescription',
                        dataType: 'STRING',
                        name: vlc('Description', 'Описание'),
                        sortOrder: 2,
                        validationRules: { localized: true, versioned: true },
                        uiConfig: { widget: 'textarea', rows: 4 }
                    },
                    {
                        codename: 'QuestionType',
                        dataType: 'REF',
                        name: vlc('Question Type', 'Тип вопроса'),
                        isRequired: true,
                        sortOrder: 3,
                        targetEntityCodename: 'QuestionType',
                        targetEntityKind: 'enumeration'
                    },
                    {
                        codename: 'Difficulty',
                        dataType: 'NUMBER',
                        name: vlc('Difficulty', 'Сложность'),
                        sortOrder: 4,
                        validationRules: { min: 1, max: 5 }
                    },
                    {
                        codename: 'Explanation',
                        dataType: 'STRING',
                        name: vlc('Explanation', 'Пояснение'),
                        sortOrder: 5,
                        validationRules: { localized: true, versioned: true },
                        uiConfig: { widget: 'textarea', rows: 4 }
                    },
                    {
                        codename: 'BlockKey',
                        dataType: 'STRING',
                        name: vlc('Block', 'Блок'),
                        sortOrder: 6,
                        uiConfig: {
                            siblingRowSelect: {
                                tableCodename: 'Blocks',
                                valueFieldCodename: 'BlockKey',
                                labelFieldCodename: 'Title',
                                requiredWithRows: true,
                                requireEachTargetReferenced: true
                            }
                        }
                    },
                    {
                        codename: 'Options',
                        dataType: 'JSON',
                        name: vlc('Options', 'Варианты ответов'),
                        sortOrder: 7,
                        uiConfig: { widget: 'assessmentOptions', minOptions: 2, maxOptions: 20 }
                    },
                    {
                        codename: 'SortOrder',
                        dataType: 'NUMBER',
                        name: vlc('Sort Order', 'Порядок'),
                        sortOrder: 8,
                        uiConfig: { hidden: true, resetOnCopy: true, defaultValue: 0 }
                    }
                ]
            },
            {
                codename: 'SortOrder',
                dataType: 'NUMBER',
                name: vlc('Sort Order', 'Порядок'),
                isRequired: true,
                sortOrder: 9,
                validationRules: { min: 0 },
                uiConfig: { hidden: true, serverOwned: true, defaultValue: 1 }
            }
        ]
    },
    {
        codename: 'QuizResponses',
        kind: 'object',
        name: vlc('Quiz Responses', 'Ответы на тесты'),
        description: vlc('Individual quiz answer records for scoring.', 'Записи ответов на тесты для подсчёта баллов.'),
        config: {
            ...buildTransactionalObjectConfig({
                prefix: 'QAR-',
                effectiveDateField: 'SubmittedAt',
                targetLedgers: ['ScoreLedger']
            }),
            recordPolicy: { version: 1, workspaceCopy: 'exclude', runtimeMutation: 'deny' }
        },
        components: [
            {
                codename: 'StudentId',
                dataType: 'REF',
                name: vlc('Student', 'Студент'),
                isRequired: true,
                sortOrder: 1,
                targetEntityCodename: 'Students',
                targetEntityKind: 'object'
            },
            {
                codename: 'QuizId',
                dataType: 'REF',
                name: vlc('Quiz', 'Тест'),
                isRequired: true,
                sortOrder: 2,
                targetEntityCodename: 'Quizzes',
                targetEntityKind: 'object'
            },
            {
                codename: 'QuestionId',
                dataType: 'STRING',
                name: vlc('Question ID', 'ID вопроса'),
                isRequired: true,
                sortOrder: 3,
                uiConfig: { hidden: true, serverOwned: true }
            },
            {
                codename: 'AttemptId',
                dataType: 'REF',
                name: vlc('Attempt', 'Попытка'),
                isRequired: true,
                sortOrder: 4,
                targetEntityCodename: 'QuizAttempts',
                targetEntityKind: 'object',
                uiConfig: { hidden: true }
            },
            {
                codename: 'SelectedOptionIds',
                dataType: 'JSON',
                name: vlc('Selected Options', 'Выбранные варианты'),
                sortOrder: 5,
                uiConfig: { hidden: true, serverOwned: true }
            },
            {
                codename: 'IsCorrect',
                dataType: 'BOOLEAN',
                name: vlc('Is Correct', 'Правильно'),
                sortOrder: 6
            },
            {
                codename: 'AttemptNumber',
                dataType: 'NUMBER',
                name: vlc('Attempt Number', 'Номер попытки'),
                sortOrder: 7,
                validationRules: { min: 1 }
            },
            {
                codename: 'SubmittedAt',
                dataType: 'DATE',
                name: vlc('Submitted At', 'Отправлено'),
                sortOrder: 8
            }
        ]
    },
    {
        codename: 'QuizAttempts',
        kind: 'object',
        name: vlc('Quiz Attempts', 'Попытки тестов'),
        description: vlc(
            'Submitted quiz attempts with score and pass/fail state.',
            'Отправленные попытки тестов с баллом и состоянием прохождения.'
        ),
        config: {
            ...buildTransactionalObjectConfig({
                prefix: 'QAT-',
                effectiveDateField: 'StartedAt',
                stateField: 'Status',
                states: [
                    { codename: 'Started', title: 'Started', isInitial: true },
                    { codename: 'Submitted', title: 'Submitted' },
                    { codename: 'TimedOut', title: 'Timed Out', isFinal: true },
                    { codename: 'Revoked', title: 'Revoked', isFinal: true },
                    { codename: 'Passed', title: 'Passed', isFinal: true },
                    { codename: 'Failed', title: 'Failed', isFinal: true }
                ],
                targetLedgers: ['ScoreLedger', 'LearningActivityLedger']
            }),
            recordPolicy: { version: 1, workspaceCopy: 'exclude', runtimeMutation: 'deny' }
        },
        components: [
            {
                codename: 'StudentId',
                dataType: 'REF',
                name: vlc('Student', 'Студент'),
                isRequired: true,
                sortOrder: 1,
                targetEntityCodename: 'Students',
                targetEntityKind: 'object'
            },
            {
                codename: 'QuizId',
                dataType: 'REF',
                name: vlc('Quiz', 'Тест'),
                isRequired: true,
                sortOrder: 2,
                targetEntityCodename: 'Quizzes',
                targetEntityKind: 'object'
            },
            {
                codename: 'AttemptNumber',
                dataType: 'NUMBER',
                name: vlc('Attempt Number', 'Номер попытки'),
                isRequired: true,
                sortOrder: 3,
                validationRules: { min: 1 }
            },
            {
                codename: 'StartedAt',
                dataType: 'DATE',
                name: vlc('Started At', 'Начато'),
                sortOrder: 4
            },
            {
                codename: 'SubmittedAt',
                dataType: 'DATE',
                name: vlc('Submitted At', 'Отправлено'),
                sortOrder: 5
            },
            {
                codename: 'DeadlineAt',
                dataType: 'DATE',
                name: vlc('Deadline', 'Срок завершения'),
                sortOrder: 6
            },
            {
                codename: 'EffectiveTimeLimitSeconds',
                dataType: 'NUMBER',
                name: vlc('Time Limit (seconds)', 'Ограничение времени (секунды)'),
                sortOrder: 7,
                validationRules: { min: 0, max: 86400 }
            },
            {
                codename: 'PassingScorePercentSnapshot',
                dataType: 'NUMBER',
                name: vlc('Passing Score Snapshot (%)', 'Снимок проходного балла (%)'),
                sortOrder: 8,
                validationRules: { min: 0, max: 100 },
                uiConfig: { hidden: true }
            },
            {
                codename: 'AccessLinkId',
                dataType: 'REF',
                name: vlc('Access Link', 'Ссылка доступа'),
                sortOrder: 9,
                targetEntityCodename: 'AccessLinks',
                targetEntityKind: 'object',
                uiConfig: { hidden: true }
            },
            {
                codename: 'FinishedReason',
                dataType: 'STRING',
                name: vlc('Finished Reason', 'Причина завершения'),
                sortOrder: 10,
                validationRules: { maxLength: 30 }
            },
            {
                codename: 'QuestionsSnapshot',
                dataType: 'JSON',
                name: vlc('Question Snapshot', 'Снимок вопросов'),
                sortOrder: 11,
                uiConfig: { hidden: true }
            },
            {
                codename: 'QuestionSetDigest',
                dataType: 'STRING',
                name: vlc('Question Set Digest', 'Контрольная сумма набора вопросов'),
                sortOrder: 12,
                validationRules: { maxLength: 128 },
                uiConfig: { hidden: true }
            },
            {
                codename: 'Score',
                dataType: 'NUMBER',
                name: vlc('Score', 'Балл'),
                sortOrder: 13,
                validationRules: { min: 0 }
            },
            {
                codename: 'TotalQuestions',
                dataType: 'NUMBER',
                name: vlc('Total Questions', 'Всего вопросов'),
                sortOrder: 14,
                validationRules: { min: 0, max: 1000 }
            },
            {
                codename: 'Passed',
                dataType: 'BOOLEAN',
                name: vlc('Passed', 'Пройдено'),
                sortOrder: 15
            },
            {
                codename: 'Status',
                dataType: 'STRING',
                name: vlc('Status', 'Статус'),
                isRequired: true,
                sortOrder: 16,
                validationRules: { maxLength: 30 }
            },
            {
                codename: 'ClassIdSnapshot',
                dataType: 'REF',
                name: vlc('Class Snapshot', 'Снимок класса'),
                sortOrder: 17,
                targetEntityCodename: 'Classes',
                targetEntityKind: 'object',
                uiConfig: { hidden: true, serverOwned: true, resetOnCopy: true }
            },
            {
                codename: 'ScorePercent',
                dataType: 'NUMBER',
                name: vlc('Score (%)', 'Результат (%)'),
                sortOrder: 18,
                validationRules: { min: 0, max: 100, precision: 5, scale: 2 },
                uiConfig: { hidden: true, serverOwned: true, defaultValue: null, resetOnCopy: true }
            },
            {
                codename: 'FlowSnapshot',
                dataType: 'JSON',
                name: vlc('Flow Snapshot', 'Снимок структуры теста'),
                sortOrder: 19,
                uiConfig: { hidden: true, serverOwned: true, resetOnCopy: true }
            },
            {
                codename: 'Phase',
                dataType: 'STRING',
                name: vlc('Attempt Phase', 'Фаза попытки'),
                sortOrder: 20,
                validationRules: { maxLength: 20 },
                uiConfig: { hidden: true, serverOwned: true, resetOnCopy: true }
            },
            {
                codename: 'PhaseRevision',
                dataType: 'NUMBER',
                name: vlc('Phase Revision', 'Версия фазы'),
                sortOrder: 21,
                validationRules: { min: 0, max: 1100 },
                uiConfig: { hidden: true, serverOwned: true, resetOnCopy: true }
            },
            {
                codename: 'TimerState',
                dataType: 'STRING',
                name: vlc('Timer State', 'Состояние таймера'),
                sortOrder: 22,
                validationRules: { maxLength: 20 },
                uiConfig: { hidden: true, serverOwned: true, resetOnCopy: true }
            },
            {
                codename: 'FrozenRemainingMs',
                dataType: 'NUMBER',
                name: vlc('Frozen Remaining Time (ms)', 'Оставшееся время в миллисекундах'),
                sortOrder: 23,
                validationRules: { min: 1, max: 86400000 },
                uiConfig: { hidden: true, serverOwned: true, resetOnCopy: true, defaultValue: null }
            }
        ]
    }
]
