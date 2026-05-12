import type { MetahubTemplateManifest, TemplateSeedZoneWidget } from '@universo/types'
import { vlc, enrichConfigWithVlcTimestamps } from './basic.template'

type LmsTemplateEntity = NonNullable<MetahubTemplateManifest['seed']['entities']>[number]

const LMS_PUBLIC_GUEST_RUNTIME_CONFIG = {
    objects: {
        accessLinks: 'AccessLinks',
        participants: 'Students',
        assessments: 'Quizzes',
        contentNodes: 'Modules',
        assessmentResponses: 'QuizResponses',
        contentProgress: 'ModuleProgress'
    },
    fields: {
        accessLink: {
            slug: 'Slug',
            targetType: 'TargetType',
            targetId: 'TargetId',
            isActive: 'IsActive',
            expiresAt: 'ExpiresAt',
            maxUses: 'MaxUses',
            useCount: 'UseCount',
            title: 'LinkTitle',
            classId: 'LinkClassId'
        },
        participant: {
            displayName: 'DisplayName',
            isGuest: 'IsGuest',
            guestSessionToken: 'GuestSessionToken'
        },
        contentNode: {
            title: 'Title',
            description: 'Description',
            contentItems: 'ContentItems'
        },
        contentPart: {
            itemType: 'ItemType',
            itemTitle: 'ItemTitle',
            itemContent: 'ItemContent',
            quizId: 'QuizId',
            sortOrder: 'SortOrder'
        },
        assessment: {
            title: 'Title',
            description: 'Description',
            passingScorePercent: 'PassingScorePercent',
            questions: 'Questions'
        },
        assessmentQuestion: {
            prompt: 'Prompt',
            description: 'QuestionDescription',
            questionType: 'QuestionType',
            explanation: 'Explanation',
            sortOrder: 'SortOrder',
            options: 'Options'
        },
        assessmentResponse: {
            studentId: 'StudentId',
            quizId: 'QuizId',
            questionId: 'QuestionId',
            selectedOptionIds: 'SelectedOptionIds',
            isCorrect: 'IsCorrect',
            attemptNumber: 'AttemptNumber',
            submittedAt: 'SubmittedAt'
        },
        contentProgress: {
            studentId: 'ProgressStudentId',
            moduleId: 'ModuleId',
            status: 'ProgressStatus',
            progressPercent: 'ProgressPercent',
            startedAt: 'StartedAt',
            completedAt: 'CompletedAt',
            lastAccessedItemIndex: 'LastAccessedItemIndex'
        }
    }
} as const

function buildLmsSeedZoneWidgets(): TemplateSeedZoneWidget[] {
    return [
        {
            zone: 'left' as const,
            widgetKey: 'menuWidget',
            sortOrder: 3,
            config: enrichConfigWithVlcTimestamps({
                showTitle: false,
                title: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Learning', version: 1, isActive: true },
                        ru: { content: 'Обучение', version: 1, isActive: true }
                    }
                },
                autoShowAllCatalogs: false,
                bindToHub: false,
                boundTreeEntityId: null,
                maxPrimaryItems: 6,
                overflowLabelKey: 'runtime.menu.more',
                startPage: 'LearnerHome',
                workspacePlacement: 'primary',
                items: [
                    {
                        id: 'lms-nav-home',
                        kind: 'page',
                        title: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Home', version: 1, isActive: true },
                                ru: { content: 'Главная', version: 1, isActive: true }
                            }
                        },
                        icon: 'home',
                        href: null,
                        sectionId: 'LearnerHome',
                        sortOrder: 0,
                        isActive: true
                    },
                    {
                        id: 'lms-nav-catalog',
                        kind: 'catalog',
                        title: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Catalog', version: 1, isActive: true },
                                ru: { content: 'Каталог', version: 1, isActive: true }
                            }
                        },
                        icon: 'catalog',
                        href: null,
                        catalogId: 'Modules',
                        sortOrder: 1,
                        isActive: true
                    },
                    {
                        id: 'lms-nav-knowledge',
                        kind: 'catalog',
                        title: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Knowledge', version: 1, isActive: true },
                                ru: { content: 'Знания', version: 1, isActive: true }
                            }
                        },
                        icon: 'folder',
                        href: null,
                        catalogId: 'Quizzes',
                        sortOrder: 2,
                        isActive: true
                    },
                    {
                        id: 'lms-nav-development',
                        kind: 'catalog',
                        title: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Development', version: 1, isActive: true },
                                ru: { content: 'Развитие', version: 1, isActive: true }
                            }
                        },
                        icon: 'tasks',
                        href: null,
                        catalogId: 'Classes',
                        sortOrder: 3,
                        isActive: true
                    },
                    {
                        id: 'lms-nav-reports',
                        kind: 'catalog',
                        title: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Reports', version: 1, isActive: true },
                                ru: { content: 'Отчёты', version: 1, isActive: true }
                            }
                        },
                        icon: 'analytics',
                        href: null,
                        catalogId: 'Reports',
                        sortOrder: 4,
                        isActive: true
                    }
                ]
            })
        },
        { zone: 'top' as const, widgetKey: 'appNavbar', sortOrder: 1 },
        { zone: 'top' as const, widgetKey: 'header', sortOrder: 2 },
        {
            zone: 'center' as const,
            widgetKey: 'overviewCards',
            sortOrder: 4,
            config: {
                cards: [
                    {
                        title: vlc('Learners', 'Учащиеся'),
                        value: '0',
                        interval: vlc('All workspaces', 'Все рабочие пространства'),
                        trend: 'neutral',
                        datasource: {
                            kind: 'metric',
                            metricKey: 'records.count',
                            params: { sectionCodename: 'Students' }
                        }
                    },
                    {
                        title: vlc('Modules', 'Модули'),
                        value: '0',
                        interval: vlc('Published catalog', 'Опубликованный каталог'),
                        trend: 'neutral',
                        datasource: {
                            kind: 'metric',
                            metricKey: 'records.count',
                            params: { sectionCodename: 'Modules' }
                        }
                    },
                    {
                        title: vlc('Enrollments', 'Назначения'),
                        value: '0',
                        interval: vlc('Training records', 'Учебные записи'),
                        trend: 'neutral',
                        datasource: {
                            kind: 'metric',
                            metricKey: 'records.count',
                            params: { sectionCodename: 'Enrollments' }
                        }
                    },
                    {
                        title: vlc('Certificates', 'Сертификаты'),
                        value: '0',
                        interval: vlc('Issued facts', 'Факты выдачи'),
                        trend: 'neutral',
                        datasource: {
                            kind: 'metric',
                            metricKey: 'records.count',
                            params: { sectionCodename: 'CertificateIssues' }
                        }
                    }
                ]
            }
        },
        { zone: 'center' as const, widgetKey: 'detailsTitle', sortOrder: 5 },
        {
            zone: 'center' as const,
            widgetKey: 'sessionsChart',
            sortOrder: 6,
            config: {
                title: vlc('Department Progress', 'Прогресс подразделений'),
                interval: vlc('By module progress records', 'По записям прогресса модулей'),
                datasource: {
                    kind: 'records.list',
                    sectionCodename: 'ModuleProgress',
                    query: {
                        sort: [{ field: 'CompletedAt', direction: 'asc' }]
                    }
                },
                xField: 'DepartmentId',
                maxRows: 12,
                series: [{ field: 'ProgressPercent', label: vlc('Progress %', 'Прогресс %'), area: true }]
            }
        },
        {
            zone: 'center' as const,
            widgetKey: 'pageViewsChart',
            sortOrder: 7,
            config: {
                title: vlc('Assignment Scores', 'Оценки заданий'),
                interval: vlc('Latest submissions', 'Последние отправки'),
                datasource: {
                    kind: 'records.list',
                    sectionCodename: 'AssignmentSubmissions',
                    query: {
                        sort: [{ field: 'SubmittedAt', direction: 'asc' }]
                    }
                },
                xField: 'SubmittedAt',
                maxRows: 12,
                series: [{ field: 'Score', label: vlc('Score', 'Балл') }]
            }
        },
        {
            zone: 'center' as const,
            widgetKey: 'columnsContainer',
            sortOrder: 8,
            config: {
                columns: [
                    {
                        id: 'lms-progress-report',
                        width: 4,
                        widgets: [
                            {
                                id: 'lms-progress-table',
                                widgetKey: 'detailsTable',
                                sortOrder: 1,
                                config: {
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'ModuleProgress',
                                        query: {
                                            sort: [{ field: 'CompletedAt', direction: 'desc' }]
                                        }
                                    },
                                    showViewToggle: true
                                }
                            }
                        ]
                    },
                    {
                        id: 'lms-track-report',
                        width: 4,
                        widgets: [
                            {
                                id: 'lms-track-table',
                                widgetKey: 'detailsTable',
                                sortOrder: 1,
                                config: {
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'LearningTracks',
                                        query: {
                                            sort: [{ field: 'Title', direction: 'asc' }]
                                        }
                                    },
                                    showViewToggle: true
                                }
                            }
                        ]
                    },
                    {
                        id: 'lms-enrollment-history',
                        width: 4,
                        widgets: [
                            {
                                id: 'lms-enrollment-table',
                                widgetKey: 'detailsTable',
                                sortOrder: 1,
                                config: {
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'Enrollments',
                                        query: {
                                            sort: [{ field: 'EnrolledAt', direction: 'desc' }]
                                        }
                                    },
                                    showViewToggle: true
                                }
                            }
                        ]
                    }
                ]
            }
        },
        { zone: 'center' as const, widgetKey: 'detailsTable', sortOrder: 9 }
    ]
}

const buildEditorText = (en: string, ru: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: en, version: 1, isActive: true },
        ru: { content: ru, version: 1, isActive: true }
    }
})

const buildEditorHeaderBlock = (id: string, level: number, en: string, ru: string) => ({
    id,
    type: 'header',
    data: {
        level,
        text: buildEditorText(en, ru)
    }
})

const buildEditorParagraphBlock = (id: string, en: string, ru: string) => ({
    id,
    type: 'paragraph',
    data: {
        text: buildEditorText(en, ru)
    }
})

const buildLmsPageEntity = ({
    codename,
    nameEn,
    nameRu,
    descriptionEn,
    descriptionRu,
    routeSegment,
    blocks
}: {
    codename: string
    nameEn: string
    nameRu: string
    descriptionEn: string
    descriptionRu: string
    routeSegment: string
    blocks: Array<Record<string, unknown>>
}): LmsTemplateEntity => ({
    codename,
    kind: 'page',
    name: vlc(nameEn, nameRu),
    description: vlc(descriptionEn, descriptionRu),
    hubs: ['Learning'],
    config: enrichConfigWithVlcTimestamps({
        blockContent: {
            format: 'editorjs',
            version: '2.29.0',
            blocks
        },
        runtime: {
            menuVisibility: 'secondary',
            routeSegment
        }
    })
})

