import { z } from 'zod'
import { runtimeDatasourceDescriptorSchema } from './runtimeDataSources'
import { RESOURCE_TYPES, resourceSourceSchema } from './resourceSources'
import { roleCapabilityRuleSchema } from './workflowActions'

export { RESOURCE_LAUNCH_MODES, RESOURCE_TYPES, resourceSourceSchema } from './resourceSources'
export type { ResourceLaunchMode, ResourceSource, ResourceType } from './resourceSources'

export const localizedContractTextSchema = z.union([z.string().trim().min(1).max(240), z.record(z.string(), z.unknown())])
export type LocalizedContractText = z.infer<typeof localizedContractTextSchema>

const codenameSchema = z.string().trim().min(1).max(128)
const isoDateStringSchema = z.string().datetime()
const uuidSchema = z.string().uuid()
const optionalLocalizedLongTextSchema = z.union([z.string().trim().max(5000), z.record(z.string(), z.unknown())]).optional()

export const CONTENT_ITEM_TYPES = ['page', 'link', 'quiz', 'assignment', 'course', 'learningTrack', 'training', 'file', 'external'] as const
export type ContentItemType = (typeof CONTENT_ITEM_TYPES)[number]

export const PROJECT_ACCESS_LEVELS = ['canView', 'canEdit'] as const
export type ProjectAccessLevel = (typeof PROJECT_ACCESS_LEVELS)[number]

export const CONTENT_PRINCIPAL_TYPES = ['workspaceMember', 'user', 'group', 'department', 'class'] as const
export type ContentPrincipalType = (typeof CONTENT_PRINCIPAL_TYPES)[number]

export const PUBLICATION_STATUSES = ['draft', 'published', 'unpublishedChanges', 'archived'] as const
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number]

export const COURSE_NAVIGATION_MODES = ['free', 'sequential'] as const
export type CourseNavigationMode = (typeof COURSE_NAVIGATION_MODES)[number]

export const COURSE_COMPLETION_CONDITIONS = ['allItems', 'selectedItems'] as const
export type CourseCompletionCondition = (typeof COURSE_COMPLETION_CONDITIONS)[number]

export const COURSE_STATUS_FORMATS = ['completeIncomplete', 'passedFailed'] as const
export type CourseStatusFormat = (typeof COURSE_STATUS_FORMATS)[number]

export const TRACK_ORDER_MODES = ['byDays', 'sequential', 'free'] as const
export type TrackOrderMode = (typeof TRACK_ORDER_MODES)[number]

export const ENROLLMENT_STATUSES = ['notStarted', 'inProgress', 'completed', 'failed', 'overdue', 'canceled'] as const
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number]

export const DUE_DATE_MODES = ['useSettings', 'byDate', 'forPeriod', 'noDueDate'] as const
export type DueDateMode = (typeof DUE_DATE_MODES)[number]

export const TRASH_RESTORE_STATES = ['restorable', 'requiresTarget', 'expired', 'notRestorable'] as const
export type TrashRestoreState = (typeof TRASH_RESTORE_STATES)[number]

export const CATALOG_SELF_ENROLLMENT_MODES = ['disabled', 'open'] as const
export type CatalogSelfEnrollmentMode = (typeof CATALOG_SELF_ENROLLMENT_MODES)[number]

export const runtimeContentRefSchema = z
    .object({
        objectCodename: codenameSchema,
        recordId: uuidSchema,
        displayType: z.enum(CONTENT_ITEM_TYPES).optional(),
        title: localizedContractTextSchema.optional()
    })
    .strict()
export type RuntimeContentRef = z.infer<typeof runtimeContentRefSchema>

export const contentProjectSchema = z
    .object({
        id: uuidSchema.optional(),
        title: localizedContractTextSchema,
        description: optionalLocalizedLongTextSchema,
        ownerUserId: uuidSchema.optional(),
        accessMode: z.enum(['private', 'shared', 'workspace']).default('workspace'),
        cover: resourceSourceSchema.optional(),
        sortOrder: z.number().finite().optional(),
        archivedAt: isoDateStringSchema.nullable().optional()
    })
    .strict()
export type ContentProject = z.infer<typeof contentProjectSchema>

