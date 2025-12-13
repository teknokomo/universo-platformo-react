import { z } from 'zod'
import { LocalizedStringSchema, LocalizedStringOptionalSchema } from '@universo/types'

// Re-export Localized Content schemas for use in routes
export { LocalizedStringSchema, LocalizedStringOptionalSchema }

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
 * Schema for creating a new role
 */
export const CreateRoleSchema = z.object({
    codename: z
        .string()
        .min(2, 'Codename must be at least 2 characters')
        .max(50, 'Codename must be at most 50 characters')
        .regex(/^[a-z0-9_-]+$/, 'Codename must be lowercase alphanumeric with underscores/dashes'),
    description: LocalizedStringOptionalSchema,
    name: LocalizedStringSchema,
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format'),
    isSuperuser: z.boolean(),
    permissions: z.array(PermissionRuleSchema).min(1, 'At least one permission is required')
})

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>

/**
 * Schema for updating an existing role
 */
export const UpdateRoleSchema = z.object({
    codename: z
        .string()
        .min(2, 'Codename must be at least 2 characters')
        .max(50, 'Codename must be at most 50 characters')
        .regex(/^[a-z0-9_-]+$/, 'Codename must be lowercase alphanumeric with underscores/dashes')
        .optional(),
    description: LocalizedStringOptionalSchema,
    name: LocalizedStringSchema.optional(),
    color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format')
        .optional(),
    isSuperuser: z.boolean().optional(),
    permissions: z.array(PermissionRuleSchema).min(1, 'At least one permission is required').optional()
})

export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>

// ═══════════════════════════════════════════════════════════════
// LOCALE MANAGEMENT SCHEMAS
// ═══════════════════════════════════════════════════════════════

/**
 * Locale code validation (BCP47-like, 2-5 chars)
 */
export const LocaleCodeSchema = z
    .string()
    .min(2, 'Locale code must be at least 2 characters')
    .max(10, 'Locale code must be at most 10 characters')
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Invalid locale code format (e.g., en, ru, en-US)')

/**
 * Schema for creating a new locale
 */
export const CreateLocaleSchema = z.object({
    code: LocaleCodeSchema,
    name: LocalizedStringSchema,
    nativeName: z.string().max(100, 'Native name must be at most 100 characters').optional(),
    isEnabledContent: z.boolean().default(true),
    isEnabledUi: z.boolean().default(false),
    isDefaultContent: z.boolean().default(false),
    isDefaultUi: z.boolean().default(false),
    sortOrder: z.number().int().min(0).default(0)
})

export type CreateLocaleInput = z.infer<typeof CreateLocaleSchema>

/**
 * Schema for updating an existing locale
 */
export const UpdateLocaleSchema = z.object({
    name: LocalizedStringSchema.optional(),
    nativeName: z.string().max(100, 'Native name must be at most 100 characters').nullable().optional(),
    isEnabledContent: z.boolean().optional(),
    isEnabledUi: z.boolean().optional(),
    isDefaultContent: z.boolean().optional(),
    isDefaultUi: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional()
})

export type UpdateLocaleInput = z.infer<typeof UpdateLocaleSchema>

/**
 * Schema for listing locales query parameters
 */
export const LocalesListQuerySchema = z.object({
    includeDisabled: z.coerce.boolean().default(false),
    sortBy: z.enum(['code', 'sort_order', 'created_at']).default('sort_order'),
    sortOrder: z.enum(['asc', 'desc']).default('asc')
})

export type LocalesListQuery = z.infer<typeof LocalesListQuerySchema>
