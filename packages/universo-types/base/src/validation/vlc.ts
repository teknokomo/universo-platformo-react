import { z } from 'zod'
import type { LocalizedContentSchemaVersion } from '../common/admin'

// ============================================================
// Localized Content Validation Schemas
// ============================================================

/**
 * Locale code validation (dynamic, BCP47-like format)
 * Format: 2-letter ISO 639-1 code, optionally with region (e.g., 'en', 'ru', 'en-US')
 */
export const LocaleCodeSchema = z
    .string()
    .min(2, 'Locale code must be at least 2 characters')
    .max(10, 'Locale code must be at most 10 characters')
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Invalid locale code format')

/**
 * Localized content entry metadata schema
 */
export const LocalizedContentEntrySchema = z.object({
    content: z.unknown(),
    version: z.number().int().positive(),
    isActive: z.boolean(),
    createdAt: z.string().datetime({ message: 'createdAt must be ISO 8601 format' }),
    updatedAt: z.string().datetime({ message: 'updatedAt must be ISO 8601 format' })
})

/**
 * Generic localized content schema for any content type
 * Use LocalizedStringSchema for string-only content (display names)
 */
export const VersionedLocalizedContentSchema = z.object({
    _schema: z.literal('1' satisfies LocalizedContentSchemaVersion),
    _primary: LocaleCodeSchema,
    locales: z.record(LocaleCodeSchema, LocalizedContentEntrySchema).refine((locales) => Object.keys(locales).length > 0, {
        message: 'At least one locale is required'
    })
})

/**
 * Localized content schema for string content (display names, descriptions)
 * Validates that content is a non-empty string
 */
export const LocalizedStringSchema = VersionedLocalizedContentSchema.extend({
    locales: z.record(
        LocaleCodeSchema,
        LocalizedContentEntrySchema.extend({
            content: z.string().min(1, 'Content cannot be empty')
        })
    )
})

/**
 * Localized content schema for optional string content (e.g., descriptions)
 * Allows empty strings in content - useful for optional fields where user may start editing
 */
export const LocalizedStringAllowEmptySchema = VersionedLocalizedContentSchema.extend({
    locales: z.record(
        LocaleCodeSchema,
        LocalizedContentEntrySchema.extend({
            content: z.string() // Allow empty strings
        })
    )
})

/**
 * Optional localized string schema (allows null/undefined or empty content)
 * Use for optional fields like descriptions where content may be empty
 */
export const LocalizedStringOptionalSchema = LocalizedStringAllowEmptySchema.nullable().optional()

// Type exports for runtime validation results
export type ValidatedLocalizedContentEntry = z.infer<typeof LocalizedContentEntrySchema>
export type ValidatedLocalizedContent = z.infer<typeof VersionedLocalizedContentSchema>
export type ValidatedLocalizedString = z.infer<typeof LocalizedStringSchema>