const buildLmsBalanceLedger = ({
    codename,
    nameEn,
    nameRu,
    descriptionEn,
    descriptionRu,
    subjectEn,
    subjectRu,
    resourceCodename,
    resourceEn,
    resourceRu,
    aggregate
}: {
    codename: string
    nameEn: string
    nameRu: string
    descriptionEn: string
    descriptionRu: string
    subjectEn: string
    subjectRu: string
    resourceCodename: string
    resourceEn: string
    resourceRu: string
    aggregate: 'sum' | 'latest'
}): LmsTemplateEntity => ({
    codename,
    kind: 'catalog',
    name: vlc(nameEn, nameRu),
    description: vlc(descriptionEn, descriptionRu),
    hubs: ['Learning'],
    config: {
        ledger: {
            mode: 'balance',
            mutationPolicy: 'appendOnly',
            periodicity: 'instant',
            sourcePolicy: 'registrar',
            registrarKinds: ['catalog'],
            fieldRoles: [
                { fieldCodename: 'Learner', role: 'dimension', required: true },
                { fieldCodename: 'Subject', role: 'dimension', required: true },
                { fieldCodename: resourceCodename, role: 'resource', aggregate, required: true },
                { fieldCodename: 'Status', role: 'attribute' },
                { fieldCodename: 'OccurredAt', role: 'attribute' },
                { fieldCodename: 'SourceObjectId', role: 'attribute' },
                { fieldCodename: 'SourceRowId', role: 'attribute' },
                { fieldCodename: 'SourceLineId', role: 'attribute' }
            ],
            projections: [
                {
                    codename: `${codename}ByLearner`,
                    kind: aggregate === 'latest' ? 'latest' : 'balance',
                    dimensions: ['Learner', 'Subject'],
                    resources: [resourceCodename],
                    period: 'none'
                }
            ],
            idempotency: {
                keyFields: ['source_object_id', 'source_row_id', 'source_line_id']
            }
        }
    },
    attributes: [
        { codename: 'Learner', dataType: 'STRING', name: vlc('Learner', 'Учащийся'), sortOrder: 1, isRequired: true },
        { codename: 'Subject', dataType: 'STRING', name: vlc(subjectEn, subjectRu), sortOrder: 2, isRequired: true },
        { codename: resourceCodename, dataType: 'NUMBER', name: vlc(resourceEn, resourceRu), sortOrder: 3, isRequired: true },
        { codename: 'Status', dataType: 'STRING', name: vlc('Status', 'Статус'), sortOrder: 4 },
        {
            codename: 'OccurredAt',
            dataType: 'DATE',
            name: vlc('Occurred At', 'Дата события'),
            sortOrder: 5,
            validationRules: { dateComposition: 'datetime' }
        },
        { codename: 'SourceObjectId', dataType: 'STRING', name: vlc('Source Object ID', 'ID объекта-источника'), sortOrder: 6 },
        { codename: 'SourceRowId', dataType: 'STRING', name: vlc('Source Row ID', 'ID строки-источника'), sortOrder: 7 },
        { codename: 'SourceLineId', dataType: 'STRING', name: vlc('Source Line ID', 'ID строки движения'), sortOrder: 8 }
    ]
})

const LMS_ADDITIONAL_LEDGER_ENTITIES: LmsTemplateEntity[] = [
    buildLmsBalanceLedger({
        codename: 'LearningActivityLedger',
        nameEn: 'Learning Activity Ledger',
        nameRu: 'Регистр учебной активности',
        descriptionEn: 'Append-only activity facts for runtime learning events.',
        descriptionRu: 'Неизменяемые факты активности для событий обучения в runtime.',
        subjectEn: 'Activity Subject',
        subjectRu: 'Предмет активности',
        resourceCodename: 'ActivityCount',
        resourceEn: 'Activity Count',
        resourceRu: 'Количество активностей',
        aggregate: 'sum'
    }),
    buildLmsBalanceLedger({
        codename: 'EnrollmentLedger',
        nameEn: 'Enrollment Ledger',
        nameRu: 'Регистр записей на обучение',
        descriptionEn: 'Append-only enrollment facts by learner and learning item.',
        descriptionRu: 'Неизменяемые факты записей на обучение по учащемуся и учебному элементу.',
        subjectEn: 'Enrollment Subject',
        subjectRu: 'Предмет записи',
        resourceCodename: 'EnrollmentDelta',
        resourceEn: 'Enrollment Delta',
        resourceRu: 'Изменение записи',
        aggregate: 'sum'
    }),
    buildLmsBalanceLedger({
        codename: 'AttendanceLedger',
        nameEn: 'Attendance Ledger',
        nameRu: 'Регистр посещаемости',
        descriptionEn: 'Append-only attendance facts for instructor-led and blended training.',
        descriptionRu: 'Неизменяемые факты посещаемости для очного и смешанного обучения.',
        subjectEn: 'Training Event',
        subjectRu: 'Учебное мероприятие',
        resourceCodename: 'AttendanceDelta',
        resourceEn: 'Attendance Delta',
        resourceRu: 'Изменение посещаемости',
        aggregate: 'sum'
    }),
    buildLmsBalanceLedger({
        codename: 'CertificateLedger',
        nameEn: 'Certificate Ledger',
        nameRu: 'Регистр сертификатов',
        descriptionEn: 'Append-only certificate issue and revocation facts.',
        descriptionRu: 'Неизменяемые факты выдачи и отзыва сертификатов.',
        subjectEn: 'Certificate',
        subjectRu: 'Сертификат',
        resourceCodename: 'CertificateDelta',
        resourceEn: 'Certificate Delta',
        resourceRu: 'Изменение сертификата',
        aggregate: 'sum'
    }),
    buildLmsBalanceLedger({
        codename: 'PointsLedger',
        nameEn: 'Points Ledger',
        nameRu: 'Регистр баллов',
        descriptionEn: 'Append-only gamification and learning points facts.',
        descriptionRu: 'Неизменяемые факты баллов обучения и геймификации.',
        subjectEn: 'Points Source',
        subjectRu: 'Источник баллов',
        resourceCodename: 'PointsDelta',
        resourceEn: 'Points Delta',
        resourceRu: 'Изменение баллов',
        aggregate: 'sum'
    }),
    buildLmsBalanceLedger({
        codename: 'NotificationLedger',
        nameEn: 'Notification Ledger',
        nameRu: 'Регистр уведомлений',
        descriptionEn: 'Append-only notification delivery facts for learning workflows.',
        descriptionRu: 'Неизменяемые факты доставки уведомлений для учебных процессов.',
        subjectEn: 'Notification',
        subjectRu: 'Уведомление',
        resourceCodename: 'NotificationCount',
        resourceEn: 'Notification Count',
        resourceRu: 'Количество уведомлений',
        aggregate: 'sum'
    })
]

const buildTransactionalCatalogConfig = ({
    prefix,
    effectiveDateField,
    stateField,
    states = [],
    targetLedgers = []
}: {
    prefix: string
    effectiveDateField: string
    stateField?: string
    states?: Array<{ codename: string; title: string; isInitial?: boolean; isFinal?: boolean }>
    targetLedgers?: string[]
}) => ({
    recordBehavior: {
        mode: 'transactional',
        numbering: {
            enabled: true,
            scope: 'workspace',
            periodicity: 'year',
            prefix,
            minLength: 6
        },
        effectiveDate: {
            enabled: true,
            fieldCodename: effectiveDateField,
            defaultToNow: true
        },
        lifecycle: {
            enabled: Boolean(stateField && states.length > 0),
            ...(stateField ? { stateFieldCodename: stateField } : {}),
            states
        },
        posting: {
            mode: 'manual',
            targetLedgers
        },
        immutability: 'posted'
    }
})

const LMS_ENROLLMENT_POSTING_SCRIPT_SOURCE = `import { ExtensionScript, OnEvent } from '@universo/extension-sdk'

const readRecordValue = (record, ...keys) => {
    if (!record || typeof record !== 'object') {
        return null
    }

    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(record, key)) {
            return record[key]
        }
    }

    return null
}

const toNumber = (value, fallback = 0) => {
    const numeric = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(numeric) ? numeric : fallback
}

export default class EnrollmentPostingScript extends ExtensionScript {
    @OnEvent('beforePost')
    async buildProgressMovement(payload) {
        const row = payload?.previousRow ?? {}
        const rowId = typeof row.id === 'string' ? row.id : 'unknown'
        const entityCodename = typeof payload?.entityCodename === 'string' ? payload.entityCodename : 'Enrollments'
        const learner = readRecordValue(row, 'EnrollmentStudentId', 'enrollment_student_id')
        const learningItem = readRecordValue(row, 'ModuleIdRef', 'module_id_ref')
        const status = readRecordValue(row, 'EnrollmentStatus', 'enrollment_status')
        const occurredAt =
            readRecordValue(row, 'CompletedAt', 'completed_at') ?? readRecordValue(row, 'EnrolledAt', 'enrolled_at') ?? new Date().toISOString()

        return {
            movements: [
                {
                    ledgerCodename: 'ProgressLedger',
                    facts: [
                        {
                            data: {
                                Learner: learner ? String(learner) : rowId,
                                LearningItem: learningItem ? String(learningItem) : entityCodename,
                                ProgressDelta: toNumber(readRecordValue(row, 'Score', 'score'), 1),
                                Status: status ? String(status) : 'posted',
                                OccurredAt: occurredAt,
                                SourceObjectId: entityCodename,
                                SourceRowId: rowId,
                                SourceLineId: 'enrollment-progress'
                            }
                        }
                    ]
                }
            ]
        }
    }
}
`

const LMS_AUTO_ENROLLMENT_SCRIPT_SOURCE = `import { ExtensionScript, OnEvent } from '@universo/extension-sdk'

const readRecordValue = (record, ...keys) => {
    if (!record || typeof record !== 'object') {
        return null
    }

    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(record, key)) {
            return record[key]
        }
    }

    return null
}

export default class AutoEnrollmentRuleScript extends ExtensionScript {
    @OnEvent('afterCreate')
    async enrollStudent(payload) {
        const row = payload?.currentRow ?? {}
        const studentId = readRecordValue(row, 'id', 'Id')
        const classId = readRecordValue(row, 'ClassId', 'class_id')

        if (!studentId || !classId) {
            return null
        }

        const existing = await this.ctx.records.list('Enrollments', {
            EnrollmentStudentId: String(studentId),
            ClassId: String(classId),
            limit: 1
        })

        if (Array.isArray(existing) && existing.length > 0) {
            return { skipped: true }
        }

        await this.ctx.records.create('Enrollments', {
            EnrollmentStudentId: String(studentId),
            ClassId: String(classId),
            ModuleIdRef: 'default',
            EnrollmentStatus: 'Active',
            EnrolledAt: new Date().toISOString()
        })

        return { created: true }
    }
}
`

const LMS_QUIZ_ATTEMPT_POSTING_SCRIPT_SOURCE = `import { ExtensionScript, OnEvent } from '@universo/extension-sdk'

const readRecordValue = (record, ...keys) => {
    if (!record || typeof record !== 'object') {
        return null
    }

    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(record, key)) {
            return record[key]
        }
    }

    return null
}

const toNumber = (value, fallback = 0) => {
    const numeric = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(numeric) ? numeric : fallback
}

export default class QuizAttemptPostingScript extends ExtensionScript {
    @OnEvent('beforePost')
    async buildQuizAttemptMovements(payload) {
        const row = payload?.previousRow ?? {}
        const rowId = typeof row.id === 'string' ? row.id : 'unknown'
        const learner = readRecordValue(row, 'StudentId', 'student_id') ?? rowId
        const quiz = readRecordValue(row, 'QuizId', 'quiz_id') ?? 'quiz'
        const occurredAt = readRecordValue(row, 'SubmittedAt', 'submitted_at') ?? new Date().toISOString()

        return {
            movements: [
                {
                    ledgerCodename: 'ScoreLedger',
                    facts: [
                        {
                            data: {
                                Learner: String(learner),
                                Assessment: String(quiz),
                                Score: toNumber(readRecordValue(row, 'Score', 'score'), 0),
                                Passed: Boolean(readRecordValue(row, 'Passed', 'passed')),
                                OccurredAt: occurredAt,
                                SourceObjectId: 'QuizAttempts',
                                SourceRowId: rowId,
                                SourceLineId: 'quiz-attempt-score'
                            }
                        }
                    ]
                },
                {
                    ledgerCodename: 'LearningActivityLedger',
                    facts: [
                        {
                            data: {
                                Learner: String(learner),
                                Subject: String(quiz),
                                ActivityDelta: 1,
                                Status: String(readRecordValue(row, 'Status', 'status') ?? 'submitted'),
                                OccurredAt: occurredAt,
                                SourceObjectId: 'QuizAttempts',
                                SourceRowId: rowId,
                                SourceLineId: 'quiz-attempt-activity'
                            }
                        }
                    ]
                }
            ]
        }
    }
}
`

