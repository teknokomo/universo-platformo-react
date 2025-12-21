import { z } from 'zod'

/**
 * Schema for list query parameters with pagination, sorting, and search
 * Used across metahubs, entities, and records list endpoints
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
        .transform((val) => val || undefined)
})

export type ListQueryParams = z.infer<typeof ListQuerySchema>

/**
 * Validates and parses list query parameters
 */
export function validateListQuery(query: unknown): ListQueryParams {
    return ListQuerySchema.parse(query)
}

/**
 * Schema for creating a metahub
 */
export const CreateMetahubSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255),
    description: z.string().max(10000).optional()
})

export type CreateMetahubInput = z.infer<typeof CreateMetahubSchema>

/**
 * Schema for updating a metahub
 */
export const UpdateMetahubSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(10000).optional().nullable()
})

export type UpdateMetahubInput = z.infer<typeof UpdateMetahubSchema>

/**
 * Schema for creating an entity definition
 */
export const CreateEntitySchema = z.object({
    name: z.string().min(1, 'Name is required').max(255),
    codename: z
        .string()
        .min(1, 'Codename is required')
        .max(100)
        .regex(/^[a-z][a-z0-9_]*$/, 'Codename must be lowercase, start with a letter, and contain only letters, numbers, and underscores'),
    description: z.string().max(10000).optional(),
    displayConfig: z.record(z.unknown()).optional()
})

export type CreateEntityInput = z.infer<typeof CreateEntitySchema>

/**
 * Schema for creating a field definition
 */
export const CreateFieldSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255),
    codename: z
        .string()
        .min(1, 'Codename is required')
        .max(100)
        .regex(/^[a-z][a-z0-9_]*$/, 'Codename must be lowercase, start with a letter'),
    fieldType: z.enum(['string', 'number', 'boolean', 'date', 'datetime', 'text', 'select', 'multiselect', 'reference']),
    required: z.boolean().default(false),
    fieldConfig: z.record(z.unknown()).optional(),
    sortOrder: z.number().int().min(0).default(0)
})

export type CreateFieldInput = z.infer<typeof CreateFieldSchema>

/**
 * Schema for creating a user data record
 */
export const CreateRecordSchema = z.object({
    data: z.record(z.unknown())
})

export type CreateRecordInput = z.infer<typeof CreateRecordSchema>

/**
 * Schema for updating a user data record
 */
export const UpdateRecordSchema = z.object({
    data: z.record(z.unknown())
})

export type UpdateRecordInput = z.infer<typeof UpdateRecordSchema>
