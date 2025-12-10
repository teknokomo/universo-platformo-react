import { z } from 'zod'

/**
 * Schema for granting global role (by email, not UUID)
 * Role is validated dynamically against database roles in the service layer
 */
export const GrantRoleSchema = z.object({
    email: z.string().email('Invalid email format'),
    role: z.string().min(1, 'Role name is required'),
    comment: z.string().trim().max(500).optional().or(z.literal(''))
})

export type GrantRoleInput = z.infer<typeof GrantRoleSchema>

/**
 * Schema for updating global user (role and/or comment)
 * Role is validated dynamically against database roles
 */
export const UpdateGlobalUserSchema = z.object({
    role: z.string().min(1, 'Role name is required').optional(),
    comment: z.string().trim().max(500).optional().or(z.literal(''))
})

export type UpdateGlobalUserInput = z.infer<typeof UpdateGlobalUserSchema>

/**
 * Schema for list query parameters (users list with filters)
 */
export const ListQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    sortBy: z.enum(['created', 'email', 'role']).default('created'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().optional(),
    /** Filter by specific role ID (UUID) */
    roleId: z.string().uuid().optional(),
    /** Filter by global access status */
    hasGlobalAccess: z.enum(['true', 'false', 'all']).default('true')
})

export type ListQueryInput = z.infer<typeof ListQuerySchema>

/**
 * Format Zod error for API response
 */
export function formatZodError(error: z.ZodError): string {
    return error.errors[0]?.message ?? 'Validation error'
}

/**
 * Validate and parse list query parameters
 */
export function validateListQuery(query: unknown): ListQueryInput {
    return ListQuerySchema.parse(query)
}

// ═══════════════════════════════════════════════════════════════
// ROLE MANAGEMENT SCHEMAS
// ═══════════════════════════════════════════════════════════════

/**
 * Available permission subjects (CASL standard terminology)
 */
const PermissionSubjects = [
    'metaverses',
    'clusters',
    'projects',
    'spaces',
    'storages',
    'organizations',
    'campaigns',
    'uniks',
    'sections',
    'entities',
    'canvases',
    'publications',
    'roles',
    'instances',
    'users',
    'admin',
    '*'
] as const

/**
 * Available permission actions
 */
const PermissionActions = ['create', 'read', 'update', 'delete', '*'] as const

/**
 * Schema for a single permission rule
 */
const PermissionRuleSchema = z.object({
    subject: z.enum(PermissionSubjects),
    action: z.enum(PermissionActions),
    conditions: z.record(z.unknown()).optional(),
    fields: z.array(z.string()).optional()
})

/**
 * Schema for localized string (display names)
 */
const LocalizedStringSchema = z.record(z.string())

/**
 * Schema for creating a new role
 */
export const CreateRoleSchema = z.object({
    name: z
        .string()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name must be at most 50 characters')
        .regex(/^[a-z0-9_-]+$/, 'Name must be lowercase alphanumeric with underscores/dashes'),
    description: z.string().max(500).optional(),
    displayName: LocalizedStringSchema,
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format'),
    isSuperuser: z.boolean(),
    permissions: z.array(PermissionRuleSchema).min(1, 'At least one permission is required')
})

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>

/**
 * Schema for updating an existing role
 */
export const UpdateRoleSchema = z.object({
    name: z
        .string()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name must be at most 50 characters')
        .regex(/^[a-z0-9_-]+$/, 'Name must be lowercase alphanumeric with underscores/dashes')
        .optional(),
    description: z.string().max(500).optional().nullable(),
    displayName: LocalizedStringSchema.optional(),
    color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format')
        .optional(),
    isSuperuser: z.boolean().optional(),
    permissions: z.array(PermissionRuleSchema).min(1, 'At least one permission is required').optional()
})

export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>