const LMS_MODULE_COMPLETION_POSTING_SCRIPT_SOURCE = `import { ExtensionScript, OnEvent } from '@universo/extension-sdk'

const readRecordValue = (record, ...keys) => {
    if (!record || typeof record !== 'object') {
        return null
    }

    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(record, key)) {
            return record[key]
        }
    }

    return null
}

const toNumber = (value, fallback = 0) => {
    const numeric = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(numeric) ? numeric : fallback
}

export default class ModuleCompletionPostingScript extends ExtensionScript {
    @OnEvent('beforePost')
    async buildModuleProgressMovement(payload) {
        const row = payload?.previousRow ?? {}
        const rowId = typeof row.id === 'string' ? row.id : 'unknown'
        const learner = readRecordValue(row, 'ProgressStudentId', 'progress_student_id') ?? rowId
        const moduleId = readRecordValue(row, 'ModuleId', 'module_id') ?? 'module'
        const occurredAt =
            readRecordValue(row, 'CompletedAt', 'completed_at') ?? readRecordValue(row, 'StartedAt', 'started_at') ?? new Date().toISOString()

        return {
            movements: [
                {
                    ledgerCodename: 'ProgressLedger',
                    facts: [
                        {
                            data: {
                                Learner: String(learner),
                                LearningItem: String(moduleId),
                                ProgressDelta: toNumber(readRecordValue(row, 'ProgressPercent', 'progress_percent'), 0),
                                Status: String(readRecordValue(row, 'ProgressStatus', 'progress_status') ?? 'posted'),
                                OccurredAt: occurredAt,
                                SourceObjectId: 'ModuleProgress',
                                SourceRowId: rowId,
                                SourceLineId: 'module-progress'
                            }
                        }
                    ]
                }
            ]
        }
    }
}
`

const LMS_CERTIFICATE_ISSUE_POSTING_SCRIPT_SOURCE = `import { ExtensionScript, OnEvent } from '@universo/extension-sdk'

const readRecordValue = (record, ...keys) => {
    if (!record || typeof record !== 'object') {
        return null
    }

    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(record, key)) {
            return record[key]
        }
    }

    return null
}

export default class CertificateIssuePostingScript extends ExtensionScript {
    @OnEvent('beforePost')
    async buildCertificateMovements(payload) {
        const row = payload?.previousRow ?? {}
        const rowId = typeof row.id === 'string' ? row.id : 'unknown'
        const learner = readRecordValue(row, 'StudentId', 'student_id') ?? rowId
        const certificate = readRecordValue(row, 'CertificateNumber', 'certificate_number') ?? readRecordValue(row, 'CertificateId', 'certificate_id') ?? rowId
        const occurredAt = readRecordValue(row, 'IssuedAt', 'issued_at') ?? new Date().toISOString()
        const status = String(readRecordValue(row, 'Status', 'status') ?? 'Issued')
        const certificateDelta = status === 'Revoked' || status === 'Expired' ? -1 : 1

        return {
            movements: [
                {
                    ledgerCodename: 'CertificateLedger',
                    facts: [
                        {
                            data: {
                                Learner: String(learner),
                                Subject: String(certificate),
                                CertificateDelta: certificateDelta,
                                Status: status,
                                OccurredAt: occurredAt,
                                SourceObjectId: 'CertificateIssues',
                                SourceRowId: rowId,
                                SourceLineId: 'certificate-issue'
                            }
                        }
                    ]
                },
                {
                    ledgerCodename: 'NotificationLedger',
                    facts: [
                        {
                            data: {
                                Learner: String(learner),
                                Subject: String(certificate),
                                NotificationCount: 1,
                                Status: status,
                                OccurredAt: occurredAt,
                                SourceObjectId: 'CertificateIssues',
                                SourceRowId: rowId,
                                SourceLineId: 'certificate-notification'
                            }
                        }
                    ]
                }
            ]
        }
    }
}
`

