import { z } from 'zod'
import type { VlcSchemaVersion, SupportedLocale } from '../common/admin'

// ============================================================
// VLC (Versioned Localized Content) Validation Schemas
// ============================================================

/**
 * Supported locale codes
 * Matches SupportedLocale type from common/admin.ts
 */
export const SupportedLocaleSchema = z.enum(['en', 'ru'])

/**
 * VLC locale entry metadata
 */
export const VlcLocaleEntrySchema = z.object({
    content: z.unknown(),
    version: z.number().int().positive(),
    isActive: z.boolean(),
    createdAt: z.string().datetime({ message: 'createdAt must be ISO 8601 format' }),
    updatedAt: z.string().datetime({ message: 'updatedAt must be ISO 8601 format' })
})

/**
 * Generic VLC schema for any content type
 * Use VlcStringSchema for string-only VLC (display names)
 */
export const VersionedLocalizedContentSchema = z.object({
    _schema: z.literal('1' satisfies VlcSchemaVersion),
    _primary: SupportedLocaleSchema,
    locales: z
        .record(SupportedLocaleSchema, VlcLocaleEntrySchema)
        .refine((locales) => Object.keys(locales).length > 0, {
            message: 'At least one locale is required'
        })
})

/**
 * VLC schema for string content (display names, descriptions)
 * Validates that content is a non-empty string
 */
export const VlcStringSchema = VersionedLocalizedContentSchema.extend({
    locales: z.record(
        SupportedLocaleSchema,
        VlcLocaleEntrySchema.extend({
            content: z.string().min(1, 'Content cannot be empty')
        })
    )
})

/**
 * Optional VLC string schema (allows null/undefined)
 */
export const VlcStringOptionalSchema = VlcStringSchema.nullable().optional()

// Type exports for runtime validation results
export type ValidatedVlcLocaleEntry = z.infer<typeof VlcLocaleEntrySchema>
export type ValidatedVlcContent = z.infer<typeof VersionedLocalizedContentSchema>
export type ValidatedVlcString = z.infer<typeof VlcStringSchema>
