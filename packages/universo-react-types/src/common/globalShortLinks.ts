import { z } from 'zod'
import { runtimeEntityCodenameSchema } from './applicationLayouts'

export const GLOBAL_SHORT_LINK_SLUG_MIN_LENGTH = 1
export const GLOBAL_SHORT_LINK_SLUG_MAX_LENGTH = 63
export const GLOBAL_SHORT_LINK_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/** Route names reserved for platform-owned pages and system endpoints. */
export const RESERVED_GLOBAL_SHORT_LINK_SLUGS = Object.freeze([
    'a',
    'admin',
    'api',
    'applications',
    'assets',
    'auth',
    'callback',
    'dashboard',
    'health',
    'instances',
    'l',
    'login',
    'logout',
    'metahub',
    'metahubs',
    'metapanel',
    'oauth',
    'privacy',
    'profile',
    'public',
    'robots',
    'settings',
    'start',
    'status',
    'terms',
    'uploads',
    'webhooks',
    'well-known'
] as const)

export const GLOBAL_SHORT_LINK_SLUG_VALIDATION_REASONS = ['format', 'uuid', 'reserved'] as const
export type GlobalShortLinkSlugValidationReason = (typeof GLOBAL_SHORT_LINK_SLUG_VALIDATION_REASONS)[number]

export class GlobalShortLinkSlugValidationError extends Error {
    readonly reason: GlobalShortLinkSlugValidationReason

    constructor(reason: GlobalShortLinkSlugValidationReason) {
        super(`Invalid global short-link slug: ${reason}`)
        this.name = 'GlobalShortLinkSlugValidationError'
        this.reason = reason
    }
}

const UUID_SHAPED_RE = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
const UUID_V7_VERSION = '7'
const UUID_VARIANT_NIBBLES = new Set(['8', '9', 'a', 'b'])

const uuidV7Schema = z
    .string()
    .uuid()
    .refine(
        (value) => value[14]?.toLowerCase() === UUID_V7_VERSION && UUID_VARIANT_NIBBLES.has(value[19]?.toLowerCase() ?? ''),
        'A valid UUID v7 is required'
    )

export const globalShortLinkUuidV7Schema = uuidV7Schema

export const GLOBAL_SHORT_LINK_APPLICATION_SECTIONS = ['dashboard', 'workspace'] as const
export type GlobalShortLinkApplicationSection = (typeof GLOBAL_SHORT_LINK_APPLICATION_SECTIONS)[number]
export const globalShortLinkApplicationSectionSchema = z.enum(GLOBAL_SHORT_LINK_APPLICATION_SECTIONS)

export const GLOBAL_SHORT_LINK_RESOURCE_KINDS = ['page', 'object'] as const
export type GlobalShortLinkResourceKind = (typeof GLOBAL_SHORT_LINK_RESOURCE_KINDS)[number]
export const globalShortLinkResourceKindSchema = z.enum(GLOBAL_SHORT_LINK_RESOURCE_KINDS)

export const globalShortLinkResourceOptionSchema = z
    .object({
        targetKind: globalShortLinkResourceKindSchema,
        entityTypeCodename: runtimeEntityCodenameSchema,
        label: z.string().trim().min(1).max(1000)
    })
    .strict()

export const globalShortLinkResourceOptionsResponseSchema = z
    .object({
        items: z.array(globalShortLinkResourceOptionSchema).max(100)
    })
    .strict()

export type GlobalShortLinkResourceOption = z.infer<typeof globalShortLinkResourceOptionSchema>

const accessLinkSlugSchema = z
    .string()
    .min(1)
    .max(255)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'AccessLink slug must be a single ASCII segment')

export const globalShortLinkQuizAccessOptionSchema = z
    .object({
        id: uuidV7Schema,
        slug: accessLinkSlugSchema,
        label: z.string().trim().min(1).max(1000),
        workspaceId: uuidV7Schema.nullable(),
        workspaceLabel: z.string().trim().min(1).max(255).nullable()
    })
    .strict()