export const lmsTemplate: MetahubTemplateManifest = {
    $schema: 'metahub-template/v1',
    codename: 'lms',
    version: '0.1.0',
    minStructureVersion: '0.1.0',
    name: vlc('LMS', 'LMS'),
    description: vlc(
        'Learning Management System template with classes, modules, quizzes, and student tracking.',
        'Шаблон системы управления обучением с классами, модулями, тестами и отслеживанием студентов.'
    ),
    meta: {
        author: 'universo-platformo',
        tags: ['lms', 'education', 'quiz'],
        icon: 'School'
    },
    presets: [
        { presetCodename: 'hub', includedByDefault: true },
        { presetCodename: 'page', includedByDefault: false },
        { presetCodename: 'catalog', includedByDefault: true },
        { presetCodename: 'set', includedByDefault: true },
        { presetCodename: 'enumeration', includedByDefault: true }
    ],
    seed: {
        layouts: [
            {
                codename: 'main',
                templateKey: 'dashboard',
                name: vlc('Main', 'Основной'),
                description: vlc('Main layout for LMS application', 'Основной макет для приложения LMS'),
                isDefault: true,
                isActive: true,
                sortOrder: 0
            }
        ],
        layoutZoneWidgets: {
            main: buildLmsSeedZoneWidgets()
        },
        entities: [
            {
                codename: 'Learning',
                kind: 'hub',
                name: vlc('Learning', 'Обучение'),
                description: vlc('Root learning navigation hub for LMS resources.', 'Корневой учебный хаб для навигации по ресурсам LMS.')
            },
            {
                codename: 'LmsConfiguration',
                kind: 'set',
                name: vlc('LMS Configuration', 'Настройки LMS'),
                description: vlc(
                    'Shared constants that drive default LMS behavior across workspaces.',
                    'Общие константы, которые задают базовое поведение LMS во всех рабочих пространствах.'
                ),
                fixedValues: [
                    {
                        codename: 'DefaultPassingScore',
                        dataType: 'NUMBER',
                        name: vlc('Default Passing Score', 'Проходной балл по умолчанию'),
                        sortOrder: 1,
                        value: 80
                    },
                    {
                        codename: 'CertificateValidityDays',
                        dataType: 'NUMBER',
                        name: vlc('Certificate Validity Days', 'Срок действия сертификата в днях'),
                        sortOrder: 2,
                        value: 365
                    },
                    {
                        codename: 'AutoEnrollEnabled',
                        dataType: 'BOOLEAN',
                        name: vlc('Auto Enroll Enabled', 'Автозачисление включено'),
                        sortOrder: 3,
                        value: false
                    },
                    {
                        codename: 'SupportEmail',
                        dataType: 'STRING',
                        name: vlc('Support Email', 'Email поддержки'),
                        sortOrder: 4,
                        value: ''
                    }
                ]
            },
            {
                codename: 'LearnerHome',
                kind: 'page',
                name: vlc('Welcome', 'Добро пожаловать'),
                description: vlc(
                    'Full LMS landing page with structured onboarding content.',
                    'Полная стартовая страница LMS со структурированным вводным контентом.'
                ),
                hubs: ['Learning'],
                config: enrichConfigWithVlcTimestamps({
                    blockContent: {
                        format: 'editorjs',
                        version: '2.29.0',
                        blocks: [
                            {
                                id: 'welcome-title',
                                type: 'header',
                                data: {
                                    level: 2,
                                    text: {
                                        _schema: '1',
                                        _primary: 'en',
                                        locales: {
                                            en: { content: 'Welcome to your learning portal', version: 1, isActive: true },
                                            ru: { content: 'Добро пожаловать в учебный портал', version: 1, isActive: true }
                                        }
                                    }
                                }
                            },
                            {
                                id: 'welcome-intro',
                                type: 'paragraph',
                                data: {
                                    text: {
                                        _schema: '1',
                                        _primary: 'en',
                                        locales: {
                                            en: {
                                                content:
                                                    'This portal brings together the learning paths, modules, assignments, tests, and progress indicators that learners need every day. Start with your assigned modules, continue from the last opened activity, and use the catalog to find approved materials for independent study.',
                                                version: 1,
                                                isActive: true
                                            },
                                            ru: {
                                                content:
                                                    'Этот портал объединяет учебные траектории, модули, задания, тесты и показатели прогресса, которые нужны учащимся каждый день. Начните с назначенных модулей, продолжите обучение с последнего открытого материала и используйте каталог для самостоятельного изучения утвержденных материалов.',
                                                version: 1,
                                                isActive: true
                                            }
                                        }
                                    }
                                }
                            },
                            {
                                id: 'welcome-how-to-start-title',
                                type: 'header',
                                data: {
                                    level: 3,
                                    text: {
                                        _schema: '1',
                                        _primary: 'en',
                                        locales: {
                                            en: { content: 'How to start', version: 1, isActive: true },
                                            ru: { content: 'Как начать', version: 1, isActive: true }
                                        }
                                    }
                                }
                            },
                            {
                                id: 'welcome-how-to-start-list',
                                type: 'list',
                                data: {
                                    style: 'unordered',
                                    items: [
                                        {
                                            _schema: '1',
                                            _primary: 'en',
                                            locales: {
                                                en: {
                                                    content:
                                                        'Open the catalog to review available courses, modules, and knowledge-base materials.',
                                                    version: 1,
                                                    isActive: true
                                                },
                                                ru: {
                                                    content:
                                                        'Откройте каталог, чтобы посмотреть доступные курсы, модули и материалы базы знаний.',
                                                    version: 1,
                                                    isActive: true
                                                }
                                            }
                                        },
                                        {
                                            _schema: '1',
                                            _primary: 'en',
                                            locales: {
                                                en: {
                                                    content:
                                                        'Use assignments and progress pages to understand what has already been completed and what requires attention.',
                                                    version: 1,
                                                    isActive: true
                                                },
                                                ru: {
                                                    content:
                                                        'Используйте страницы назначений и прогресса, чтобы понимать, что уже выполнено и что требует внимания.',
                                                    version: 1,
                                                    isActive: true
                                                }
                                            }
                                        },
                                        {
                                            _schema: '1',
                                            _primary: 'en',
                                            locales: {
                                                en: {
                                                    content:
                                                        'Complete tests and practical tasks inside modules so that managers can track learning outcomes.',
                                                    version: 1,
                                                    isActive: true
                                                },
                                                ru: {
                                                    content:
                                                        'Проходите тесты и практические задания внутри модулей, чтобы руководители могли отслеживать результаты обучения.',
                                                    version: 1,
                                                    isActive: true
                                                }
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                id: 'welcome-workspaces',
                                type: 'paragraph',
                                data: {
                                    text: {
                                        _schema: '1',
                                        _primary: 'en',
                                        locales: {
                                            en: {
                                                content:
                                                    'Workspaces separate personal learning, team learning, and shared training areas. The main workspace is created automatically, and additional workspaces can be added later when a team needs isolated content, members, and reporting.',
                                                version: 1,
                                                isActive: true
                                            },
                                            ru: {
                                                content:
                                                    'Рабочие пространства разделяют личное обучение, обучение команд и общие учебные области. Основное рабочее пространство создается автоматически, а дополнительные рабочие пространства можно добавить позже, когда команде понадобятся отдельные материалы, участники и отчеты.',
                                                version: 1,
                                                isActive: true
                                            }
                                        }
                                    }
                                }
                            },
                            {
                                id: 'welcome-support',
                                type: 'paragraph',
                                data: {
                                    text: {
                                        _schema: '1',
                                        _primary: 'en',
                                        locales: {
                                            en: {
                                                content:
                                                    'If you cannot find an assigned module, check the knowledge section first and then contact the learning administrator. The support address and common LMS rules are stored in the shared configuration set, so they can be updated without changing page content.',
                                                version: 1,
                                                isActive: true
                                            },
                                            ru: {
                                                content:
                                                    'Если назначенный модуль не найден, сначала проверьте раздел знаний, а затем обратитесь к администратору обучения. Адрес поддержки и общие правила LMS хранятся в общем наборе настроек, поэтому их можно обновлять без изменения контента страницы.',
                                                version: 1,
                                                isActive: true
                                            }
                                        }
                                    }
                                }
                            }
                        ]
                    },
                    runtime: {
                        menuVisibility: 'primary',
                        routeSegment: 'home'
                    }
                })
            },
            buildLmsPageEntity({
                codename: 'CourseOverview',
                nameEn: 'Course Overview',
                nameRu: 'Обзор курса',
                descriptionEn: 'Reusable course overview page for published LMS workspaces.',
                descriptionRu: 'Переиспользуемая страница обзора курса для опубликованных LMS-пространств.',
                routeSegment: 'course-overview',
                blocks: [
                    buildEditorHeaderBlock('course-overview-title', 2, 'Course overview', 'Обзор курса'),
                    buildEditorParagraphBlock(
                        'course-overview-purpose',
                        'Use this page to present the learning goal, target audience, prerequisites, completion rules, and expected outcomes for a course or learning track.',
                        'Используйте эту страницу, чтобы описать учебную цель, аудиторию, предварительные требования, правила завершения и ожидаемые результаты курса или учебного трека.'
                    ),
                    buildEditorHeaderBlock('course-overview-path-title', 3, 'Learning path', 'Учебная траектория'),
                    buildEditorParagraphBlock(
                        'course-overview-path',
                        'Course structure should be driven by Modules, Learning Tracks, Assignments, Quizzes, and transactional progress records. The page stays informational while completion state is calculated from Catalog rows and Ledgers.',
                        'Структура курса должна задаваться модулями, учебными треками, назначениями, тестами и транзакционными записями прогресса. Страница остается информационной, а состояние прохождения рассчитывается по строкам каталогов и регистрам.'
                    )
                ]
            }),
            buildLmsPageEntity({
                codename: 'KnowledgeArticle',
                nameEn: 'Knowledge Article',
                nameRu: 'Статья базы знаний',
                descriptionEn: 'Reusable knowledge-base article page for learning materials.',
                descriptionRu: 'Переиспользуемая статья базы знаний для учебных материалов.',
                routeSegment: 'knowledge-article',
                blocks: [
                    buildEditorHeaderBlock('knowledge-article-title', 2, 'Knowledge article', 'Статья базы знаний'),
                    buildEditorParagraphBlock(
                        'knowledge-article-summary',
                        'Use this page for reference material that supports modules, assignments, and instructor-led events. Keep facts, examples, and source links in the article, and keep operational state in Catalogs and Ledgers.',
                        'Используйте эту страницу для справочных материалов, которые поддерживают модули, задания и учебные мероприятия. Факты, примеры и ссылки на источники храните в статье, а операционное состояние — в каталогах и регистрах.'
                    ),
                    buildEditorHeaderBlock('knowledge-article-maintenance-title', 3, 'Maintenance', 'Сопровождение'),
                    buildEditorParagraphBlock(
                        'knowledge-article-maintenance',
                        'Versioned localized content makes it possible to update the article without changing learner progress, assignment history, or certificate facts.',
                        'Версионируемый локализованный контент позволяет обновлять статью без изменения прогресса учащихся, истории назначений или фактов сертификатов.'
                    )
                ]
            }),
            buildLmsPageEntity({
                codename: 'AssignmentInstructions',
                nameEn: 'Assignment Instructions',
                nameRu: 'Инструкции к заданию',
                descriptionEn: 'Reusable instructions page for practical LMS assignments.',
                descriptionRu: 'Переиспользуемая страница инструкций для практических заданий LMS.',
                routeSegment: 'assignment-instructions',
                blocks: [
                    buildEditorHeaderBlock('assignment-instructions-title', 2, 'Assignment instructions', 'Инструкции к заданию'),
                    buildEditorParagraphBlock(
                        'assignment-instructions-rules',
                        'Describe the expected deliverable, due-date policy, review criteria, allowed file formats, and resubmission rules. Individual submissions are stored in AssignmentSubmissions and posted to the configured Ledgers.',
                        'Опишите ожидаемый результат, правила срока сдачи, критерии проверки, допустимые форматы файлов и правила повторной отправки. Индивидуальные сдачи хранятся в AssignmentSubmissions и проводятся в настроенные регистры.'
                    ),
                    buildEditorHeaderBlock('assignment-instructions-review-title', 3, 'Review result', 'Результат проверки'),
                    buildEditorParagraphBlock(
                        'assignment-instructions-review',
                        'Reviewers should record status, score, and feedback on the submission record so reports and dashboards can use the same generic datasource and Ledger model.',
                        'Проверяющие должны фиксировать статус, балл и обратную связь в записи сдачи, чтобы отчеты и панели использовали одну и ту же универсальную модель источников данных и регистров.'
                    )
                ]
            }),
            buildLmsPageEntity({
                codename: 'CertificatePolicy',
                nameEn: 'Certificate Policy',
                nameRu: 'Правила сертификатов',
                descriptionEn: 'Reusable certificate policy page for completion and revocation rules.',
                descriptionRu: 'Переиспользуемая страница правил сертификатов для завершения и отзыва.',
                routeSegment: 'certificate-policy',
                blocks: [
                    buildEditorHeaderBlock('certificate-policy-title', 2, 'Certificate policy', 'Правила сертификатов'),
                    buildEditorParagraphBlock(
                        'certificate-policy-eligibility',
                        'Certificates should be issued only after required modules, assignments, and quiz attempts meet the configured completion thresholds. The policy text explains the rule; CertificateIssues and CertificateLedger store the auditable facts.',
                        'Сертификаты следует выдавать только после того, как обязательные модули, задания и попытки тестов достигли настроенных порогов завершения. Текст правил объясняет условие, а CertificateIssues и CertificateLedger хранят проверяемые факты.'
                    ),
                    buildEditorHeaderBlock('certificate-policy-lifecycle-title', 3, 'Lifecycle', 'Жизненный цикл'),
                    buildEditorParagraphBlock(
                        'certificate-policy-lifecycle',
                        'Issue, expiration, and revocation should be represented as transactional records so workspace administrators can audit changes without editing historical completion data.',
                        'Выдача, истечение срока и отзыв должны представляться транзакционными записями, чтобы администраторы пространства могли проверять изменения без редактирования исторических данных завершения.'
                    )
                ]
            }),
            {
                codename: 'ProgressLedger',
                kind: 'catalog',
                name: vlc('Progress Ledger', 'Регистр прогресса'),
                description: vlc(
                    'Append-only progress facts by learner and learning item.',
                    'Неизменяемые факты прогресса по учащемуся и учебному элементу.'
                ),
                hubs: ['Learning'],
                config: {
                    ledger: {
                        mode: 'balance',
                        mutationPolicy: 'appendOnly',
                        periodicity: 'instant',
                        sourcePolicy: 'registrar',
                        registrarKinds: ['catalog'],
                        fieldRoles: [
                            { fieldCodename: 'Learner', role: 'dimension', required: true },
                            { fieldCodename: 'LearningItem', role: 'dimension', required: true },
                            { fieldCodename: 'ProgressDelta', role: 'resource', aggregate: 'sum', required: true },
                            { fieldCodename: 'Status', role: 'attribute' },
                            { fieldCodename: 'OccurredAt', role: 'attribute' },
                            { fieldCodename: 'SourceObjectId', role: 'attribute' },
                            { fieldCodename: 'SourceRowId', role: 'attribute' },
                            { fieldCodename: 'SourceLineId', role: 'attribute' }
                        ],
                        projections: [
                            {
                                codename: 'ProgressByLearner',
                                kind: 'balance',
                                dimensions: ['Learner', 'LearningItem'],
                                resources: ['ProgressDelta'],
                                period: 'none'
                            }
                        ],
                        idempotency: {
                            keyFields: ['source_object_id', 'source_row_id', 'source_line_id']
                        }
                    }
                },
                attributes: [
                    { codename: 'Learner', dataType: 'STRING', name: vlc('Learner', 'Учащийся'), sortOrder: 1, isRequired: true },
                    {
                        codename: 'LearningItem',
                        dataType: 'STRING',
                        name: vlc('Learning Item', 'Учебный элемент'),
                        sortOrder: 2,
                        isRequired: true
                    },
                    {
                        codename: 'ProgressDelta',
                        dataType: 'NUMBER',
                        name: vlc('Progress Delta', 'Изменение прогресса'),
                        sortOrder: 3,
                        isRequired: true
                    },
                    { codename: 'Status', dataType: 'STRING', name: vlc('Status', 'Статус'), sortOrder: 4 },
                    {
                        codename: 'OccurredAt',
                        dataType: 'DATE',
                        name: vlc('Occurred At', 'Дата события'),
                        sortOrder: 5,
                        validationRules: { dateComposition: 'datetime' }
                    },
                    { codename: 'SourceObjectId', dataType: 'STRING', name: vlc('Source Object ID', 'ID объекта-источника'), sortOrder: 6 },
                    { codename: 'SourceRowId', dataType: 'STRING', name: vlc('Source Row ID', 'ID строки-источника'), sortOrder: 7 },
                    {
                        codename: 'SourceLineId',
                        dataType: 'STRING',
                        name: vlc('Source Line ID', 'ID строки движения'),
                        sortOrder: 8
                    }
                ]
            },
            {
                codename: 'ScoreLedger',
                kind: 'catalog',
                name: vlc('Score Ledger', 'Регистр оценок'),
                description: vlc('Append-only quiz and assignment score facts.', 'Неизменяемые факты оценок тестов и заданий.'),
                hubs: ['Learning'],
                config: {
                    ledger: {
                        mode: 'balance',
                        mutationPolicy: 'appendOnly',
                        periodicity: 'instant',
                        sourcePolicy: 'registrar',
                        registrarKinds: ['catalog'],
                        fieldRoles: [
                            { fieldCodename: 'Learner', role: 'dimension', required: true },
                            { fieldCodename: 'Assessment', role: 'dimension', required: true },
                            { fieldCodename: 'Score', role: 'resource', aggregate: 'latest', required: true },
                            { fieldCodename: 'Passed', role: 'attribute' },
                            { fieldCodename: 'OccurredAt', role: 'attribute' },
                            { fieldCodename: 'SourceObjectId', role: 'attribute' },
                            { fieldCodename: 'SourceRowId', role: 'attribute' },
                            { fieldCodename: 'SourceLineId', role: 'attribute' }
                        ],
                        projections: [
                            {
                                codename: 'LatestScoreByAssessment',
                                kind: 'latest',
                                dimensions: ['Learner', 'Assessment'],
                                resources: ['Score'],
                                period: 'none'
                            }
                        ],
                        idempotency: {
                            keyFields: ['source_object_id', 'source_row_id', 'source_line_id']
                        }
                    }
                },
                attributes: [
                    { codename: 'Learner', dataType: 'STRING', name: vlc('Learner', 'Учащийся'), sortOrder: 1, isRequired: true },
                    { codename: 'Assessment', dataType: 'STRING', name: vlc('Assessment', 'Оценивание'), sortOrder: 2, isRequired: true },
                    { codename: 'Score', dataType: 'NUMBER', name: vlc('Score', 'Балл'), sortOrder: 3, isRequired: true },
                    { codename: 'Passed', dataType: 'BOOLEAN', name: vlc('Passed', 'Пройдено'), sortOrder: 4 },
                    {
                        codename: 'OccurredAt',
                        dataType: 'DATE',
                        name: vlc('Occurred At', 'Дата события'),
                        sortOrder: 5,
                        validationRules: { dateComposition: 'datetime' }
                    },
                    { codename: 'SourceObjectId', dataType: 'STRING', name: vlc('Source Object ID', 'ID объекта-источника'), sortOrder: 6 },
                    { codename: 'SourceRowId', dataType: 'STRING', name: vlc('Source Row ID', 'ID строки-источника'), sortOrder: 7 },
                    {
                        codename: 'SourceLineId',
                        dataType: 'STRING',
                        name: vlc('Source Line ID', 'ID строки движения'),
                        sortOrder: 8
                    }
                ]
            },
            ...LMS_ADDITIONAL_LEDGER_ENTITIES,
            {
                codename: 'Classes',
                kind: 'catalog',
                name: vlc('Classes', 'Классы'),
                description: vlc('Student groups for learning management.', 'Группы студентов для управления обучением.'),
                attributes: [
                    {
                        codename: 'Name',
                        dataType: 'STRING',
                        name: vlc('Name', 'Название'),
                        isRequired: true,
                        isDisplayAttribute: true,
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
                        codename: 'SchoolYear',
                        dataType: 'STRING',
                        name: vlc('School Year', 'Учебный год'),
                        sortOrder: 3,
                        validationRules: { maxLength: 20 }
                    },
                    {
                        codename: 'StudentCountLimit',
                        dataType: 'NUMBER',
                        name: vlc('Student Count Limit', 'Лимит студентов'),
                        sortOrder: 4,
                        validationRules: { min: 1, max: 1000 }
                    }
                ]
            },
            {
                codename: 'Students',
                kind: 'catalog',
                name: vlc('Students', 'Студенты'),
                description: vlc('Registered and guest students.', 'Зарегистрированные и гостевые студенты.'),
                attributes: [
                    {
                        codename: 'DisplayName',
                        dataType: 'STRING',
                        name: vlc('Display Name', 'Отображаемое имя'),
                        isRequired: true,
                        isDisplayAttribute: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 255 }
                    },
                    {
                        codename: 'Email',
                        dataType: 'STRING',
                        name: vlc('Email', 'Электронная почта'),
                        sortOrder: 2,
                        validationRules: { maxLength: 320 }
                    },
                    {
                        codename: 'IsGuest',
                        dataType: 'BOOLEAN',
                        name: vlc('Is Guest', 'Гость'),
                        sortOrder: 3
                    },
                    {
                        codename: 'DepartmentId',
                        dataType: 'REF',
                        name: vlc('Department', 'Подразделение'),
                        sortOrder: 4,
                        targetEntityCodename: 'Departments',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'GuestSessionToken',
                        dataType: 'STRING',
                        name: vlc('Guest Session Token', 'Токен гостевой сессии'),
                        sortOrder: 5
                    }
                ]
            },
            {
                codename: 'Departments',
                kind: 'catalog',
                name: vlc('Departments', 'Подразделения'),
                description: vlc(
                    'Organization units used for learner segmentation and reporting.',
                    'Подразделения для сегментации учащихся и отчетности.'
                ),
                attributes: [
                    {
                        codename: 'Name',
                        dataType: 'STRING',
                        name: vlc('Name', 'Название'),
                        isRequired: true,
                        isDisplayAttribute: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 255, localized: true, versioned: true }
                    },
                    {
                        codename: 'Code',
                        dataType: 'STRING',
                        name: vlc('Code', 'Код'),
                        sortOrder: 2,
                        validationRules: { maxLength: 64 }
                    },
                    {
                        codename: 'ParentDepartmentId',
                        dataType: 'REF',
                        name: vlc('Parent Department', 'Родительское подразделение'),
                        sortOrder: 3,
                        targetEntityCodename: 'Departments',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'ManagerEmail',
                        dataType: 'STRING',
                        name: vlc('Manager Email', 'Email руководителя'),
                        sortOrder: 4,
                        validationRules: { maxLength: 320 }
                    }
                ]
            },
            {
                codename: 'LearningResources',
                kind: 'catalog',
                name: vlc('Learning Resources', 'Учебные ресурсы'),
                description: vlc(
                    'Reusable content resources such as pages, links, videos, documents, embeds, and SCORM-like packages.',
                    'Переиспользуемые учебные ресурсы: страницы, ссылки, видео, документы, встраивания и SCORM-подобные пакеты.'
                ),
                attributes: [
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayAttribute: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 500, localized: true, versioned: true }
                    },
                    {
                        codename: 'ResourceType',
                        dataType: 'REF',
                        name: vlc('Resource Type', 'Тип ресурса'),
                        isRequired: true,
                        sortOrder: 2,
                        targetEntityCodename: 'ResourceType',
                        targetEntityKind: 'enumeration'
                    },
                    {
                        codename: 'Source',
                        dataType: 'JSON',
                        name: vlc('Source', 'Источник'),
                        isRequired: true,
                        sortOrder: 3
                    },
                    {
                        codename: 'EstimatedTimeMinutes',
                        dataType: 'NUMBER',
                        name: vlc('Estimated Time, min', 'Оценочное время, мин'),
                        sortOrder: 4,
                        validationRules: { min: 0 }
                    },
                    {
                        codename: 'Language',
                        dataType: 'STRING',
                        name: vlc('Language', 'Язык'),
                        sortOrder: 5,
                        validationRules: { maxLength: 16 }
                    }
                ]
            },
            {
                codename: 'Courses',
                kind: 'catalog',
                name: vlc('Courses', 'Курсы'),
                description: vlc(
                    'Course shells that group sections, resources, assignments, and quizzes.',
                    'Оболочки курсов, объединяющие разделы, ресурсы, задания и тесты.'
                ),
                attributes: [
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayAttribute: true,
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
                        codename: 'Status',
                        dataType: 'REF',
                        name: vlc('Status', 'Статус'),
                        sortOrder: 3,
                        targetEntityCodename: 'ModuleStatus',
                        targetEntityKind: 'enumeration'
                    },
                    {
                        codename: 'EstimatedTimeMinutes',
                        dataType: 'NUMBER',
                        name: vlc('Estimated Time, min', 'Оценочное время, мин'),
                        sortOrder: 4,
                        validationRules: { min: 0 }
                    }
                ]
            },
            {
                codename: 'CourseSections',
                kind: 'catalog',
                name: vlc('Course Sections', 'Разделы курса'),
                description: vlc('Ordered sections inside courses.', 'Упорядоченные разделы внутри курсов.'),
                attributes: [
                    {
                        codename: 'CourseId',
                        dataType: 'REF',
                        name: vlc('Course', 'Курс'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'Courses',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayAttribute: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 500, localized: true, versioned: true }
                    },
                    {
                        codename: 'ResourceId',
                        dataType: 'REF',
                        name: vlc('Resource', 'Ресурс'),
                        sortOrder: 3,
                        targetEntityCodename: 'LearningResources',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'ModuleId',
                        dataType: 'REF',
                        name: vlc('Module', 'Модуль'),
                        sortOrder: 4,
                        targetEntityCodename: 'Modules',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'SortOrder',
                        dataType: 'NUMBER',
                        name: vlc('Sort Order', 'Порядок'),
                        sortOrder: 5,
                        validationRules: { min: 0 }
                    }
                ]
            },
            {
                codename: 'LearningTracks',
                kind: 'catalog',
                name: vlc('Learning Tracks', 'Учебные треки'),
                description: vlc(
                    'Ordered programs that combine modules, quizzes, and assignments.',
                    'Последовательные программы из модулей, тестов и назначений.'
                ),
                attributes: [
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayAttribute: true,
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
                        codename: 'TrackItems',
                        dataType: 'TABLE',
                        name: vlc('Track Items', 'Элементы трека'),
                        sortOrder: 3,
                        childAttributes: [
                            {
                                codename: 'ModuleId',
                                dataType: 'REF',
                                name: vlc('Module', 'Модуль'),
                                sortOrder: 1,
                                targetEntityCodename: 'Modules',
                                targetEntityKind: 'catalog'
                            },
                            {
                                codename: 'Required',
                                dataType: 'BOOLEAN',
                                name: vlc('Required', 'Обязательно'),
                                sortOrder: 2
                            },
                            {
                                codename: 'SortOrder',
                                dataType: 'NUMBER',
                                name: vlc('Sort Order', 'Порядок'),
                                sortOrder: 3
                            }
                        ]
                    }
                ]
            },
            {
                codename: 'TrackSteps',
                kind: 'catalog',
                name: vlc('Track Steps', 'Шаги трека'),
                description: vlc(
                    'Reusable ordered steps for learning track progression and prerequisite checks.',
                    'Переиспользуемые упорядоченные шаги учебных треков и проверок prerequisites.'
                ),
                attributes: [
                    {
                        codename: 'TrackId',
                        dataType: 'REF',
                        name: vlc('Learning Track', 'Учебный трек'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'LearningTracks',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayAttribute: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 500, localized: true, versioned: true }
                    },
                    {
                        codename: 'ModuleId',
                        dataType: 'REF',
                        name: vlc('Module', 'Модуль'),
                        sortOrder: 3,
                        targetEntityCodename: 'Modules',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'ResourceId',
                        dataType: 'REF',
                        name: vlc('Resource', 'Ресурс'),
                        sortOrder: 4,
                        targetEntityCodename: 'LearningResources',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'SortOrder',
                        dataType: 'NUMBER',
                        name: vlc('Sort Order', 'Порядок'),
                        isRequired: true,
                        sortOrder: 5,
                        validationRules: { min: 0 }
                    },
                    {
                        codename: 'Required',
                        dataType: 'BOOLEAN',
                        name: vlc('Required', 'Обязательно'),
                        sortOrder: 6
                    }
                ]
            },
            {
                codename: 'Modules',
                kind: 'catalog',
                name: vlc('Modules', 'Модули'),
                description: vlc(
                    'Learning content modules with structured content items.',
                    'Учебные модули со структурированными элементами контента.'
                ),
                attributes: [
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayAttribute: true,
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
                        codename: 'Status',
                        dataType: 'REF',
                        name: vlc('Status', 'Статус'),
                        isRequired: true,
                        sortOrder: 3,
                        targetEntityCodename: 'ModuleStatus',
                        targetEntityKind: 'enumeration'
                    },
                    {
                        codename: 'CoverImageUrl',
                        dataType: 'STRING',
                        name: vlc('Cover Image URL', 'URL обложки'),
                        sortOrder: 4,
                        validationRules: { maxLength: 2048 }
                    },
                    {
                        codename: 'EstimatedDurationMinutes',
                        dataType: 'NUMBER',
                        name: vlc('Estimated Duration (min)', 'Ожидаемая длительность (мин)'),
                        sortOrder: 5,
                        validationRules: { min: 1 }
                    },
                    {
                        codename: 'AccessLinkSlug',
                        dataType: 'STRING',
                        name: vlc('Access Link Slug', 'Слаг ссылки доступа'),
                        sortOrder: 6,
                        validationRules: { maxLength: 255 }
                    },
                    {
                        codename: 'ContentItems',
                        dataType: 'TABLE',
                        name: vlc('Content Items', 'Элементы контента'),
                        sortOrder: 7,
                        childAttributes: [
                            {
                                codename: 'ItemType',
                                dataType: 'REF',
                                name: vlc('Item Type', 'Тип элемента'),
                                isRequired: true,
                                sortOrder: 1,
                                targetEntityCodename: 'ContentType',
                                targetEntityKind: 'enumeration'
                            },
                            {
                                codename: 'ItemTitle',
                                dataType: 'STRING',
                                name: vlc('Item Title', 'Заголовок элемента'),
                                sortOrder: 2,
                                validationRules: { maxLength: 500, localized: true, versioned: true }
                            },
                            {
                                codename: 'ItemContent',
                                dataType: 'STRING',
                                name: vlc('Item Content', 'Содержимое элемента'),
                                sortOrder: 3,
                                validationRules: { localized: true, versioned: true }
                            },
                            {
                                codename: 'QuizId',
                                dataType: 'STRING',
                                name: vlc('Quiz ID', 'ID теста'),
                                sortOrder: 4
                            },
                            {
                                codename: 'SortOrder',
                                dataType: 'NUMBER',
                                name: vlc('Sort Order', 'Порядок'),
                                sortOrder: 5
                            }
                        ]
                    }
                ]
            },
            {
                codename: 'Quizzes',
                kind: 'catalog',
                name: vlc('Quizzes', 'Тесты'),
                description: vlc('Quiz assessments with questions stored as JSON.', 'Тестовые задания с вопросами, хранящимися как JSON.'),
                attributes: [
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayAttribute: true,
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
                        childAttributes: [
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
                kind: 'catalog',
                name: vlc('Quiz Responses', 'Ответы на тесты'),
                description: vlc('Individual quiz answer records for scoring.', 'Записи ответов на тесты для подсчёта баллов.'),
                config: buildTransactionalCatalogConfig({
                    prefix: 'QAR-',
                    effectiveDateField: 'SubmittedAt',
                    targetLedgers: ['ScoreLedger']
                }),
                attributes: [
                    {
                        codename: 'StudentId',
                        dataType: 'REF',
                        name: vlc('Student', 'Студент'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'Students',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'QuizId',
                        dataType: 'REF',
                        name: vlc('Quiz', 'Тест'),
                        isRequired: true,
                        sortOrder: 2,
                        targetEntityCodename: 'Quizzes',
                        targetEntityKind: 'catalog'
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
                kind: 'catalog',
                name: vlc('Quiz Attempts', 'Попытки тестов'),
                description: vlc(
                    'Submitted quiz attempts with score and pass/fail state.',
                    'Отправленные попытки тестов с баллом и состоянием прохождения.'
                ),
                config: buildTransactionalCatalogConfig({
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
                attributes: [
                    {
                        codename: 'StudentId',
                        dataType: 'REF',
                        name: vlc('Student', 'Студент'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'Students',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'QuizId',
                        dataType: 'REF',
                        name: vlc('Quiz', 'Тест'),
                        isRequired: true,
                        sortOrder: 2,
                        targetEntityCodename: 'Quizzes',
                        targetEntityKind: 'catalog'
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
                codename: 'ModuleProgress',
                kind: 'catalog',
                name: vlc('Module Progress', 'Прогресс по модулям'),
                description: vlc('Per-student module completion tracking.', 'Отслеживание прохождения модулей по студентам.'),
                config: buildTransactionalCatalogConfig({
                    prefix: 'MPR-',
                    effectiveDateField: 'CompletedAt',
                    stateField: 'ProgressStatus',
                    states: [
                        { codename: 'NotStarted', title: 'Not Started', isInitial: true },
                        { codename: 'InProgress', title: 'In Progress' },
                        { codename: 'Completed', title: 'Completed', isFinal: true }
                    ],
                    targetLedgers: ['ProgressLedger']
                }),
                attributes: [
                    {
                        codename: 'ProgressStudentId',
                        dataType: 'REF',
                        name: vlc('Student', 'Студент'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'Students',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'ModuleId',
                        dataType: 'REF',
                        name: vlc('Module', 'Модуль'),
                        isRequired: true,
                        sortOrder: 2,
                        targetEntityCodename: 'Modules',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'DepartmentId',
                        dataType: 'REF',
                        name: vlc('Department', 'Подразделение'),
                        sortOrder: 3,
                        targetEntityCodename: 'Departments',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'ProgressStatus',
                        dataType: 'STRING',
                        name: vlc('Status', 'Статус'),
                        isRequired: true,
                        sortOrder: 4,
                        validationRules: { maxLength: 30 }
                    },
                    {
                        codename: 'ProgressPercent',
                        dataType: 'NUMBER',
                        name: vlc('Progress %', 'Прогресс %'),
                        sortOrder: 5,
                        validationRules: { min: 0, max: 100 }
                    },
                    {
                        codename: 'StartedAt',
                        dataType: 'DATE',
                        name: vlc('Started At', 'Начато'),
                        sortOrder: 6
                    },
                    {
                        codename: 'CompletedAt',
                        dataType: 'DATE',
                        name: vlc('Completed At', 'Завершено'),
                        sortOrder: 7
                    },
                    {
                        codename: 'LastAccessedItemIndex',
                        dataType: 'NUMBER',
                        name: vlc('Last Accessed Item', 'Последний элемент'),
                        sortOrder: 8
                    }
                ]
            },
            {
                codename: 'AccessLinks',
                kind: 'catalog',
                name: vlc('Access Links', 'Ссылки доступа'),
                description: vlc(
                    'Direct access links and QR codes for modules and quizzes.',
                    'Прямые ссылки и QR-коды для модулей и тестов.'
                ),
                attributes: [
                    {
                        codename: 'Slug',
                        dataType: 'STRING',
                        name: vlc('Slug', 'Слаг'),
                        isRequired: true,
                        isDisplayAttribute: true,
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
                        codename: 'LinkClassId',
                        dataType: 'REF',
                        name: vlc('Class', 'Класс'),
                        sortOrder: 4,
                        targetEntityCodename: 'Classes',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'IsActive',
                        dataType: 'BOOLEAN',
                        name: vlc('Is Active', 'Активна'),
                        sortOrder: 5
                    },
                    {
                        codename: 'ExpiresAt',
                        dataType: 'DATE',
                        name: vlc('Expires At', 'Истекает'),
                        sortOrder: 6
                    },
                    {
                        codename: 'MaxUses',
                        dataType: 'NUMBER',
                        name: vlc('Max Uses', 'Макс. использований'),
                        sortOrder: 7,
                        validationRules: { min: 1 }
                    },
                    {
                        codename: 'UseCount',
                        dataType: 'NUMBER',
                        name: vlc('Use Count', 'Счётчик'),
                        sortOrder: 8,
                        validationRules: { min: 0 }
                    },
                    {
                        codename: 'LinkTitle',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        sortOrder: 9,
                        validationRules: { maxLength: 500, localized: true, versioned: true }
                    }
                ]
            },
            {
                codename: 'Enrollments',
                kind: 'catalog',
                name: vlc('Enrollments', 'Записи'),
                description: vlc('Class-student-module enrollment bridge.', 'Связь класс-студент-модуль.'),
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
                            scriptCodename: 'EnrollmentPostingScript'
                        },
                        immutability: 'posted'
                    }
                },
                attributes: [
                    {
                        codename: 'EnrollmentStudentId',
                        dataType: 'REF',
                        name: vlc('Student', 'Студент'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'Students',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'EnrollmentClassId',
                        dataType: 'REF',
                        name: vlc('Class', 'Класс'),
                        isRequired: true,
                        sortOrder: 2,
                        targetEntityCodename: 'Classes',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'ModuleIdRef',
                        dataType: 'STRING',
                        name: vlc('Module ID', 'ID модуля'),
                        isRequired: true,
                        sortOrder: 3
                    },
                    {
                        codename: 'EnrollmentStatus',
                        dataType: 'REF',
                        name: vlc('Status', 'Статус'),
                        isRequired: true,
                        sortOrder: 4,
                        targetEntityCodename: 'EnrollmentStatus',
                        targetEntityKind: 'enumeration'
                    },
                    {
                        codename: 'EnrolledAt',
                        dataType: 'DATE',
                        name: vlc('Enrolled At', 'Записан'),
                        isRequired: true,
                        sortOrder: 5
                    },
                    {
                        codename: 'CompletedAt',
                        dataType: 'DATE',
                        name: vlc('Completed At', 'Завершено'),
                        sortOrder: 6
                    },
                    {
                        codename: 'Score',
                        dataType: 'NUMBER',
                        name: vlc('Score', 'Балл'),
                        sortOrder: 7
                    }
                ]
            },
            {
                codename: 'Assignments',
                kind: 'catalog',
                name: vlc('Assignments', 'Назначения'),
                description: vlc(
                    'Learning assignments for students, classes, departments, and tracks.',
                    'Учебные назначения для студентов, классов, подразделений и треков.'
                ),
                config: buildTransactionalCatalogConfig({
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
                attributes: [
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayAttribute: true,
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
                        codename: 'ModuleId',
                        dataType: 'REF',
                        name: vlc('Module', 'Модуль'),
                        sortOrder: 4,
                        targetEntityCodename: 'Modules',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'LearningTrackId',
                        dataType: 'REF',
                        name: vlc('Learning Track', 'Учебный трек'),
                        sortOrder: 5,
                        targetEntityCodename: 'LearningTracks',
                        targetEntityKind: 'catalog'
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
                kind: 'catalog',
                name: vlc('Assignment Submissions', 'Сдачи заданий'),
                description: vlc(
                    'Student assignment submissions with review state and score.',
                    'Сдачи заданий студентами со статусом проверки и баллом.'
                ),
                config: buildTransactionalCatalogConfig({
                    prefix: 'SUB-',
                    effectiveDateField: 'SubmittedAt',
                    stateField: 'Status',
                    states: [
                        { codename: 'Submitted', title: 'Submitted', isInitial: true },
                        { codename: 'InReview', title: 'In Review' },
                        { codename: 'Accepted', title: 'Accepted', isFinal: true },
                        { codename: 'Declined', title: 'Declined', isFinal: true }
                    ],
                    targetLedgers: ['ScoreLedger', 'LearningActivityLedger']
                }),
                attributes: [
                    {
                        codename: 'AssignmentId',
                        dataType: 'REF',
                        name: vlc('Assignment', 'Назначение'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'Assignments',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'StudentId',
                        dataType: 'REF',
                        name: vlc('Student', 'Студент'),
                        isRequired: true,
                        sortOrder: 2,
                        targetEntityCodename: 'Students',
                        targetEntityKind: 'catalog'
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
                        validationRules: { maxLength: 100 }
                    },
                    {
                        codename: 'Feedback',
                        dataType: 'STRING',
                        name: vlc('Feedback', 'Обратная связь'),
                        sortOrder: 7,
                        validationRules: { localized: true, versioned: true }
                    }
                ]
            },
            {
                codename: 'TrainingEvents',
                kind: 'catalog',
                name: vlc('Training Events', 'Учебные мероприятия'),
                description: vlc(
                    'Instructor-led sessions, webinars, and blended learning events.',
                    'Очные занятия, вебинары и смешанные учебные мероприятия.'
                ),
                config: buildTransactionalCatalogConfig({
                    prefix: 'TRN-',
                    effectiveDateField: 'StartsAt',
                    targetLedgers: ['AttendanceLedger']
                }),
                attributes: [
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayAttribute: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 500, localized: true, versioned: true }
                    },
                    {
                        codename: 'EventType',
                        dataType: 'REF',
                        name: vlc('Event Type', 'Тип мероприятия'),
                        sortOrder: 2,
                        targetEntityCodename: 'TrainingEventType',
                        targetEntityKind: 'enumeration'
                    },
                    {
                        codename: 'StartsAt',
                        dataType: 'DATE',
                        name: vlc('Starts At', 'Начало'),
                        sortOrder: 3
                    },
                    {
                        codename: 'EndsAt',
                        dataType: 'DATE',
                        name: vlc('Ends At', 'Окончание'),
                        sortOrder: 4
                    },
                    {
                        codename: 'Capacity',
                        dataType: 'NUMBER',
                        name: vlc('Capacity', 'Вместимость'),
                        sortOrder: 5,
                        validationRules: { min: 1 }
                    }
                ]
            },
            {
                codename: 'TrainingAttendance',
                kind: 'catalog',
                name: vlc('Training Attendance', 'Посещаемость мероприятий'),
                description: vlc(
                    'Attendance facts for instructor-led sessions and webinars.',
                    'Факты посещаемости очных занятий и вебинаров.'
                ),
                config: buildTransactionalCatalogConfig({
                    prefix: 'ATT-',
                    effectiveDateField: 'CheckedInAt',
                    stateField: 'Status',
                    states: [
                        { codename: 'Registered', title: 'Registered', isInitial: true },
                        { codename: 'Attended', title: 'Attended', isFinal: true },
                        { codename: 'NoShow', title: 'No-show', isFinal: true },
                        { codename: 'Cancelled', title: 'Cancelled', isFinal: true }
                    ],
                    targetLedgers: ['AttendanceLedger', 'LearningActivityLedger']
                }),
                attributes: [
                    {
                        codename: 'TrainingEventId',
                        dataType: 'REF',
                        name: vlc('Training Event', 'Учебное мероприятие'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'TrainingEvents',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'StudentId',
                        dataType: 'REF',
                        name: vlc('Student', 'Студент'),
                        isRequired: true,
                        sortOrder: 2,
                        targetEntityCodename: 'Students',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'CheckedInAt',
                        dataType: 'DATE',
                        name: vlc('Checked In At', 'Отметка посещения'),
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
                        codename: 'DurationMinutes',
                        dataType: 'NUMBER',
                        name: vlc('Duration Minutes', 'Длительность в минутах'),
                        sortOrder: 5,
                        validationRules: { min: 0 }
                    }
                ]
            },
            {
                codename: 'Certificates',
                kind: 'catalog',
                name: vlc('Certificates', 'Сертификаты'),
                description: vlc(
                    'Issued completion certificates and their lifecycle state.',
                    'Выданные сертификаты о прохождении и их состояние.'
                ),
                config: buildTransactionalCatalogConfig({
                    prefix: 'CRT-',
                    effectiveDateField: 'IssuedAt',
                    stateField: 'Status',
                    states: [
                        { codename: 'Eligible', title: 'Eligible', isInitial: true },
                        { codename: 'Issued', title: 'Issued' },
                        { codename: 'Revoked', title: 'Revoked', isFinal: true },
                        { codename: 'Expired', title: 'Expired', isFinal: true }
                    ],
                    targetLedgers: ['CertificateLedger']
                }),
                attributes: [
                    {
                        codename: 'CertificateNumber',
                        dataType: 'STRING',
                        name: vlc('Certificate Number', 'Номер сертификата'),
                        isRequired: true,
                        isDisplayAttribute: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 100 }
                    },
                    {
                        codename: 'StudentId',
                        dataType: 'REF',
                        name: vlc('Student', 'Студент'),
                        sortOrder: 2,
                        targetEntityCodename: 'Students',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'ModuleId',
                        dataType: 'REF',
                        name: vlc('Module', 'Модуль'),
                        sortOrder: 3,
                        targetEntityCodename: 'Modules',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'IssuedAt',
                        dataType: 'DATE',
                        name: vlc('Issued At', 'Выдан'),
                        sortOrder: 4
                    },
                    {
                        codename: 'Status',
                        dataType: 'REF',
                        name: vlc('Status', 'Статус'),
                        sortOrder: 5,
                        targetEntityCodename: 'CertificateStatus',
                        targetEntityKind: 'enumeration'
                    }
                ]
            },
            {
                codename: 'CertificateIssues',
                kind: 'catalog',
                name: vlc('Certificate Issues', 'Выдачи сертификатов'),
                description: vlc(
                    'Certificate issue and revocation events posted to the certificate ledger.',
                    'События выдачи и отзыва сертификатов, проводимые в регистр сертификатов.'
                ),
                config: buildTransactionalCatalogConfig({
                    prefix: 'CIS-',
                    effectiveDateField: 'IssuedAt',
                    stateField: 'Status',
                    states: [
                        { codename: 'Eligible', title: 'Eligible', isInitial: true },
                        { codename: 'Issued', title: 'Issued' },
                        { codename: 'Revoked', title: 'Revoked', isFinal: true },
                        { codename: 'Expired', title: 'Expired', isFinal: true }
                    ],
                    targetLedgers: ['CertificateLedger', 'NotificationLedger']
                }),
                attributes: [
                    {
                        codename: 'CertificateId',
                        dataType: 'REF',
                        name: vlc('Certificate', 'Сертификат'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'Certificates',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'CertificateNumber',
                        dataType: 'STRING',
                        name: vlc('Certificate Number', 'Номер сертификата'),
                        isRequired: true,
                        isDisplayAttribute: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 100 }
                    },
                    {
                        codename: 'StudentId',
                        dataType: 'REF',
                        name: vlc('Student', 'Студент'),
                        isRequired: true,
                        sortOrder: 3,
                        targetEntityCodename: 'Students',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'ModuleId',
                        dataType: 'REF',
                        name: vlc('Module', 'Модуль'),
                        sortOrder: 4,
                        targetEntityCodename: 'Modules',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'IssuedAt',
                        dataType: 'DATE',
                        name: vlc('Issued At', 'Выдан'),
                        isRequired: true,
                        sortOrder: 5
                    },
                    {
                        codename: 'Status',
                        dataType: 'REF',
                        name: vlc('Status', 'Статус'),
                        isRequired: true,
                        sortOrder: 6,
                        targetEntityCodename: 'CertificateStatus',
                        targetEntityKind: 'enumeration'
                    }
                ]
            },
            {
                codename: 'KnowledgeSpaces',
                kind: 'catalog',
                name: vlc('Knowledge Spaces', 'Пространства знаний'),
                description: vlc('Knowledge base spaces with shared permissions.', 'Пространства базы знаний с общими правами доступа.'),
                attributes: [
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayAttribute: true,
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
                        codename: 'Visibility',
                        dataType: 'STRING',
                        name: vlc('Visibility', 'Видимость'),
                        sortOrder: 3,
                        validationRules: { maxLength: 32 }
                    }
                ]
            },
            {
                codename: 'KnowledgeFolders',
                kind: 'catalog',
                name: vlc('Knowledge Folders', 'Папки знаний'),
                description: vlc('Folders and article bindings inside knowledge spaces.', 'Папки и привязки статей внутри пространств знаний.'),
                attributes: [
                    {
                        codename: 'SpaceId',
                        dataType: 'REF',
                        name: vlc('Knowledge Space', 'Пространство знаний'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'KnowledgeSpaces',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayAttribute: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 500, localized: true, versioned: true }
                    },
                    {
                        codename: 'ArticlePageCodename',
                        dataType: 'STRING',
                        name: vlc('Article Page Codename', 'Код статьи-страницы'),
                        sortOrder: 3,
                        validationRules: { maxLength: 128 }
                    },
                    {
                        codename: 'SortOrder',
                        dataType: 'NUMBER',
                        name: vlc('Sort Order', 'Порядок'),
                        sortOrder: 4,
                        validationRules: { min: 0 }
                    }
                ]
            },
            {
                codename: 'KnowledgeBookmarks',
                kind: 'catalog',
                name: vlc('Knowledge Bookmarks', 'Закладки знаний'),
                description: vlc('Per-learner bookmarks for knowledge base articles.', 'Закладки учащихся для статей базы знаний.'),
                attributes: [
                    {
                        codename: 'StudentId',
                        dataType: 'REF',
                        name: vlc('Student', 'Студент'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'Students',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'FolderId',
                        dataType: 'REF',
                        name: vlc('Knowledge Folder', 'Папка знаний'),
                        isRequired: true,
                        sortOrder: 2,
                        targetEntityCodename: 'KnowledgeFolders',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'CreatedAt',
                        dataType: 'DATE',
                        name: vlc('Created At', 'Создано'),
                        sortOrder: 3
                    }
                ]
            },
            {
                codename: 'DevelopmentPlans',
                kind: 'catalog',
                name: vlc('Development Plans', 'Планы развития'),
                description: vlc('Onboarding and growth plans for learners and teams.', 'Планы адаптации и развития для учащихся и команд.'),
                attributes: [
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayAttribute: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 500, localized: true, versioned: true }
                    },
                    {
                        codename: 'StudentId',
                        dataType: 'REF',
                        name: vlc('Student', 'Студент'),
                        sortOrder: 2,
                        targetEntityCodename: 'Students',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'SupervisorEmail',
                        dataType: 'STRING',
                        name: vlc('Supervisor Email', 'Email руководителя'),
                        sortOrder: 3,
                        validationRules: { maxLength: 320 }
                    },
                    {
                        codename: 'Status',
                        dataType: 'REF',
                        name: vlc('Status', 'Статус'),
                        sortOrder: 4,
                        targetEntityCodename: 'CompletionStatus',
                        targetEntityKind: 'enumeration'
                    }
                ]
            },
            {
                codename: 'DevelopmentPlanStages',
                kind: 'catalog',
                name: vlc('Development Plan Stages', 'Этапы плана развития'),
                description: vlc('Ordered stages inside development plans.', 'Упорядоченные этапы внутри планов развития.'),
                attributes: [
                    {
                        codename: 'PlanId',
                        dataType: 'REF',
                        name: vlc('Development Plan', 'План развития'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'DevelopmentPlans',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayAttribute: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 500, localized: true, versioned: true }
                    },
                    {
                        codename: 'SortOrder',
                        dataType: 'NUMBER',
                        name: vlc('Sort Order', 'Порядок'),
                        sortOrder: 3,
                        validationRules: { min: 0 }
                    }
                ]
            },
            {
                codename: 'DevelopmentPlanTasks',
                kind: 'catalog',
                name: vlc('Development Plan Tasks', 'Задачи плана развития'),
                description: vlc('Actionable tasks inside development plan stages.', 'Практические задачи внутри этапов плана развития.'),
                attributes: [
                    {
                        codename: 'StageId',
                        dataType: 'REF',
                        name: vlc('Development Stage', 'Этап развития'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'DevelopmentPlanStages',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayAttribute: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 500, localized: true, versioned: true }
                    },
                    {
                        codename: 'ResourceId',
                        dataType: 'REF',
                        name: vlc('Resource', 'Ресурс'),
                        sortOrder: 3,
                        targetEntityCodename: 'LearningResources',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'Status',
                        dataType: 'REF',
                        name: vlc('Status', 'Статус'),
                        sortOrder: 4,
                        targetEntityCodename: 'CompletionStatus',
                        targetEntityKind: 'enumeration'
                    }
                ]
            },
            {
                codename: 'NotificationRules',
                kind: 'catalog',
                name: vlc('Notification Rules', 'Правила уведомлений'),
                description: vlc('Generic notification rules triggered by scripts and workflow events.', 'Универсальные правила уведомлений от скриптов и workflow-событий.'),
                attributes: [
                    {
                        codename: 'Name',
                        dataType: 'STRING',
                        name: vlc('Name', 'Название'),
                        isRequired: true,
                        isDisplayAttribute: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 255, localized: true, versioned: true }
                    },
                    {
                        codename: 'Trigger',
                        dataType: 'STRING',
                        name: vlc('Trigger', 'Триггер'),
                        isRequired: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 128 }
                    },
                    {
                        codename: 'Template',
                        dataType: 'JSON',
                        name: vlc('Template', 'Шаблон'),
                        sortOrder: 3
                    }
                ]
            },
            {
                codename: 'NotificationOutbox',
                kind: 'catalog',
                name: vlc('Notification Outbox', 'Очередь уведомлений'),
                description: vlc('Script-generated notification events awaiting delivery.', 'События уведомлений от скриптов, ожидающие доставки.'),
                config: buildTransactionalCatalogConfig({
                    prefix: 'NTF-',
                    effectiveDateField: 'CreatedAt',
                    targetLedgers: ['NotificationLedger']
                }),
                attributes: [
                    {
                        codename: 'RuleId',
                        dataType: 'REF',
                        name: vlc('Notification Rule', 'Правило уведомления'),
                        sortOrder: 1,
                        targetEntityCodename: 'NotificationRules',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'Recipient',
                        dataType: 'STRING',
                        name: vlc('Recipient', 'Получатель'),
                        isRequired: true,
                        isDisplayAttribute: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 320 }
                    },
                    {
                        codename: 'Payload',
                        dataType: 'JSON',
                        name: vlc('Payload', 'Данные'),
                        sortOrder: 3
                    },
                    {
                        codename: 'CreatedAt',
                        dataType: 'DATE',
                        name: vlc('Created At', 'Создано'),
                        sortOrder: 4
                    }
                ]
            },
            {
                codename: 'Reports',
                kind: 'catalog',
                name: vlc('Reports', 'Отчеты'),
                description: vlc(
                    'Reusable LMS report definitions for administrators and instructors.',
                    'Переиспользуемые определения отчетов LMS для администраторов и преподавателей.'
                ),
                attributes: [
                    {
                        codename: 'Name',
                        dataType: 'STRING',
                        name: vlc('Name', 'Название'),
                        isRequired: true,
                        isDisplayAttribute: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 255, localized: true, versioned: true }
                    },
                    {
                        codename: 'ReportType',
                        dataType: 'REF',
                        name: vlc('Report Type', 'Тип отчета'),
                        sortOrder: 2,
                        targetEntityCodename: 'ReportType',
                        targetEntityKind: 'enumeration'
                    },
                    {
                        codename: 'Filters',
                        dataType: 'JSON',
                        name: vlc('Filters', 'Фильтры'),
                        sortOrder: 3
                    },
                    {
                        codename: 'Definition',
                        dataType: 'JSON',
                        name: vlc('Definition', 'Определение'),
                        sortOrder: 4
                    },
                    {
                        codename: 'SavedFilters',
                        dataType: 'JSON',
                        name: vlc('Saved Filters', 'Сохраненные фильтры'),
                        sortOrder: 5
                    }
                ]
            },
            {
                codename: 'ModuleStatus',
                kind: 'enumeration',
                name: vlc('Module Status', 'Статус модуля'),
                description: vlc('Status values for learning modules.', 'Значения статуса учебных модулей.')
            },
            {
                codename: 'EnrollmentStatus',
                kind: 'enumeration',
                name: vlc('Enrollment Status', 'Статус записи'),
                description: vlc('Status values for student enrollments.', 'Значения статуса записей студентов.')
            },
            {
                codename: 'QuestionType',
                kind: 'enumeration',
                name: vlc('Question Type', 'Тип вопроса'),
                description: vlc('Types of quiz questions.', 'Типы вопросов теста.')
            },
            {
                codename: 'ContentType',
                kind: 'enumeration',
                name: vlc('Content Type', 'Тип контента'),
                description: vlc('Types of content items in modules.', 'Типы элементов контента в модулях.')
            },
            {
                codename: 'ResourceType',
                kind: 'enumeration',
                name: vlc('Resource Type', 'Тип ресурса'),
                description: vlc('Generic resource types for learning content.', 'Универсальные типы ресурсов для учебного контента.')
            },
            {
                codename: 'CompletionStatus',
                kind: 'enumeration',
                name: vlc('Completion Status', 'Статус прохождения'),
                description: vlc('Generic completion states for resources, courses, tracks, and plans.', 'Универсальные статусы прохождения ресурсов, курсов, треков и планов.')
            },
            {
                codename: 'AttemptStatus',
                kind: 'enumeration',
                name: vlc('Attempt Status', 'Статус попытки'),
                description: vlc('Attempt lifecycle states for quizzes and assessments.', 'Состояния жизненного цикла попыток тестов и оцениваний.')
            },
            {
                codename: 'AssignmentReviewStatus',
                kind: 'enumeration',
                name: vlc('Assignment Review Status', 'Статус проверки задания'),
                description: vlc('Review states for assignment submissions.', 'Состояния проверки отправленных заданий.')
            },
            {
                codename: 'AssignmentStatus',
                kind: 'enumeration',
                name: vlc('Assignment Status', 'Статус назначения'),
                description: vlc('Status values for learning assignments.', 'Значения статуса учебных назначений.')
            },
            {
                codename: 'TrainingAttendanceStatus',
                kind: 'enumeration',
                name: vlc('Training Attendance Status', 'Статус посещаемости'),
                description: vlc('Attendance states for instructor-led events.', 'Состояния посещаемости очных и онлайн-мероприятий.')
            },
            {
                codename: 'TrainingEventType',
                kind: 'enumeration',
                name: vlc('Training Event Type', 'Тип учебного мероприятия'),
                description: vlc('Types of instructor-led and blended training events.', 'Типы очных и смешанных учебных мероприятий.')
            },
            {
                codename: 'CertificateStatus',
                kind: 'enumeration',
                name: vlc('Certificate Status', 'Статус сертификата'),
                description: vlc('Status values for issued certificates.', 'Значения статуса выданных сертификатов.')
            },
            {
                codename: 'ReportType',
                kind: 'enumeration',
                name: vlc('Report Type', 'Тип отчета'),
                description: vlc('Report categories for LMS analytics.', 'Категории отчетов для аналитики LMS.')
            }
        ],
        optionValues: {
            ModuleStatus: [
                { codename: 'Draft', name: vlc('Draft', 'Черновик'), sortOrder: 1 },
                { codename: 'Published', name: vlc('Published', 'Опубликовано'), sortOrder: 2, isDefault: true },
                { codename: 'Archived', name: vlc('Archived', 'Архив'), sortOrder: 3 }
            ],
            EnrollmentStatus: [
                { codename: 'Invited', name: vlc('Invited', 'Приглашён'), sortOrder: 1 },
                { codename: 'Active', name: vlc('Active', 'Активен'), sortOrder: 2, isDefault: true },
                { codename: 'Completed', name: vlc('Completed', 'Завершён'), sortOrder: 3 },
                { codename: 'Dropped', name: vlc('Dropped', 'Покинул'), sortOrder: 4 }
            ],
            QuestionType: [
                { codename: 'SingleChoice', name: vlc('Single Choice', 'Одиночный выбор'), sortOrder: 1, isDefault: true },
                { codename: 'MultipleChoice', name: vlc('Multiple Choice', 'Множественный выбор'), sortOrder: 2 }
            ],
            ContentType: [
                { codename: 'Text', name: vlc('Text', 'Текст'), sortOrder: 1, isDefault: true },
                { codename: 'Image', name: vlc('Image', 'Изображение'), sortOrder: 2 },
                { codename: 'VideoUrl', name: vlc('Video URL', 'URL видео'), sortOrder: 3 },
                { codename: 'QuizRef', name: vlc('Quiz Reference', 'Ссылка на тест'), sortOrder: 4 }
            ],
            ResourceType: [
                { codename: 'Page', name: vlc('Page', 'Страница'), sortOrder: 1, isDefault: true },
                { codename: 'Url', name: vlc('URL', 'URL'), sortOrder: 2 },
                { codename: 'Video', name: vlc('Video', 'Видео'), sortOrder: 3 },
                { codename: 'Audio', name: vlc('Audio', 'Аудио'), sortOrder: 4 },
                { codename: 'Document', name: vlc('Document', 'Документ'), sortOrder: 5 },
                { codename: 'Scorm', name: vlc('SCORM-like package', 'SCORM-подобный пакет'), sortOrder: 6 },
                { codename: 'Embed', name: vlc('Embed', 'Встраивание'), sortOrder: 7 },
                { codename: 'File', name: vlc('File', 'Файл'), sortOrder: 8 }
            ],
            CompletionStatus: [
                { codename: 'NotStarted', name: vlc('Not started', 'Не начато'), sortOrder: 1, isDefault: true },
                { codename: 'InProgress', name: vlc('In progress', 'В процессе'), sortOrder: 2 },
                { codename: 'Completed', name: vlc('Completed', 'Завершено'), sortOrder: 3 },
                { codename: 'Overdue', name: vlc('Overdue', 'Просрочено'), sortOrder: 4 },
                { codename: 'Expired', name: vlc('Expired', 'Истекло'), sortOrder: 5 }
            ],
            AttemptStatus: [
                { codename: 'NotStarted', name: vlc('Not started', 'Не начато'), sortOrder: 1, isDefault: true },
                { codename: 'InProgress', name: vlc('In progress', 'В процессе'), sortOrder: 2 },
                { codename: 'Failed', name: vlc('Failed', 'Не пройдено'), sortOrder: 3 },
                { codename: 'Passed', name: vlc('Passed', 'Пройдено'), sortOrder: 4 }
            ],
            AssignmentReviewStatus: [
                { codename: 'NotStarted', name: vlc('Not started', 'Не начато'), sortOrder: 1, isDefault: true },
                { codename: 'PendingReview', name: vlc('Pending Review', 'Ожидает проверки'), sortOrder: 2 },
                { codename: 'Declined', name: vlc('Declined', 'Отклонено'), sortOrder: 3 },
                { codename: 'Accepted', name: vlc('Accepted', 'Принято'), sortOrder: 4 }
            ],
            AssignmentStatus: [
                { codename: 'Draft', name: vlc('Draft', 'Черновик'), sortOrder: 1 },
                { codename: 'Assigned', name: vlc('Assigned', 'Назначено'), sortOrder: 2, isDefault: true },
                { codename: 'Completed', name: vlc('Completed', 'Завершено'), sortOrder: 3 },
                { codename: 'Cancelled', name: vlc('Cancelled', 'Отменено'), sortOrder: 4 }
            ],
            TrainingAttendanceStatus: [
                { codename: 'Registered', name: vlc('Registered', 'Зарегистрирован'), sortOrder: 1, isDefault: true },
                { codename: 'Attended', name: vlc('Attended', 'Посетил'), sortOrder: 2 },
                { codename: 'NoShow', name: vlc('No-show', 'Не явился'), sortOrder: 3 },
                { codename: 'Cancelled', name: vlc('Cancelled', 'Отменено'), sortOrder: 4 }
            ],
            TrainingEventType: [
                { codename: 'Classroom', name: vlc('Classroom', 'Аудиторное занятие'), sortOrder: 1, isDefault: true },
                { codename: 'Webinar', name: vlc('Webinar', 'Вебинар'), sortOrder: 2 },
                { codename: 'Blended', name: vlc('Blended', 'Смешанное'), sortOrder: 3 }
            ],
            CertificateStatus: [
                { codename: 'Eligible', name: vlc('Eligible', 'Готов к выдаче'), sortOrder: 1 },
                { codename: 'Issued', name: vlc('Issued', 'Выдан'), sortOrder: 2, isDefault: true },
                { codename: 'Revoked', name: vlc('Revoked', 'Отозван'), sortOrder: 3 },
                { codename: 'Expired', name: vlc('Expired', 'Истек'), sortOrder: 4 }
            ],
            ReportType: [
                { codename: 'Progress', name: vlc('Progress', 'Прогресс'), sortOrder: 1, isDefault: true },
                { codename: 'Enrollment', name: vlc('Enrollment', 'Записи'), sortOrder: 2 },
                { codename: 'QuizResults', name: vlc('Quiz Results', 'Результаты тестов'), sortOrder: 3 }
            ]
        },
        scripts: [
            {
                codename: 'AutoEnrollmentRuleScript',
                name: vlc('Auto Enrollment Rule Script', 'Скрипт правила автозачисления'),
                description: vlc(
                    'Creates an enrollment for a new student when the student record carries enough assignment context.',
                    'Создает запись на обучение для нового студента, если запись студента содержит достаточный контекст назначения.'
                ),
                attachedToKind: 'catalog',
                attachedToEntityCodename: 'Students',
                moduleRole: 'lifecycle',
                sourceKind: 'embedded',
                sdkApiVersion: '1.0.0',
                capabilities: ['records.read', 'records.write', 'metadata.read', 'lifecycle'],
                sourceCode: LMS_AUTO_ENROLLMENT_SCRIPT_SOURCE
            },
            {
                codename: 'EnrollmentPostingScript',
                name: vlc('Enrollment Posting Script', 'Скрипт проведения записи'),
                description: vlc(
                    'Posts enrollment records into the generic Progress Ledger.',
                    'Проводит записи на обучение в универсальный регистр прогресса.'
                ),
                attachedToKind: 'catalog',
                attachedToEntityCodename: 'Enrollments',
                moduleRole: 'lifecycle',
                sourceKind: 'embedded',
                sdkApiVersion: '1.0.0',
                capabilities: ['records.read', 'metadata.read', 'lifecycle', 'posting', 'ledger.write'],
                sourceCode: LMS_ENROLLMENT_POSTING_SCRIPT_SOURCE
            },
            {
                codename: 'QuizAttemptPostingScript',
                name: vlc('Quiz Attempt Posting Script', 'Скрипт проведения попытки теста'),
                description: vlc(
                    'Posts quiz attempt records into score and learning activity Ledgers.',
                    'Проводит попытки тестов в регистры оценок и учебной активности.'
                ),
                attachedToKind: 'catalog',
                attachedToEntityCodename: 'QuizAttempts',
                moduleRole: 'lifecycle',
                sourceKind: 'embedded',
                sdkApiVersion: '1.0.0',
                capabilities: ['records.read', 'metadata.read', 'lifecycle', 'posting', 'ledger.write'],
                sourceCode: LMS_QUIZ_ATTEMPT_POSTING_SCRIPT_SOURCE
            },
            {
                codename: 'ModuleCompletionPostingScript',
                name: vlc('Module Completion Posting Script', 'Скрипт проведения завершения модуля'),
                description: vlc(
                    'Posts module completion progress records into the progress Ledger.',
                    'Проводит записи прогресса модулей в регистр прогресса.'
                ),
                attachedToKind: 'catalog',
                attachedToEntityCodename: 'ModuleProgress',
                moduleRole: 'lifecycle',
                sourceKind: 'embedded',
                sdkApiVersion: '1.0.0',
                capabilities: ['records.read', 'metadata.read', 'lifecycle', 'posting', 'ledger.write'],
                sourceCode: LMS_MODULE_COMPLETION_POSTING_SCRIPT_SOURCE
            },
            {
                codename: 'CertificateIssuePostingScript',
                name: vlc('Certificate Issue Posting Script', 'Скрипт проведения выдачи сертификата'),
                description: vlc(
                    'Posts certificate issue records into certificate and notification Ledgers.',
                    'Проводит выдачи сертификатов в регистры сертификатов и уведомлений.'
                ),
                attachedToKind: 'catalog',
                attachedToEntityCodename: 'CertificateIssues',
                moduleRole: 'lifecycle',
                sourceKind: 'embedded',
                sdkApiVersion: '1.0.0',
                capabilities: ['records.read', 'metadata.read', 'lifecycle', 'posting', 'ledger.write'],
                sourceCode: LMS_CERTIFICATE_ISSUE_POSTING_SCRIPT_SOURCE
            }
        ],
        settings: [
            { key: 'general.language', value: { _value: 'system' } },
            { key: 'general.timezone', value: { _value: 'UTC' } },
            { key: 'general.codenameStyle', value: { _value: 'pascal-case' } },
            { key: 'general.codenameAlphabet', value: { _value: 'en-ru' } },
            { key: 'general.codenameAllowMixedAlphabets', value: { _value: false } },
            { key: 'general.codenameAutoConvertMixedAlphabets', value: { _value: true } },
            { key: 'general.codenameAutoReformat', value: { _value: true } },
            { key: 'general.codenameRequireReformat', value: { _value: true } },
            { key: 'application.publicRuntime.guest', value: { _value: LMS_PUBLIC_GUEST_RUNTIME_CONFIG } },
            { key: 'entity.catalog.allowAttributeCopy', value: { _value: true } },
            { key: 'entity.catalog.allowAttributeDelete', value: { _value: true } },
            { key: 'entity.catalog.allowDeleteLastDisplayAttribute', value: { _value: true } }
        ]
    }
}
