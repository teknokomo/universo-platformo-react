import { z } from 'zod'

/**
 * Schema for granting global role (by email, not UUID)
 */
export const GrantRoleSchema = z.object({
    email: z.string().email('Invalid email format'),
    role: z.enum(['superadmin', 'supermoderator'], {
        errorMap: () => ({ message: 'Role must be superadmin or supermoderator' })
    }),
    comment: z.string().trim().max(500).optional().or(z.literal(''))
})

export type GrantRoleInput = z.infer<typeof GrantRoleSchema>

/**
 * Schema for updating global user (role and/or comment)
 */
export const UpdateGlobalUserSchema = z.object({
    role: z.enum(['superadmin', 'supermoderator'], {
        errorMap: () => ({ message: 'Role must be superadmin or supermoderator' })
    }).optional(),
    comment: z.string().trim().max(500).optional().or(z.literal(''))
})

export type UpdateGlobalUserInput = z.infer<typeof UpdateGlobalUserSchema>

/**
 * Schema for list query parameters
 */
export const ListQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    sortBy: z.enum(['created', 'email', 'role']).default('created'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().optional()
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
