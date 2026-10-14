export const REQUIRED_ENTITY_CODENAMES = [
    'LearnerHome',
    'CourseOverview',
    'KnowledgeHome',
    'KnowledgeArticle',
    'DevelopmentHome',
    'AssignmentInstructions',
    'CertificatePolicy',
    'Classes',
    'Students',
    'Departments',
    'ContentProjects',
    'ContentAccessEntries',
    'ContentStars',
    'RecentContentViews',
    'ContentProgress',
    'TrashEntries',
    'LearningContentDefaults',
    'SupportedResourceTypes',
    'PlayerPresets',
    'LearningContentColumnPresets',
    'EnrollmentDefaults',
    'CompletionDefaults',
    'LearningResources',
    'Courses',
    'CourseSections',
    'CourseItems',
    'LearningTracks',
    'TrackStages',
    'TrackSteps',
    'Quizzes',
    'QuizResponses',
    'QuizAttempts',
    'LearningActivityLedger',
    'ProgressLedger',
    'ScoreLedger',
    'EnrollmentLedger',
    'AttendanceLedger',
    'CertificateLedger',
    'PointsLedger',
    'NotificationLedger',
    'ContentProgress',
    'AccessLinks',
    'Enrollments',
    'Assignments',
    'AssignmentSubmissions',
    'TrainingEvents',
    'TrainingAttendance',
    'Certificates',
    'CertificateIssues',
    'KnowledgeSpaces',
    'KnowledgeFolders',
    'KnowledgeArticles',
    'KnowledgeBookmarks',
    'DevelopmentPlans',
    'DevelopmentPlanStages',
    'DevelopmentPlanTasks',
    'NotificationRules',
    'NotificationOutbox',
    'GamificationSettings',
    'PointAwardRules',
    'PointTransactions',
    'BadgeDefinitions',
    'BadgeIssues',
    'LeaderboardSnapshots',
    'Reports',
    'ResourceType',
    'PublicationStatus',
    'CompletionStatus',
    'AttemptStatus',
    'AssignmentReviewStatus',
    'TrainingAttendanceStatus',
    'AssignmentStatus',
    'TrainingEventType',
    'CertificateStatus',
    'PointSourceType',
    'ReportType'
]

export type RequiredWorkflowAction = {
    entityCodename: string
    actionCodename: string
    from: string[]
    to: string
    statusFieldCodename?: string
    requiredCapabilities: string[]
    postingCommand?: 'post' | 'unpost' | 'void'
    moduleCodename?: string
}

