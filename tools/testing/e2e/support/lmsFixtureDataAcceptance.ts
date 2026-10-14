import { lmsAcceptanceMatrixSchema } from '@universo-react/types'

const acceptanceGates = (
    gates: Partial<{
        seeded: boolean
        visible: boolean
        actionable: boolean
        audited: boolean
        'workspace-isolated': boolean
        'covered-by-e2e': boolean
    }> = {}
) => ({
    seeded: false,
    visible: false,
    actionable: false,
    audited: false,
    'workspace-isolated': false,
    'covered-by-e2e': false,
    ...gates
})

export const LMS_PRODUCT_ACCEPTANCE_MATRIX = lmsAcceptanceMatrixSchema.parse([
    {
        area: 'learnerHome',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['LearnerHome', 'LearningResources', 'Courses', 'ContentProgress'],
        requiredStatuses: ['NotStarted', 'InProgress', 'Completed'],
        evidence: ['snapshot-import-lms-runtime flow opens learner home and public content progress'],
        browserEvidence: ['snapshot-import-lms-runtime opens learner home and verifies public content progress'],
        gaps: [
            'Deferred beyond current Learning Content release scope: learner-home activity is not yet written to a dedicated audit ledger'
        ]
    },
    {
        area: 'contentLibrary',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['ContentProjects', 'LearningResources', 'Courses', 'CourseSections', 'CourseItems', 'KnowledgeArticles'],
        requiredStatuses: ['Published'],
        evidence: ['resource source contract, app-side block authoring, and runtime preview tests cover early safe resource types'],
        browserEvidence: [
            'snapshot-import-lms-runtime creates Page, Link, Project, and Knowledge Article content through the published app'
        ],
        fixtureEvidence: ['resource source and block-content fixture contracts cover supported early resource types'],
        gaps: [
            'Deferred beyond current Learning Content release scope: broad package ingestion for SCORM, xAPI, Office, and advanced media'
        ]
    },
    {
        area: 'contentProjects',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['ContentProjects', 'ContentAccessEntries', 'ContentStars', 'RecentContentViews'],
        browserEvidence: [
            'snapshot-import-lms-runtime opens the Projects-backed Learning Content library and verifies project create defaults'
        ],
        evidence: [
            'Learning Content V2 metadata seeds workspace-scoped project containers and the Playwright flow opens the Projects-backed library view'
        ]
    },
    {
        area: 'learningContentShell',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['ContentProjects', 'KnowledgeArticles', 'LearningResources', 'Courses', 'LearningTracks', 'TrashEntries'],
        browserEvidence: [
            'snapshot-import-lms-runtime captures the entity-backed Knowledge Articles table and Library, Recent, Starred, Shared with me, and Trash runtime views'
        ],
        evidence: [
            'Primary LMS navigation targets ContentProjects, KnowledgeArticles, and LearningResources',
            'snapshot-import-lms-runtime captures Knowledge Articles, Learning Content, Recent, Starred, Shared with me, and Trash screenshots'
        ]
    },
    {
        area: 'standalonePageAuthoring',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['LearningResources'],
        requiredStatuses: ['Draft', 'Published'],
        browserEvidence: ['snapshot-import-lms-runtime creates and edits block-authored Page content through the published app runtime'],
        evidence: [
            'LearningResources.Body uses the shared Editor.js block-content field',
            'snapshot-import-lms-runtime creates and edits block-authored content through the published app runtime'
        ]
    },
    {
        area: 'standaloneLinkResources',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['LearningResources', 'ResourceType'],
        browserEvidence: ['snapshot-import-lms-runtime validates Link authoring and RU unsafe URL validation in the published app runtime'],
        fixtureEvidence: ['resource-source fixture contract validates safe URL-backed resource metadata'],
        evidence: [
            'Shared resource-source contract validates safe URL-backed resources',
            'Resource preview unit coverage verifies URL-backed and deferred resource states without LMS-specific widgets'
        ]
    },
    {
        area: 'courseDetail',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['CourseOverview', 'Courses', 'CourseSections', 'CourseItems', 'LearningResources'],
        requiredStatuses: ['Published'],
        browserEvidence: [
            'snapshot-import-lms-runtime captures first-class Course Builder tabs, bound child tables, reports, and ordering proof'
        ],
        evidence: [
            'course overview page and published-app authoring flows create content resources through the LMS fixture',
            'CourseSections and CourseItems have scoped generic ordering layouts backed by SortOrder',
            'snapshot-import-lms-runtime captures first-class Course Builder tabs, bound child tables, reports, and ordering proof'
        ]
    },
    {
        area: 'courseBuilder',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['Courses', 'CourseSections', 'CourseItems', 'LearningResources'],
        requiredReports: ['LearningContentSummary', 'LearnerProgress'],
        requiredStatuses: ['Draft', 'Published'],
        browserEvidence: [
            'snapshot-import-lms-runtime verifies Course Builder first-class tabs, bound child tables, reports, and outline reordering'
        ],
        evidence: [
            'CourseItems is the canonical Course -> Section -> Content item model',
            'CourseSections and CourseItems are source-managed through neutral record-set bindings on first-class detailsTable placements',
            'Generic details tables can persist CourseSections and CourseItems order through the runtime reorder endpoint',
            'Course Builder is organized through detailsTabs whose child widgets are separate parent_widget_id/slot_key placements',
            'snapshot-import-lms-runtime verifies builder tabs, bound child tables, saved reports, and outline reordering'
        ]
    },
    {
        area: 'learningTrackProgression',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['LearningTracks', 'TrackStages', 'TrackSteps', 'Courses', 'Enrollments', 'ProgressLedger'],
        requiredStatuses: ['NotStarted', 'InProgress', 'Completed', 'Overdue', 'Expired'],
        browserEvidence: ['snapshot-import-lms-runtime verifies track runtime progression and guest progress flows'],
        evidence: ['guest content flow writes progress and direct ledger facts are verified in LMS runtime E2E']
    },
    {
        area: 'trackBuilder',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['LearningTracks', 'TrackStages', 'TrackSteps', 'Courses'],
        requiredReports: ['LearningContentSummary', 'LearnerProgress'],
        browserEvidence: [
            'snapshot-import-lms-runtime verifies Track Builder first-class tabs, bound child tables, reports, and outline reordering'
        ],
        evidence: [
            'TrackStages and course-centered TrackSteps are present in the canonical metadata model',
            'TrackStages and TrackSteps are source-managed through neutral record-set bindings on first-class detailsTable placements',
            'Generic details tables can persist TrackStages and TrackSteps order through the runtime reorder endpoint',
            'Track Builder is organized through detailsTabs whose child widgets are separate parent_widget_id/slot_key placements',
            'snapshot-import-lms-runtime verifies builder tabs, bound child tables, saved reports, and outline reordering'
        ]
    },
    {
        area: 'manualEnrollment',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['Enrollments', 'Students', 'Courses', 'LearningTracks'],
        requiredStatuses: ['NotStarted', 'InProgress', 'Completed', 'Overdue'],
        browserEvidence: [
            'snapshot-import-lms-runtime verifies My Courses and My Tracks against the actor-scoped shared Enrollments Object'
        ],
        evidence: [
            'Course and Track enrollments remain ordinary runtime records in the shared Enrollments Object',
            'Seeded enrollment rows use the runtime current-user token for learner-scoped assignment ownership',
            'snapshot-import-lms-runtime verifies enrollment runtime records and posting/unposting ledger behavior independently of builder composition'
        ]
    },
    {
        area: 'learnerPlayer',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['Courses', 'CourseItems', 'LearningTracks', 'TrackSteps', 'LearnerHome', 'ContentProgress'],
        requiredStatuses: ['NotStarted', 'InProgress', 'Completed'],
        browserEvidence: [
            'snapshot-import-lms-runtime verifies registry-bound course and track learnerPlayer sequencing and persisted progress, plus guest completion flows'
        ],
        evidence: [
            'CourseItems and TrackSteps keep generic runtime progress sequence policies in Entity metadata',
            'Course and Track learnerPlayer placements bind parent record sets and parent-scoped item relation sets through the registry',
            'Published learning pages, learnerPlayer flows, and guest flows persist progress through the shared runtime progress endpoint'
        ]
    },
    {
        area: 'trashRestore',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['TrashEntries'],
        browserEvidence: [
            'snapshot-import-lms-runtime captures Trash and restore-target picker flows in the workspace-scoped Learning Content runtime'
        ],
        evidence: [
            'Runtime delete uses existing lifecycle fields and TrashEntries projects restore metadata',
            'Runtime restore endpoint and generic Trash restore action are covered by focused runtime tests',
            'snapshot-import-lms-runtime captures the workspace-scoped Learning Content Trash view'
        ]
    },
    {
        area: 'assignmentSubmissionAndGrading',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': false
        }),
        requiredEntities: ['Assignments', 'AssignmentSubmissions'],
        requiredStatuses: ['NotStarted', 'PendingReview', 'Declined', 'Accepted'],
        apiEvidence: ['backend and runtime workflow command tests cover assignment review, accept, and decline transitions'],
        evidence: ['backend and runtime workflow command tests cover review, accept, and decline transitions'],
        gaps: [
            'Deferred beyond current Learning Content release scope: browser proof for creating assignment prerequisites entirely through the published UI'
        ]
    },
    {
        area: 'trainingAttendance',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': false
        }),
        requiredEntities: ['TrainingEvents', 'TrainingAttendance', 'AttendanceLedger'],
        requiredStatuses: ['Registered', 'Attended', 'NoShow', 'Cancelled'],
        apiEvidence: ['backend and runtime workflow command tests cover training attendance, no-show, and cancellation transitions'],
        evidence: ['backend and runtime workflow command tests cover attended, no-show, and cancellation transitions'],
        gaps: [
            'Deferred beyond current Learning Content release scope: browser proof for creating training-event prerequisites entirely through the published UI'
        ]
    },
    {
        area: 'certificateIssue',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': false
        }),
        requiredEntities: ['Certificates', 'CertificateIssues', 'CertificateLedger'],
        requiredStatuses: ['Eligible', 'Issued', 'Revoked', 'Expired'],
        apiEvidence: ['backend and runtime workflow command tests cover certificate issue and revoke transitions'],
        evidence: ['backend and runtime workflow command tests cover certificate issue and revoke transitions'],
        gaps: [
            'Deferred beyond current Learning Content release scope: browser proof for creating certificate prerequisites entirely through the published UI'
        ]
    },
    {
        area: 'reports',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['Reports'],
        requiredReports: ['LearnerProgress', 'LearningContentSummary'],
        browserEvidence: [
            'snapshot-import-lms-runtime runs and exports the primary Learning Content summary report through the Reports UI'
        ],
        apiEvidence: [
            'runtime report route tests verify saved-definition-only execution, permissions, safe records.union output, and CSV export'
        ],
        evidence: [
            'generic saved report definitions execute through runtime reports API in LMS E2E',
            'runtime report route tests verify saved-definition-only execution, permission checks, safe records.union output, and CSV export without runtime identifiers'
        ],
        gaps: ['Deferred beyond current Learning Content release scope: saved-filter management and scheduled report delivery']
    },
    {
        area: 'knowledgeBase',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: [
            'KnowledgeHome',
            'KnowledgeSpaces',
            'KnowledgeFolders',
            'KnowledgeArticles',
            'KnowledgeBookmarks',
            'KnowledgeArticle'
        ],
        evidence: [
            'Knowledge navigation targets the authored KnowledgeArticles object surface and no longer points to surrogate collections',
            'snapshot-import-lms-runtime creates and edits Knowledge Articles through the published application CRUD surface',
            'fixture contract validates KnowledgeSpaces, KnowledgeFolders, KnowledgeArticles, and article-targeted KnowledgeBookmarks seed rows',
            'generic runtime mutation and Learning Content trash/restore coverage provide the current auditable lifecycle boundary for authored knowledge records'
        ],
        browserEvidence: [
            'snapshot-import-lms-runtime creates and edits Knowledge Articles through the published application CRUD surface'
        ],
        fixtureEvidence: [
            'fixture contract validates KnowledgeSpaces, KnowledgeFolders, KnowledgeArticles, and article-targeted KnowledgeBookmarks seed rows'
        ],
        gaps: [
            'Deferred beyond current Learning Content release scope: Knowledge bookmark UI and permission-limited search product capabilities'
        ]
    },
    {
        area: 'developmentPlan',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': false
        }),
        requiredEntities: ['DevelopmentHome', 'DevelopmentPlans', 'DevelopmentPlanStages', 'DevelopmentPlanTasks'],
        apiEvidence: ['backend and runtime workflow command tests cover development task start, complete, and reopen transitions'],
        evidence: ['backend and runtime workflow command tests cover development task start, complete, and reopen transitions'],
        gaps: [
            'Deferred beyond current Learning Content release scope: browser proof for creating development-plan prerequisites entirely through the published UI',
            'Deferred beyond current Learning Content release scope: mentor comments and export on generic scoped collaboration primitives'
        ]
    },
    {
        area: 'roleVisibility',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['Students', 'Departments', 'Classes'],
        browserEvidence: ['snapshot-import-lms-runtime verifies owner/shared Learning Content access behavior in published runtime views'],
        apiEvidence: ['backend route tests verify owner/shared predicates and fail-closed unsupported scoped role policies'],
        evidence: [
            'Learning Content resources, courses, and tracks use generic owner-or-shared runtimeRecordAccess backed by ContentAccessEntries',
            'backend runtime route tests verify read-only members receive owner/shared predicates before rows are returned',
            'unsupported recordOwner, department, class, and group role-policy allow rules are downgraded and tested fail-closed in backend and application settings UI'
        ],
        gaps: [
            'Deferred beyond current Learning Content release scope: department, class, and group predicates beyond the current workspace plus owner/shared visibility scope'
        ]
    },
    {
        area: 'workspaceIsolation',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['Students', 'Departments', 'Classes'],
        browserEvidence: ['snapshot-import-lms-runtime verifies imported LMS runtime rows with workspace context and workspace navigation'],
        evidence: ['runtime workspaces and imported LMS runtime rows are verified with workspace context']
    },
    {
        area: 'publicGuestAccess',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['AccessLinks', 'LearningResources', 'QuizAttempts', 'ProgressLedger'],
        requiredStatuses: ['Completed'],
        browserEvidence: ['snapshot-import-lms-runtime verifies public guest session, progress, quiz submit, and completion flows'],
        evidence: ['public guest session, progress, quiz submit, and completion flow pass in LMS runtime E2E']
    }
])
