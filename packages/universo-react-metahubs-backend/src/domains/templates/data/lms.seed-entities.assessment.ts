import type { LmsTemplateEntity } from './lms.seed-entity-helpers'
import { vlc } from './basic.template'
import { LMS_ASSIGNMENT_SUBMISSION_WORKFLOW_ACTIONS } from './lms.seed-workflows'
import { buildTransactionalObjectConfig } from './lms.seed-entity-helpers'

export const lmsSeedAssessmentEntities: LmsTemplateEntity[] = [
    {
        codename: 'Quizzes',
        kind: 'object',
        name: vlc('Quizzes', 'Тесты'),
        description: vlc('Quiz assessments with questions stored as JSON.', 'Тестовые задания с вопросами, хранящимися как JSON.'),
        components: [
            {
                codename: 'Title',
                dataType: 'STRING',
                name: vlc('Title', 'Заголовок'),
                isRequired: true,
                isDisplayComponent: true,
                sortOrder: 1,
                validationRules: { maxLength: 500, localized: true, versioned: true }
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
                codename: 'Questions',
                dataType: 'TABLE',
                name: vlc('Questions', 'Вопросы'),
                sortOrder: 5,
                childComponents: [
                    {
                        codename: 'Prompt',
                        dataType: 'STRING',
                        name: vlc('Prompt', 'Текст вопроса'),
                        isRequired: true,
                        sortOrder: 1,
                        validationRules: { localized: true, versioned: true }
                    },
                    {
                        codename: 'QuestionDescription',
                        dataType: 'STRING',
                        name: vlc('Description', 'Описание'),
                        sortOrder: 2,
                        validationRules: { localized: true, versioned: true }
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
                        validationRules: { localized: true, versioned: true }
                    },
                    {
                        codename: 'Options',
                        dataType: 'JSON',
                        name: vlc('Options', 'Варианты ответов'),
                        sortOrder: 6
                    },
                    {
                        codename: 'SortOrder',
                        dataType: 'NUMBER',
                        name: vlc('Sort Order', 'Порядок'),
                        sortOrder: 7
                    }
                ]
            }
        ]
    },
    {
        codename: 'QuizResponses',
        kind: 'object',
        name: vlc('Quiz Responses', 'Ответы на тесты'),
        description: vlc('Individual quiz answer records for scoring.', 'Записи ответов на тесты для подсчёта баллов.'),
        config: buildTransactionalObjectConfig({
            prefix: 'QAR-',
            effectiveDateField: 'SubmittedAt',
            targetLedgers: ['ScoreLedger']
        }),
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
                sortOrder: 3
            },
            {
                codename: 'SelectedOptionIds',
                dataType: 'JSON',
                name: vlc('Selected Options', 'Выбранные варианты'),
                sortOrder: 4
            },
            {
                codename: 'IsCorrect',
                dataType: 'BOOLEAN',
                name: vlc('Is Correct', 'Правильно'),
                sortOrder: 5
            },
            {
                codename: 'AttemptNumber',
                dataType: 'NUMBER',
                name: vlc('Attempt Number', 'Номер попытки'),
                sortOrder: 6,
                validationRules: { min: 1 }
            },
            {
                codename: 'SubmittedAt',
                dataType: 'DATE',
                name: vlc('Submitted At', 'Отправлено'),
                sortOrder: 7
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
        config: buildTransactionalObjectConfig({
            prefix: 'QAT-',
            effectiveDateField: 'SubmittedAt',
            stateField: 'Status',
            states: [
                { codename: 'Started', title: 'Started', isInitial: true },
                { codename: 'Submitted', title: 'Submitted' },
                { codename: 'Passed', title: 'Passed', isFinal: true },
                { codename: 'Failed', title: 'Failed', isFinal: true }
            ],
            targetLedgers: ['ScoreLedger', 'LearningActivityLedger']
        }),
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
                isRequired: true,
                sortOrder: 5
            },
            {
                codename: 'Score',
                dataType: 'NUMBER',
                name: vlc('Score', 'Балл'),
                sortOrder: 6,
                validationRules: { min: 0 }
            },
            {
                codename: 'Passed',
                dataType: 'BOOLEAN',
                name: vlc('Passed', 'Пройдено'),
                sortOrder: 7
            },
            {
                codename: 'Status',
                dataType: 'STRING',
                name: vlc('Status', 'Статус'),
                isRequired: true,
                sortOrder: 8,
                validationRules: { maxLength: 30 }
            }
        ]
    },
    {
        codename: 'AccessLinks',
        kind: 'object',
        name: vlc('Access Links', 'Ссылки доступа'),
        description: vlc(
            'Direct access links and QR codes for learning content and quizzes.',
            'Прямые ссылки и QR-коды для учебного контента и тестов.'
        ),
        components: [
            {
                codename: 'Slug',
                dataType: 'STRING',
                name: vlc('Slug', 'Слаг'),
                isRequired: true,
                isDisplayComponent: true,
                sortOrder: 1,
                validationRules: { maxLength: 255 }
            },
            {
                codename: 'TargetType',
                dataType: 'STRING',
                name: vlc('Target Type', 'Тип цели'),
                isRequired: true,
                sortOrder: 2,
                validationRules: { maxLength: 30 }
            },
            {
                codename: 'TargetId',
                dataType: 'STRING',
                name: vlc('Target ID', 'ID цели'),
                isRequired: true,
                sortOrder: 3
            },
            {
                codename: 'ContentNodeIdRef',
                dataType: 'REF',
                name: vlc('Learning Content', 'Учебный контент'),
                sortOrder: 4,
                targetEntityCodename: 'LearningResources',
                targetEntityKind: 'object',
                uiConfig: { hidden: true }
            },
            {
                codename: 'LinkClassId',
                dataType: 'REF',
                name: vlc('Class', 'Класс'),
                sortOrder: 5,
                targetEntityCodename: 'Classes',
                targetEntityKind: 'object'
            },
            {
                codename: 'IsActive',
                dataType: 'BOOLEAN',
                name: vlc('Is Active', 'Активна'),
                sortOrder: 6
            },
            {
                codename: 'ExpiresAt',
                dataType: 'DATE',
                name: vlc('Expires At', 'Истекает'),
                sortOrder: 7
            },
            {
                codename: 'MaxUses',
                dataType: 'NUMBER',
                name: vlc('Max Uses', 'Макс. использований'),
                sortOrder: 8,
                validationRules: { min: 1 }
            },
            {
                codename: 'UseCount',
                dataType: 'NUMBER',
                name: vlc('Use Count', 'Счётчик'),
                sortOrder: 9,
                validationRules: { min: 0 }
            },
            {
                codename: 'LinkTitle',
                dataType: 'STRING',
                name: vlc('Title', 'Заголовок'),
                sortOrder: 10,
                validationRules: { maxLength: 500, localized: true, versioned: true }
            }
        ]
    },
    {
        codename: 'Enrollments',
        kind: 'object',
        name: vlc('Enrollments', 'Записи'),
        description: vlc('Class-student-learning item enrollment bridge.', 'Связь класса, учащегося и учебного объекта.'),
        config: {
            recordBehavior: {
                mode: 'transactional',
                numbering: {
                    enabled: true,
                    scope: 'workspace',
                    periodicity: 'year',
                    prefix: 'ENR-',
                    minLength: 6
                },
                effectiveDate: {
                    enabled: true,
                    fieldCodename: 'EnrolledAt',
                    defaultToNow: true
                },
                lifecycle: {
                    enabled: true,
                    stateFieldCodename: 'EnrollmentStatus',
                    states: [
                        { codename: 'Invited', title: 'Invited', isInitial: true },
                        { codename: 'Active', title: 'Active' },
                        { codename: 'Completed', title: 'Completed', isFinal: true }
                    ]
                },
                posting: {
                    mode: 'manual',
                    targetLedgers: ['ProgressLedger'],
                    moduleCodename: 'EnrollmentPostingModule'
                },
                immutability: 'posted'
            },
            runtimeValidations: {
                requiredWhen: [
                    {
                        field: 'DueDate',
                        when: { field: 'DueDateMode', equals: 'ByDate' },
                        message: vlc(
                            'Due Date is required when Due Date Mode is Due by date',
                            'Срок обязателен, когда режим срока задан как дата'
                        )
                    },
                    {
                        field: 'DuePeriodDays',
                        when: { field: 'DueDateMode', equals: 'ForPeriod' },
                        message: vlc(
                            'Due Period is required when Due Date Mode is Due for period',
                            'Период срока обязателен, когда режим срока задан как период'
                        )
                    }
                ],
                dateOrder: [
                    {
                        startField: 'EnrolledAt',
                        endField: 'DueDate',
                        allowEqual: true,
                        message: vlc('Due Date must be on or after Enrolled At', 'Срок должен быть не раньше даты записи')
                    }
                ]
            },
            runtimeDerivations: {
                dateOffset: [
                    {
                        targetField: 'DueDate',
                        startField: 'EnrolledAt',
                        offsetDaysField: 'DuePeriodDays',
                        when: { field: 'DueDateMode', equals: 'ForPeriod' },
                        clearWhen: { field: 'DueDateMode', equals: 'NoDueDate' }
                    }
                ]
            }
        },
        components: [
            {
                codename: 'EnrollmentStudentId',
                dataType: 'REF',
                name: vlc('Student', 'Студент'),
                isRequired: true,
                sortOrder: 1,
                targetEntityCodename: 'Students',
                targetEntityKind: 'object'
            },
            {
                codename: 'EnrollmentClassId',
                dataType: 'REF',
                name: vlc('Class', 'Класс'),
                isRequired: true,
                sortOrder: 2,
                targetEntityCodename: 'Classes',
                targetEntityKind: 'object'
            },
            {
                codename: 'AssignedUserId',
                dataType: 'STRING',
                name: vlc('Assigned User ID', 'ID назначенного пользователя'),
                sortOrder: 3,
                validationRules: { maxLength: 128 },
                uiConfig: { hidden: true }
            },
            {
                codename: 'TargetTitle',
                dataType: 'STRING',
                name: vlc('Learning Item', 'Учебный объект'),
                isRequired: true,
                isDisplayComponent: true,
                sortOrder: 4,
                validationRules: { maxLength: 500, localized: true, versioned: true }
            },
            {
                codename: 'TargetType',
                dataType: 'STRING',
                name: vlc('Target Type', 'Тип цели'),
                isRequired: true,
                sortOrder: 5,
                validationRules: { maxLength: 30 },
                uiConfig: {
                    hidden: true,
                    widget: 'select',
                    stringOptions: [
                        { value: 'course', label: vlc('Course', 'Курс') },
                        { value: 'track', label: vlc('Learning Track', 'Учебный трек') },
                        { value: 'content', label: vlc('Learning Content', 'Учебный контент') }
                    ]
                }
            },
            {
                codename: 'TargetId',
                dataType: 'STRING',
                name: vlc('Target ID', 'ID цели'),
                isRequired: true,
                sortOrder: 6,
                validationRules: { maxLength: 80 },
                uiConfig: {
                    hidden: true
                }
            },
            {
                codename: 'ContentNodeIdRef',
                dataType: 'STRING',
                name: vlc('Content Node ID', 'ID узла контента'),
                sortOrder: 7,
                uiConfig: { hidden: true }
            },
            {
                codename: 'EnrollmentStatus',
                dataType: 'REF',
                name: vlc('Status', 'Статус'),
                isRequired: true,
                sortOrder: 8,
                targetEntityCodename: 'EnrollmentStatus',
                targetEntityKind: 'enumeration'
            },
            {
                codename: 'EnrolledAt',
                dataType: 'DATE',
                name: vlc('Enrolled At', 'Записан'),
                isRequired: true,
                sortOrder: 9
            },
            {
                codename: 'DueDateMode',
                dataType: 'STRING',
                name: vlc('Due Date Mode', 'Режим срока'),
                isRequired: true,
                sortOrder: 10,
                validationRules: { maxLength: 32 },
                uiConfig: {
                    widget: 'select',
                    stringOptions: [
                        { value: 'ByDate', label: vlc('Due by date', 'До даты') },
                        { value: 'ForPeriod', label: vlc('Due for period', 'В течение периода') },
                        { value: 'NoDueDate', label: vlc('No due date', 'Без срока') }
                    ]
                }
            },
            {
                codename: 'DueDate',
                dataType: 'DATE',
                name: vlc('Due Date', 'Срок'),
                sortOrder: 11,
                uiConfig: {
                    visibleWhen: { field: 'DueDateMode', equals: 'ByDate' },
                    requiredWhen: { field: 'DueDateMode', equals: 'ByDate' },
                    derivedDateOffset: {
                        startField: 'EnrolledAt',
                        offsetDaysField: 'DuePeriodDays',
                        when: { field: 'DueDateMode', equals: 'ForPeriod' },
                        clearWhen: { field: 'DueDateMode', equals: 'NoDueDate' }
                    }
                }
            },
            {
                codename: 'DuePeriodDays',
                dataType: 'NUMBER',
                name: vlc('Due Period, Days', 'Период срока, дни'),
                sortOrder: 12,
                validationRules: { min: 0, max: 3650 },
                uiConfig: {
                    visibleWhen: { field: 'DueDateMode', equals: 'ForPeriod' },
                    requiredWhen: { field: 'DueDateMode', equals: 'ForPeriod' }
                }
            },
            {
                codename: 'RestrictAfterDueDate',
                dataType: 'BOOLEAN',
                name: vlc('Restrict After Due Date', 'Ограничить после срока'),
                sortOrder: 13
            },
            {
                codename: 'CompletedAt',
                dataType: 'DATE',
                name: vlc('Completed At', 'Завершено'),
                sortOrder: 14
            },
            {
                codename: 'Score',
                dataType: 'NUMBER',
                name: vlc('Score', 'Балл'),
                sortOrder: 15
            }
        ]
    },
    {
        codename: 'Assignments',
        kind: 'object',
        name: vlc('Assignments', 'Назначения'),
        description: vlc(
            'Learning assignments for students, classes, departments, and tracks.',
            'Учебные назначения для студентов, классов, подразделений и треков.'
        ),
        config: buildTransactionalObjectConfig({
            prefix: 'ASN-',
            effectiveDateField: 'DueAt',
            stateField: 'Status',
            states: [
                { codename: 'Draft', title: 'Draft', isInitial: true },
                { codename: 'Assigned', title: 'Assigned' },
                { codename: 'Completed', title: 'Completed', isFinal: true },
                { codename: 'Cancelled', title: 'Cancelled', isFinal: true }
            ],
            targetLedgers: ['LearningActivityLedger']
        }),
        components: [
            {
                codename: 'Title',
                dataType: 'STRING',
                name: vlc('Title', 'Заголовок'),
                isRequired: true,
                isDisplayComponent: true,
                sortOrder: 1,
                validationRules: { maxLength: 500, localized: true, versioned: true }
            },
            {
                codename: 'TargetType',
                dataType: 'STRING',
                name: vlc('Target Type', 'Тип адресата'),
                isRequired: true,
                sortOrder: 2,
                validationRules: { maxLength: 40 }
            },
            {
                codename: 'TargetId',
                dataType: 'STRING',
                name: vlc('Target ID', 'ID адресата'),
                sortOrder: 3
            },
            {
                codename: 'ContentNodeId',
                dataType: 'REF',
                name: vlc('Learning Resource', 'Учебный ресурс'),
                sortOrder: 4,
                targetEntityCodename: 'LearningResources',
                targetEntityKind: 'object'
            },
            {
                codename: 'LearningTrackId',
                dataType: 'REF',
                name: vlc('Learning Track', 'Учебный трек'),
                sortOrder: 5,
                targetEntityCodename: 'LearningTracks',
                targetEntityKind: 'object'
            },
            {
                codename: 'Status',
                dataType: 'REF',
                name: vlc('Status', 'Статус'),
                sortOrder: 6,
                targetEntityCodename: 'AssignmentStatus',
                targetEntityKind: 'enumeration'
            },
            {
                codename: 'DueAt',
                dataType: 'DATE',
                name: vlc('Due At', 'Срок'),
                sortOrder: 7
            }
        ]
    },
    {
        codename: 'AssignmentSubmissions',
        kind: 'object',
        name: vlc('Assignment Submissions', 'Сдачи заданий'),
        description: vlc(
            'Student assignment submissions with review state and score.',
            'Сдачи заданий студентами со статусом проверки и баллом.'
        ),
        config: buildTransactionalObjectConfig({
            prefix: 'SUB-',
            effectiveDateField: 'SubmittedAt',
            stateField: 'Status',
            states: [
                { codename: 'Submitted', title: 'Submitted', isInitial: true },
                { codename: 'PendingReview', title: 'Pending Review' },
                { codename: 'Accepted', title: 'Accepted', isFinal: true },
                { codename: 'Declined', title: 'Declined', isFinal: true }
            ],
            targetLedgers: ['ScoreLedger', 'LearningActivityLedger'],
            workflowActions: LMS_ASSIGNMENT_SUBMISSION_WORKFLOW_ACTIONS
        }),
        components: [
            {
                codename: 'AssignmentId',
                dataType: 'REF',
                name: vlc('Assignment', 'Назначение'),
                isRequired: true,
                sortOrder: 1,
                targetEntityCodename: 'Assignments',
                targetEntityKind: 'object'
            },
            {
                codename: 'StudentId',
                dataType: 'REF',
                name: vlc('Student', 'Студент'),
                isRequired: true,
                sortOrder: 2,
                targetEntityCodename: 'Students',
                targetEntityKind: 'object'
            },
            {
                codename: 'SubmittedAt',
                dataType: 'DATE',
                name: vlc('Submitted At', 'Отправлено'),
                isRequired: true,
                sortOrder: 3
            },
            {
                codename: 'Status',
                dataType: 'STRING',
                name: vlc('Status', 'Статус'),
                isRequired: true,
                sortOrder: 4,
                validationRules: { maxLength: 30 }
            },
            {
                codename: 'Score',
                dataType: 'NUMBER',
                name: vlc('Score', 'Балл'),
                sortOrder: 5,
                validationRules: { min: 0 }
            },
            {
                codename: 'ReviewerId',
                dataType: 'STRING',
                name: vlc('Reviewer ID', 'ID проверяющего'),
                sortOrder: 6,
                validationRules: { maxLength: 100 },
                uiConfig: { hidden: true }
            },
            {
                codename: 'Feedback',
                dataType: 'STRING',
                name: vlc('Feedback', 'Обратная связь'),
                sortOrder: 7,
                validationRules: { localized: true, versioned: true }
            }
        ]
    }
]