export const REQUIRED_WORKFLOW_ACTIONS: RequiredWorkflowAction[] = [
    {
        entityCodename: 'LearningResources',
        actionCodename: 'PublishLearningResource',
        from: ['Draft', 'UnpublishedChanges'],
        to: 'Published',
        statusFieldCodename: 'PublicationStatus',
        requiredCapabilities: ['workflow.execute']
    },
    {
        entityCodename: 'LearningResources',
        actionCodename: 'ReturnLearningResourceToDraft',
        from: ['Published', 'UnpublishedChanges'],
        to: 'Draft',
        statusFieldCodename: 'PublicationStatus',
        requiredCapabilities: ['workflow.execute']
    },
    {
        entityCodename: 'LearningResources',
        actionCodename: 'MarkLearningResourceChanged',
        from: ['Published'],
        to: 'UnpublishedChanges',
        statusFieldCodename: 'PublicationStatus',
        requiredCapabilities: ['workflow.execute']
    },
    {
        entityCodename: 'AssignmentSubmissions',
        actionCodename: 'StartSubmissionReview',
        from: ['Submitted'],
        to: 'PendingReview',
        requiredCapabilities: ['assignment.review']
    },
    {
        entityCodename: 'AssignmentSubmissions',
        actionCodename: 'AcceptSubmission',
        from: ['PendingReview'],
        to: 'Accepted',
        requiredCapabilities: ['assignment.review'],
        postingCommand: 'post'
    },
    {
        entityCodename: 'AssignmentSubmissions',
        actionCodename: 'DeclineSubmission',
        from: ['PendingReview'],
        to: 'Declined',
        requiredCapabilities: ['assignment.review']
    },
    {
        entityCodename: 'TrainingAttendance',
        actionCodename: 'MarkAttendanceAttended',
        from: ['Registered'],
        to: 'Attended',
        requiredCapabilities: ['attendance.mark'],
        postingCommand: 'post'
    },
    {
        entityCodename: 'TrainingAttendance',
        actionCodename: 'MarkAttendanceNoShow',
        from: ['Registered'],
        to: 'NoShow',
        requiredCapabilities: ['attendance.mark'],
        postingCommand: 'post'
    },
    {
        entityCodename: 'TrainingAttendance',
        actionCodename: 'CancelAttendance',
        from: ['Registered', 'Attended', 'NoShow'],
        to: 'Cancelled',
        requiredCapabilities: ['attendance.manage'],
        postingCommand: 'void'
    },
    {
        entityCodename: 'CertificateIssues',
        actionCodename: 'IssueCertificate',
        from: ['Eligible'],
        to: 'Issued',
        requiredCapabilities: ['certificate.issue'],
        postingCommand: 'post',
        moduleCodename: 'CertificateIssuePostingModule'
    },
    {
        entityCodename: 'CertificateIssues',
        actionCodename: 'RevokeCertificate',
        from: ['Issued'],
        to: 'Revoked',
        requiredCapabilities: ['certificate.revoke'],
        postingCommand: 'post',
        moduleCodename: 'CertificateIssuePostingModule'
    },
    {
        entityCodename: 'DevelopmentPlanTasks',
        actionCodename: 'StartDevelopmentTask',
        from: ['NotStarted'],
        to: 'InProgress',
        requiredCapabilities: ['development.task.update']
    },
    {
        entityCodename: 'DevelopmentPlanTasks',
        actionCodename: 'CompleteDevelopmentTask',
        from: ['InProgress'],
        to: 'Completed',
        requiredCapabilities: ['development.task.update']
    },
    {
        entityCodename: 'DevelopmentPlanTasks',
        actionCodename: 'ReopenDevelopmentTask',
        from: ['Completed'],
        to: 'InProgress',
        requiredCapabilities: ['development.task.update']
    },
    {
        entityCodename: 'NotificationOutbox',
        actionCodename: 'MarkNotificationSent',
        from: ['Queued', 'Failed'],
        to: 'Sent',
        requiredCapabilities: ['notification.deliver'],
        postingCommand: 'post'
    },
    {
        entityCodename: 'NotificationOutbox',
        actionCodename: 'MarkNotificationFailed',
        from: ['Queued'],
        to: 'Failed',
        requiredCapabilities: ['notification.deliver']
    },
    {
        entityCodename: 'NotificationOutbox',
        actionCodename: 'CancelNotification',
        from: ['Queued', 'Failed'],
        to: 'Cancelled',
        requiredCapabilities: ['notification.manage'],
        postingCommand: 'void'
    },
    {
        entityCodename: 'PointTransactions',
        actionCodename: 'ApprovePointAdjustment',
        from: ['Pending'],
        to: 'Approved',
        requiredCapabilities: ['gamification.points.adjust'],
        postingCommand: 'post',
        moduleCodename: 'PointTransactionPostingModule'
    },
    {
        entityCodename: 'PointTransactions',
        actionCodename: 'ReversePointAdjustment',
        from: ['Approved'],
        to: 'Reversed',
        requiredCapabilities: ['gamification.points.adjust'],
        postingCommand: 'void',
        moduleCodename: 'PointTransactionPostingModule'
    },
    {
        entityCodename: 'BadgeIssues',
        actionCodename: 'IssueBadge',
        from: ['Eligible'],
        to: 'Issued',
        requiredCapabilities: ['badge.issue']
    },
    {
        entityCodename: 'BadgeIssues',
        actionCodename: 'RevokeBadge',
        from: ['Issued'],
        to: 'Revoked',
        requiredCapabilities: ['badge.revoke']
    }
] as const

export const REQUIRED_BASIC_BASELINE_ENTITIES = [
    { kind: 'hub', name: 'Main' },
    { kind: 'object', name: 'Main' },
    { kind: 'set', name: 'Main' },
    { kind: 'enumeration', name: 'Main' }
] as const
