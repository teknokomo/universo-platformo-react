import { z } from 'zod'

const codenameSchema = z.string().trim().min(1).max(128)
const localizedContractTextSchema = z.union([z.string().trim().min(1).max(240), z.record(z.string(), z.unknown())])

export const WORKFLOW_POSTING_COMMANDS = ['post', 'unpost', 'void'] as const
export type WorkflowPostingCommand = (typeof WORKFLOW_POSTING_COMMANDS)[number]

export const workflowActionConfirmationSchema = z
    .object({
        required: z.boolean().default(false),
        title: localizedContractTextSchema.optional(),
        message: localizedContractTextSchema.optional(),
        confirmLabel: localizedContractTextSchema.optional()
    })
    .strict()
export type WorkflowActionConfirmation = z.infer<typeof workflowActionConfirmationSchema>

export const workflowActionSchema = z
    .object({
        codename: codenameSchema,
        title: localizedContractTextSchema,
        from: z.array(codenameSchema).max(32).default([]),
        to: codenameSchema,
        statusFieldCodename: codenameSchema.optional(),
        statusColumnName: codenameSchema.optional(),
        requiredCapabilities: z.array(codenameSchema).max(32).default([]),
        confirmation: workflowActionConfirmationSchema.optional(),
        scriptCodename: codenameSchema.optional(),
        postingCommand: z.enum(WORKFLOW_POSTING_COMMANDS).optional()
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

export const WORKFLOW_ACTION_UNAVAILABLE_REASONS = [
    'available',
    'missingCapability',
    'unsupportedScope',
    'statusMismatch',
    'invalidAction'
] as const
export type WorkflowActionUnavailableReason = (typeof WORKFLOW_ACTION_UNAVAILABLE_REASONS)[number]

export type WorkflowCapabilityMap = Record<string, boolean> | ReadonlySet<string> | readonly string[]

export type WorkflowActionAvailability = {
    actionCodename: string
    available: boolean
    reason: WorkflowActionUnavailableReason
    missingCapabilities: string[]
    unsupportedScopes: CapabilityScope[]
}

const normalizeCapability = (value: string): string => value.trim().toLowerCase()

const hasCapability = (capabilities: WorkflowCapabilityMap | null | undefined, capability: string): boolean => {
    if (!capabilities) return false
    const normalizedCapability = normalizeCapability(capability)

    if (capabilities instanceof Set) {
        return [...capabilities].some((item) => normalizeCapability(item) === normalizedCapability)
    }

    if (Array.isArray(capabilities)) {
        return capabilities.some((item) => normalizeCapability(item) === normalizedCapability)
    }

    const entry = Object.entries(capabilities).find(([key]) => normalizeCapability(key) === normalizedCapability)
    return entry?.[1] === true
}

const normalizeStatusValue = (value: unknown): string => (typeof value === 'string' ? value.trim().toLowerCase() : '')

export function evaluateWorkflowActionAvailability(params: {
    action: WorkflowAction
    currentStatus: unknown
    capabilities: WorkflowCapabilityMap | null | undefined
    scopes?: readonly CapabilityScope[]
}): WorkflowActionAvailability {
    const parsedAction = workflowActionSchema.parse(params.action)
    const supportedScopes = new Set<CapabilityScope>(params.scopes ?? ['application', 'workspace'])
    const unsupportedScopes = parsedAction.requiredCapabilities
        .map((capability): CapabilityScope | null => {
            const prefix = capability.split(':', 1)[0]
            return capabilityScopeSchema.safeParse(prefix).success ? (prefix as CapabilityScope) : null
        })
        .filter((scope): scope is CapabilityScope => Boolean(scope && !supportedScopes.has(scope)))

    if (unsupportedScopes.length > 0) {
        return {
            actionCodename: parsedAction.codename,
            available: false,
            reason: 'unsupportedScope',
            missingCapabilities: [],
            unsupportedScopes
        }
    }

    if (parsedAction.from.length === 0 || parsedAction.requiredCapabilities.length === 0) {
        return {
            actionCodename: parsedAction.codename,
            available: false,
            reason: 'invalidAction',
            missingCapabilities: parsedAction.requiredCapabilities.length === 0 ? [] : parsedAction.requiredCapabilities,
            unsupportedScopes: []
        }
    }

    const normalizedStatus = normalizeStatusValue(params.currentStatus)
    const fromMatches = parsedAction.from.some((status) => normalizeStatusValue(status) === normalizedStatus)
    if (!fromMatches) {
        return {
            actionCodename: parsedAction.codename,
            available: false,
            reason: 'statusMismatch',
            missingCapabilities: [],
            unsupportedScopes: []
        }
    }

    const missingCapabilities = parsedAction.requiredCapabilities.filter((capability) => !hasCapability(params.capabilities, capability))
    if (missingCapabilities.length > 0) {
        return {
            actionCodename: parsedAction.codename,
            available: false,
            reason: 'missingCapability',
            missingCapabilities,
            unsupportedScopes: []
        }
    }

    return {
        actionCodename: parsedAction.codename,
        available: true,
        reason: 'available',
        missingCapabilities: [],
        unsupportedScopes: []
    }
}
