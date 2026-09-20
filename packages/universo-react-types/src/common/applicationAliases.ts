import { z } from 'zod'
import { publicMarketingPageDataSchema } from './marketingPage'

export const APPLICATION_ALIAS_ROUTING_MODES = ['direct', 'canonical'] as const
export type ApplicationAliasRoutingMode = (typeof APPLICATION_ALIAS_ROUTING_MODES)[number]
export const applicationAliasRoutingModeSchema = z.enum(APPLICATION_ALIAS_ROUTING_MODES)

export const APPLICATION_ALIAS_MIN_LENGTH = 1
export const APPLICATION_ALIAS_MAX_LENGTH = 63
export const APPLICATION_ALIAS_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/**
 * Platform-owned route words that must never become application aliases.
 * Keep this registry shared between API validation and route-entry logic.
 */
export const RESERVED_APPLICATION_ALIASES = new Set([
    'admin',
    'api',
    'applications',
    'auth',
    'dashboard',
    'instances',
    'login',
    'logout',
    'metahubs',
    'metapanel',
    'privacy',
    'public',
    'settings',
    'start',
    'terms'
])

export const APPLICATION_ALIAS_VALIDATION_REASONS = ['format', 'uuid', 'reserved'] as const
export type ApplicationAliasValidationReason = (typeof APPLICATION_ALIAS_VALIDATION_REASONS)[number]

export class ApplicationAliasValidationError extends Error {
    readonly reason: ApplicationAliasValidationReason

    constructor(reason: ApplicationAliasValidationReason) {
        super(`Invalid application alias: ${reason}`)
        this.name = 'ApplicationAliasValidationError'
        this.reason = reason
    }
}

const UUID_SHAPED_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const containsNonAsciiOrControlCharacter = (value: string): boolean => {
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index)
        if (code <= 0x1f || code === 0x7f || code > 0x7f) return true
    }
    return false
}

export function normalizeApplicationAlias(input: string): string {
    if (typeof input !== 'string') throw new ApplicationAliasValidationError('format')
    const raw = input

    if (containsNonAsciiOrControlCharacter(raw) || raw.includes('/') || raw.includes('\\') || raw.includes('%')) {
        throw new ApplicationAliasValidationError('format')
    }

    const alias = raw.trim().toLowerCase()
    if (
        alias.length < APPLICATION_ALIAS_MIN_LENGTH ||
        alias.length > APPLICATION_ALIAS_MAX_LENGTH ||
        !APPLICATION_ALIAS_PATTERN.test(alias)
    ) {
        throw new ApplicationAliasValidationError('format')
    }
    if (UUID_SHAPED_RE.test(alias)) throw new ApplicationAliasValidationError('uuid')
    if (RESERVED_APPLICATION_ALIASES.has(alias)) throw new ApplicationAliasValidationError('reserved')
    return alias
}

export const applicationAliasSchema = z.string().transform((value, context) => {
    try {
        return normalizeApplicationAlias(value)
    } catch (error) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: error instanceof ApplicationAliasValidationError ? error.reason : 'format'
        })
        return z.NEVER
    }
})

const uuidV7Schema = z
    .string()
    .uuid()
    .refine((value) => value[14]?.toLowerCase() === '7', 'UUID v7 is required')

export const applicationAliasRecordSchema = z
    .object({
        id: uuidV7Schema,
        applicationId: uuidV7Schema,
        alias: applicationAliasSchema,
        isPrimary: z.boolean(),
        releasedAt: z.string().datetime().nullable(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime()
    })
    .strict()
export type ApplicationAliasRecord = z.infer<typeof applicationAliasRecordSchema>

export const APPLICATION_PUBLIC_ROUTE_MATCH_KINDS = ['uuid', 'alias'] as const
export type ApplicationPublicRouteMatchKind = (typeof APPLICATION_PUBLIC_ROUTE_MATCH_KINDS)[number]

export const applicationPublicRouteResolutionSchema = z
    .object({
        applicationId: uuidV7Schema,
        matchedBy: z.enum(APPLICATION_PUBLIC_ROUTE_MATCH_KINDS),
        matchedAlias: applicationAliasSchema.nullable(),
        routingMode: applicationAliasRoutingModeSchema,
        primaryAlias: applicationAliasSchema.nullable(),
        canonicalAlias: applicationAliasSchema.nullable()
    })
    .strict()
export type ApplicationPublicRouteResolution = z.infer<typeof applicationPublicRouteResolutionSchema>

/** Public route metadata contains no internal application identifier. */
export const publicApplicationRouteResolutionSchema = applicationPublicRouteResolutionSchema.omit({ applicationId: true })
export type PublicApplicationRouteResolution = z.infer<typeof publicApplicationRouteResolutionSchema>

/**
 * Authenticated runtime reference resolution deliberately returns only the
 * internal application id required by the existing runtime guards.
 */
export const authenticatedApplicationRuntimeReferenceSchema = z
    .object({
        applicationId: uuidV7Schema
    })
    .strict()
export type AuthenticatedApplicationRuntimeReference = z.infer<typeof authenticatedApplicationRuntimeReferenceSchema>

export const publicMarketingApplicationRuntimeSchema = z
    .object({
        route: publicApplicationRouteResolutionSchema,
        templateKey: z.literal('marketing-page'),
        marketingPage: publicMarketingPageDataSchema
    })
    .strict()
export type PublicMarketingApplicationRuntime = z.infer<typeof publicMarketingApplicationRuntimeSchema>

export const PUBLIC_APPLICATION_RUNTIME_ERROR_CODE = 'PUBLIC_APPLICATION_NOT_AVAILABLE' as const
