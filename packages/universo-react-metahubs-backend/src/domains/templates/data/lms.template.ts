import type { MetahubTemplateManifest, TemplateSeedZoneWidget, WorkflowAction } from '@universo-react/types'
import { vlc, enrichConfigWithVlcTimestamps } from './basic.template'

type LmsTemplateEntity = NonNullable<MetahubTemplateManifest['seed']['entities']>[number]

type LmsWorkflowActionOptions = {
    codename: string
    titleEn: string
    titleRu: string
    from: string[]
    to: string
    statusFieldCodename?: string
    requiredCapabilities: string[]
    postingCommand?: WorkflowAction['postingCommand']
    moduleCodename?: string
    confirmation?: {
        titleEn: string
        titleRu: string
        messageEn: string
        messageRu: string
        confirmLabelEn: string
        confirmLabelRu: string
    }
}

const workflowText = (en: string, ru: string): WorkflowAction['title'] => vlc(en, ru) as unknown as WorkflowAction['title']

const buildLmsWorkflowAction = ({
    codename,
    titleEn,
    titleRu,
    from,
    to,
    statusFieldCodename = 'Status',
    requiredCapabilities,
    postingCommand,
    moduleCodename,
    confirmation
}: LmsWorkflowActionOptions): WorkflowAction => ({
    codename,
    title: workflowText(titleEn, titleRu),
    from,
    to,
    statusFieldCodename,
    requiredCapabilities,
    ...(postingCommand ? { postingCommand } : {}),
    ...(moduleCodename ? { moduleCodename } : {}),
    ...(confirmation
        ? {
              confirmation: {
                  required: true,
                  title: workflowText(confirmation.titleEn, confirmation.titleRu),
                  message: workflowText(confirmation.messageEn, confirmation.messageRu),
                  confirmLabel: workflowText(confirmation.confirmLabelEn, confirmation.confirmLabelRu)
              }
          }
        : {})
})

const LMS_ASSIGNMENT_SUBMISSION_WORKFLOW_ACTIONS: WorkflowAction[] = [
    buildLmsWorkflowAction({
        codename: 'StartSubmissionReview',
        titleEn: 'Start review',
        titleRu: 'Начать проверку',
        from: ['Submitted'],
        to: 'PendingReview',
        requiredCapabilities: ['assignment.review']
    }),
    buildLmsWorkflowAction({
        codename: 'AcceptSubmission',
        titleEn: 'Accept submission',
        titleRu: 'Принять сдачу',
        from: ['PendingReview'],
        to: 'Accepted',
        requiredCapabilities: ['assignment.review'],
        postingCommand: 'post',
        confirmation: {
            titleEn: 'Accept submission',
            titleRu: 'Принять сдачу',
            messageEn: 'Accept this submission and make the result available for reports?',
            messageRu: 'Принять эту сдачу и сделать результат доступным для отчётов?',
            confirmLabelEn: 'Accept',
            confirmLabelRu: 'Принять'
        }
    }),
    buildLmsWorkflowAction({
        codename: 'DeclineSubmission',
        titleEn: 'Decline submission',
        titleRu: 'Отклонить сдачу',
        from: ['PendingReview'],
        to: 'Declined',
        requiredCapabilities: ['assignment.review'],
        confirmation: {
            titleEn: 'Decline submission',
            titleRu: 'Отклонить сдачу',
            messageEn: 'Decline this submission and keep it visible for learner feedback?',
            messageRu: 'Отклонить эту сдачу и оставить ее доступной для обратной связи учащегося?',
            confirmLabelEn: 'Decline',
            confirmLabelRu: 'Отклонить'
        }
    })
]

const LMS_LEARNING_RESOURCE_PUBLICATION_WORKFLOW_ACTIONS: WorkflowAction[] = [
    buildLmsWorkflowAction({
        codename: 'PublishLearningResource',
        titleEn: 'Publish',
        titleRu: 'Опубликовать',
        from: ['Draft', 'UnpublishedChanges'],
        to: 'Published',
        statusFieldCodename: 'PublicationStatus',
        requiredCapabilities: ['workflow.execute'],
        confirmation: {
            titleEn: 'Publish learning resource',
            titleRu: 'Опубликовать учебный ресурс',
            messageEn: 'Publish this resource for use in courses, tracks, and learner-facing views?',
            messageRu: 'Опубликовать этот ресурс для использования в курсах, треках и витринах учащихся?',
            confirmLabelEn: 'Publish',
            confirmLabelRu: 'Опубликовать'
        }
    }),
    buildLmsWorkflowAction({
        codename: 'ReturnLearningResourceToDraft',
        titleEn: 'Return to draft',
        titleRu: 'Вернуть в черновик',
        from: ['Published', 'UnpublishedChanges'],
        to: 'Draft',
        statusFieldCodename: 'PublicationStatus',
        requiredCapabilities: ['workflow.execute'],
        confirmation: {
            titleEn: 'Return learning resource to draft',
            titleRu: 'Вернуть учебный ресурс в черновик',
            messageEn: 'Move this resource back to draft so it is hidden from learner-facing views until it is published again?',
            messageRu: 'Вернуть ресурс в черновик, чтобы скрыть его из витрин учащихся до повторной публикации?',
            confirmLabelEn: 'Return to draft',
            confirmLabelRu: 'Вернуть в черновик'
        }
    }),
    buildLmsWorkflowAction({
        codename: 'MarkLearningResourceChanged',
        titleEn: 'Mark unpublished changes',
        titleRu: 'Отметить изменения',
        from: ['Published'],
        to: 'UnpublishedChanges',
        statusFieldCodename: 'PublicationStatus',
        requiredCapabilities: ['workflow.execute']
    })
]

const LMS_TRAINING_ATTENDANCE_WORKFLOW_ACTIONS: WorkflowAction[] = [
    buildLmsWorkflowAction({
        codename: 'MarkAttendanceAttended',
        titleEn: 'Mark attended',
        titleRu: 'Отметить посещение',
        from: ['Registered'],
        to: 'Attended',
        requiredCapabilities: ['attendance.mark'],
        postingCommand: 'post'
    }),
    buildLmsWorkflowAction({
        codename: 'MarkAttendanceNoShow',
        titleEn: 'Mark no-show',
        titleRu: 'Отметить неявку',
        from: ['Registered'],
        to: 'NoShow',
        requiredCapabilities: ['attendance.mark'],
        postingCommand: 'post'
    }),
    buildLmsWorkflowAction({
        codename: 'CancelAttendance',
        titleEn: 'Cancel attendance',
        titleRu: 'Отменить посещаемость',
        from: ['Registered', 'Attended', 'NoShow'],
        to: 'Cancelled',
        requiredCapabilities: ['attendance.manage'],
        postingCommand: 'void'
    })
]

const LMS_CERTIFICATE_ISSUE_WORKFLOW_ACTIONS: WorkflowAction[] = [
    buildLmsWorkflowAction({
        codename: 'IssueCertificate',
        titleEn: 'Issue certificate',
        titleRu: 'Выдать сертификат',
        from: ['Eligible'],
        to: 'Issued',
        requiredCapabilities: ['certificate.issue'],
        postingCommand: 'post',
        moduleCodename: 'CertificateIssuePostingModule',
        confirmation: {
            titleEn: 'Issue certificate',
            titleRu: 'Выдать сертификат',
            messageEn: 'Issue this certificate and record the auditable certificate fact?',
            messageRu: 'Выдать этот сертификат и записать проверяемый факт сертификата?',
            confirmLabelEn: 'Issue',
            confirmLabelRu: 'Выдать'
        }
    }),
    buildLmsWorkflowAction({
        codename: 'RevokeCertificate',
        titleEn: 'Revoke certificate',
        titleRu: 'Отозвать сертификат',
        from: ['Issued'],
        to: 'Revoked',
        requiredCapabilities: ['certificate.revoke'],
        postingCommand: 'post',
        moduleCodename: 'CertificateIssuePostingModule',
        confirmation: {
            titleEn: 'Revoke certificate',
            titleRu: 'Отозвать сертификат',
            messageEn: 'Revoke this certificate and record the revocation fact?',
            messageRu: 'Отозвать этот сертификат и записать факт отзыва?',
            confirmLabelEn: 'Revoke',
            confirmLabelRu: 'Отозвать'
        }
    })
]

const LMS_DEVELOPMENT_TASK_WORKFLOW_ACTIONS: WorkflowAction[] = [
    buildLmsWorkflowAction({
        codename: 'StartDevelopmentTask',
        titleEn: 'Start task',
        titleRu: 'Начать задачу',
        from: ['NotStarted'],
        to: 'InProgress',
        requiredCapabilities: ['development.task.update']
    }),
    buildLmsWorkflowAction({
        codename: 'CompleteDevelopmentTask',
        titleEn: 'Complete task',
        titleRu: 'Завершить задачу',
        from: ['InProgress'],
        to: 'Completed',
        requiredCapabilities: ['development.task.update']
    }),
    buildLmsWorkflowAction({
        codename: 'ReopenDevelopmentTask',
        titleEn: 'Reopen task',
        titleRu: 'Вернуть задачу',
        from: ['Completed'],
        to: 'InProgress',
        requiredCapabilities: ['development.task.update']
    })
]

const LMS_NOTIFICATION_OUTBOX_WORKFLOW_ACTIONS: WorkflowAction[] = [
    buildLmsWorkflowAction({
        codename: 'MarkNotificationSent',
        titleEn: 'Mark sent',
        titleRu: 'Отметить отправленным',
        from: ['Queued', 'Failed'],
        to: 'Sent',
        requiredCapabilities: ['notification.deliver'],
        postingCommand: 'post'
    }),
    buildLmsWorkflowAction({
        codename: 'MarkNotificationFailed',
        titleEn: 'Mark failed',
        titleRu: 'Отметить ошибку',
        from: ['Queued'],
        to: 'Failed',
        requiredCapabilities: ['notification.deliver']
    }),
    buildLmsWorkflowAction({
        codename: 'CancelNotification',
        titleEn: 'Cancel notification',
        titleRu: 'Отменить уведомление',
        from: ['Queued', 'Failed'],
        to: 'Cancelled',
        requiredCapabilities: ['notification.manage'],
        postingCommand: 'void'
    })
]

const LMS_POINT_TRANSACTION_WORKFLOW_ACTIONS: WorkflowAction[] = [
    buildLmsWorkflowAction({
        codename: 'ApprovePointAdjustment',
        titleEn: 'Approve points',
        titleRu: 'Подтвердить баллы',
        from: ['Pending'],
        to: 'Approved',
        requiredCapabilities: ['gamification.points.adjust'],
        postingCommand: 'post',
        moduleCodename: 'PointTransactionPostingModule',
        confirmation: {
            titleEn: 'Approve point adjustment',
            titleRu: 'Подтвердить изменение баллов',
            messageEn: 'Approve this point adjustment and append an auditable Points Ledger fact?',
            messageRu: 'Подтвердить изменение баллов и добавить проверяемый факт в регистр баллов?',
            confirmLabelEn: 'Approve',
            confirmLabelRu: 'Подтвердить'
        }
    }),
    buildLmsWorkflowAction({
        codename: 'ReversePointAdjustment',
        titleEn: 'Reverse points',
        titleRu: 'Сторнировать баллы',
        from: ['Approved'],
        to: 'Reversed',
        requiredCapabilities: ['gamification.points.adjust'],
        postingCommand: 'void',
        moduleCodename: 'PointTransactionPostingModule',
        confirmation: {
            titleEn: 'Reverse point adjustment',
            titleRu: 'Сторнировать изменение баллов',
            messageEn: 'Reverse this point adjustment with an append-only compensating fact?',
            messageRu: 'Сторнировать изменение баллов через append-only компенсирующий факт?',
            confirmLabelEn: 'Reverse',
            confirmLabelRu: 'Сторнировать'
        }
    })
]

const LMS_BADGE_ISSUE_WORKFLOW_ACTIONS: WorkflowAction[] = [
    buildLmsWorkflowAction({
        codename: 'IssueBadge',
        titleEn: 'Issue badge',
        titleRu: 'Выдать бейдж',
        from: ['Eligible'],
        to: 'Issued',
        requiredCapabilities: ['badge.issue'],
        confirmation: {
            titleEn: 'Issue badge',
            titleRu: 'Выдать бейдж',
            messageEn: 'Issue this achievement badge to the learner?',
            messageRu: 'Выдать этот бейдж достижения учащемуся?',
            confirmLabelEn: 'Issue',
            confirmLabelRu: 'Выдать'
        }
    }),
    buildLmsWorkflowAction({
        codename: 'RevokeBadge',
        titleEn: 'Revoke badge',
        titleRu: 'Отозвать бейдж',
        from: ['Issued'],
        to: 'Revoked',
        requiredCapabilities: ['badge.revoke'],
        confirmation: {
            titleEn: 'Revoke badge',
            titleRu: 'Отозвать бейдж',
            messageEn: 'Revoke this learner badge while keeping the history visible?',
            messageRu: 'Отозвать бейдж учащегося, сохранив историю?',
            confirmLabelEn: 'Revoke',
            confirmLabelRu: 'Отозвать'
        }
    })
]

const LMS_PUBLIC_GUEST_RUNTIME_CONFIG = {
    objects: {
        accessLinks: 'AccessLinks',
        participants: 'Students',
        assessments: 'Quizzes',
        contentNodes: 'LearningResources',
        assessmentResponses: 'QuizResponses',
        contentProgress: 'ContentProgress'
    },
    fields: {
        accessLink: {
            slug: 'Slug',
            targetType: 'TargetType',
            targetId: 'TargetId',
            contentNodeIdRef: 'ContentNodeIdRef',
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
            contentNodeId: 'ContentNodeId',
            status: 'ProgressStatus',
            progressPercent: 'ProgressPercent',
            startedAt: 'StartedAt',
            completedAt: 'CompletedAt',
            lastAccessedItemIndex: 'LastAccessedItemIndex'
        }
    }
} as const

function buildLmsBaseSeedZoneWidgets(): TemplateSeedZoneWidget[] {
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
                autoShowAllSections: false,
                bindToHub: false,
                boundTreeEntityId: null,
                maxPrimaryItems: 12,
                overflowLabelKey: 'runtime.menu.more',
                startPage: 'LearnerHome',
                workspacePlacement: 'primary',
                items: [
                    {
                        id: 'lms-nav-home',
                        kind: 'section',
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
                        id: 'lms-nav-learning-content',
                        kind: 'section',
                        title: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Learning Content', version: 1, isActive: true },
                                ru: { content: 'Учебный контент', version: 1, isActive: true }
                            }
                        },
                        icon: 'folder',
                        href: null,
                        sectionId: 'ContentProjects',
                        sortOrder: 1,
                        isActive: true
                    },
                    {
                        id: 'lms-nav-courses',
                        kind: 'section',
                        title: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Courses', version: 1, isActive: true },
                                ru: { content: 'Курсы', version: 1, isActive: true }
                            }
                        },
                        icon: 'object',
                        href: null,
                        sectionId: 'Courses',
                        sortOrder: 5,
                        isActive: true
                    },
                    {
                        id: 'lms-nav-tracks',
                        kind: 'section',
                        title: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Tracks', version: 1, isActive: true },
                                ru: { content: 'Треки', version: 1, isActive: true }
                            }
                        },
                        icon: 'object',
                        href: null,
                        sectionId: 'LearningTracks',
                        sortOrder: 6,
                        isActive: true
                    },
                    {
                        id: 'lms-nav-recent-content',
                        kind: 'section',
                        title: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Recent', version: 1, isActive: true },
                                ru: { content: 'Недавние', version: 1, isActive: true }
                            }
                        },
                        icon: 'recent',
                        href: null,
                        sectionId: 'RecentContentViews',
                        sortOrder: 2,
                        isActive: true
                    },
                    {
                        id: 'lms-nav-starred-content',
                        kind: 'section',
                        title: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Starred', version: 1, isActive: true },
                                ru: { content: 'Избранное', version: 1, isActive: true }
                            }
                        },
                        icon: 'star',
                        href: null,
                        sectionId: 'ContentStars',
                        sortOrder: 3,
                        isActive: true
                    },
                    {
                        id: 'lms-nav-shared-content',
                        kind: 'section',
                        title: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Shared with me', version: 1, isActive: true },
                                ru: { content: 'Доступные мне', version: 1, isActive: true }
                            }
                        },
                        icon: 'users',
                        href: null,
                        sectionId: 'ContentAccessEntries',
                        sortOrder: 4,
                        isActive: true
                    },
                    {
                        id: 'lms-nav-trash-content',
                        kind: 'section',
                        title: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Trash', version: 1, isActive: true },
                                ru: { content: 'Корзина', version: 1, isActive: true }
                            }
                        },
                        icon: 'delete',
                        href: null,
                        sectionId: 'TrashEntries',
                        sortOrder: 7,
                        isActive: true
                    },
                    {
                        id: 'lms-nav-knowledge',
                        kind: 'section',
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
                        sectionId: 'KnowledgeArticles',
                        sortOrder: 8,
                        isActive: true
                    },
                    {
                        id: 'lms-nav-development',
                        kind: 'section',
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
                        sectionId: 'DevelopmentPlans',
                        sortOrder: 9,
                        isActive: true
                    },
                    {
                        id: 'lms-nav-reports',
                        kind: 'section',
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
                        sectionId: 'Reports',
                        sortOrder: 10,
                        isActive: true
                    }
                ]
            })
        },
        { zone: 'top' as const, widgetKey: 'appNavbar', sortOrder: 1 },
        { zone: 'top' as const, widgetKey: 'header', sortOrder: 2 },
        { zone: 'center' as const, widgetKey: 'detailsTitle', sortOrder: 5 },
        { zone: 'center' as const, widgetKey: 'detailsTable', sortOrder: 9 }
    ]
}

