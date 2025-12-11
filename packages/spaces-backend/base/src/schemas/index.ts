import { z } from 'zod'

// ═══════════════════════════════════════════════════════════════════════════
// Common validation patterns
// ═══════════════════════════════════════════════════════════════════════════

const uuidSchema = z.string().uuid('Invalid UUID format')

const trimmedString = (maxLength: number) => z.string().trim().max(maxLength, `Must be ${maxLength} characters or less`)

const optionalTrimmedString = (maxLength: number) =>
    z
        .string()
        .trim()
        .max(maxLength, `Must be ${maxLength} characters or less`)
        .optional()
        .transform((val) => (val?.length ? val : undefined))

// ═══════════════════════════════════════════════════════════════════════════
// Space Schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Schema for creating a new space
 */
export const CreateSpaceSchema = z.object({
    name: trimmedString(200).min(1, 'Space name is required'),
    description: optionalTrimmedString(2000),
    visibility: z.enum(['private', 'public']).default('private').optional(),
    defaultCanvasName: optionalTrimmedString(200),
    defaultCanvasFlowData: z.string().optional()
})

export type CreateSpaceInput = z.infer<typeof CreateSpaceSchema>

/**
 * Schema for updating a space
 */
export const UpdateSpaceSchema = z
    .object({
        name: trimmedString(200).min(1, 'Space name cannot be empty').optional(),
        description: optionalTrimmedString(2000),
        visibility: z.enum(['private', 'public']).optional()
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: 'At least one field must be provided for update'
    })

export type UpdateSpaceInput = z.infer<typeof UpdateSpaceSchema>

// ═══════════════════════════════════════════════════════════════════════════
// Canvas Schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Canvas type enum
 */
export const CanvasTypeSchema = z.enum(['CHATFLOW', 'MULTIAGENT', 'ASSISTANT'])

/**
 * Schema for creating a new canvas
 */
export const CreateCanvasSchema = z.object({
    name: trimmedString(200).default('Canvas 1').optional(),
    flowData: z.string().default('{}').optional()
})

export type CreateCanvasInput = z.infer<typeof CreateCanvasSchema>

/**
 * Schema for updating a canvas
 */
export const UpdateCanvasSchema = z.object({
    name: trimmedString(200).optional(),
    flowData: z.string().optional(),
    deployed: z.boolean().optional(),
    isPublic: z.boolean().optional(),
    apikeyid: z.string().optional(),
    chatbotConfig: z.string().optional(),
    apiConfig: z.string().optional(),
    analytic: z.string().optional(),
    speechToText: z.string().optional(),
    followUpPrompts: z.string().optional(),
    category: z.string().optional(),
    type: CanvasTypeSchema.optional()
})

export type UpdateCanvasInput = z.infer<typeof UpdateCanvasSchema>

/**
 * Schema for reordering canvases
 */
export const ReorderCanvasesSchema = z.object({
    canvasOrders: z
        .array(
            z.object({
                canvasId: uuidSchema,
                sortOrder: z.number().int().min(1, 'Sort order must be at least 1')
            })
        )
        .min(1, 'At least one canvas order is required')
})

export type ReorderCanvasesInput = z.infer<typeof ReorderCanvasesSchema>

// ═══════════════════════════════════════════════════════════════════════════
// Canvas Version Schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Schema for creating a new canvas version
 */
export const CreateCanvasVersionSchema = z.object({
    label: optionalTrimmedString(200),
    description: optionalTrimmedString(2000),
    activate: z.boolean().default(false).optional()
})

export type CreateCanvasVersionInput = z.infer<typeof CreateCanvasVersionSchema>

/**
 * Schema for updating canvas version metadata
 */
export const UpdateCanvasVersionSchema = z
    .object({
        label: trimmedString(200).min(1, 'Version label cannot be empty').optional(),
        description: optionalTrimmedString(2000)
    })
    .refine((data) => data.label !== undefined || data.description !== undefined, {
        message: 'At least label or description must be provided'
    })

export type UpdateCanvasVersionInput = z.infer<typeof UpdateCanvasVersionSchema>

// ═══════════════════════════════════════════════════════════════════════════
// Path Parameters Schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Schema for unikId path parameter
 */
export const UnikIdParamSchema = z.object({
    unikId: uuidSchema,
    id: uuidSchema.optional() // Some routes use :id instead of :unikId
})

/**
 * Schema for space path parameters
 */
export const SpaceParamsSchema = z.object({
    unikId: uuidSchema.optional(),
    id: uuidSchema.optional(),
    spaceId: uuidSchema
})

/**
 * Schema for canvas path parameters
 */
export const CanvasParamsSchema = z.object({
    unikId: uuidSchema.optional(),
    id: uuidSchema.optional(),
    spaceId: uuidSchema.optional(),
    canvasId: uuidSchema
})

/**
 * Schema for canvas version path parameters
 */
export const CanvasVersionParamsSchema = z.object({
    unikId: uuidSchema.optional(),
    id: uuidSchema.optional(),
    spaceId: uuidSchema,
    canvasId: uuidSchema,
    versionId: uuidSchema
})

// ═══════════════════════════════════════════════════════════════════════════
// Validation Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validates request body against a schema
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated and typed data
 * @throws ZodError if validation fails
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
    return schema.parse(data)
}

/**
 * Safely validates request body, returning result object instead of throwing
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Object with success flag and either data or error
 */
export function safeValidateBody<T extends z.ZodTypeAny>(
    schema: T,
    data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: z.ZodError } {
    const result = schema.safeParse(data)
    if (result.success) {
        return { success: true, data: result.data }
    }
    return { success: false, error: result.error }
}

/**
 * Formats Zod validation errors into a user-friendly string
 * @param error - ZodError instance
 * @returns Formatted error message
 */
export function formatZodError(error: z.ZodError): string {
    return error.errors
        .map((e) => {
            const path = e.path.join('.')
            return path ? `${path}: ${e.message}` : e.message
        })
        .join('; ')
}

/**
 * Extracts unikId from request params (supports both :unikId and :id)
 */
export function extractUnikId(params: Record<string, string | undefined>): string | null {
    const unikId = params.unikId || params.id
    if (!unikId) return null
    const result = uuidSchema.safeParse(unikId)
    return result.success ? result.data : null
}
