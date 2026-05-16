import { z } from 'zod'
import { runtimeDatasourceDescriptorSchema } from './runtimeDataSources'
import { resourceSourceSchema } from './resourceSources'
import { roleCapabilityRuleSchema } from './workflowActions'

export { RESOURCE_LAUNCH_MODES, RESOURCE_TYPES, resourceSourceSchema } from './resourceSources'
export type { ResourceLaunchMode, ResourceSource, ResourceType } from './resourceSources'

export const localizedContractTextSchema = z.union([z.string().trim().min(1).max(240), z.record(z.string(), z.unknown())])
export type LocalizedContractText = z.infer<typeof localizedContractTextSchema>

const codenameSchema = z.string().trim().min(1).max(128)
const isoDateStringSchema = z.string().datetime()

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
