import { z } from 'zod'
import { runtimeDatasourceDescriptorSchema } from './runtimeDataSources'

export const localizedContractTextSchema = z.union([z.string().trim().min(1).max(240), z.record(z.string(), z.unknown())])
export type LocalizedContractText = z.infer<typeof localizedContractTextSchema>

export const RESOURCE_TYPES = ['page', 'url', 'video', 'audio', 'document', 'scorm', 'embed', 'file'] as const
export type ResourceType = (typeof RESOURCE_TYPES)[number]

export const RESOURCE_LAUNCH_MODES = ['inline', 'newTab', 'download'] as const
export type ResourceLaunchMode = (typeof RESOURCE_LAUNCH_MODES)[number]

const codenameSchema = z.string().trim().min(1).max(128)
const isoDateStringSchema = z.string().datetime()

export const resourceSourceSchema = z
    .object({
        type: z.enum(RESOURCE_TYPES),
        url: z.string().url().optional(),
        pageCodename: codenameSchema.optional(),
        storageKey: z.string().trim().min(1).max(512).optional(),
        packageDescriptor: z.record(z.string(), z.unknown()).optional(),
        mimeType: z.string().trim().min(1).max(128).optional(),
        launchMode: z.enum(RESOURCE_LAUNCH_MODES).default('inline')
    })
    .strict()
    .superRefine((value, ctx) => {
        const hasUrl = typeof value.url === 'string'
        const hasPage = typeof value.pageCodename === 'string'
        const hasStorage = typeof value.storageKey === 'string'
        const hasPackage = Boolean(value.packageDescriptor)
        const sourceCount = [hasUrl, hasPage, hasStorage, hasPackage].filter(Boolean).length

        if (sourceCount !== 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Resource source must define exactly one source locator',
                path: ['source']
            })
            return
        }

        if (value.type === 'page' && !hasPage) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Page resources must use pageCodename',
                path: ['pageCodename']
            })
        }
        if ((value.type === 'url' || value.type === 'video' || value.type === 'audio' || value.type === 'embed') && !hasUrl) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${value.type} resources must use url`,
                path: ['url']
            })
        }
        if ((value.type === 'document' || value.type === 'file') && !hasUrl && !hasStorage) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${value.type} resources must use url or storageKey`,
                path: ['storageKey']
            })
        }
        if (value.type === 'scorm' && !hasPackage && !hasStorage) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'SCORM resources must use packageDescriptor or storageKey',
                path: ['packageDescriptor']
            })
        }
    })
export type ResourceSource = z.infer<typeof resourceSourceSchema>

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

export const SEQUENCE_POLICY_MODES = ['free', 'sequential', 'scheduled', 'prerequisite'] as const
export type SequencePolicyMode = (typeof SEQUENCE_POLICY_MODES)[number]

export const completionConditionSchema = z
    .object({
        kind: z.enum(['manual', 'progressPercent', 'scoreAtLeast', 'allStepsCompleted', 'attendanceMarked', 'certificateIssued']),
        field: codenameSchema.optional(),
        value: z.unknown().optional()
    })
    .strict()
export type CompletionCondition = z.infer<typeof completionConditionSchema>

export const sequencePolicySchema = z
    .object({
        mode: z.enum(SEQUENCE_POLICY_MODES).default('free'),
        prerequisiteFieldCodename: codenameSchema.optional(),
        orderFieldCodename: codenameSchema.optional(),
        availableFromFieldCodename: codenameSchema.optional(),
        availableToFieldCodename: codenameSchema.optional(),
        dueAtFieldCodename: codenameSchema.optional(),
        retryLimit: z.number().int().min(0).max(100).optional(),
        maxAttempts: z.number().int().min(1).max(100).optional(),
        completion: z.array(completionConditionSchema).max(16).default([])
    })
    .strict()
export type SequencePolicy = z.infer<typeof sequencePolicySchema>

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

export const workflowActionSchema = z
    .object({
        codename: codenameSchema,
        title: localizedContractTextSchema,
        from: z.array(codenameSchema).max(32).default([]),
        to: codenameSchema,
        requiredCapabilities: z.array(codenameSchema).max(32).default([]),
        scriptCodename: codenameSchema.optional()
    })
    .strict()
export type WorkflowAction = z.infer<typeof workflowActionSchema>

export const capabilityScopeSchema = z.enum(['application', 'workspace', 'recordOwner', 'department', 'class', 'group'])
export type CapabilityScope = z.infer<typeof capabilityScopeSchema>

export const roleCapabilityRuleSchema = z
    .object({
        capability: codenameSchema,
        effect: z.enum(['allow', 'deny']),
        scope: capabilityScopeSchema.default('workspace'),
        condition: z.record(z.string(), z.unknown()).optional()
    })
    .strict()
export type RoleCapabilityRule = z.infer<typeof roleCapabilityRuleSchema>

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

export const lmsAcceptanceAreaSchema = z.enum([
    'learnerHome',
    'contentLibrary',
    'courseDetail',
    'learningTrackProgression',
    'assignmentSubmissionAndGrading',
    'trainingAttendance',
    'certificateIssue',
    'reports',
    'knowledgeBase',
    'developmentPlan',
    'roleVisibility',
    'workspaceIsolation',
    'publicGuestAccess'
])
export type LmsAcceptanceArea = z.infer<typeof lmsAcceptanceAreaSchema>

export const lmsAcceptanceMatrixSchema = z
    .array(
        z
            .object({
                area: lmsAcceptanceAreaSchema,
                requiredEntities: z.array(codenameSchema).max(32).default([]),
                requiredReports: z.array(codenameSchema).max(32).default([]),
                requiredStatuses: z.array(codenameSchema).max(32).default([])
            })
            .strict()
    )
    .min(1)
export type LmsAcceptanceMatrix = z.infer<typeof lmsAcceptanceMatrixSchema>