export const contentAccessEntrySchema = z
    .object({
        target: runtimeContentRefSchema,
        principalType: z.enum(CONTENT_PRINCIPAL_TYPES),
        principalId: uuidSchema,
        accessLevel: z.enum(PROJECT_ACCESS_LEVELS),
        invitedBy: uuidSchema.optional(),
        invitedAt: isoDateStringSchema.optional()
    })
    .strict()
    .superRefine((value, ctx) => {
        if (value.principalType !== 'workspaceMember' && value.principalType !== 'user') {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Only workspace member and user principals are supported until scoped predicates are implemented.',
                path: ['principalType']
            })
        }
    })
export type ContentAccessEntry = z.infer<typeof contentAccessEntrySchema>

export const contentStarSchema = z
    .object({
        target: runtimeContentRefSchema,
        userId: uuidSchema,
        starredAt: isoDateStringSchema
    })
    .strict()
export type ContentStar = z.infer<typeof contentStarSchema>

export const recentContentViewSchema = z
    .object({
        target: runtimeContentRefSchema,
        userId: uuidSchema,
        viewedAt: isoDateStringSchema,
        workspaceId: uuidSchema.optional()
    })
    .strict()
export type RecentContentView = z.infer<typeof recentContentViewSchema>

export const trashEntrySchema = z
    .object({
        target: runtimeContentRefSchema,
        deletedBy: uuidSchema,
        deletedAt: isoDateStringSchema,
        expiresAt: isoDateStringSchema.optional(),
        restoreState: z.enum(TRASH_RESTORE_STATES).default('restorable'),
        projectId: uuidSchema.optional(),
        reason: z.string().trim().max(500).optional()
    })
    .strict()
export type TrashEntry = z.infer<typeof trashEntrySchema>

export const catalogPublicationPolicySchema = z
    .object({
        visible: z.boolean().default(false),
        category: localizedContractTextSchema.optional(),
        audience: localizedContractTextSchema.optional(),
        selfEnrollmentMode: z.enum(CATALOG_SELF_ENROLLMENT_MODES).default('disabled')
    })
    .strict()
export type CatalogPublicationPolicy = z.infer<typeof catalogPublicationPolicySchema>

export const courseCompletionPolicySchema = z
    .object({
        navigationMode: z.enum(COURSE_NAVIGATION_MODES).default('free'),
        completionCondition: z.enum(COURSE_COMPLETION_CONDITIONS).default('allItems'),
        statusFormat: z.enum(COURSE_STATUS_FORMATS).default('completeIncomplete'),
        selectedItemIds: z.array(uuidSchema).max(500).default([]),
        requiredOnly: z.boolean().default(false),
        passingScorePercent: z.number().min(0).max(100).optional()
    })
    .strict()
export type CourseCompletionPolicy = z.infer<typeof courseCompletionPolicySchema>

export const trackOrderPolicySchema = z
    .object({
        orderMode: z.enum(TRACK_ORDER_MODES).default('free'),
        restrictAfterDueDate: z.boolean().default(false),
        defaultEnrollmentOffsetDays: z.number().int().min(0).max(3650).optional(),
        defaultDueOffsetDays: z.number().int().min(0).max(3650).optional()
    })
    .strict()
export type TrackOrderPolicy = z.infer<typeof trackOrderPolicySchema>

export const playerPresetSchema = z
    .object({
        codename: codenameSchema,
        title: localizedContractTextSchema,
        showOutline: z.boolean().default(true),
        showProgressHeader: z.boolean().default(true),
        allowResume: z.boolean().default(true),
        allowResourcePreview: z.boolean().default(true),
        completeButtonMode: z.enum(['manual', 'autoAfterOpen', 'hidden']).default('manual')
    })
    .strict()
export type PlayerPreset = z.infer<typeof playerPresetSchema>

export const learningContentColumnPresetSchema = z
    .object({
        codename: codenameSchema,
        title: localizedContractTextSchema,
        columns: z
            .array(
                z
                    .object({
                        field: codenameSchema,
                        visible: z.boolean().default(true),
                        width: z.number().int().min(60).max(1000).optional(),
                        flex: z.number().min(0).max(10).optional(),
                        sort: z.enum(['asc', 'desc']).optional()
                    })
                    .strict()
            )
            .min(1)
            .max(64)
    })
    .strict()
export type LearningContentColumnPreset = z.infer<typeof learningContentColumnPresetSchema>

export const learningContentDefaultViewModes = ['table', 'cards'] as const
export type LearningContentDefaultViewMode = (typeof learningContentDefaultViewModes)[number]

