/**
 * Common Pagination and API Schemas
 *
 * Shared validation schemas used across all list endpoints.
 * Provides consistent pagination, query params, and error handling.
 */

import { z } from 'zod'

/**
 * Pagination query parameters schema
 * Used for list endpoints with pagination support
 */
export const PaginationQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(1000).default(100),
    offset: z.coerce.number().int().min(0).default(0),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    search: z.string().optional()
})

/**
 * Pagination metadata schema
 * Returned in response headers and body for paginated lists
 */
export const PaginationMetaSchema = z.object({
    total: z.number().int().min(0),
    limit: z.number().int().min(1),
    offset: z.number().int().min(0),
    count: z.number().int().min(0),
    hasMore: z.boolean()
})

/**
 * Generic paginated response schema
 * Can be used with any data type
 */
export const createPaginatedResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
    z.object({
        data: z.array(dataSchema),
        pagination: PaginationMetaSchema
    })

/**
 * API error response schema
 * Standard error format across all endpoints
 */
export const ApiErrorSchema = z.object({
    error: z.string(),
    code: z.string().optional(),
    status: z.number().int().optional()
})

// Type inference exports
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>
export type PaginatedResponse<T> = {
    data: T[]
    pagination: PaginationMeta
}
export type ApiError = z.infer<typeof ApiErrorSchema>