function buildLmsHomeSeedZoneWidgets(): TemplateSeedZoneWidget[] {
    return [
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
                        title: vlc('Projects', 'Проекты'),
                        value: '0',
                        interval: vlc('Workspace content', 'Контент пространства'),
                        trend: 'neutral',
                        datasource: {
                            kind: 'metric',
                            metricKey: 'records.count',
                            params: { sectionCodename: 'ContentProjects' }
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
        {
            zone: 'center' as const,
            widgetKey: 'sessionsChart',
            sortOrder: 6,
            config: {
                title: vlc('Department Progress', 'Прогресс подразделений'),
                interval: vlc('By content progress records', 'По записям прогресса контента'),
                datasource: {
                    kind: 'records.list',
                    sectionCodename: 'ContentProgress',
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
            widgetKey: 'detailsTabs',
            sortOrder: 8,
            config: {
                tabs: [
                    {
                        id: 'my-courses',
                        label: vlc('My Courses', 'Мои курсы'),
                        widgets: [
                            {
                                widgetKey: 'detailsTable',
                                config: {
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'Enrollments',
                                        query: {
                                            filters: [
                                                { field: 'AssignedUserId', operator: 'equals', value: { runtime: 'currentUserId' } },
                                                { field: 'TargetType', operator: 'equals', value: 'course' }
                                            ],
                                            sort: [{ field: 'DueDate', direction: 'asc' }]
                                        }
                                    }
                                }
                            }
                        ]
                    },
                    {
                        id: 'my-tracks',
                        label: vlc('My Tracks', 'Мои треки'),
                        widgets: [
                            {
                                widgetKey: 'detailsTable',
                                config: {
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'Enrollments',
                                        query: {
                                            filters: [
                                                { field: 'AssignedUserId', operator: 'equals', value: { runtime: 'currentUserId' } },
                                                { field: 'TargetType', operator: 'equals', value: 'track' }
                                            ],
                                            sort: [{ field: 'DueDate', direction: 'asc' }]
                                        }
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        }
    ]
}

function buildLmsLearningContentSeedZoneWidgets(libraryView: 'all' | 'recent' | 'starred' | 'shared' = 'all'): TemplateSeedZoneWidget[] {
    return [
        {
            zone: 'center' as const,
            widgetKey: 'overviewCards',
            sortOrder: 4,
            config: {
                cards: [
                    {
                        title: vlc('Projects', 'Проекты'),
                        value: '0',
                        interval: vlc('Current workspace', 'Текущее рабочее пространство'),
                        trend: 'neutral',
                        datasource: {
                            kind: 'metric',
                            metricKey: 'records.count',
                            params: { sectionCodename: 'ContentProjects' }
                        }
                    },
                    {
                        title: vlc('Pages and links', 'Страницы и ссылки'),
                        value: '0',
                        interval: vlc('Standalone content', 'Самостоятельный контент'),
                        trend: 'neutral',
                        datasource: {
                            kind: 'metric',
                            metricKey: 'records.count',
                            params: { sectionCodename: 'LearningResources' }
                        }
                    },
                    {
                        title: vlc('Courses', 'Курсы'),
                        value: '0',
                        interval: vlc('Course builder records', 'Записи конструктора курсов'),
                        trend: 'neutral',
                        datasource: {
                            kind: 'metric',
                            metricKey: 'records.count',
                            params: { sectionCodename: 'Courses' }
                        }
                    },
                    {
                        title: vlc('Tracks', 'Треки'),
                        value: '0',
                        interval: vlc('Learning track records', 'Записи учебных треков'),
                        trend: 'neutral',
                        datasource: {
                            kind: 'metric',
                            metricKey: 'records.count',
                            params: { sectionCodename: 'LearningTracks' }
                        }
                    }
                ]
            }
        },
        {
            zone: 'center' as const,
            widgetKey: 'detailsTable',
            sortOrder: 9,
            config: {
                datasource: {
                    kind: 'records.union',
                    projectedFields: ['Instructor'],
                    targets: [
                        {
                            sectionCodename: 'LearningResources',
                            displayType: 'resource',
                            titleField: 'Title',
                            statusField: 'PublicationStatus',
                            projectField: 'ProjectId'
                        },
                        {
                            sectionCodename: 'Courses',
                            displayType: 'course',
                            titleField: 'Title',
                            statusField: 'Status',
                            projectField: 'ProjectId'
                        },
                        {
                            sectionCodename: 'LearningTracks',
                            displayType: 'track',
                            titleField: 'Title',
                            statusField: 'Status',
                            projectField: 'ProjectId'
                        }
                    ],
                    query: {
                        lifecycleState: 'active',
                        libraryView,
                        sort: [
                            libraryView === 'recent'
                                ? { field: 'recentAt', direction: 'desc' }
                                : libraryView === 'shared'
                                ? { field: 'sharedAt', direction: 'desc' }
                                : { field: 'Title', direction: 'asc' }
                        ]
                    }
                },
                showViewToggle: true,
                showSearch: true,
                targetFilters: [
                    {
                        id: 'learning-content-filter-resources',
                        label: vlc('Resources', 'Ресурсы'),
                        targetDisplayTypes: ['resource']
                    },
                    {
                        id: 'learning-content-filter-courses',
                        label: vlc('Courses', 'Курсы'),
                        targetDisplayTypes: ['course']
                    },
                    {
                        id: 'learning-content-filter-tracks',
                        label: vlc('Learning Tracks', 'Учебные треки'),
                        targetDisplayTypes: ['track']
                    }
                ],
                rowActions: [
                    {
                        id: 'learning-content-toggle-starred',
                        kind: 'library.toggle',
                        libraryView: 'starred',
                        icon: 'star',
                        label: vlc('Add to starred', 'Добавить в избранное'),
                        activeLabel: vlc('Remove from starred', 'Убрать из избранного')
                    },
                    {
                        id: 'learning-content-toggle-shared',
                        kind: 'library.toggle',
                        libraryView: 'shared',
                        icon: 'share',
                        principalTarget: 'workspaceMember',
                        label: vlc('Share', 'Поделиться'),
                        activeLabel: vlc('Share', 'Поделиться'),
                        dialogTitle: vlc('Share content', 'Поделиться контентом'),
                        targetLabel: vlc('Workspace member', 'Участник рабочего пространства')
                    },
                    ...(libraryView === 'all'
                        ? [
                              {
                                  id: 'learning-content-move-project',
                                  kind: 'field.updateWithTarget',
                                  fieldCodename: 'ProjectId',
                                  targetObjectCollectionCodename: 'ContentProjects',
                                  labelFields: ['Name', 'Title'],
                                  icon: 'move',
                                  label: vlc('Move to project', 'Переместить в проект'),
                                  dialogTitle: vlc('Move to project', 'Переместить в проект'),
                                  targetLabel: vlc('Project', 'Проект')
                              }
                          ]
                        : [])
                ],
                ...(libraryView === 'all'
                    ? {
                          createTargets: [
                              {
                                  id: 'learning-content-create-project',
                                  label: vlc('Project', 'Проект'),
                                  sectionCodename: 'ContentProjects',
                                  icon: 'folder'
                              },
                              {
                                  id: 'learning-content-create-page',
                                  label: vlc('Page', 'Страница'),
                                  sectionCodename: 'LearningResources',
                                  icon: 'article',
                                  createDefaults: [
                                      { fieldCodename: 'ResourceType', enumCodename: 'Page' },
                                      { fieldCodename: 'Source', resourceSourceType: 'page' }
                                  ]
                              },
                              {
                                  id: 'learning-content-create-link',
                                  label: vlc('Link', 'Ссылка'),
                                  sectionCodename: 'LearningResources',
                                  icon: 'link',
                                  createDefaults: [
                                      { fieldCodename: 'ResourceType', enumCodename: 'Url' },
                                      { fieldCodename: 'Source', resourceSourceType: 'url' }
                                  ]
                              },
                              {
                                  id: 'learning-content-create-course',
                                  label: vlc('Course', 'Курс'),
                                  sectionCodename: 'Courses',
                                  icon: 'school',
                                  createDefaults: [
                                      {
                                          fieldCodename: 'NavigationMode',
                                          contextPath: 'learningContent.courseCompletionPolicy.navigationMode'
                                      },
                                      {
                                          fieldCodename: 'CompletionCondition',
                                          contextPath: 'learningContent.courseCompletionPolicy.completionCondition'
                                      },
                                      {
                                          fieldCodename: 'StatusFormat',
                                          contextPath: 'learningContent.courseCompletionPolicy.statusFormat'
                                      }
                                  ]
                              },
                              {
                                  id: 'learning-content-create-track',
                                  label: vlc('Learning Track', 'Учебный трек'),
                                  sectionCodename: 'LearningTracks',
                                  icon: 'route',
                                  createDefaults: [
                                      {
                                          fieldCodename: 'OrderMode',
                                          contextPath: 'learningContent.trackOrderPolicy.orderMode'
                                      }
                                  ]
                              },
                              {
                                  id: 'learning-content-create-quiz-lite',
                                  label: vlc('Quiz (planned)', 'Тест (планируется)'),
                                  sectionCodename: 'Quizzes',
                                  icon: 'quiz',
                                  disabled: true,
                                  disabledReason: vlc(
                                      'Quiz authoring is planned for a later Learning Content phase.',
                                      'Создание тестов запланировано на следующий этап учебного контента.'
                                  )
                              },
                              {
                                  id: 'learning-content-create-assignment-lite',
                                  label: vlc('Assignment (planned)', 'Задание (планируется)'),
                                  sectionCodename: 'Assignments',
                                  icon: 'assignment',
                                  disabled: true,
                                  disabledReason: vlc(
                                      'Assignment authoring is planned for a later Learning Content phase.',
                                      'Создание заданий запланировано на следующий этап учебного контента.'
                                  )
                              },
                              {
                                  id: 'learning-content-create-package',
                                  label: vlc('Import package (planned)', 'Импорт пакета (планируется)'),
                                  sectionCodename: 'LearningResources',
                                  icon: 'upload',
                                  disabled: true,
                                  disabledReason: vlc(
                                      'File import support is planned for a later phase.',
                                      'Импорт файлов запланирован на следующий этап.'
                                  )
                              }
                          ]
                      }
                    : {})
            }
        }
    ]
}

function buildLmsTrashSeedZoneWidgets(): TemplateSeedZoneWidget[] {
    return [
        {
            zone: 'center' as const,
            widgetKey: 'detailsTable',
            sortOrder: 9,
            config: {
                datasource: {
                    kind: 'records.union',
                    projectedFields: ['Instructor'],
                    targets: [
                        {
                            sectionCodename: 'LearningResources',
                            displayType: 'resource',
                            titleField: 'Title',
                            statusField: 'PublicationStatus',
                            projectField: 'ProjectId'
                        },
                        {
                            sectionCodename: 'Courses',
                            displayType: 'course',
                            titleField: 'Title',
                            statusField: 'Status',
                            projectField: 'ProjectId'
                        },
                        {
                            sectionCodename: 'LearningTracks',
                            displayType: 'track',
                            titleField: 'Title',
                            statusField: 'Status',
                            projectField: 'ProjectId'
                        }
                    ],
                    query: {
                        lifecycleState: 'deleted',
                        sort: [{ field: 'Title', direction: 'asc' }]
                    }
                },
                showSearch: true,
                targetFilters: [
                    {
                        id: 'learning-content-trash-filter-resources',
                        label: vlc('Resources', 'Ресурсы'),
                        targetDisplayTypes: ['resource']
                    },
                    {
                        id: 'learning-content-trash-filter-courses',
                        label: vlc('Courses', 'Курсы'),
                        targetDisplayTypes: ['course']
                    },
                    {
                        id: 'learning-content-trash-filter-tracks',
                        label: vlc('Learning Tracks', 'Учебные треки'),
                        targetDisplayTypes: ['track']
                    }
                ],
                restoreTarget: {
                    targetObjectCollectionCodename: 'ContentProjects',
                    parentFieldCodename: 'ProjectId',
                    labelFields: ['Name', 'Title'],
                    dialogTitle: vlc('Restore to project', 'Восстановить в проект'),
                    targetLabel: vlc('Project', 'Проект')
                }
            }
        }
    ]
}

function buildLmsReportsSeedZoneWidgets(): TemplateSeedZoneWidget[] {
    return [
        {
            zone: 'center' as const,
            widgetKey: 'detailsTable',
            sortOrder: 13,
            config: {
                reportCodename: 'LearningContentSummary'
            }
        }
    ]
}

function buildLmsCourseBuilderSeedZoneWidgets(): TemplateSeedZoneWidget[] {
    return [
        {
            zone: 'center' as const,
            widgetKey: 'overviewCards',
            sortOrder: 4,
            config: {
                cards: [
                    {
                        title: vlc('Sections', 'Разделы'),
                        value: '0',
                        interval: vlc('Course outline groups', 'Группы структуры курса'),
                        trend: 'neutral',
                        datasource: {
                            kind: 'metric',
                            metricKey: 'records.count',
                            params: { sectionCodename: 'CourseSections' }
                        }
                    },
                    {
                        title: vlc('Items', 'Элементы'),
                        value: '0',
                        interval: vlc('Course content references', 'Ссылки на контент курса'),
                        trend: 'neutral',
                        datasource: {
                            kind: 'metric',
                            metricKey: 'records.count',
                            params: { sectionCodename: 'CourseItems' }
                        }
                    }
                ]
            }
        },
        {
            zone: 'center' as const,
            widgetKey: 'detailsTabs',
            sortOrder: 9,
            config: {
                tabs: [
                    {
                        id: 'outline',
                        label: vlc('Outline', 'Структура'),
                        widgets: [
                            {
                                widgetKey: 'relationBuilder',
                                config: {
                                    parentDatasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'Courses',
                                        query: { sort: [{ field: 'Title', direction: 'asc' }] }
                                    },
                                    parentLabel: vlc('Course', 'Курс'),
                                    parentTitleFieldCodename: 'Title',
                                    emptyParentMessage: vlc(
                                        'Create a course before adding sections and content items.',
                                        'Создайте курс перед добавлением разделов и элементов контента.'
                                    ),
                                    panels: [
                                        {
                                            id: 'course-sections',
                                            width: 5,
                                            title: vlc('Sections', 'Разделы'),
                                            datasource: {
                                                kind: 'records.list',
                                                sectionCodename: 'CourseSections',
                                                query: { sort: [{ field: 'SortOrder', direction: 'asc' }] }
                                            },
                                            parentFieldCodename: 'CourseId',
                                            sortOrderFieldCodename: 'SortOrder',
                                            enableRowReordering: true
                                        },
                                        {
                                            id: 'course-items',
                                            width: 7,
                                            title: vlc('Items', 'Элементы'),
                                            datasource: {
                                                kind: 'records.list',
                                                sectionCodename: 'CourseItems',
                                                query: { sort: [{ field: 'SortOrder', direction: 'asc' }] }
                                            },
                                            parentFieldCodename: 'CourseId',
                                            sortOrderFieldCodename: 'SortOrder',
                                            enableRowReordering: true,
                                            rowCountWarning: {
                                                threshold: 100,
                                                message: vlc(
                                                    'Large course outline: review navigation, search, and completion policies before publishing.',
                                                    'Большая структура курса: перед публикацией проверьте навигацию, поиск и политики завершения.'
                                                )
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    {
                        id: 'general',
                        label: vlc('General', 'Общее'),
                        widgets: [
                            {
                                widgetKey: 'detailsTable',
                                config: { showViewToggle: true }
                            }
                        ]
                    },
                    {
                        id: 'completion',
                        label: vlc('Completion', 'Завершение'),
                        widgets: [
                            {
                                widgetKey: 'detailsTable',
                                config: {
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'CourseItems',
                                        query: { sort: [{ field: 'SortOrder', direction: 'asc' }] }
                                    },
                                    sequencePolicy: {
                                        mode: 'sequential',
                                        scopeFieldCodename: 'CourseId',
                                        orderFieldCodename: 'SortOrder'
                                    }
                                }
                            }
                        ]
                    },
                    {
                        id: 'player',
                        label: vlc('Player', 'Проигрыватель'),
                        widgets: [
                            {
                                widgetKey: 'learnerPlayer',
                                config: {
                                    parentDatasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'Courses',
                                        query: { sort: [{ field: 'Title', direction: 'asc' }] }
                                    },
                                    itemsDatasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'CourseItems',
                                        query: { sort: [{ field: 'SortOrder', direction: 'asc' }] }
                                    },
                                    parentLabel: vlc('Course', 'Курс'),
                                    parentFieldCodename: 'CourseId',
                                    itemTitleFieldCodename: 'Title',
                                    targetObjectCodenameField: 'TargetObjectCodename',
                                    targetRecordIdField: 'TargetRecordId',
                                    completionTargetObjectCodename: 'CourseItems',
                                    sequencePolicy: {
                                        mode: 'sequential',
                                        scopeFieldCodename: 'CourseId',
                                        orderFieldCodename: 'SortOrder'
                                    },
                                    targetContent: {
                                        titleFieldCodename: 'Title',
                                        descriptionFieldCodename: 'Description',
                                        sourceFieldCodename: 'Source',
                                        bodyFieldCodename: 'Body'
                                    }
                                }
                            }
                        ]
                    },
                    {
                        id: 'enrollments',
                        label: vlc('Enrollments', 'Назначения'),
                        widgets: [
                            {
                                widgetKey: 'relationBuilder',
                                config: {
                                    parentDatasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'Courses',
                                        query: { sort: [{ field: 'Title', direction: 'asc' }] }
                                    },
                                    parentLabel: vlc('Course', 'Курс'),
                                    parentTitleFieldCodename: 'Title',
                                    emptyParentMessage: vlc(
                                        'Create a course before enrolling learners.',
                                        'Создайте курс перед назначением учащихся.'
                                    ),
                                    panels: [
                                        {
                                            id: 'course-enrollments',
                                            title: vlc('Course enrollments', 'Назначения курса'),
                                            datasource: {
                                                kind: 'records.list',
                                                sectionCodename: 'Enrollments',
                                                query: {
                                                    sort: [{ field: 'DueDate', direction: 'asc' }],
                                                    filters: [{ field: 'TargetType', operator: 'equals', value: 'course' }]
                                                }
                                            },
                                            parentFieldCodename: 'TargetId',
                                            createDefaults: { TargetType: 'course', DueDateMode: 'ByDate' },
                                            createWizard: {
                                                steps: [
                                                    {
                                                        id: 'content',
                                                        label: vlc('Content', 'Контент'),
                                                        helperText: vlc(
                                                            'The selected course is used as the enrollment target.',
                                                            'Выбранный курс используется как цель назначения.'
                                                        ),
                                                        fieldCodenames: ['TargetTitle']
                                                    },
                                                    {
                                                        id: 'learners',
                                                        label: vlc('Learners', 'Учащиеся'),
                                                        helperText: vlc(
                                                            'Select the learner and class context for this enrollment.',
                                                            'Выберите учащегося и класс для этого назначения.'
                                                        ),
                                                        fieldCodenames: ['EnrollmentStudentId', 'EnrollmentClassId']
                                                    },
                                                    {
                                                        id: 'parameters',
                                                        label: vlc('Parameters', 'Параметры'),
                                                        helperText: vlc(
                                                            'Set the start, due-date mode, due date or period, and access restriction.',
                                                            'Задайте дату начала, режим срока, дату или период срока и ограничение доступа.'
                                                        ),
                                                        fieldCodenames: [
                                                            'EnrolledAt',
                                                            'DueDateMode',
                                                            'DueDate',
                                                            'DuePeriodDays',
                                                            'RestrictAfterDueDate',
                                                            'EnrollmentStatus'
                                                        ]
                                                    }
                                                ]
                                            },
                                            rowCountWarning: {
                                                threshold: 1,
                                                message: vlc(
                                                    'This course already has enrollments. Review learner impact before changing the outline.',
                                                    'У этого курса уже есть назначения. Перед изменением структуры проверьте влияние на учащихся.'
                                                )
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                widgetKey: 'detailsTable',
                                config: {
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'Enrollments',
                                        query: {
                                            sort: [{ field: 'DueDate', direction: 'asc' }],
                                            filters: [{ field: 'TargetType', operator: 'equals', value: 'course' }]
                                        }
                                    },
                                    showViewToggle: true
                                }
                            }
                        ]
                    },
                    {
                        id: 'reports',
                        label: vlc('Reports', 'Отчёты'),
                        widgets: [
                            {
                                widgetKey: 'detailsTable',
                                config: {
                                    reportCodename: 'CourseBuilderOutline'
                                }
                            }
                        ]
                    }
                ]
            }
        }
    ]
}

function buildLmsOrderingSeedZoneWidgets(sectionCodename: string): TemplateSeedZoneWidget[] {
    return [
        {
            zone: 'center' as const,
            widgetKey: 'columnsContainer',
            sortOrder: 9,
            config: {
                columns: [
                    {
                        id: `${sectionCodename}-ordering-column`,
                        width: 12,
                        widgets: [
                            {
                                widgetKey: 'detailsTable',
                                config: {
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename,
                                        query: { sort: [{ field: 'SortOrder', direction: 'asc' }] }
                                    },
                                    enableRowReordering: true,
                                    showViewToggle: false
                                }
                            }
                        ]
                    }
                ]
            }
        }
    ]
}

const lmsNavigationLayoutConfig = {
    showSideMenu: true,
    showAppNavbar: true,
    showHeader: true
}

const orderingLayoutConfig = {
    ...lmsNavigationLayoutConfig,
    showOverviewTitle: false,
    showOverviewCards: false,
    showSessionsChart: false,
    showPageViewsChart: false,
    showDetailsTitle: false,
    showDetailsTable: false,
    showColumnsContainer: true,
    objectBehavior: {
        useLayoutOverrides: true,
        enableRowReordering: true,
        reorderPersistenceField: 'SortOrder'
    }
}

function buildLmsTrackBuilderSeedZoneWidgets(): TemplateSeedZoneWidget[] {
    return [
        {
            zone: 'center' as const,
            widgetKey: 'overviewCards',
            sortOrder: 4,
            config: {
                cards: [
                    {
                        title: vlc('Stages', 'Этапы'),
                        value: '0',
                        interval: vlc('Track outline groups', 'Группы структуры трека'),
                        trend: 'neutral',
                        datasource: {
                            kind: 'metric',
                            metricKey: 'records.count',
                            params: { sectionCodename: 'TrackStages' }
                        }
                    },
                    {
                        title: vlc('Steps', 'Шаги'),
                        value: '0',
                        interval: vlc('Course steps in tracks', 'Шаги курсов в треках'),
                        trend: 'neutral',
                        datasource: {
                            kind: 'metric',
                            metricKey: 'records.count',
                            params: { sectionCodename: 'TrackSteps' }
                        }
                    }
                ]
            }
        },
        {
            zone: 'center' as const,
            widgetKey: 'detailsTabs',
            sortOrder: 9,
            config: {
                tabs: [
                    {
                        id: 'outline',
                        label: vlc('Outline', 'Структура'),
                        widgets: [
                            {
                                widgetKey: 'relationBuilder',
                                config: {
                                    parentDatasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'LearningTracks',
                                        query: { sort: [{ field: 'Title', direction: 'asc' }] }
                                    },
                                    parentLabel: vlc('Learning Track', 'Учебный трек'),
                                    parentTitleFieldCodename: 'Title',
                                    emptyParentMessage: vlc(
                                        'Create a learning track before adding stages and course steps.',
                                        'Создайте учебный трек перед добавлением этапов и шагов курсов.'
                                    ),
                                    panels: [
                                        {
                                            id: 'track-stages',
                                            width: 5,
                                            title: vlc('Stages', 'Этапы'),
                                            datasource: {
                                                kind: 'records.list',
                                                sectionCodename: 'TrackStages',
                                                query: { sort: [{ field: 'SortOrder', direction: 'asc' }] }
                                            },
                                            parentFieldCodename: 'TrackId',
                                            sortOrderFieldCodename: 'SortOrder',
                                            enableRowReordering: true
                                        },
                                        {
                                            id: 'track-steps',
                                            width: 7,
                                            title: vlc('Steps', 'Шаги'),
                                            datasource: {
                                                kind: 'records.list',
                                                sectionCodename: 'TrackSteps',
                                                query: { sort: [{ field: 'SortOrder', direction: 'asc' }] }
                                            },
                                            parentFieldCodename: 'TrackId',
                                            sortOrderFieldCodename: 'SortOrder',
                                            enableRowReordering: true
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    {
                        id: 'general',
                        label: vlc('General', 'Общее'),
                        widgets: [
                            {
                                widgetKey: 'detailsTable',
                                config: { showViewToggle: true }
                            }
                        ]
                    },
                    {
                        id: 'completion',
                        label: vlc('Completion', 'Завершение'),
                        widgets: [
                            {
                                widgetKey: 'detailsTable',
                                config: {
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'TrackSteps',
                                        query: { sort: [{ field: 'SortOrder', direction: 'asc' }] }
                                    },
                                    sequencePolicy: {
                                        mode: 'sequential',
                                        scopeFieldCodename: 'TrackId',
                                        orderFieldCodename: 'SortOrder'
                                    }
                                }
                            }
                        ]
                    },
                    {
                        id: 'player',
                        label: vlc('Player', 'Проигрыватель'),
                        widgets: [
                            {
                                widgetKey: 'learnerPlayer',
                                config: {
                                    parentDatasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'LearningTracks',
                                        query: { sort: [{ field: 'Title', direction: 'asc' }] }
                                    },
                                    itemsDatasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'TrackSteps',
                                        query: { sort: [{ field: 'SortOrder', direction: 'asc' }] }
                                    },
                                    parentLabel: vlc('Learning Track', 'Учебный трек'),
                                    parentFieldCodename: 'TrackId',
                                    itemTitleFieldCodename: 'Title',
                                    targetObjectCodename: 'Courses',
                                    targetRecordIdField: 'CourseId',
                                    completionTargetObjectCodename: 'TrackSteps',
                                    sequencePolicy: {
                                        mode: 'sequential',
                                        scopeFieldCodename: 'TrackId',
                                        orderFieldCodename: 'SortOrder'
                                    },
                                    targetContent: {
                                        titleFieldCodename: 'Title',
                                        descriptionFieldCodename: 'Description'
                                    }
                                }
                            }
                        ]
                    },
                    {
                        id: 'enrollments',
                        label: vlc('Enrollments', 'Назначения'),
                        widgets: [
                            {
                                widgetKey: 'relationBuilder',
                                config: {
                                    parentDatasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'LearningTracks',
                                        query: { sort: [{ field: 'Title', direction: 'asc' }] }
                                    },
                                    parentLabel: vlc('Learning Track', 'Учебный трек'),
                                    parentTitleFieldCodename: 'Title',
                                    emptyParentMessage: vlc(
                                        'Create a learning track before enrolling learners.',
                                        'Создайте учебный трек перед назначением учащихся.'
                                    ),
                                    panels: [
                                        {
                                            id: 'track-enrollments',
                                            title: vlc('Track enrollments', 'Назначения трека'),
                                            datasource: {
                                                kind: 'records.list',
                                                sectionCodename: 'Enrollments',
                                                query: {
                                                    sort: [{ field: 'DueDate', direction: 'asc' }],
                                                    filters: [{ field: 'TargetType', operator: 'equals', value: 'track' }]
                                                }
                                            },
                                            parentFieldCodename: 'TargetId',
                                            createDefaults: { TargetType: 'track', DueDateMode: 'ByDate' },
                                            createWizard: {
                                                steps: [
                                                    {
                                                        id: 'content',
                                                        label: vlc('Content', 'Контент'),
                                                        helperText: vlc(
                                                            'The selected learning track is used as the enrollment target.',
                                                            'Выбранный учебный трек используется как цель назначения.'
                                                        ),
                                                        fieldCodenames: ['TargetTitle']
                                                    },
                                                    {
                                                        id: 'learners',
                                                        label: vlc('Learners', 'Учащиеся'),
                                                        helperText: vlc(
                                                            'Select the learner and class context for this enrollment.',
                                                            'Выберите учащегося и класс для этого назначения.'
                                                        ),
                                                        fieldCodenames: ['EnrollmentStudentId', 'EnrollmentClassId']
                                                    },
                                                    {
                                                        id: 'parameters',
                                                        label: vlc('Parameters', 'Параметры'),
                                                        helperText: vlc(
                                                            'Set the start, due-date mode, due date or period, and access restriction.',
                                                            'Задайте дату начала, режим срока, дату или период срока и ограничение доступа.'
                                                        ),
                                                        fieldCodenames: [
                                                            'EnrolledAt',
                                                            'DueDateMode',
                                                            'DueDate',
                                                            'DuePeriodDays',
                                                            'RestrictAfterDueDate',
                                                            'EnrollmentStatus'
                                                        ]
                                                    }
                                                ]
                                            },
                                            rowCountWarning: {
                                                threshold: 1,
                                                message: vlc(
                                                    'This track already has enrollments. Review learner impact before changing stages or steps.',
                                                    'У этого трека уже есть назначения. Перед изменением этапов или шагов проверьте влияние на учащихся.'
                                                )
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                widgetKey: 'detailsTable',
                                config: {
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'Enrollments',
                                        query: {
                                            sort: [{ field: 'DueDate', direction: 'asc' }],
                                            filters: [{ field: 'TargetType', operator: 'equals', value: 'track' }]
                                        }
                                    },
                                    showViewToggle: true
                                }
                            }
                        ]
                    },
                    {
                        id: 'reports',
                        label: vlc('Reports', 'Отчёты'),
                        widgets: [
                            {
                                widgetKey: 'detailsTable',
                                config: {
                                    reportCodename: 'TrackBuilderOutline'
                                }
                            }
                        ]
                    }
                ]
            }
        }
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

const buildEditorBlockContent = (blocks: Array<Record<string, unknown>>) => ({
    format: 'editorjs',
    version: '2.29.0',
    blocks
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
        blockContent: buildEditorBlockContent(blocks),
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
    kind: 'object',
    name: vlc(nameEn, nameRu),
    description: vlc(descriptionEn, descriptionRu),
    hubs: ['Learning'],
    config: {
        ledger: {
            mode: 'balance',
            mutationPolicy: 'appendOnly',
            periodicity: 'instant',
            sourcePolicy: 'registrar',
            registrarKinds: ['object'],
            fieldRoles: [
                { fieldCodename: 'Learner', role: 'dimension', required: true },
                { fieldCodename: 'Subject', role: 'dimension', required: true },
                { fieldCodename: resourceCodename, role: 'resource', aggregate, required: true },
                { fieldCodename: 'Status', role: 'component' },
                { fieldCodename: 'OccurredAt', role: 'component' },
                { fieldCodename: 'SourceObjectId', role: 'component' },
                { fieldCodename: 'SourceRowId', role: 'component' },
                { fieldCodename: 'SourceLineId', role: 'component' }
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
    components: [
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

const buildTransactionalObjectConfig = ({
    prefix,
    effectiveDateField,
    stateField,
    states = [],
    targetLedgers = [],
    workflowActions = []
}: {
    prefix: string
    effectiveDateField: string
    stateField?: string
    states?: Array<{ codename: string; title: string; isInitial?: boolean; isFinal?: boolean }>
    targetLedgers?: string[]
    workflowActions?: WorkflowAction[]
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
    },
    ...(workflowActions.length > 0 ? { workflowActions } : {})
})

const LMS_ENROLLMENT_POSTING_MODULE_SOURCE = `import { ExtensionModule, OnEvent } from '@universo-react/extension-sdk'

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

export default class EnrollmentPostingModule extends ExtensionModule {
    @OnEvent('beforePost')
    async buildProgressMovement(payload) {
        const row = payload?.previousRow ?? {}
        const rowId = typeof row.id === 'string' ? row.id : 'unknown'
        const entityCodename = typeof payload?.entityCodename === 'string' ? payload.entityCodename : 'Enrollments'
        const learner = readRecordValue(row, 'EnrollmentStudentId', 'enrollment_student_id')
        const learningItem =
            readRecordValue(row, 'TargetId', 'target_id') ?? readRecordValue(row, 'ContentNodeIdRef', 'content_node_id_ref')
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

const LMS_QUIZ_ATTEMPT_POSTING_MODULE_SOURCE = `import { ExtensionModule, OnEvent } from '@universo-react/extension-sdk'

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

export default class QuizAttemptPostingModule extends ExtensionModule {
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

const LMS_CONTENT_COMPLETION_POSTING_MODULE_SOURCE = `import { ExtensionModule, OnEvent } from '@universo-react/extension-sdk'

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

export default class ContentCompletionPostingModule extends ExtensionModule {
    @OnEvent('beforePost')
    async buildContentProgressMovement(payload) {
        const row = payload?.previousRow ?? {}
        const rowId = typeof row.id === 'string' ? row.id : 'unknown'
        const learner = readRecordValue(row, 'ProgressStudentId', 'progress_student_id') ?? rowId
        const contentNodeId = readRecordValue(row, 'ContentNodeId', 'content_node_id') ?? 'content'
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
                                LearningItem: String(contentNodeId),
                                ProgressDelta: toNumber(readRecordValue(row, 'ProgressPercent', 'progress_percent'), 0),
                                Status: String(readRecordValue(row, 'ProgressStatus', 'progress_status') ?? 'posted'),
                                OccurredAt: occurredAt,
                                SourceObjectId: 'ContentProgress',
                                SourceRowId: rowId,
                                SourceLineId: 'content-progress'
                            }
                        }
                    ]
                }
            ]
        }
    }
}
`

const LMS_CERTIFICATE_ISSUE_POSTING_MODULE_SOURCE = `import { ExtensionModule, OnEvent } from '@universo-react/extension-sdk'

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

export default class CertificateIssuePostingModule extends ExtensionModule {
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

const LMS_POINT_TRANSACTION_POSTING_MODULE_SOURCE = `import { ExtensionModule, OnEvent } from '@universo-react/extension-sdk'

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

export default class PointTransactionPostingModule extends ExtensionModule {
    @OnEvent('beforePost')
    async buildPointMovements(payload) {
        const row = payload?.previousRow ?? {}
        const rowId = typeof row.id === 'string' ? row.id : 'unknown'
        const learner = readRecordValue(row, 'StudentId', 'student_id')
        const source = readRecordValue(row, 'SourceType', 'source_type') ?? 'Manual'
        const sourceObjectId = readRecordValue(row, 'SourceObjectId', 'source_object_id') ?? 'PointTransactions'
        const occurredAt = readRecordValue(row, 'AwardedAt', 'awarded_at') ?? new Date().toISOString()
        const pointsDelta = toNumber(readRecordValue(row, 'PointsDelta', 'points_delta'), 0)
        const status = readRecordValue(row, 'Status', 'status') ?? 'Approved'

        return {
            movements: [
                {
                    ledgerCodename: 'PointsLedger',
                    facts: [
                        {
                            data: {
                                Learner: String(learner ?? 'unknown'),
                                Subject: String(source),
                                PointsDelta: status === 'Reversed' ? -pointsDelta : pointsDelta,
                                Status: String(status),
                                OccurredAt: String(occurredAt),
                                SourceObjectId: String(sourceObjectId),
                                SourceRowId: rowId,
                                SourceLineId: 'points'
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
        'Learning Management System template with classes, learning content, quizzes, and student tracking.',
        'Шаблон системы управления обучением с классами, учебным контентом, тестами и отслеживанием студентов.'
    ),
    meta: {
        author: 'universo-platformo',
        tags: ['lms', 'education', 'quiz'],
        icon: 'School'
    },
    presets: [
        { presetCodename: 'hub', includedByDefault: true },
        { presetCodename: 'page', includedByDefault: false },
        { presetCodename: 'object', includedByDefault: true },
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
        scopedLayouts: [
            {
                codename: 'learnerHome',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'LearnerHome',
                scopeEntityKind: 'page',
                name: vlc('Learner Home', 'Главная учащегося'),
                description: vlc(
                    'Home page layout with LMS overview cards and learning activity charts.',
                    'Макет главной страницы с обзорными карточками LMS и графиками учебной активности.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 0,
                config: lmsNavigationLayoutConfig
            },
            {
                codename: 'learningContent',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'ContentProjects',
                scopeEntityKind: 'object',
                name: vlc('Learning Content Library', 'Библиотека учебного контента'),
                description: vlc(
                    'Workspace Learning Content layout with project metrics and a unified active content table.',
                    'Макет учебного контента рабочего пространства с метриками проектов и единой таблицей активного контента.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 1,
                config: lmsNavigationLayoutConfig
            },
            {
                codename: 'learningContentRecent',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'RecentContentViews',
                scopeEntityKind: 'object',
                name: vlc('Recent Learning Content', 'Недавний учебный контент'),
                description: vlc(
                    'Recent Learning Content records resolved through metadata-defined view facts.',
                    'Недавние записи учебного контента, собранные через метаданные фактов просмотра.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 2,
                config: lmsNavigationLayoutConfig
            },
            {
                codename: 'learningContentStarred',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'ContentStars',
                scopeEntityKind: 'object',
                name: vlc('Starred Learning Content', 'Избранный учебный контент'),
                description: vlc(
                    'Starred Learning Content records resolved through metadata-defined star facts.',
                    'Избранные записи учебного контента, собранные через метаданные фактов избранного.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 3,
                config: lmsNavigationLayoutConfig
            },
            {
                codename: 'learningContentShared',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'ContentAccessEntries',
                scopeEntityKind: 'object',
                name: vlc('Shared Learning Content', 'Доступный учебный контент'),
                description: vlc(
                    'Learning Content records shared with the current workspace member.',
                    'Записи учебного контента, доступные текущему участнику рабочего пространства.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 4,
                config: lmsNavigationLayoutConfig
            },
            {
                codename: 'learningContentTrash',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'TrashEntries',
                scopeEntityKind: 'object',
                name: vlc('Learning Content Trash', 'Корзина учебного контента'),
                description: vlc(
                    'Trash layout backed by deleted Learning Content runtime rows.',
                    'Макет корзины на основе удаленных runtime-записей учебного контента.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 5,
                config: lmsNavigationLayoutConfig
            },
            {
                codename: 'courseBuilder',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'Courses',
                scopeEntityKind: 'object',
                name: vlc('Course Builder', 'Конструктор курса'),
                description: vlc(
                    'Course layout with sections and ordered CourseItems rendered through generic runtime tables.',
                    'Макет курса с разделами и упорядоченными CourseItems через универсальные runtime-таблицы.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 3,
                config: lmsNavigationLayoutConfig
            },
            {
                codename: 'courseSectionsOrdering',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'CourseSections',
                scopeEntityKind: 'object',
                name: vlc('Course Section Ordering', 'Упорядочивание разделов курса'),
                description: vlc(
                    'Generic runtime ordering layout for course sections.',
                    'Универсальный runtime-макет упорядочивания разделов курса.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 4,
                config: orderingLayoutConfig
            },
            {
                codename: 'courseItemsOrdering',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'CourseItems',
                scopeEntityKind: 'object',
                name: vlc('Course Item Ordering', 'Упорядочивание элементов курса'),
                description: vlc(
                    'Generic runtime ordering layout for course content references.',
                    'Универсальный runtime-макет упорядочивания ссылок на контент курса.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 5,
                config: orderingLayoutConfig
            },
            {
                codename: 'trackBuilder',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'LearningTracks',
                scopeEntityKind: 'object',
                name: vlc('Learning Track Builder', 'Конструктор учебного трека'),
                description: vlc(
                    'Learning Track layout with stages and course steps rendered through generic runtime tables.',
                    'Макет учебного трека с этапами и шагами курсов через универсальные runtime-таблицы.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 6,
                config: lmsNavigationLayoutConfig
            },
            {
                codename: 'trackStagesOrdering',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'TrackStages',
                scopeEntityKind: 'object',
                name: vlc('Track Stage Ordering', 'Упорядочивание этапов трека'),
                description: vlc(
                    'Generic runtime ordering layout for learning track stages.',
                    'Универсальный runtime-макет упорядочивания этапов учебного трека.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 7,
                config: orderingLayoutConfig
            },
            {
                codename: 'trackStepsOrdering',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'TrackSteps',
                scopeEntityKind: 'object',
                name: vlc('Track Step Ordering', 'Упорядочивание шагов трека'),
                description: vlc(
                    'Generic runtime ordering layout for learning track course steps.',
                    'Универсальный runtime-макет упорядочивания шагов курсов в учебном треке.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 8,
                config: orderingLayoutConfig
            },
            {
                codename: 'reportsDashboard',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'Reports',
                scopeEntityKind: 'object',
                name: vlc('Reports Dashboard', 'Панель отчётов'),
                description: vlc(
                    'Reports layout with saved report definitions and the primary Learning Content summary report surface.',
                    'Макет отчётов со списком сохраненных определений и основным отчётом по учебному контенту.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 9,
                config: lmsNavigationLayoutConfig
            }
        ],
        layoutZoneWidgets: {
            main: buildLmsBaseSeedZoneWidgets(),
            learnerHome: buildLmsHomeSeedZoneWidgets(),
            learningContent: buildLmsLearningContentSeedZoneWidgets(),
            learningContentRecent: buildLmsLearningContentSeedZoneWidgets('recent'),
            learningContentStarred: buildLmsLearningContentSeedZoneWidgets('starred'),
            learningContentShared: buildLmsLearningContentSeedZoneWidgets('shared'),
            learningContentTrash: buildLmsTrashSeedZoneWidgets(),
            courseBuilder: buildLmsCourseBuilderSeedZoneWidgets(),
            courseSectionsOrdering: buildLmsOrderingSeedZoneWidgets('CourseSections'),
            courseItemsOrdering: buildLmsOrderingSeedZoneWidgets('CourseItems'),
            trackBuilder: buildLmsTrackBuilderSeedZoneWidgets(),
            trackStagesOrdering: buildLmsOrderingSeedZoneWidgets('TrackStages'),
            trackStepsOrdering: buildLmsOrderingSeedZoneWidgets('TrackSteps'),
            reportsDashboard: buildLmsReportsSeedZoneWidgets()
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
                    },
                    {
                        codename: 'GamificationEnabled',
                        dataType: 'BOOLEAN',
                        name: vlc('Gamification Enabled', 'Геймификация включена'),
                        sortOrder: 5,
                        value: true
                    },
                    {
                        codename: 'DefaultPointAward',
                        dataType: 'NUMBER',
                        name: vlc('Default Point Award', 'Баллы по умолчанию'),
                        sortOrder: 6,
                        value: 10
                    }
                ]
            },
            {
                codename: 'LearningContentDefaults',
                kind: 'set',
                name: vlc('Learning Content Defaults', 'Настройки учебного контента'),
                description: vlc(
                    'Default workspace authoring behavior for Learning Content projects, resources, courses, and tracks.',
                    'Поведение по умолчанию для проектов, ресурсов, курсов и треков учебного контента в рабочем пространстве.'
                ),
                fixedValues: [
                    {
                        codename: 'DefaultContentView',
                        dataType: 'STRING',
                        name: vlc('Default Content View', 'Представление по умолчанию'),
                        sortOrder: 1,
                        value: 'table'
                    },
                    {
                        codename: 'DefaultPublicationStatus',
                        dataType: 'STRING',
                        name: vlc('Default Publication Status', 'Статус публикации по умолчанию'),
                        sortOrder: 2,
                        value: 'Draft'
                    },
                    {
                        codename: 'AllowWorkspaceAuthorsToCreateProjects',
                        dataType: 'BOOLEAN',
                        name: vlc('Allow Workspace Authors to Create Projects', 'Разрешить авторам создавать проекты'),
                        sortOrder: 3,
                        value: true
                    }
                ]
            },
            {
                codename: 'SupportedResourceTypes',
                kind: 'set',
                name: vlc('Supported Resource Types', 'Поддерживаемые типы ресурсов'),
                description: vlc(
                    'Resource type support policy for early Learning Content authoring.',
                    'Политика поддержки типов ресурсов для раннего создания учебного контента.'
                ),
                fixedValues: [
                    {
                        codename: 'EnabledTypes',
                        dataType: 'STRING',
                        name: vlc('Enabled Types', 'Включенные типы'),
                        sortOrder: 1,
                        value: 'Page,Url,Embed'
                    },
                    {
                        codename: 'DeferredTypes',
                        dataType: 'STRING',
                        name: vlc('Deferred Types', 'Отложенные типы'),
                        sortOrder: 2,
                        value: 'Scorm,Xapi,File,Video,Audio,Document'
                    }
                ]
            },
            {
                codename: 'PlayerPresets',
                kind: 'set',
                name: vlc('Player Presets', 'Пресеты плеера'),
                description: vlc(
                    'Default learner player behavior reused by courses and learning tracks.',
                    'Поведение плеера учащегося по умолчанию, используемое курсами и учебными треками.'
                ),
                fixedValues: [
                    {
                        codename: 'DefaultCoursePlayer',
                        dataType: 'STRING',
                        name: vlc('Default Course Player', 'Плеер курса по умолчанию'),
                        sortOrder: 1,
                        value: 'showOutline=true;allowSearch=true;showProgress=true;allowManualComplete=true'
                    }
                ]
            },
            {
                codename: 'LearningContentColumnPresets',
                kind: 'set',
                name: vlc('Learning Content Column Presets', 'Пресеты колонок учебного контента'),
                description: vlc(
                    'Reusable metadata-driven column presets for Learning Content list surfaces.',
                    'Переиспользуемые metadata-driven пресеты колонок для списков учебного контента.'
                ),
                fixedValues: [
                    {
                        codename: 'DefaultLibraryColumns',
                        dataType: 'STRING',
                        name: vlc('Default Library Columns', 'Колонки библиотеки по умолчанию'),
                        sortOrder: 1,
                        value: 'type,title,status,ResourceType'
                    }
                ]
            },
            {
                codename: 'EnrollmentDefaults',
                kind: 'set',
                name: vlc('Enrollment Defaults', 'Настройки назначений'),
                description: vlc(
                    'Default manual enrollment parameters for courses and tracks.',
                    'Параметры ручных назначений по умолчанию для курсов и треков.'
                ),
                fixedValues: [
                    {
                        codename: 'DefaultDueDateMode',
                        dataType: 'STRING',
                        name: vlc('Default Due Date Mode', 'Режим срока по умолчанию'),
                        sortOrder: 1,
                        value: 'NoDueDate'
                    },
                    {
                        codename: 'RestrictAfterDueDate',
                        dataType: 'BOOLEAN',
                        name: vlc('Restrict After Due Date', 'Ограничить после срока'),
                        sortOrder: 2,
                        value: false
                    }
                ]
            },
            {
                codename: 'CompletionDefaults',
                kind: 'set',
                name: vlc('Completion Defaults', 'Настройки завершения'),
                description: vlc(
                    'Default completion policies for courses and learning tracks.',
                    'Политики завершения по умолчанию для курсов и учебных треков.'
                ),
                fixedValues: [
                    {
                        codename: 'CourseNavigationMode',
                        dataType: 'STRING',
                        name: vlc('Course Navigation Mode', 'Режим навигации курса'),
                        sortOrder: 1,
                        value: 'free'
                    },
                    {
                        codename: 'CourseCompletionCondition',
                        dataType: 'STRING',
                        name: vlc('Course Completion Condition', 'Условие завершения курса'),
                        sortOrder: 2,
                        value: 'allItems'
                    },
                    {
                        codename: 'TrackOrderMode',
                        dataType: 'STRING',
                        name: vlc('Track Order Mode', 'Режим порядка трека'),
                        sortOrder: 3,
                        value: 'sequential'
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
                                                    'This portal brings together the learning paths, content resources, assignments, tests, and progress indicators that learners need every day. Start with your assigned content, continue from the last opened activity, and use the content library to find approved materials for independent study.',
                                                version: 1,
                                                isActive: true
                                            },
                                            ru: {
                                                content:
                                                    'Этот портал объединяет учебные траектории, учебные ресурсы, задания, тесты и показатели прогресса, которые нужны учащимся каждый день. Начните с назначенного контента, продолжите обучение с последнего открытого материала и используйте библиотеку контента для самостоятельного изучения утвержденных материалов.',
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
                                                        'Open Learning Content to review available courses, resources, and knowledge-base materials.',
                                                    version: 1,
                                                    isActive: true
                                                },
                                                ru: {
                                                    content:
                                                        'Откройте учебный контент, чтобы посмотреть доступные курсы, ресурсы и материалы базы знаний.',
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
                                                        'Complete tests and practical tasks inside learning resources so that managers can track learning outcomes.',
                                                    version: 1,
                                                    isActive: true
                                                },
                                                ru: {
                                                    content:
                                                        'Проходите тесты и практические задания в учебных ресурсах, чтобы руководители могли отслеживать результаты обучения.',
                                                    version: 1,
                                                    isActive: true
                                                }
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                id: 'welcome-workspaces-title',
                                type: 'header',
                                data: {
                                    level: 3,
                                    text: {
                                        _schema: '1',
                                        _primary: 'en',
                                        locales: {
                                            en: { content: 'Workspaces', version: 1, isActive: true },
                                            ru: { content: 'Рабочие пространства', version: 1, isActive: true }
                                        }
                                    }
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
                                                    'If you cannot find an assigned content, check the knowledge section first and then contact the learning administrator. The support address and common LMS rules are stored in the shared configuration set, so they can be updated without changing page content.',
                                                version: 1,
                                                isActive: true
                                            },
                                            ru: {
                                                content:
                                                    'Если назначенный контент не найден, сначала проверьте раздел знаний, а затем обратитесь к администратору обучения. Адрес поддержки и общие правила LMS хранятся в общем наборе настроек, поэтому их можно обновлять без изменения контента страницы.',
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
                        'Course structure should be driven by Learning Resources, Learning Tracks, Assignments, Quizzes, and transactional progress records. The page stays informational while completion state is calculated from Learning Content records and Ledgers.',
                        'Структура курса должна задаваться учебными ресурсами, учебными треками, назначениями, тестами и транзакционными записями прогресса. Страница остается информационной, а состояние прохождения рассчитывается по записям контента и регистрам.'
                    )
                ]
            }),
            buildLmsPageEntity({
                codename: 'KnowledgeHome',
                nameEn: 'Knowledge Home',
                nameRu: 'Раздел знаний',
                descriptionEn: 'Portal page for knowledge-base spaces, folders, articles, and learner bookmarks.',
                descriptionRu: 'Портальная страница для пространств знаний, папок, статей и закладок учащихся.',
                routeSegment: 'knowledge',
                blocks: [
                    buildEditorHeaderBlock('knowledge-home-title', 2, 'Knowledge base', 'База знаний'),
                    buildEditorParagraphBlock(
                        'knowledge-home-purpose',
                        'Use this page as the learner-facing entry point for approved reference materials. Knowledge spaces, folders, article bindings, and bookmarks are stored as records so they can be filtered by workspace and role policy.',
                        'Используйте эту страницу как вход учащегося в утвержденные справочные материалы. Пространства знаний, папки, привязки статей и закладки хранятся как записи, поэтому их можно фильтровать по рабочему пространству и политике ролей.'
                    ),
                    buildEditorHeaderBlock('knowledge-home-structure-title', 3, 'Structure', 'Структура'),
                    buildEditorParagraphBlock(
                        'knowledge-home-structure',
                        'KnowledgeSpaces define ownership and visibility, KnowledgeFolders organize article pages, and KnowledgeBookmarks preserve each learner’s saved references without duplicating article content.',
                        'KnowledgeSpaces задают владение и видимость, KnowledgeFolders организуют страницы статей, а KnowledgeBookmarks сохраняют личные ссылки учащегося без дублирования содержимого статей.'
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
                        'Use this page for reference material that supports learning resources, assignments, and instructor-led events. Keep facts, examples, and source links in the article, and keep operational state in content records and Ledgers.',
                        'Используйте эту страницу для справочных материалов, которые поддерживают учебные ресурсы, задания и учебные мероприятия. Факты, примеры и ссылки на источники храните в статье, а операционное состояние — в записях контента и регистрах.'
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
                codename: 'DevelopmentHome',
                nameEn: 'Development Home',
                nameRu: 'Раздел развития',
                descriptionEn: 'Portal page for development plans, stages, tasks, mentors, and monitors.',
                descriptionRu: 'Портальная страница для планов развития, этапов, задач, наставников и наблюдателей.',
                routeSegment: 'development',
                blocks: [
                    buildEditorHeaderBlock('development-home-title', 2, 'Development plans', 'Планы развития'),
                    buildEditorParagraphBlock(
                        'development-home-purpose',
                        'Use this page as the employee-facing entry point for individual development plans. Plan records define ownership and status, stages group milestones, and tasks hold actionable work with workflow status changes.',
                        'Используйте эту страницу как вход сотрудника в индивидуальные планы развития. Записи планов задают владельца и состояние, этапы группируют вехи, а задачи содержат практическую работу со сменой статусов процесса.'
                    ),
                    buildEditorHeaderBlock('development-home-operations-title', 3, 'Operations', 'Операции'),
                    buildEditorParagraphBlock(
                        'development-home-operations',
                        'Development plan progress should be calculated from DevelopmentPlans, DevelopmentPlanStages, and DevelopmentPlanTasks instead of custom LMS screens, so reports and dashboards can reuse generic runtime datasources.',
                        'Прогресс плана развития должен рассчитываться по DevelopmentPlans, DevelopmentPlanStages и DevelopmentPlanTasks вместо специальных LMS-экранов, чтобы отчеты и панели использовали универсальные runtime-источники данных.'
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
                        'Certificates should be issued only after required learning resources, assignments, and quiz attempts meet the configured completion thresholds. The policy text explains the rule; CertificateIssues and CertificateLedger store the auditable facts.',
                        'Сертификаты следует выдавать только после того, как обязательные учебные ресурсы, задания и попытки тестов достигли настроенных порогов завершения. Текст правил объясняет условие, а CertificateIssues и CertificateLedger хранят проверяемые факты.'
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
                kind: 'object',
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
                        registrarKinds: ['object'],
                        fieldRoles: [
                            { fieldCodename: 'Learner', role: 'dimension', required: true },
                            { fieldCodename: 'LearningItem', role: 'dimension', required: true },
                            { fieldCodename: 'ProgressDelta', role: 'resource', aggregate: 'sum', required: true },
                            { fieldCodename: 'Status', role: 'component' },
                            { fieldCodename: 'OccurredAt', role: 'component' },
                            { fieldCodename: 'SourceObjectId', role: 'component' },
                            { fieldCodename: 'SourceRowId', role: 'component' },
                            { fieldCodename: 'SourceLineId', role: 'component' }
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
                components: [
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
                kind: 'object',
                name: vlc('Score Ledger', 'Регистр оценок'),
                description: vlc('Append-only quiz and assignment score facts.', 'Неизменяемые факты оценок тестов и заданий.'),
                hubs: ['Learning'],
                config: {
                    ledger: {
                        mode: 'balance',
                        mutationPolicy: 'appendOnly',
                        periodicity: 'instant',
                        sourcePolicy: 'registrar',
                        registrarKinds: ['object'],
                        fieldRoles: [
                            { fieldCodename: 'Learner', role: 'dimension', required: true },
                            { fieldCodename: 'Assessment', role: 'dimension', required: true },
                            { fieldCodename: 'Score', role: 'resource', aggregate: 'latest', required: true },
                            { fieldCodename: 'Passed', role: 'component' },
                            { fieldCodename: 'OccurredAt', role: 'component' },
                            { fieldCodename: 'SourceObjectId', role: 'component' },
                            { fieldCodename: 'SourceRowId', role: 'component' },
                            { fieldCodename: 'SourceLineId', role: 'component' }
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
                components: [
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
                kind: 'object',
                name: vlc('Classes', 'Классы'),
                description: vlc('Student groups for learning management.', 'Группы студентов для управления обучением.'),
                components: [
                    {
                        codename: 'Name',
                        dataType: 'STRING',
                        name: vlc('Name', 'Название'),
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
                kind: 'object',
                name: vlc('Students', 'Студенты'),
                description: vlc('Registered and guest students.', 'Зарегистрированные и гостевые студенты.'),
                components: [
                    {
                        codename: 'DisplayName',
                        dataType: 'STRING',
                        name: vlc('Display Name', 'Отображаемое имя'),
                        isRequired: true,
                        isDisplayComponent: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 255, localized: true, versioned: true }
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
                        targetEntityKind: 'object'
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
                kind: 'object',
                name: vlc('Departments', 'Подразделения'),
                description: vlc(
                    'Organization units used for learner segmentation and reporting.',
                    'Подразделения для сегментации учащихся и отчетности.'
                ),
                components: [
                    {
                        codename: 'Name',
                        dataType: 'STRING',
                        name: vlc('Name', 'Название'),
                        isRequired: true,
                        isDisplayComponent: true,
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
                        targetEntityKind: 'object'
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
                codename: 'ContentProjects',
                kind: 'object',
                name: vlc('Content Projects', 'Проекты контента'),
                description: vlc(
                    'Workspace-scoped Learning Content projects for grouping authored resources, courses, and tracks.',
                    'Проекты учебного контента внутри рабочего пространства для группировки ресурсов, курсов и треков.'
                ),
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
                        validationRules: { localized: true, versioned: true },
                        uiConfig: { widget: 'textarea', rows: 2 }
                    },
                    {
                        codename: 'AccessMode',
                        dataType: 'STRING',
                        name: vlc('Access Mode', 'Режим доступа'),
                        sortOrder: 3,
                        validationRules: { maxLength: 32 },
                        uiConfig: {
                            widget: 'select',
                            defaultValue: 'workspace',
                            stringOptions: [
                                { value: 'workspace', label: vlc('Workspace', 'Рабочее пространство') },
                                { value: 'restricted', label: vlc('Restricted', 'Ограниченный') },
                                { value: 'private', label: vlc('Private', 'Личный') }
                            ]
                        }
                    },
                    {
                        codename: 'Cover',
                        dataType: 'JSON',
                        name: vlc('Cover', 'Обложка'),
                        sortOrder: 4,
                        uiConfig: {
                            widget: 'resourceSource',
                            gridHidden: true
                        }
                    },
                    {
                        codename: 'SortOrder',
                        dataType: 'NUMBER',
                        name: vlc('Sort Order', 'Порядок'),
                        sortOrder: 5,
                        validationRules: { min: 0 }
                    },
                    {
                        codename: 'ArchivedAt',
                        dataType: 'DATE',
                        name: vlc('Archived At', 'Дата архивации'),
                        sortOrder: 6,
                        validationRules: { dateComposition: 'datetime' },
                        uiConfig: { formHidden: true }
                    }
                ]
            },
            {
                codename: 'ContentAccessEntries',
                kind: 'object',
                name: vlc('Content Access Entries', 'Записи доступа к контенту'),
                description: vlc(
                    'Generic sharing entries for Learning Content records inside the current workspace.',
                    'Универсальные записи совместного доступа к учебному контенту внутри текущего рабочего пространства.'
                ),
                config: {
                    runtimeAccessEntry: {
                        targetObjectFieldCodename: 'TargetObjectCodename',
                        targetRecordFieldCodename: 'TargetRecordId',
                        principalTypeFieldCodename: 'PrincipalType',
                        principalIdFieldCodename: 'PrincipalId',
                        accessLevelFieldCodename: 'AccessLevel',
                        supportedPrincipalTypes: ['workspaceMember', 'user']
                    }
                },
                components: [
                    {
                        codename: 'TargetObjectCodename',
                        dataType: 'STRING',
                        name: vlc('Target Object', 'Целевой объект'),
                        isRequired: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 128 }
                    },
                    {
                        codename: 'TargetRecordId',
                        dataType: 'STRING',
                        name: vlc('Target Record', 'Целевая запись'),
                        isRequired: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 128 }
                    },
                    {
                        codename: 'PrincipalType',
                        dataType: 'STRING',
                        name: vlc('Principal Type', 'Тип субъекта'),
                        isRequired: true,
                        sortOrder: 3,
                        validationRules: { maxLength: 64 }
                    },
                    {
                        codename: 'PrincipalId',
                        dataType: 'STRING',
                        name: vlc('Principal ID', 'ID субъекта'),
                        isRequired: true,
                        sortOrder: 4,
                        validationRules: { maxLength: 128 },
                        uiConfig: { hidden: true }
                    },
                    {
                        codename: 'AccessLevel',
                        dataType: 'STRING',
                        name: vlc('Access Level', 'Уровень доступа'),
                        isRequired: true,
                        sortOrder: 5,
                        validationRules: { maxLength: 32 }
                    },
                    {
                        codename: 'InvitedBy',
                        dataType: 'STRING',
                        name: vlc('Invited By', 'Пригласил'),
                        sortOrder: 6,
                        validationRules: { maxLength: 128 }
                    },
                    {
                        codename: 'InvitedAt',
                        dataType: 'DATE',
                        name: vlc('Invited At', 'Дата приглашения'),
                        sortOrder: 7,
                        validationRules: { dateComposition: 'datetime' }
                    }
                ]
            },
            {
                codename: 'ContentStars',
                kind: 'object',
                name: vlc('Content Stars', 'Избранный контент'),
                description: vlc('User stars for Learning Content records.', 'Пользовательское избранное для учебного контента.'),
                components: [
                    {
                        codename: 'TargetObjectCodename',
                        dataType: 'STRING',
                        name: vlc('Target Object', 'Целевой объект'),
                        isRequired: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 128 }
                    },
                    {
                        codename: 'TargetRecordId',
                        dataType: 'STRING',
                        name: vlc('Target Record', 'Целевая запись'),
                        isRequired: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 128 }
                    },
                    {
                        codename: 'UserId',
                        dataType: 'STRING',
                        name: vlc('User ID', 'ID пользователя'),
                        isRequired: true,
                        sortOrder: 3,
                        validationRules: { maxLength: 128 },
                        uiConfig: { hidden: true }
                    },
                    {
                        codename: 'StarredAt',
                        dataType: 'DATE',
                        name: vlc('Starred At', 'Дата добавления'),
                        isRequired: true,
                        sortOrder: 4,
                        validationRules: { dateComposition: 'datetime' }
                    }
                ]
            },
            {
                codename: 'RecentContentViews',
                kind: 'object',
                name: vlc('Recent Content Views', 'Недавние просмотры контента'),
                description: vlc('Recent Learning Content view facts by user.', 'Недавние просмотры учебного контента по пользователям.'),
                components: [
                    {
                        codename: 'TargetObjectCodename',
                        dataType: 'STRING',
                        name: vlc('Target Object', 'Целевой объект'),
                        isRequired: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 128 }
                    },
                    {
                        codename: 'TargetRecordId',
                        dataType: 'STRING',
                        name: vlc('Target Record ID', 'ID целевой записи'),
                        isRequired: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 128 }
                    },
                    {
                        codename: 'UserId',
                        dataType: 'STRING',
                        name: vlc('User ID', 'ID пользователя'),
                        isRequired: true,
                        sortOrder: 3,
                        validationRules: { maxLength: 128 },
                        uiConfig: { hidden: true }
                    },
                    {
                        codename: 'ViewedAt',
                        dataType: 'DATE',
                        name: vlc('Viewed At', 'Дата просмотра'),
                        isRequired: true,
                        sortOrder: 4,
                        validationRules: { dateComposition: 'datetime' }
                    }
                ]
            },
            {
                codename: 'ContentProgress',
                kind: 'object',
                name: vlc('Content Progress', 'Прогресс по контенту'),
                description: vlc(
                    'Server-owned Learning Content page/resource progress by runtime user.',
                    'Серверный прогресс по страницам и ресурсам учебного контента для runtime-пользователей.'
                ),
                config: buildTransactionalObjectConfig({
                    prefix: 'CPR-',
                    effectiveDateField: 'CompletedAt',
                    stateField: 'ProgressStatus',
                    states: [
                        { codename: 'NotStarted', title: 'Not Started', isInitial: true },
                        { codename: 'InProgress', title: 'In Progress' },
                        { codename: 'Completed', title: 'Completed', isFinal: true }
                    ],
                    targetLedgers: ['ProgressLedger']
                }),
                components: [
                    {
                        codename: 'TargetObjectCodename',
                        dataType: 'STRING',
                        name: vlc('Target Object', 'Целевой объект'),
                        sortOrder: 1,
                        validationRules: { maxLength: 128 }
                    },
                    {
                        codename: 'TargetRecordId',
                        dataType: 'STRING',
                        name: vlc('Target Record ID', 'ID целевой записи'),
                        sortOrder: 2,
                        validationRules: { maxLength: 128 }
                    },
                    {
                        codename: 'UserId',
                        dataType: 'STRING',
                        name: vlc('User ID', 'ID пользователя'),
                        sortOrder: 3,
                        validationRules: { maxLength: 128 },
                        uiConfig: { hidden: true }
                    },
                    {
                        codename: 'ProgressStudentId',
                        dataType: 'REF',
                        name: vlc('Student', 'Студент'),
                        sortOrder: 4,
                        targetEntityCodename: 'Students',
                        targetEntityKind: 'object'
                    },
                    {
                        codename: 'ContentNodeId',
                        dataType: 'REF',
                        name: vlc('Learning Resource', 'Учебный ресурс'),
                        sortOrder: 5,
                        targetEntityCodename: 'LearningResources',
                        targetEntityKind: 'object'
                    },
                    {
                        codename: 'DepartmentId',
                        dataType: 'REF',
                        name: vlc('Department', 'Подразделение'),
                        sortOrder: 6,
                        targetEntityCodename: 'Departments',
                        targetEntityKind: 'object'
                    },
                    {
                        codename: 'ProgressStatus',
                        dataType: 'STRING',
                        name: vlc('Status', 'Статус'),
                        isRequired: true,
                        sortOrder: 7,
                        validationRules: { maxLength: 64 }
                    },
                    {
                        codename: 'ProgressPercent',
                        dataType: 'NUMBER',
                        name: vlc('Progress %', 'Прогресс %'),
                        isRequired: true,
                        sortOrder: 8,
                        validationRules: { min: 0, max: 100 }
                    },
                    {
                        codename: 'StartedAt',
                        dataType: 'DATE',
                        name: vlc('Started At', 'Начато'),
                        sortOrder: 9,
                        validationRules: { dateComposition: 'datetime' }
                    },
                    {
                        codename: 'CompletedAt',
                        dataType: 'DATE',
                        name: vlc('Completed At', 'Завершено'),
                        sortOrder: 10,
                        validationRules: { dateComposition: 'datetime' }
                    },
                    {
                        codename: 'LastViewedAt',
                        dataType: 'DATE',
                        name: vlc('Last Viewed At', 'Последний просмотр'),
                        sortOrder: 11,
                        validationRules: { dateComposition: 'datetime' }
                    },
                    {
                        codename: 'LastAccessedItemIndex',
                        dataType: 'NUMBER',
                        name: vlc('Last Accessed Item', 'Последний элемент'),
                        sortOrder: 12
                    }
                ]
            },
            {
                codename: 'TrashEntries',
                kind: 'object',
                name: vlc('Trash Entries', 'Корзина'),
                description: vlc(
                    'Object projection for deleted Learning Content records that can be restored from the workspace Trash.',
                    'Объектная проекция удаленного учебного контента для восстановления из корзины рабочего пространства.'
                ),
                components: [
                    {
                        codename: 'TargetObjectCodename',
                        dataType: 'STRING',
                        name: vlc('Target Object', 'Целевой объект'),
                        isRequired: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 128 }
                    },
                    {
                        codename: 'TargetRecordId',
                        dataType: 'STRING',
                        name: vlc('Target Record ID', 'ID целевой записи'),
                        isRequired: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 128 }
                    },
                    {
                        codename: 'DeletedBy',
                        dataType: 'STRING',
                        name: vlc('Deleted By', 'Удалил'),
                        sortOrder: 3,
                        validationRules: { maxLength: 128 }
                    },
                    {
                        codename: 'DeletedAt',
                        dataType: 'DATE',
                        name: vlc('Deleted At', 'Дата удаления'),
                        isRequired: true,
                        sortOrder: 4,
                        validationRules: { dateComposition: 'datetime' }
                    },
                    {
                        codename: 'ExpiresAt',
                        dataType: 'DATE',
                        name: vlc('Expires At', 'Истекает'),
                        sortOrder: 5,
                        validationRules: { dateComposition: 'datetime' }
                    },
                    {
                        codename: 'RestoreState',
                        dataType: 'STRING',
                        name: vlc('Restore State', 'Состояние восстановления'),
                        sortOrder: 6,
                        validationRules: { maxLength: 64 }
                    }
                ]
            },
            {
                codename: 'LearningResources',
                kind: 'object',
                name: vlc('Learning Resources', 'Учебные ресурсы'),
                description: vlc(
                    'Reusable content resources such as pages, links, videos, documents, embeds, and deferred package standards.',
                    'Переиспользуемые учебные ресурсы: страницы, ссылки, видео, документы, встраивания и отложенные пакетные стандарты.'
                ),
                config: {
                    workflowActions: LMS_LEARNING_RESOURCE_PUBLICATION_WORKFLOW_ACTIONS,
                    runtimeLibrary: {
                        recent: {
                            objectCodename: 'RecentContentViews',
                            targetObjectFieldCodename: 'TargetObjectCodename',
                            targetRecordFieldCodename: 'TargetRecordId',
                            actorFieldCodename: 'UserId',
                            timestampFieldCodename: 'ViewedAt'
                        },
                        starred: {
                            objectCodename: 'ContentStars',
                            targetObjectFieldCodename: 'TargetObjectCodename',
                            targetRecordFieldCodename: 'TargetRecordId',
                            actorFieldCodename: 'UserId',
                            timestampFieldCodename: 'StarredAt'
                        },
                        shared: {
                            objectCodename: 'ContentAccessEntries',
                            targetObjectFieldCodename: 'TargetObjectCodename',
                            targetRecordFieldCodename: 'TargetRecordId',
                            principalTypeFieldCodename: 'PrincipalType',
                            principalIdFieldCodename: 'PrincipalId',
                            accessLevelFieldCodename: 'AccessLevel',
                            defaultAccessLevel: 'canView',
                            timestampFieldCodename: 'InvitedAt',
                            allowedPrincipalTypes: ['workspaceMember', 'user']
                        }
                    },
                    runtimeRecordAccess: {
                        mode: 'ownerOrShared',
                        ownerColumnName: '_upl_created_by',
                        sharedRelationKey: 'shared'
                    }
                },
                components: [
                    {
                        codename: 'ProjectId',
                        dataType: 'REF',
                        name: vlc('Project', 'Проект'),
                        sortOrder: 1,
                        targetEntityCodename: 'ContentProjects',
                        targetEntityKind: 'object'
                    },
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayComponent: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 500, localized: true, versioned: true },
                        uiConfig: {
                            syncTargets: [{ fieldId: 'Name', manualFlagFieldId: 'NameManuallyEdited' }]
                        }
                    },
                    {
                        codename: 'Name',
                        dataType: 'STRING',
                        name: vlc('Name', 'Название страницы'),
                        sortOrder: 3,
                        validationRules: { maxLength: 500 }
                    },
                    {
                        codename: 'NameManuallyEdited',
                        dataType: 'BOOLEAN',
                        name: vlc('Name Manually Edited', 'Название изменено вручную'),
                        sortOrder: 4,
                        uiConfig: {
                            hidden: true
                        }
                    },
                    {
                        codename: 'ResourceType',
                        dataType: 'REF',
                        name: vlc('Resource Type', 'Тип ресурса'),
                        isRequired: true,
                        sortOrder: 5,
                        targetEntityCodename: 'ResourceType',
                        targetEntityKind: 'enumeration'
                    },
                    {
                        codename: 'Source',
                        dataType: 'JSON',
                        name: vlc('Source', 'Источник'),
                        isRequired: true,
                        sortOrder: 6,
                        uiConfig: {
                            widget: 'resourceSource',
                            autoPageCodename: {
                                sourceFields: ['Name', 'Title']
                            },
                            gridHidden: true
                        }
                    },
                    {
                        codename: 'Body',
                        dataType: 'JSON',
                        name: vlc('Body', 'Содержимое'),
                        sortOrder: 7,
                        uiConfig: {
                            gridHidden: true,
                            widget: 'editorjsBlockContent',
                            blockEditor: {
                                allowedBlockTypes: ['paragraph', 'header', 'list', 'quote', 'table', 'image', 'embed', 'delimiter'],
                                maxBlocks: 200
                            }
                        }
                    },
                    {
                        codename: 'PublicationStatus',
                        dataType: 'REF',
                        name: vlc('Publication Status', 'Статус публикации'),
                        sortOrder: 8,
                        targetEntityCodename: 'PublicationStatus',
                        targetEntityKind: 'enumeration'
                    },
                    {
                        codename: 'EstimatedTimeMinutes',
                        dataType: 'NUMBER',
                        name: vlc('Estimated Time, min', 'Оценочное время, мин'),
                        sortOrder: 9,
                        validationRules: { min: 0 }
                    },
                    {
                        codename: 'Language',
                        dataType: 'STRING',
                        name: vlc('Language', 'Язык'),
                        sortOrder: 10,
                        validationRules: { maxLength: 16 }
                    },
                    {
                        codename: 'Version',
                        dataType: 'STRING',
                        name: vlc('Version', 'Версия'),
                        sortOrder: 11,
                        validationRules: { maxLength: 64 }
                    },
                    {
                        codename: 'Thumbnail',
                        dataType: 'JSON',
                        name: vlc('Thumbnail', 'Миниатюра'),
                        sortOrder: 12,
                        uiConfig: {
                            widget: 'resourceSource',
                            gridHidden: true
                        }
                    },
                    {
                        codename: 'CreatedBy',
                        dataType: 'STRING',
                        name: vlc('Created By', 'Создал'),
                        sortOrder: 13,
                        validationRules: { maxLength: 128 },
                        uiConfig: { hidden: true }
                    },
                    {
                        codename: 'Instructor',
                        dataType: 'STRING',
                        name: vlc('Instructor', 'Преподаватель'),
                        sortOrder: 14,
                        validationRules: { maxLength: 255, localized: true, versioned: true }
                    },
                    {
                        codename: 'ContentItems',
                        dataType: 'TABLE',
                        name: vlc('Content Items', 'Элементы контента'),
                        sortOrder: 15,
                        childComponents: [
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
                                dataType: 'REF',
                                name: vlc('Quiz', 'Тест'),
                                sortOrder: 4,
                                targetEntityCodename: 'Quizzes',
                                targetEntityKind: 'object'
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
                codename: 'Courses',
                kind: 'object',
                name: vlc('Courses', 'Курсы'),
                description: vlc(
                    'Courses that group ordered sections and Learning Content items.',
                    'Курсы, объединяющие упорядоченные разделы и элементы учебного контента.'
                ),
                config: {
                    runtimeLibrary: {
                        recent: {
                            objectCodename: 'RecentContentViews',
                            targetObjectFieldCodename: 'TargetObjectCodename',
                            targetRecordFieldCodename: 'TargetRecordId',
                            actorFieldCodename: 'UserId',
                            timestampFieldCodename: 'ViewedAt'
                        },
                        starred: {
                            objectCodename: 'ContentStars',
                            targetObjectFieldCodename: 'TargetObjectCodename',
                            targetRecordFieldCodename: 'TargetRecordId',
                            actorFieldCodename: 'UserId',
                            timestampFieldCodename: 'StarredAt'
                        },
                        shared: {
                            objectCodename: 'ContentAccessEntries',
                            targetObjectFieldCodename: 'TargetObjectCodename',
                            targetRecordFieldCodename: 'TargetRecordId',
                            principalTypeFieldCodename: 'PrincipalType',
                            principalIdFieldCodename: 'PrincipalId',
                            accessLevelFieldCodename: 'AccessLevel',
                            defaultAccessLevel: 'canView',
                            timestampFieldCodename: 'InvitedAt',
                            allowedPrincipalTypes: ['workspaceMember', 'user']
                        }
                    },
                    runtimeRecordAccess: {
                        mode: 'ownerOrShared',
                        ownerColumnName: '_upl_created_by',
                        sharedRelationKey: 'shared'
                    },
                    runtimeCopy: {
                        relations: [
                            {
                                objectCodename: 'CourseSections',
                                parentFieldCodename: 'CourseId',
                                orderFieldCodename: 'SortOrder'
                            },
                            {
                                objectCodename: 'CourseItems',
                                parentFieldCodename: 'CourseId',
                                orderFieldCodename: 'SortOrder',
                                refRemaps: [
                                    {
                                        fieldCodename: 'SectionId',
                                        sourceObjectCodename: 'CourseSections'
                                    }
                                ]
                            }
                        ]
                    }
                },
                components: [
                    {
                        codename: 'ProjectId',
                        dataType: 'REF',
                        name: vlc('Project', 'Проект'),
                        sortOrder: 1,
                        targetEntityCodename: 'ContentProjects',
                        targetEntityKind: 'object'
                    },
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayComponent: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 500, localized: true, versioned: true }
                    },
                    {
                        codename: 'Description',
                        dataType: 'STRING',
                        name: vlc('Description', 'Описание'),
                        sortOrder: 3,
                        validationRules: { localized: true, versioned: true },
                        uiConfig: { widget: 'textarea', rows: 2 }
                    },
                    {
                        codename: 'Status',
                        dataType: 'REF',
                        name: vlc('Status', 'Статус'),
                        sortOrder: 4,
                        targetEntityCodename: 'LearningResourceStatus',
                        targetEntityKind: 'enumeration'
                    },
                    {
                        codename: 'NavigationMode',
                        dataType: 'STRING',
                        name: vlc('Navigation Mode', 'Режим навигации'),
                        sortOrder: 5,
                        validationRules: { maxLength: 32 },
                        uiConfig: {
                            widget: 'select',
                            stringOptions: [
                                { value: 'free', label: vlc('Free', 'Свободная') },
                                { value: 'sequential', label: vlc('Sequential', 'Последовательная') }
                            ]
                        }
                    },
                    {
                        codename: 'CompletionCondition',
                        dataType: 'STRING',
                        name: vlc('Completion Condition', 'Условие завершения'),
                        sortOrder: 6,
                        validationRules: { maxLength: 64 },
                        uiConfig: {
                            widget: 'select',
                            stringOptions: [
                                { value: 'allItems', label: vlc('All items', 'Все элементы') },
                                { value: 'selectedItems', label: vlc('Selected items', 'Выбранные элементы') }
                            ]
                        }
                    },
                    {
                        codename: 'StatusFormat',
                        dataType: 'STRING',
                        name: vlc('Status Format', 'Формат статуса'),
                        sortOrder: 7,
                        validationRules: { maxLength: 64 },
                        uiConfig: {
                            widget: 'select',
                            stringOptions: [
                                { value: 'completeIncomplete', label: vlc('Complete / Incomplete', 'Завершен / Не завершен') },
                                { value: 'passedFailed', label: vlc('Passed / Failed', 'Пройден / Не пройден') }
                            ]
                        }
                    },
                    {
                        codename: 'Cover',
                        dataType: 'JSON',
                        name: vlc('Cover', 'Обложка'),
                        sortOrder: 8,
                        uiConfig: {
                            widget: 'resourceSource',
                            gridHidden: true
                        }
                    },
                    {
                        codename: 'Instructor',
                        dataType: 'STRING',
                        name: vlc('Instructor', 'Преподаватель'),
                        sortOrder: 9,
                        validationRules: { maxLength: 255, localized: true, versioned: true }
                    },
                    {
                        codename: 'Tags',
                        dataType: 'STRING',
                        name: vlc('Tags', 'Теги'),
                        sortOrder: 10,
                        validationRules: { maxLength: 500 }
                    },
                    {
                        codename: 'CatalogVisible',
                        dataType: 'BOOLEAN',
                        name: vlc('Catalog Visible', 'Показывать в каталоге'),
                        sortOrder: 11
                    },
                    {
                        codename: 'CatalogCategory',
                        dataType: 'STRING',
                        name: vlc('Catalog Category', 'Категория каталога'),
                        sortOrder: 12,
                        validationRules: { maxLength: 255, localized: true, versioned: true }
                    },
                    {
                        codename: 'CatalogAudience',
                        dataType: 'STRING',
                        name: vlc('Catalog Audience', 'Аудитория каталога'),
                        sortOrder: 13,
                        validationRules: { maxLength: 255, localized: true, versioned: true }
                    },
                    {
                        codename: 'SelfEnrollmentMode',
                        dataType: 'STRING',
                        name: vlc('Self-Enrollment Mode', 'Режим самостоятельной записи'),
                        sortOrder: 14,
                        validationRules: { maxLength: 32 },
                        uiConfig: {
                            widget: 'select',
                            stringOptions: [
                                { value: 'disabled', label: vlc('Disabled', 'Отключена') },
                                { value: 'open', label: vlc('Open', 'Открытая') }
                            ]
                        }
                    },
                    {
                        codename: 'EstimatedTimeMinutes',
                        dataType: 'NUMBER',
                        name: vlc('Estimated Time, min', 'Оценочное время, мин'),
                        sortOrder: 15,
                        validationRules: { min: 0 }
                    }
                ]
            },
            {
                codename: 'CourseSections',
                kind: 'object',
                name: vlc('Course Sections', 'Разделы курса'),
                description: vlc('Ordered sections inside courses.', 'Упорядоченные разделы внутри курсов.'),
                config: {
                    runtimeRecordParentAccess: {
                        mode: 'parentRecord',
                        parentObjectCodename: 'Courses',
                        parentFieldCodename: 'CourseId'
                    }
                },
                components: [
                    {
                        codename: 'CourseId',
                        dataType: 'REF',
                        name: vlc('Course', 'Курс'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'Courses',
                        targetEntityKind: 'object'
                    },
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayComponent: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 500, localized: true, versioned: true }
                    },
                    {
                        codename: 'Description',
                        dataType: 'STRING',
                        name: vlc('Description', 'Описание'),
                        sortOrder: 3,
                        validationRules: { localized: true, versioned: true },
                        uiConfig: { widget: 'textarea', rows: 2 }
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
                codename: 'CourseItems',
                kind: 'object',
                name: vlc('Course Items', 'Элементы курса'),
                description: vlc(
                    'Ordered polymorphic content references inside course sections.',
                    'Упорядоченные полиморфные ссылки на контент внутри разделов курса.'
                ),
                config: {
                    runtimeRecordParentAccess: {
                        mode: 'parentRecord',
                        parentObjectCodename: 'Courses',
                        parentFieldCodename: 'CourseId'
                    },
                    runtimeProgress: {
                        sequencePolicy: {
                            mode: 'sequential',
                            scopeFieldCodename: 'CourseId',
                            orderFieldCodename: 'SortOrder'
                        },
                        aggregateParents: [
                            {
                                parentObjectCodename: 'Courses',
                                parentIdFieldCodename: 'CourseId',
                                itemWeightFieldCodename: 'CompletionWeight',
                                itemRequiredFieldCodename: 'IsRequired',
                                requiredOnly: true
                            }
                        ]
                    }
                },
                components: [
                    {
                        codename: 'CourseId',
                        dataType: 'REF',
                        name: vlc('Course', 'Курс'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'Courses',
                        targetEntityKind: 'object'
                    },
                    {
                        codename: 'SectionId',
                        dataType: 'REF',
                        name: vlc('Section', 'Раздел'),
                        sortOrder: 2,
                        targetEntityCodename: 'CourseSections',
                        targetEntityKind: 'object',
                        uiConfig: { gridHidden: true }
                    },
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayComponent: true,
                        sortOrder: 3,
                        validationRules: { maxLength: 500, localized: true, versioned: true }
                    },
                    {
                        codename: 'TargetObjectCodename',
                        dataType: 'STRING',
                        name: vlc('Target Object', 'Целевой объект'),
                        isRequired: true,
                        sortOrder: 4,
                        validationRules: { maxLength: 128 },
                        uiConfig: {
                            widget: 'select',
                            stringOptions: [
                                { value: 'LearningResources', label: vlc('Learning Resources', 'Учебные ресурсы') },
                                { value: 'Quizzes', label: vlc('Quizzes', 'Тесты') }
                            ]
                        }
                    },
                    {
                        codename: 'TargetRecordId',
                        dataType: 'STRING',
                        name: vlc('Target Record', 'Целевая запись'),
                        isRequired: true,
                        sortOrder: 5,
                        validationRules: { maxLength: 128 },
                        uiConfig: {
                            gridHidden: true,
                            widget: 'runtimeRecordPicker',
                            runtimeRecordPicker: {
                                targetObjectCodenameField: 'TargetObjectCodename',
                                allowedObjectCodenames: ['LearningResources', 'Quizzes'],
                                labelFields: ['Title', 'Name'],
                                limit: 100
                            }
                        }
                    },
                    {
                        codename: 'ItemType',
                        dataType: 'STRING',
                        name: vlc('Item Type', 'Тип элемента'),
                        isRequired: true,
                        sortOrder: 6,
                        validationRules: { maxLength: 64 }
                    },
                    {
                        codename: 'SortOrder',
                        dataType: 'NUMBER',
                        name: vlc('Sort Order', 'Порядок'),
                        isRequired: true,
                        sortOrder: 7,
                        validationRules: { min: 0 }
                    },
                    {
                        codename: 'IsRequired',
                        dataType: 'BOOLEAN',
                        name: vlc('Required', 'Обязательно'),
                        sortOrder: 8
                    },
                    {
                        codename: 'CompletionWeight',
                        dataType: 'NUMBER',
                        name: vlc('Completion Weight', 'Вес завершения'),
                        sortOrder: 9,
                        validationRules: { min: 0 }
                    },
                    {
                        codename: 'AvailabilityOverride',
                        dataType: 'JSON',
                        name: vlc('Availability Override', 'Переопределение доступности'),
                        sortOrder: 10
                    },
                    {
                        codename: 'EstimatedTimeMinutes',
                        dataType: 'NUMBER',
                        name: vlc('Estimated Time, min', 'Оценочное время, мин'),
                        sortOrder: 11,
                        validationRules: { min: 0 }
                    }
                ]
            },
            {
                codename: 'LearningTracks',
                kind: 'object',
                name: vlc('Learning Tracks', 'Учебные треки'),
                description: vlc(
                    'Ordered programs that combine courses into stages.',
                    'Последовательные программы, объединяющие курсы по этапам.'
                ),
                config: {
                    runtimeLibrary: {
                        recent: {
                            objectCodename: 'RecentContentViews',
                            targetObjectFieldCodename: 'TargetObjectCodename',
                            targetRecordFieldCodename: 'TargetRecordId',
                            actorFieldCodename: 'UserId',
                            timestampFieldCodename: 'ViewedAt'
                        },
                        starred: {
                            objectCodename: 'ContentStars',
                            targetObjectFieldCodename: 'TargetObjectCodename',
                            targetRecordFieldCodename: 'TargetRecordId',
                            actorFieldCodename: 'UserId',
                            timestampFieldCodename: 'StarredAt'
                        },
                        shared: {
                            objectCodename: 'ContentAccessEntries',
                            targetObjectFieldCodename: 'TargetObjectCodename',
                            targetRecordFieldCodename: 'TargetRecordId',
                            principalTypeFieldCodename: 'PrincipalType',
                            principalIdFieldCodename: 'PrincipalId',
                            accessLevelFieldCodename: 'AccessLevel',
                            defaultAccessLevel: 'canView',
                            timestampFieldCodename: 'InvitedAt',
                            allowedPrincipalTypes: ['workspaceMember', 'user']
                        }
                    },
                    runtimeRecordAccess: {
                        mode: 'ownerOrShared',
                        ownerColumnName: '_upl_created_by',
                        sharedRelationKey: 'shared'
                    },
                    runtimeCopy: {
                        relations: [
                            {
                                objectCodename: 'TrackStages',
                                parentFieldCodename: 'TrackId',
                                orderFieldCodename: 'SortOrder'
                            },
                            {
                                objectCodename: 'TrackSteps',
                                parentFieldCodename: 'TrackId',
                                orderFieldCodename: 'SortOrder',
                                refRemaps: [
                                    {
                                        fieldCodename: 'StageId',
                                        sourceObjectCodename: 'TrackStages'
                                    }
                                ]
                            }
                        ]
                    }
                },
                components: [
                    {
                        codename: 'ProjectId',
                        dataType: 'REF',
                        name: vlc('Project', 'Проект'),
                        sortOrder: 1,
                        targetEntityCodename: 'ContentProjects',
                        targetEntityKind: 'object'
                    },
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayComponent: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 500, localized: true, versioned: true }
                    },
                    {
                        codename: 'Description',
                        dataType: 'STRING',
                        name: vlc('Description', 'Описание'),
                        sortOrder: 3,
                        validationRules: { localized: true, versioned: true },
                        uiConfig: { widget: 'textarea', rows: 2 }
                    },
                    {
                        codename: 'Status',
                        dataType: 'REF',
                        name: vlc('Status', 'Статус'),
                        sortOrder: 4,
                        targetEntityCodename: 'LearningResourceStatus',
                        targetEntityKind: 'enumeration'
                    },
                    {
                        codename: 'OrderMode',
                        dataType: 'STRING',
                        name: vlc('Order Mode', 'Режим порядка'),
                        sortOrder: 5,
                        validationRules: { maxLength: 32 },
                        uiConfig: {
                            widget: 'select',
                            stringOptions: [
                                { value: 'byDays', label: vlc('By days', 'По дням') },
                                { value: 'sequential', label: vlc('Sequential', 'Последовательно') },
                                { value: 'free', label: vlc('Free', 'Свободно') }
                            ]
                        }
                    },
                    {
                        codename: 'Cover',
                        dataType: 'JSON',
                        name: vlc('Cover', 'Обложка'),
                        sortOrder: 6,
                        uiConfig: {
                            widget: 'resourceSource',
                            gridHidden: true
                        }
                    },
                    {
                        codename: 'Instructor',
                        dataType: 'STRING',
                        name: vlc('Instructor', 'Преподаватель'),
                        sortOrder: 7,
                        validationRules: { maxLength: 255 }
                    },
                    {
                        codename: 'Tags',
                        dataType: 'STRING',
                        name: vlc('Tags', 'Теги'),
                        sortOrder: 8,
                        validationRules: { maxLength: 500 }
                    },
                    {
                        codename: 'CatalogVisible',
                        dataType: 'BOOLEAN',
                        name: vlc('Catalog Visible', 'Показывать в каталоге'),
                        sortOrder: 9
                    },
                    {
                        codename: 'CatalogCategory',
                        dataType: 'STRING',
                        name: vlc('Catalog Category', 'Категория каталога'),
                        sortOrder: 10,
                        validationRules: { maxLength: 255, localized: true, versioned: true }
                    },
                    {
                        codename: 'CatalogAudience',
                        dataType: 'STRING',
                        name: vlc('Catalog Audience', 'Аудитория каталога'),
                        sortOrder: 11,
                        validationRules: { maxLength: 255, localized: true, versioned: true }
                    },
                    {
                        codename: 'SelfEnrollmentMode',
                        dataType: 'STRING',
                        name: vlc('Self-Enrollment Mode', 'Режим самостоятельной записи'),
                        sortOrder: 12,
                        validationRules: { maxLength: 32 },
                        uiConfig: {
                            widget: 'select',
                            stringOptions: [
                                { value: 'disabled', label: vlc('Disabled', 'Отключена') },
                                { value: 'open', label: vlc('Open', 'Открытая') }
                            ]
                        }
                    }
                ]
            },
            {
                codename: 'TrackStages',
                kind: 'object',
                name: vlc('Track Stages', 'Этапы трека'),
                description: vlc('Ordered stage headers inside learning tracks.', 'Упорядоченные этапы внутри учебных треков.'),
                config: {
                    runtimeRecordParentAccess: {
                        mode: 'parentRecord',
                        parentObjectCodename: 'LearningTracks',
                        parentFieldCodename: 'TrackId'
                    }
                },
                components: [
                    {
                        codename: 'TrackId',
                        dataType: 'REF',
                        name: vlc('Learning Track', 'Учебный трек'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'LearningTracks',
                        targetEntityKind: 'object'
                    },
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayComponent: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 500, localized: true, versioned: true }
                    },
                    {
                        codename: 'Description',
                        dataType: 'STRING',
                        name: vlc('Description', 'Описание'),
                        sortOrder: 3,
                        validationRules: { localized: true, versioned: true }
                    },
                    {
                        codename: 'SortOrder',
                        dataType: 'NUMBER',
                        name: vlc('Sort Order', 'Порядок'),
                        isRequired: true,
                        sortOrder: 4,
                        validationRules: { min: 0 }
                    }
                ]
            },
            {
                codename: 'TrackSteps',
                kind: 'object',
                name: vlc('Track Steps', 'Шаги трека'),
                description: vlc(
                    'Reusable ordered steps for learning track progression and prerequisite checks.',
                    'Переиспользуемые упорядоченные шаги учебных треков и проверок prerequisites.'
                ),
                config: {
                    runtimeRecordParentAccess: {
                        mode: 'parentRecord',
                        parentObjectCodename: 'LearningTracks',
                        parentFieldCodename: 'TrackId'
                    },
                    runtimeProgress: {
                        sequencePolicy: {
                            mode: 'sequential',
                            scopeFieldCodename: 'TrackId',
                            orderFieldCodename: 'SortOrder'
                        },
                        aggregateParents: [
                            {
                                parentObjectCodename: 'LearningTracks',
                                parentIdFieldCodename: 'TrackId',
                                itemRequiredFieldCodename: 'IsRequired',
                                requiredOnly: true
                            }
                        ]
                    }
                },
                components: [
                    {
                        codename: 'TrackId',
                        dataType: 'REF',
                        name: vlc('Learning Track', 'Учебный трек'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'LearningTracks',
                        targetEntityKind: 'object'
                    },
                    {
                        codename: 'StageId',
                        dataType: 'REF',
                        name: vlc('Stage', 'Этап'),
                        sortOrder: 2,
                        targetEntityCodename: 'TrackStages',
                        targetEntityKind: 'object',
                        uiConfig: { gridHidden: true }
                    },
                    {
                        codename: 'CourseId',
                        dataType: 'REF',
                        name: vlc('Course', 'Курс'),
                        isRequired: true,
                        sortOrder: 3,
                        targetEntityCodename: 'Courses',
                        targetEntityKind: 'object',
                        uiConfig: { gridHidden: true }
                    },
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayComponent: true,
                        sortOrder: 4,
                        validationRules: { maxLength: 500, localized: true, versioned: true }
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
                        codename: 'EnrollmentOffsetDays',
                        dataType: 'NUMBER',
                        name: vlc('Enrollment Offset Days', 'Смещение зачисления, дни'),
                        sortOrder: 6,
                        validationRules: { min: 0 }
                    },
                    {
                        codename: 'DueOffsetDays',
                        dataType: 'NUMBER',
                        name: vlc('Due Offset Days', 'Срок выполнения, дни'),
                        sortOrder: 7,
                        validationRules: { min: 0 }
                    },
                    {
                        codename: 'RestrictAfterDueDate',
                        dataType: 'BOOLEAN',
                        name: vlc('Restrict After Due Date', 'Ограничить после срока'),
                        sortOrder: 8
                    },
                    {
                        codename: 'IsRequired',
                        dataType: 'BOOLEAN',
                        name: vlc('Required', 'Обязательно'),
                        sortOrder: 9
                    }
                ]
            },
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
            },
            {
                codename: 'TrainingEvents',
                kind: 'object',
                name: vlc('Training Events', 'Учебные мероприятия'),
                description: vlc(
                    'Instructor-led sessions, webinars, and blended learning events.',
                    'Очные занятия, вебинары и смешанные учебные мероприятия.'
                ),
                config: buildTransactionalObjectConfig({
                    prefix: 'TRN-',
                    effectiveDateField: 'StartsAt',
                    targetLedgers: ['AttendanceLedger']
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
                kind: 'object',
                name: vlc('Training Attendance', 'Посещаемость мероприятий'),
                description: vlc(
                    'Attendance facts for instructor-led sessions and webinars.',
                    'Факты посещаемости очных занятий и вебинаров.'
                ),
                config: buildTransactionalObjectConfig({
                    prefix: 'ATT-',
                    effectiveDateField: 'CheckedInAt',
                    stateField: 'Status',
                    states: [
                        { codename: 'Registered', title: 'Registered', isInitial: true },
                        { codename: 'Attended', title: 'Attended', isFinal: true },
                        { codename: 'NoShow', title: 'No-show', isFinal: true },
                        { codename: 'Cancelled', title: 'Cancelled', isFinal: true }
                    ],
                    targetLedgers: ['AttendanceLedger', 'LearningActivityLedger'],
                    workflowActions: LMS_TRAINING_ATTENDANCE_WORKFLOW_ACTIONS
                }),
                components: [
                    {
                        codename: 'TrainingEventId',
                        dataType: 'REF',
                        name: vlc('Training Event', 'Учебное мероприятие'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'TrainingEvents',
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
                kind: 'object',
                name: vlc('Certificates', 'Сертификаты'),
                description: vlc(
                    'Issued completion certificates and their lifecycle state.',
                    'Выданные сертификаты о прохождении и их состояние.'
                ),
                config: buildTransactionalObjectConfig({
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
                components: [
                    {
                        codename: 'CertificateNumber',
                        dataType: 'STRING',
                        name: vlc('Certificate Number', 'Номер сертификата'),
                        isRequired: true,
                        isDisplayComponent: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 100 }
                    },
                    {
                        codename: 'StudentId',
                        dataType: 'REF',
                        name: vlc('Student', 'Студент'),
                        sortOrder: 2,
                        targetEntityCodename: 'Students',
                        targetEntityKind: 'object'
                    },
                    {
                        codename: 'ContentNodeId',
                        dataType: 'REF',
                        name: vlc('Learning Resource', 'Учебный ресурс'),
                        sortOrder: 3,
                        targetEntityCodename: 'LearningResources',
                        targetEntityKind: 'object'
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
                kind: 'object',
                name: vlc('Certificate Issues', 'Выдачи сертификатов'),
                description: vlc(
                    'Certificate issue and revocation events posted to the certificate ledger.',
                    'События выдачи и отзыва сертификатов, проводимые в регистр сертификатов.'
                ),
                config: buildTransactionalObjectConfig({
                    prefix: 'CIS-',
                    effectiveDateField: 'IssuedAt',
                    stateField: 'Status',
                    states: [
                        { codename: 'Eligible', title: 'Eligible', isInitial: true },
                        { codename: 'Issued', title: 'Issued' },
                        { codename: 'Revoked', title: 'Revoked', isFinal: true },
                        { codename: 'Expired', title: 'Expired', isFinal: true }
                    ],
                    targetLedgers: ['CertificateLedger', 'NotificationLedger'],
                    workflowActions: LMS_CERTIFICATE_ISSUE_WORKFLOW_ACTIONS
                }),
                components: [
                    {
                        codename: 'CertificateId',
                        dataType: 'REF',
                        name: vlc('Certificate', 'Сертификат'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'Certificates',
                        targetEntityKind: 'object'
                    },
                    {
                        codename: 'CertificateNumber',
                        dataType: 'STRING',
                        name: vlc('Certificate Number', 'Номер сертификата'),
                        isRequired: true,
                        isDisplayComponent: true,
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
                        targetEntityKind: 'object'
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
                        codename: 'IssuedAt',
                        dataType: 'DATE',
                        name: vlc('Issued At', 'Выдан'),
                        isRequired: true,
                        sortOrder: 5
                    },
                    {
                        codename: 'Status',
                        dataType: 'STRING',
                        name: vlc('Status', 'Статус'),
                        isRequired: true,
                        sortOrder: 6,
                        validationRules: { maxLength: 30 }
                    }
                ]
            },
            {
                codename: 'KnowledgeSpaces',
                kind: 'object',
                name: vlc('Knowledge Spaces', 'Пространства знаний'),
                description: vlc('Knowledge base spaces with shared permissions.', 'Пространства базы знаний с общими правами доступа.'),
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
                kind: 'object',
                name: vlc('Knowledge Folders', 'Папки знаний'),
                description: vlc('Folders inside knowledge spaces.', 'Папки внутри пространств знаний.'),
                components: [
                    {
                        codename: 'SpaceId',
                        dataType: 'REF',
                        name: vlc('Knowledge Space', 'Пространство знаний'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'KnowledgeSpaces',
                        targetEntityKind: 'object'
                    },
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayComponent: true,
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
                codename: 'KnowledgeArticles',
                kind: 'object',
                name: vlc('Knowledge Articles', 'Статьи базы знаний'),
                description: vlc(
                    'Workspace-scoped articles authored directly inside the published application.',
                    'Статьи рабочего пространства, создаваемые прямо в опубликованном приложении.'
                ),
                components: [
                    {
                        codename: 'FolderId',
                        dataType: 'REF',
                        name: vlc('Knowledge Folder', 'Папка знаний'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'KnowledgeFolders',
                        targetEntityKind: 'object'
                    },
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayComponent: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 500, localized: true, versioned: true }
                    },
                    {
                        codename: 'Body',
                        dataType: 'JSON',
                        name: vlc('Body', 'Содержимое'),
                        isRequired: true,
                        sortOrder: 3,
                        uiConfig: {
                            widget: 'editorjsBlockContent',
                            blockEditor: {
                                allowedBlockTypes: ['paragraph', 'header', 'list', 'quote', 'table', 'image', 'embed', 'delimiter'],
                                maxBlocks: 200
                            }
                        }
                    },
                    {
                        codename: 'Status',
                        dataType: 'REF',
                        name: vlc('Status', 'Статус'),
                        sortOrder: 4,
                        targetEntityCodename: 'LearningResourceStatus',
                        targetEntityKind: 'enumeration'
                    }
                ]
            },
            {
                codename: 'KnowledgeBookmarks',
                kind: 'object',
                name: vlc('Knowledge Bookmarks', 'Закладки знаний'),
                description: vlc('Per-learner bookmarks for knowledge base articles.', 'Закладки учащихся для статей базы знаний.'),
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
                        codename: 'ArticleId',
                        dataType: 'REF',
                        name: vlc('Knowledge Article', 'Статья базы знаний'),
                        isRequired: true,
                        sortOrder: 2,
                        targetEntityCodename: 'KnowledgeArticles',
                        targetEntityKind: 'object'
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
                kind: 'object',
                name: vlc('Development Plans', 'Планы развития'),
                description: vlc(
                    'Onboarding and growth plans for learners and teams.',
                    'Планы адаптации и развития для учащихся и команд.'
                ),
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
                        codename: 'StudentId',
                        dataType: 'REF',
                        name: vlc('Student', 'Студент'),
                        sortOrder: 2,
                        targetEntityCodename: 'Students',
                        targetEntityKind: 'object'
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
                kind: 'object',
                name: vlc('Development Plan Stages', 'Этапы плана развития'),
                description: vlc('Ordered stages inside development plans.', 'Упорядоченные этапы внутри планов развития.'),
                components: [
                    {
                        codename: 'PlanId',
                        dataType: 'REF',
                        name: vlc('Development Plan', 'План развития'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'DevelopmentPlans',
                        targetEntityKind: 'object'
                    },
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayComponent: true,
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
                kind: 'object',
                name: vlc('Development Plan Tasks', 'Задачи плана развития'),
                description: vlc('Actionable tasks inside development plan stages.', 'Практические задачи внутри этапов плана развития.'),
                config: buildTransactionalObjectConfig({
                    prefix: 'DPT-',
                    effectiveDateField: 'UpdatedAt',
                    stateField: 'Status',
                    states: [
                        { codename: 'NotStarted', title: 'Not started', isInitial: true },
                        { codename: 'InProgress', title: 'In progress' },
                        { codename: 'Completed', title: 'Completed', isFinal: true },
                        { codename: 'Overdue', title: 'Overdue' }
                    ],
                    workflowActions: LMS_DEVELOPMENT_TASK_WORKFLOW_ACTIONS
                }),
                components: [
                    {
                        codename: 'StageId',
                        dataType: 'REF',
                        name: vlc('Development Stage', 'Этап развития'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'DevelopmentPlanStages',
                        targetEntityKind: 'object'
                    },
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayComponent: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 500, localized: true, versioned: true }
                    },
                    {
                        codename: 'ResourceId',
                        dataType: 'REF',
                        name: vlc('Resource', 'Ресурс'),
                        sortOrder: 3,
                        targetEntityCodename: 'LearningResources',
                        targetEntityKind: 'object'
                    },
                    {
                        codename: 'Status',
                        dataType: 'STRING',
                        name: vlc('Status', 'Статус'),
                        sortOrder: 4,
                        validationRules: { maxLength: 30 }
                    },
                    {
                        codename: 'UpdatedAt',
                        dataType: 'DATE',
                        name: vlc('Updated At', 'Обновлено'),
                        sortOrder: 5
                    }
                ]
            },
            {
                codename: 'NotificationRules',
                kind: 'object',
                name: vlc('Notification Rules', 'Правила уведомлений'),
                description: vlc(
                    'Generic notification rules triggered by modules and workflow events.',
                    'Универсальные правила уведомлений от модулей и workflow-событий.'
                ),
                components: [
                    {
                        codename: 'Name',
                        dataType: 'STRING',
                        name: vlc('Name', 'Название'),
                        isRequired: true,
                        isDisplayComponent: true,
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
                kind: 'object',
                name: vlc('Notification Outbox', 'Очередь уведомлений'),
                description: vlc(
                    'Module-generated notification events awaiting delivery.',
                    'События уведомлений от модулей, ожидающие доставки.'
                ),
                config: buildTransactionalObjectConfig({
                    prefix: 'NTF-',
                    effectiveDateField: 'CreatedAt',
                    stateField: 'Status',
                    states: [
                        { codename: 'Queued', title: 'Queued', isInitial: true },
                        { codename: 'Sent', title: 'Sent', isFinal: true },
                        { codename: 'Failed', title: 'Failed' },
                        { codename: 'Cancelled', title: 'Cancelled', isFinal: true }
                    ],
                    targetLedgers: ['NotificationLedger'],
                    workflowActions: LMS_NOTIFICATION_OUTBOX_WORKFLOW_ACTIONS
                }),
                components: [
                    {
                        codename: 'RuleId',
                        dataType: 'REF',
                        name: vlc('Notification Rule', 'Правило уведомления'),
                        sortOrder: 1,
                        targetEntityCodename: 'NotificationRules',
                        targetEntityKind: 'object'
                    },
                    {
                        codename: 'Recipient',
                        dataType: 'STRING',
                        name: vlc('Recipient', 'Получатель'),
                        isRequired: true,
                        isDisplayComponent: true,
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
                    },
                    {
                        codename: 'Status',
                        dataType: 'STRING',
                        name: vlc('Status', 'Статус'),
                        sortOrder: 5,
                        validationRules: { maxLength: 30 }
                    }
                ]
            },
            {
                codename: 'GamificationSettings',
                kind: 'object',
                name: vlc('Gamification Settings', 'Настройки геймификации'),
                description: vlc(
                    'Application and workspace-level gamification switches and leaderboard policy.',
                    'Настройки геймификации уровня приложения и рабочего пространства, включая политику рейтинга.'
                ),
                components: [
                    {
                        codename: 'Scope',
                        dataType: 'STRING',
                        name: vlc('Scope', 'Область'),
                        isRequired: true,
                        isDisplayComponent: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 64 }
                    },
                    {
                        codename: 'WorkspaceKey',
                        dataType: 'STRING',
                        name: vlc('Workspace Key', 'Ключ рабочего пространства'),
                        sortOrder: 2,
                        validationRules: { maxLength: 128 }
                    },
                    {
                        codename: 'Enabled',
                        dataType: 'BOOLEAN',
                        name: vlc('Enabled', 'Включено'),
                        sortOrder: 3
                    },
                    {
                        codename: 'LeaderboardPeriodDays',
                        dataType: 'NUMBER',
                        name: vlc('Leaderboard Period Days', 'Период рейтинга в днях'),
                        sortOrder: 4,
                        validationRules: { min: 1, max: 366 }
                    },
                    {
                        codename: 'Rules',
                        dataType: 'JSON',
                        name: vlc('Rules', 'Правила'),
                        sortOrder: 5
                    }
                ]
            },
            {
                codename: 'PointAwardRules',
                kind: 'object',
                name: vlc('Point Award Rules', 'Правила начисления баллов'),
                description: vlc(
                    'Declarative point award rules for learning resources, assignments, events, certificates, and manual adjustments.',
                    'Декларативные правила начисления баллов за учебные ресурсы, задания, мероприятия, сертификаты и ручные корректировки.'
                ),
                components: [
                    {
                        codename: 'RuleCode',
                        dataType: 'STRING',
                        name: vlc('Rule Code', 'Код правила'),
                        isRequired: true,
                        isDisplayComponent: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 128 }
                    },
                    {
                        codename: 'Name',
                        dataType: 'STRING',
                        name: vlc('Name', 'Название'),
                        isRequired: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 255, localized: true, versioned: true }
                    },
                    {
                        codename: 'SourceType',
                        dataType: 'REF',
                        name: vlc('Source Type', 'Тип источника'),
                        isRequired: true,
                        sortOrder: 3,
                        targetEntityCodename: 'PointSourceType',
                        targetEntityKind: 'enumeration'
                    },
                    {
                        codename: 'Points',
                        dataType: 'NUMBER',
                        name: vlc('Points', 'Баллы'),
                        isRequired: true,
                        sortOrder: 4
                    },
                    {
                        codename: 'IsActive',
                        dataType: 'BOOLEAN',
                        name: vlc('Is Active', 'Активно'),
                        sortOrder: 5
                    },
                    {
                        codename: 'Conditions',
                        dataType: 'JSON',
                        name: vlc('Conditions', 'Условия'),
                        sortOrder: 6
                    }
                ]
            },
            {
                codename: 'PointTransactions',
                kind: 'object',
                name: vlc('Point Transactions', 'Операции с баллами'),
                description: vlc(
                    'Auditable point awards and manual adjustments posted to the Points Ledger.',
                    'Проверяемые начисления и ручные корректировки баллов, проводимые в регистр баллов.'
                ),
                config: buildTransactionalObjectConfig({
                    prefix: 'PTS-',
                    effectiveDateField: 'AwardedAt',
                    stateField: 'Status',
                    states: [
                        { codename: 'Pending', title: 'Pending', isInitial: true },
                        { codename: 'Approved', title: 'Approved' },
                        { codename: 'Reversed', title: 'Reversed', isFinal: true }
                    ],
                    targetLedgers: ['PointsLedger'],
                    workflowActions: LMS_POINT_TRANSACTION_WORKFLOW_ACTIONS
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
                        codename: 'SourceType',
                        dataType: 'REF',
                        name: vlc('Source Type', 'Тип источника'),
                        isRequired: true,
                        sortOrder: 2,
                        targetEntityCodename: 'PointSourceType',
                        targetEntityKind: 'enumeration'
                    },
                    {
                        codename: 'SourceObjectId',
                        dataType: 'STRING',
                        name: vlc('Source Object ID', 'ID объекта-источника'),
                        sortOrder: 3,
                        validationRules: { maxLength: 255 }
                    },
                    {
                        codename: 'PointsDelta',
                        dataType: 'NUMBER',
                        name: vlc('Points Delta', 'Изменение баллов'),
                        isRequired: true,
                        sortOrder: 4
                    },
                    {
                        codename: 'Reason',
                        dataType: 'STRING',
                        name: vlc('Reason', 'Причина'),
                        sortOrder: 5,
                        validationRules: { localized: true, versioned: true }
                    },
                    {
                        codename: 'AwardedAt',
                        dataType: 'DATE',
                        name: vlc('Awarded At', 'Начислено'),
                        isRequired: true,
                        sortOrder: 6
                    },
                    {
                        codename: 'Status',
                        dataType: 'STRING',
                        name: vlc('Status', 'Статус'),
                        isRequired: true,
                        sortOrder: 7,
                        validationRules: { maxLength: 30 }
                    }
                ]
            },
            {
                codename: 'BadgeDefinitions',
                kind: 'object',
                name: vlc('Badge Definitions', 'Определения бейджей'),
                description: vlc(
                    'Reusable badge definitions and eligibility thresholds.',
                    'Переиспользуемые определения бейджей и пороги получения.'
                ),
                components: [
                    {
                        codename: 'BadgeCode',
                        dataType: 'STRING',
                        name: vlc('Badge Code', 'Код бейджа'),
                        isRequired: true,
                        isDisplayComponent: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 128 }
                    },
                    {
                        codename: 'Name',
                        dataType: 'STRING',
                        name: vlc('Name', 'Название'),
                        isRequired: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 255, localized: true, versioned: true }
                    },
                    {
                        codename: 'Description',
                        dataType: 'STRING',
                        name: vlc('Description', 'Описание'),
                        sortOrder: 3,
                        validationRules: { localized: true, versioned: true }
                    },
                    {
                        codename: 'RequiredPoints',
                        dataType: 'NUMBER',
                        name: vlc('Required Points', 'Требуемые баллы'),
                        sortOrder: 4,
                        validationRules: { min: 0 }
                    },
                    {
                        codename: 'Icon',
                        dataType: 'STRING',
                        name: vlc('Icon', 'Иконка'),
                        sortOrder: 5,
                        validationRules: { maxLength: 64 }
                    },
                    {
                        codename: 'IsActive',
                        dataType: 'BOOLEAN',
                        name: vlc('Is Active', 'Активно'),
                        sortOrder: 6
                    }
                ]
            },
            {
                codename: 'BadgeIssues',
                kind: 'object',
                name: vlc('Badge Issues', 'Выдачи бейджей'),
                description: vlc('Learner badge issue and revocation records.', 'Записи выдачи и отзыва бейджей учащихся.'),
                config: buildTransactionalObjectConfig({
                    prefix: 'BDG-',
                    effectiveDateField: 'IssuedAt',
                    stateField: 'Status',
                    states: [
                        { codename: 'Eligible', title: 'Eligible', isInitial: true },
                        { codename: 'Issued', title: 'Issued' },
                        { codename: 'Revoked', title: 'Revoked', isFinal: true }
                    ],
                    workflowActions: LMS_BADGE_ISSUE_WORKFLOW_ACTIONS
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
                        codename: 'BadgeId',
                        dataType: 'REF',
                        name: vlc('Badge', 'Бейдж'),
                        isRequired: true,
                        sortOrder: 2,
                        targetEntityCodename: 'BadgeDefinitions',
                        targetEntityKind: 'object'
                    },
                    {
                        codename: 'IssuedAt',
                        dataType: 'DATE',
                        name: vlc('Issued At', 'Выдан'),
                        isRequired: true,
                        sortOrder: 3
                    },
                    {
                        codename: 'RevokedAt',
                        dataType: 'DATE',
                        name: vlc('Revoked At', 'Отозван'),
                        sortOrder: 4
                    },
                    {
                        codename: 'Status',
                        dataType: 'STRING',
                        name: vlc('Status', 'Статус'),
                        isRequired: true,
                        sortOrder: 5,
                        validationRules: { maxLength: 30 }
                    },
                    {
                        codename: 'Reason',
                        dataType: 'STRING',
                        name: vlc('Reason', 'Причина'),
                        sortOrder: 6,
                        validationRules: { localized: true, versioned: true }
                    }
                ]
            },
            {
                codename: 'LeaderboardSnapshots',
                kind: 'object',
                name: vlc('Leaderboard Snapshots', 'Снимки рейтинга'),
                description: vlc(
                    'Deterministic leaderboard rows derived from point facts for learner-facing achievement pages.',
                    'Детерминированные строки рейтинга на основе фактов баллов для страниц достижений учащегося.'
                ),
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
                        codename: 'Period',
                        dataType: 'STRING',
                        name: vlc('Period', 'Период'),
                        isRequired: true,
                        isDisplayComponent: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 64 }
                    },
                    {
                        codename: 'TotalPoints',
                        dataType: 'NUMBER',
                        name: vlc('Total Points', 'Всего баллов'),
                        isRequired: true,
                        sortOrder: 3
                    },
                    {
                        codename: 'Rank',
                        dataType: 'NUMBER',
                        name: vlc('Rank', 'Место'),
                        isRequired: true,
                        sortOrder: 4,
                        validationRules: { min: 1 }
                    },
                    {
                        codename: 'BadgeCount',
                        dataType: 'NUMBER',
                        name: vlc('Badge Count', 'Количество бейджей'),
                        sortOrder: 5,
                        validationRules: { min: 0 }
                    },
                    {
                        codename: 'CalculatedAt',
                        dataType: 'DATE',
                        name: vlc('Calculated At', 'Рассчитано'),
                        sortOrder: 6
                    }
                ]
            },
            {
                codename: 'Reports',
                kind: 'object',
                name: vlc('Reports', 'Отчёты'),
                description: vlc(
                    'Reusable LMS report definitions for administrators and instructors.',
                    'Переиспользуемые определения отчётов LMS для администраторов и преподавателей.'
                ),
                components: [
                    {
                        codename: 'Name',
                        dataType: 'STRING',
                        name: vlc('Name', 'Название'),
                        isRequired: true,
                        isDisplayComponent: true,
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
                        sortOrder: 3,
                        uiConfig: { gridHidden: true }
                    },
                    {
                        codename: 'Definition',
                        dataType: 'JSON',
                        name: vlc('Definition', 'Определение'),
                        sortOrder: 4,
                        uiConfig: { gridHidden: true }
                    },
                    {
                        codename: 'SavedFilters',
                        dataType: 'JSON',
                        name: vlc('Saved Filters', 'Сохраненные фильтры'),
                        sortOrder: 5,
                        uiConfig: { gridHidden: true }
                    }
                ]
            },
            {
                codename: 'LearningResourceStatus',
                kind: 'enumeration',
                name: vlc('Learning Resource Status', 'Статус учебного ресурса'),
                description: vlc('Status values for learning resources.', 'Значения статуса учебных ресурсов.')
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
                description: vlc('Types of content items in learning resources.', 'Типы элементов контента в учебных ресурсах.')
            },
            {
                codename: 'ResourceType',
                kind: 'enumeration',
                name: vlc('Resource Type', 'Тип ресурса'),
                description: vlc('Generic resource types for learning content.', 'Универсальные типы ресурсов для учебного контента.')
            },
            {
                codename: 'PublicationStatus',
                kind: 'enumeration',
                name: vlc('Publication Status', 'Статус публикации'),
                description: vlc(
                    'Draft, published, unpublished-changes, and archived states for authored Learning Content.',
                    'Черновик, опубликовано, неопубликованные изменения и архив для авторского учебного контента.'
                )
            },
            {
                codename: 'CompletionStatus',
                kind: 'enumeration',
                name: vlc('Completion Status', 'Статус прохождения'),
                description: vlc(
                    'Generic completion states for resources, courses, tracks, and plans.',
                    'Универсальные статусы прохождения ресурсов, курсов, треков и планов.'
                )
            },
            {
                codename: 'AttemptStatus',
                kind: 'enumeration',
                name: vlc('Attempt Status', 'Статус попытки'),
                description: vlc(
                    'Attempt lifecycle states for quizzes and assessments.',
                    'Состояния жизненного цикла попыток тестов и оцениваний.'
                )
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
                codename: 'PointSourceType',
                kind: 'enumeration',
                name: vlc('Point Source Type', 'Тип источника баллов'),
                description: vlc(
                    'Source categories for gamification point rules and point transactions.',
                    'Категории источников для правил начисления и операций с баллами.'
                )
            },
            {
                codename: 'ReportType',
                kind: 'enumeration',
                name: vlc('Report Type', 'Тип отчета'),
                description: vlc('Report categories for LMS analytics.', 'Категории отчётов для аналитики LMS.')
            }
        ],
        optionValues: {
            LearningResourceStatus: [
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
                { codename: 'Xapi', name: vlc('xAPI package', 'Пакет xAPI'), sortOrder: 7 },
                { codename: 'Embed', name: vlc('Embed', 'Встраивание'), sortOrder: 8 },
                { codename: 'File', name: vlc('File', 'Файл'), sortOrder: 9 }
            ],
            PublicationStatus: [
                { codename: 'Draft', name: vlc('Draft', 'Черновик'), sortOrder: 1, isDefault: true },
                { codename: 'Published', name: vlc('Published', 'Опубликовано'), sortOrder: 2 },
                {
                    codename: 'UnpublishedChanges',
                    name: vlc('Unpublished Changes', 'Неопубликованные изменения'),
                    sortOrder: 3
                },
                { codename: 'Archived', name: vlc('Archived', 'Архив'), sortOrder: 4 }
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
            PointSourceType: [
                { codename: 'Course', name: vlc('Course', 'Курс'), sortOrder: 1 },
                { codename: 'Track', name: vlc('Track', 'Трек'), sortOrder: 2 },
                { codename: 'Assignment', name: vlc('Assignment', 'Задание'), sortOrder: 3 },
                { codename: 'TrainingEvent', name: vlc('Training Event', 'Учебное мероприятие'), sortOrder: 4 },
                { codename: 'Certificate', name: vlc('Certificate', 'Сертификат'), sortOrder: 5 },
                { codename: 'Manual', name: vlc('Manual Adjustment', 'Ручная корректировка'), sortOrder: 6, isDefault: true }
            ],
            ReportType: [
                { codename: 'Progress', name: vlc('Progress', 'Прогресс'), sortOrder: 1, isDefault: true },
                { codename: 'Enrollment', name: vlc('Enrollment', 'Записи'), sortOrder: 2 },
                { codename: 'QuizResults', name: vlc('Quiz Results', 'Результаты тестов'), sortOrder: 3 },
                { codename: 'Gamification', name: vlc('Gamification', 'Геймификация'), sortOrder: 4 }
            ]
        },
        modules: [
            {
                codename: 'EnrollmentPostingModule',
                name: vlc('Enrollment Posting Module', 'Модуль проведения записи'),
                description: vlc(
                    'Posts enrollment records into the generic Progress Ledger.',
                    'Проводит записи на обучение в универсальный регистр прогресса.'
                ),
                attachedToKind: 'object',
                attachedToEntityCodename: 'Enrollments',
                moduleRole: 'lifecycle',
                sourceKind: 'embedded',
                sdkApiVersion: '1.0.0',
                capabilities: ['records.read', 'metadata.read', 'lifecycle', 'posting', 'ledger.write'],
                sourceCode: LMS_ENROLLMENT_POSTING_MODULE_SOURCE
            },
            {
                codename: 'QuizAttemptPostingModule',
                name: vlc('Quiz Attempt Posting Module', 'Модуль проведения попытки теста'),
                description: vlc(
                    'Posts quiz attempt records into score and learning activity Ledgers.',
                    'Проводит попытки тестов в регистры оценок и учебной активности.'
                ),
                attachedToKind: 'object',
                attachedToEntityCodename: 'QuizAttempts',
                moduleRole: 'lifecycle',
                sourceKind: 'embedded',
                sdkApiVersion: '1.0.0',
                capabilities: ['records.read', 'metadata.read', 'lifecycle', 'posting', 'ledger.write'],
                sourceCode: LMS_QUIZ_ATTEMPT_POSTING_MODULE_SOURCE
            },
            {
                codename: 'ContentCompletionPostingModule',
                name: vlc('Content Completion Posting Module', 'Модуль проведения завершения контента'),
                description: vlc(
                    'Posts content completion progress records into the progress Ledger.',
                    'Проводит записи прогресса контента в регистр прогресса.'
                ),
                attachedToKind: 'object',
                attachedToEntityCodename: 'ContentProgress',
                moduleRole: 'lifecycle',
                sourceKind: 'embedded',
                sdkApiVersion: '1.0.0',
                capabilities: ['records.read', 'metadata.read', 'lifecycle', 'posting', 'ledger.write'],
                sourceCode: LMS_CONTENT_COMPLETION_POSTING_MODULE_SOURCE
            },
            {
                codename: 'CertificateIssuePostingModule',
                name: vlc('Certificate Issue Posting Module', 'Модуль проведения выдачи сертификата'),
                description: vlc(
                    'Posts certificate issue records into certificate and notification Ledgers.',
                    'Проводит выдачи сертификатов в регистры сертификатов и уведомлений.'
                ),
                attachedToKind: 'object',
                attachedToEntityCodename: 'CertificateIssues',
                moduleRole: 'lifecycle',
                sourceKind: 'embedded',
                sdkApiVersion: '1.0.0',
                capabilities: ['records.read', 'metadata.read', 'lifecycle', 'posting', 'ledger.write'],
                sourceCode: LMS_CERTIFICATE_ISSUE_POSTING_MODULE_SOURCE
            },
            {
                codename: 'PointTransactionPostingModule',
                name: vlc('Point Transaction Posting Module', 'Модуль проведения операций с баллами'),
                description: vlc(
                    'Posts manual point adjustments into the generic Points Ledger.',
                    'Проводит ручные корректировки баллов в универсальный регистр баллов.'
                ),
                attachedToKind: 'object',
                attachedToEntityCodename: 'PointTransactions',
                moduleRole: 'lifecycle',
                sourceKind: 'embedded',
                sdkApiVersion: '1.0.0',
                capabilities: ['records.read', 'metadata.read', 'lifecycle', 'posting', 'ledger.write'],
                sourceCode: LMS_POINT_TRANSACTION_POSTING_MODULE_SOURCE
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
            { key: 'entity.object.allowComponentCopy', value: { _value: true } },
            { key: 'entity.object.allowComponentDelete', value: { _value: true } },
            { key: 'entity.object.allowDeleteLastDisplayComponent', value: { _value: true } }
        ]
    }
}