export const supportedResourceTypeSettingSchema = z
    .object({
        resourceType: z.enum(RESOURCE_TYPES),
        enabled: z.boolean().default(true),
        deferred: z.boolean().default(false),
        label: localizedContractTextSchema.optional()
    })
    .strict()
export type SupportedResourceTypeSetting = z.infer<typeof supportedResourceTypeSettingSchema>

export const learningContentProgressStoreSchema = z
    .object({
        enabled: z.boolean().default(true),
        objectCodename: codenameSchema.default('ContentProgress'),
        targetObjectCodenameField: codenameSchema.default('TargetObjectCodename'),
        targetRecordIdField: codenameSchema.default('TargetRecordId'),
        userIdField: codenameSchema.default('UserId'),
        statusField: codenameSchema.default('ProgressStatus'),
        progressPercentField: codenameSchema.default('ProgressPercent'),
        startedAtField: codenameSchema.default('StartedAt'),
        completedAtField: codenameSchema.default('CompletedAt'),
        lastViewedAtField: codenameSchema.default('LastViewedAt')
    })
    .strict()
export type LearningContentProgressStore = z.infer<typeof learningContentProgressStoreSchema>

export const applicationLearningContentSettingsSchema = z
    .object({
        supportedResourceTypes: z.array(supportedResourceTypeSettingSchema).max(RESOURCE_TYPES.length).default([]),
        defaultView: z.enum(learningContentDefaultViewModes).default('table'),
        courseCompletionPolicy: courseCompletionPolicySchema.default({}),
        trackOrderPolicy: trackOrderPolicySchema.default({}),
        playerPreset: playerPresetSchema.optional(),
        columnPreset: learningContentColumnPresetSchema.optional(),
        progressStore: learningContentProgressStoreSchema.default({})
    })
    .strict()
    .superRefine((value, ctx) => {
        const seen = new Set<string>()
        value.supportedResourceTypes.forEach((item, index) => {
            if (seen.has(item.resourceType)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Resource type settings must be unique.',
                    path: ['supportedResourceTypes', index, 'resourceType']
                })
            }
            seen.add(item.resourceType)
        })
    })
export type ApplicationLearningContentSettings = z.infer<typeof applicationLearningContentSettingsSchema>

export const DEFAULT_LEARNING_CONTENT_RESOURCE_TYPE_SETTINGS: SupportedResourceTypeSetting[] = RESOURCE_TYPES.map((resourceType) => ({
    resourceType,
    enabled: true,
    deferred: resourceType === 'scorm' || resourceType === 'xapi' || resourceType === 'file'
}))

export const DEFAULT_LEARNING_CONTENT_COLUMN_PRESET: LearningContentColumnPreset = {
    codename: 'learningContentDefault',
    title: {
        en: 'Learning Content default',
        ru: 'Учебный контент по умолчанию'
    },
    columns: [
        { field: 'Title', visible: true, flex: 1 },
        { field: 'ResourceType', visible: true, width: 140 },
        { field: 'PublicationStatus', visible: true, width: 160 },
        { field: 'ProjectId', visible: true, width: 180 },
        { field: 'UpdatedAt', visible: true, width: 160 },
        { field: 'CreatedBy', visible: false, width: 180 }
    ]
}

export const DEFAULT_LEARNING_CONTENT_PLAYER_PRESET: PlayerPreset = {
    codename: 'learningContentDefaultPlayer',
    title: {
        en: 'Default player',
        ru: 'Плеер по умолчанию'
    },
    showOutline: true,
    showProgressHeader: true,
    allowResume: true,
    allowResourcePreview: true,
    completeButtonMode: 'manual'
}

export const DEFAULT_APPLICATION_LEARNING_CONTENT_SETTINGS: ApplicationLearningContentSettings =
    applicationLearningContentSettingsSchema.parse({
        supportedResourceTypes: DEFAULT_LEARNING_CONTENT_RESOURCE_TYPE_SETTINGS,
        defaultView: 'table',
        courseCompletionPolicy: {},
        trackOrderPolicy: {},
        playerPreset: DEFAULT_LEARNING_CONTENT_PLAYER_PRESET,
        columnPreset: DEFAULT_LEARNING_CONTENT_COLUMN_PRESET
    })

