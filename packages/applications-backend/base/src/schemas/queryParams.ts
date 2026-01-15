import { z } from 'zod'

/**
 * Schema for list query parameters with pagination, sorting, and search
 * Used across applications, connectors, and members list endpoints
 */
export const ListQuerySchema = z.object({
    // Pagination
    limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(1000, 'Limit cannot exceed 1000').default(100),

    offset: z.coerce.number().int().min(0, 'Offset must be non-negative').default(0),

    // Sorting
    // Note: member lists support additional sort fields ('email', 'role')
    // while other list endpoints will safely ignore/override unsupported fields.
    sortBy: z.enum(['name', 'created', 'updated', 'email', 'role']).default('updated'),

    sortOrder: z.enum(['asc', 'desc']).default('desc'),

    // Search
    search: z
        .string()
        .trim()
        .max(255, 'Search query too long')
        .optional()
        .transform((val) => val || undefined), // Convert empty string to undefined

    // Admin filter (show all entities regardless of membership)
    showAll: z.coerce.boolean().default(false)
})

export type ListQueryParams = z.infer<typeof ListQuerySchema>

/**
 * Validates and parses list query parameters
 * Returns validated params or throws ZodError with detailed validation errors
 *
 * @param query - Raw query object from Express request
 * @returns Validated and typed query parameters
 * @throws ZodError if validation fails
 */
export function validateListQuery(query: unknown): ListQueryParams {
    return ListQuerySchema.parse(query)
}
