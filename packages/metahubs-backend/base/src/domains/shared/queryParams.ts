import { z } from 'zod'

/**
 * Schema for list query parameters with pagination, sorting, and search
 * Used across metahubs, sections, and entities list endpoints
 */
export const ListQuerySchema = z.object({
    // Pagination
    limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(1000, 'Limit cannot exceed 1000').default(100),

    offset: z.coerce.number().int().min(0, 'Offset must be non-negative').default(0),

    // Sorting
    sortBy: z.enum(['name', 'codename', 'created', 'updated', 'sortOrder']).default('updated'),

    sortOrder: z.enum(['asc', 'desc']).default('desc'),

    // Search
    search: z
        .string()
        .trim()
        .max(255, 'Search query too long')
        .optional()
        .transform((val) => val || undefined), // Convert empty string to undefined

    // Admin filter (show all entities regardless of membership)
    // NOTE: z.coerce.boolean() is unsafe for query strings — Boolean("false") === true.
    // Use preprocess to correctly handle string values from Express req.query.
    showAll: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false)
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

export interface PaginationResult<T> {
    items: T[]
    pagination: {
        limit: number
        offset: number
        total: number
        hasMore: boolean
    }
}

export function paginateItems<T>(items: T[], query: Pick<ListQueryParams, 'limit' | 'offset'>): PaginationResult<T> {
    const total = items.length
    const paged = items.slice(query.offset, query.offset + query.limit)
    return {
        items: paged,
        pagination: {
            limit: query.limit,
            offset: query.offset,
            total,
            hasMore: query.offset + query.limit < total
        }
    }
}