export const sanitizeApplicationLearningContentSettings = (
    settings: Partial<ApplicationLearningContentSettings> | null | undefined
): ApplicationLearningContentSettings => {
    const merged = {
        ...DEFAULT_APPLICATION_LEARNING_CONTENT_SETTINGS,
        ...(settings ?? {}),
        supportedResourceTypes:
            settings?.supportedResourceTypes && settings.supportedResourceTypes.length > 0
                ? settings.supportedResourceTypes
                : DEFAULT_APPLICATION_LEARNING_CONTENT_SETTINGS.supportedResourceTypes,
        courseCompletionPolicy: {
            ...DEFAULT_APPLICATION_LEARNING_CONTENT_SETTINGS.courseCompletionPolicy,
            ...(settings?.courseCompletionPolicy ?? {})
        },
        trackOrderPolicy: {
            ...DEFAULT_APPLICATION_LEARNING_CONTENT_SETTINGS.trackOrderPolicy,
            ...(settings?.trackOrderPolicy ?? {})
        },
        playerPreset: {
            ...DEFAULT_APPLICATION_LEARNING_CONTENT_SETTINGS.playerPreset,
            ...(settings?.playerPreset ?? {})
        },
        columnPreset: {
            ...DEFAULT_APPLICATION_LEARNING_CONTENT_SETTINGS.columnPreset,
            ...(settings?.columnPreset ?? {})
        },
        progressStore: {
            ...DEFAULT_APPLICATION_LEARNING_CONTENT_SETTINGS.progressStore,
            ...(settings?.progressStore ?? {})
        }
    }

    return applicationLearningContentSettingsSchema.parse(merged)
}

export const resourceDefinitionSchema = z
    .object({
        codename: codenameSchema,
        title: localizedContractTextSchema,
        description: localizedContractTextSchema.optional(),
        source: resourceSourceSchema,
        durationSeconds: z.number().int().min(0).max(604800).optional(),
        estimatedTimeMinutes: z.number().int().min(0).max(10080).optional(),
        thumbnail: z.string().url().optional(),
        language: z.string().trim().min(2).max(16).optional(),
        version: z.string().trim().min(1).max(64).optional()
    })
    .strict()
export type ResourceDefinition = z.infer<typeof resourceDefinitionSchema>

export const LMS_STATUS_GROUPS = [
    'content',
    'quizAttempt',
    'assignmentReview',
    'trackEnrollment',
    'trainingAttendance',
    'certificate'
] as const
export type LmsStatusGroup = (typeof LMS_STATUS_GROUPS)[number]

export const normalizedLifecycleStatusSchema = z
    .object({
        group: z.enum(LMS_STATUS_GROUPS),
        codename: codenameSchema,
        title: localizedContractTextSchema,
        isInitial: z.boolean().optional(),
        isFinal: z.boolean().optional(),
        isSuccess: z.boolean().optional(),
        isFailure: z.boolean().optional(),
        isOverdue: z.boolean().optional()
    })
    .strict()
export type NormalizedLifecycleStatus = z.infer<typeof normalizedLifecycleStatusSchema>

export const rolePolicyTemplateSchema = z
    .object({
        codename: codenameSchema,
        title: localizedContractTextSchema,
        baseRole: z.enum(['owner', 'admin', 'editor', 'member']).optional(),
        rules: z.array(roleCapabilityRuleSchema).max(128).default([])
    })
    .strict()
export type RolePolicyTemplate = z.infer<typeof rolePolicyTemplateSchema>

export const applicationRolePolicySettingsSchema = z
    .object({
        templates: z.array(rolePolicyTemplateSchema).max(32).default([])
    })
    .strict()
export type ApplicationRolePolicySettings = z.infer<typeof applicationRolePolicySettingsSchema>

export const SUPPORTED_ACTIVE_CAPABILITY_SCOPES = ['application', 'workspace'] as const
export type SupportedActiveCapabilityScope = (typeof SUPPORTED_ACTIVE_CAPABILITY_SCOPES)[number]

const supportedActiveCapabilityScopeSet = new Set<string>(SUPPORTED_ACTIVE_CAPABILITY_SCOPES)

export type UnsupportedActiveCapabilityRule = {
    templateCodename: string
    capability: string
    scope: string
}

export const collectUnsupportedActiveCapabilityRules = (
    rolePolicies: ApplicationRolePolicySettings | null | undefined
): UnsupportedActiveCapabilityRule[] => {
    const parsed = applicationRolePolicySettingsSchema.safeParse(rolePolicies)
    if (!parsed.success) return []

    return parsed.data.templates.flatMap((template) =>
        template.rules
            .filter((rule) => rule.effect === 'allow' && !supportedActiveCapabilityScopeSet.has(rule.scope))
            .map((rule) => ({
                templateCodename: template.codename,
                capability: rule.capability,
                scope: rule.scope
            }))
    )
}

