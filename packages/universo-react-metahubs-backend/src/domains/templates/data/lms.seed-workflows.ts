import type { WorkflowAction } from '@universo-react/types'
import { vlc } from './basic.template'

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

export const LMS_ASSIGNMENT_SUBMISSION_WORKFLOW_ACTIONS: WorkflowAction[] = [
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

export const LMS_LEARNING_RESOURCE_PUBLICATION_WORKFLOW_ACTIONS: WorkflowAction[] = [
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

export const LMS_TRAINING_ATTENDANCE_WORKFLOW_ACTIONS: WorkflowAction[] = [
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

export const LMS_CERTIFICATE_ISSUE_WORKFLOW_ACTIONS: WorkflowAction[] = [
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

export const LMS_DEVELOPMENT_TASK_WORKFLOW_ACTIONS: WorkflowAction[] = [
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

export const LMS_NOTIFICATION_OUTBOX_WORKFLOW_ACTIONS: WorkflowAction[] = [
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

export const LMS_POINT_TRANSACTION_WORKFLOW_ACTIONS: WorkflowAction[] = [
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

export const LMS_BADGE_ISSUE_WORKFLOW_ACTIONS: WorkflowAction[] = [
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
