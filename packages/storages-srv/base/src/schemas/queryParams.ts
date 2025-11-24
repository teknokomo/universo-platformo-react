import { z } from 'zod'

/**
 * Schema for list query parameters with pagination, sorting, and search
 * Used across storages, containers, and slots list endpoints
 */
export const ListQuerySchema = z.object({
    // Pagination
    limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(1000, 'Limit cannot exceed 1000').default(100).optional(),

    offset: z.coerce.number().int().min(0, 'Offset must be non-negative').default(0).optional(),

    // Sorting
    sortBy: z.enum(['name', 'created', 'updated']).default('updated').optional(),

    sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),

    // Search
    search: z
        .string()
        .trim()
        .max(255, 'Search query too long')
        .optional()
        .transform((val) => val || undefined) // Convert empty string to undefined
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