export const sanitizeApplicationRolePolicySettingsForSupportedScopes = (
    rolePolicies: ApplicationRolePolicySettings
): ApplicationRolePolicySettings => {
    const parsed = applicationRolePolicySettingsSchema.parse(rolePolicies)

    return {
        templates: parsed.templates.map((template) => ({
            ...template,
            rules: template.rules.map((rule) =>
                rule.effect === 'allow' && !supportedActiveCapabilityScopeSet.has(rule.scope)
                    ? {
                          ...rule,
                          effect: 'deny' as const
                      }
                    : rule
            )
        }))
    }
}

export const reportFilterSchema = z
    .object({
        field: codenameSchema,
        operator: z.enum([
            'contains',
            'equals',
            'startsWith',
            'endsWith',
            'isEmpty',
            'isNotEmpty',
            'greaterThan',
            'greaterThanOrEqual',
            'lessThan',
            'lessThanOrEqual'
        ]),
        value: z.unknown().optional()
    })
    .strict()
export type ReportFilter = z.infer<typeof reportFilterSchema>

export const reportAggregationSchema = z
    .object({
        field: codenameSchema,
        function: z.enum(['count', 'sum', 'avg', 'min', 'max']),
        alias: codenameSchema.optional()
    })
    .strict()
export type ReportAggregation = z.infer<typeof reportAggregationSchema>

export const reportColumnSchema = z
    .object({
        field: codenameSchema,
        label: localizedContractTextSchema,
        type: z.enum(['text', 'number', 'date', 'status', 'boolean'])
    })
    .strict()
export type ReportColumn = z.infer<typeof reportColumnSchema>

export const reportDefinitionSchema = z
    .object({
        codename: codenameSchema,
        title: localizedContractTextSchema,
        description: localizedContractTextSchema.optional(),
        datasource: runtimeDatasourceDescriptorSchema,
        columns: z.array(reportColumnSchema).min(1).max(64),
        filters: z.array(reportFilterSchema).max(32).default([]),
        aggregations: z.array(reportAggregationSchema).max(16).default([]),
        savedAt: isoDateStringSchema.optional()
    })
    .strict()
export type ReportDefinition = z.infer<typeof reportDefinitionSchema>

export const LMS_ACCEPTANCE_AREAS = [
    'learnerHome',
    'contentLibrary',
    'contentProjects',
    'learningContentShell',
    'standalonePageAuthoring',
    'standaloneLinkResources',
    'courseBuilder',
    'courseDetail',
    'trackBuilder',
    'learningTrackProgression',
    'manualEnrollment',
    'learnerPlayer',
    'trashRestore',
    'assignmentSubmissionAndGrading',
    'trainingAttendance',
    'certificateIssue',
    'reports',
    'knowledgeBase',
    'developmentPlan',
    'roleVisibility',
    'workspaceIsolation',
    'publicGuestAccess'
] as const
export const lmsAcceptanceAreaSchema = z.enum(LMS_ACCEPTANCE_AREAS)
export type LmsAcceptanceArea = z.infer<typeof lmsAcceptanceAreaSchema>

export const lmsAcceptancePhaseGatesSchema = z
    .object({
        seeded: z.boolean(),
        visible: z.boolean(),
        actionable: z.boolean(),
        audited: z.boolean(),
        'workspace-isolated': z.boolean(),
        'covered-by-e2e': z.boolean()
    })
    .strict()
export type LmsAcceptancePhaseGates = z.infer<typeof lmsAcceptancePhaseGatesSchema>

export const lmsAcceptanceMatrixSchema = z
    .array(
        z
            .object({
                area: lmsAcceptanceAreaSchema,
                gates: lmsAcceptancePhaseGatesSchema,
                requiredEntities: z.array(codenameSchema).max(32).default([]),
                requiredReports: z.array(codenameSchema).max(32).default([]),
                requiredStatuses: z.array(codenameSchema).max(32).default([]),
                evidence: z.array(z.string().trim().min(1).max(160)).max(16).default([]),
                gaps: z.array(z.string().trim().min(1).max(240)).max(16).default([])
            })
            .strict()
    )
    .min(1)
export type LmsAcceptanceMatrix = z.infer<typeof lmsAcceptanceMatrixSchema>
