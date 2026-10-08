export const LMS_ENROLLMENT_POSTING_MODULE_SOURCE = `import { ExtensionModule, OnEvent } from '@universo-react/extension-sdk'

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

export const LMS_QUIZ_ATTEMPT_POSTING_MODULE_SOURCE = `import { ExtensionModule, OnEvent } from '@universo-react/extension-sdk'

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

export const LMS_CONTENT_COMPLETION_POSTING_MODULE_SOURCE = `import { ExtensionModule, OnEvent } from '@universo-react/extension-sdk'

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

export const LMS_CERTIFICATE_ISSUE_POSTING_MODULE_SOURCE = `import { ExtensionModule, OnEvent } from '@universo-react/extension-sdk'

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

export const LMS_POINT_TRANSACTION_POSTING_MODULE_SOURCE = `import { ExtensionModule, OnEvent } from '@universo-react/extension-sdk'

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