export const globalShortLinkQuizAccessOptionsResponseSchema = z
    .object({
        items: z.array(globalShortLinkQuizAccessOptionSchema).max(100)
    })
    .strict()

export type GlobalShortLinkQuizAccessOption = z.infer<typeof globalShortLinkQuizAccessOptionSchema>

export const globalShortLinkTargetSchema = z.discriminatedUnion('kind', [
    z
        .object({
            kind: z.literal('application-entry'),
            applicationId: uuidV7Schema
        })
        .strict(),
    z
        .object({
            kind: z.literal('application-section'),
            applicationId: uuidV7Schema,
            section: globalShortLinkApplicationSectionSchema
        })
        .strict(),
    z
        .object({
            kind: z.literal('application-resource'),
            applicationId: uuidV7Schema,
            targetKind: globalShortLinkResourceKindSchema,
            entityTypeCodename: runtimeEntityCodenameSchema
        })
        .strict(),
    z
        .object({
            kind: z.literal('lms-access-link'),
            applicationId: uuidV7Schema,
            accessLinkId: uuidV7Schema,
            accessLinkSlug: accessLinkSlugSchema,
            workspaceId: uuidV7Schema.nullable()
        })
        .strict()
])
export type GlobalShortLinkTarget = z.infer<typeof globalShortLinkTargetSchema>

export function normalizeGlobalShortLinkSlug(input: string): string {
    if (typeof input !== 'string') throw new GlobalShortLinkSlugValidationError('format')

    for (let index = 0; index < input.length; index += 1) {
        const code = input.charCodeAt(index)
        if (code <= 0x1f || code === 0x7f || code > 0x7f) throw new GlobalShortLinkSlugValidationError('format')
    }
    if (input.includes('/') || input.includes('\\') || input.includes('%')) throw new GlobalShortLinkSlugValidationError('format')

    const slug = input.trim().toLowerCase()
    if (
        slug.length < GLOBAL_SHORT_LINK_SLUG_MIN_LENGTH ||
        slug.length > GLOBAL_SHORT_LINK_SLUG_MAX_LENGTH ||
        !GLOBAL_SHORT_LINK_SLUG_PATTERN.test(slug)
    ) {
        throw new GlobalShortLinkSlugValidationError('format')
    }

    if (UUID_SHAPED_RE.test(slug)) {
        const compactUuid = slug.replace(/-/g, '')
        if (compactUuid[12] !== UUID_V7_VERSION || !UUID_VARIANT_NIBBLES.has(compactUuid[16])) {
            throw new GlobalShortLinkSlugValidationError('uuid')
        }
    }

    if (RESERVED_GLOBAL_SHORT_LINK_SLUGS.some((reservedSlug) => reservedSlug === slug)) {
        throw new GlobalShortLinkSlugValidationError('reserved')
    }
    return slug
}

export const globalShortLinkSlugSchema = z.string().transform((value, context) => {
    try {
        return normalizeGlobalShortLinkSlug(value)
    } catch (error) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: error instanceof GlobalShortLinkSlugValidationError ? error.reason : 'format'
        })
        return z.NEVER
    }
})

export const globalShortLinkCreateInputSchema = z
    .object({
        slug: globalShortLinkSlugSchema,
        target: globalShortLinkTargetSchema
    })
    .strict()
export type GlobalShortLinkCreateInput = z.infer<typeof globalShortLinkCreateInputSchema>

export const globalShortLinkRecordSchema = z
    .object({
        id: uuidV7Schema,
        slug: globalShortLinkSlugSchema,
        target: globalShortLinkTargetSchema,
        releasedAt: z.string().datetime().nullable(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime()
    })
    .strict()
export type GlobalShortLinkRecord = z.infer<typeof globalShortLinkRecordSchema>

/** Public HTTP contract for resolving a global short link without redirecting. */
export const globalShortLinkResolveResponseSchema = z
    .object({
        target: globalShortLinkTargetSchema
    })
    .strict()
export type GlobalShortLinkResolveResponse = z.infer<typeof globalShortLinkResolveResponseSchema>
