import { z } from 'zod'

export const APPLICATION_BOT_PLATFORMS = ['telegram', 'max'] as const
export const APPLICATION_BOT_BINDING_STATUSES = ['draft', 'active', 'disabled'] as const

export const applicationBotPlatformSchema = z.enum(APPLICATION_BOT_PLATFORMS)
export const applicationBotBindingStatusSchema = z.enum(APPLICATION_BOT_BINDING_STATUSES)

const uuidV7Schema = z
    .string()
    .uuid()
    .refine((value) => value[14]?.toLowerCase() === '7', 'UUID v7 is required')

const messengerBotShortIdSchema = z.string().regex(/^[A-Za-z0-9_-]{22}$/u)

const displayNameDisclosurePattern = /\b(?:bearer|token|secret|password|credential|api[\s_-]*key|private[\s_-]*key|init[\s_-]*data)\b/iu
const displayNameCredentialPattern =
    /\b(?:sk[_-](?:live|test)[_-][a-z0-9_-]{12,}|xox[baprs]-[a-z0-9-]{10,}|gh[pousr]_[a-z0-9]{20,}|akia[a-z0-9]{16}|AIza[a-z0-9_-]{30,}|\d{6,12}:[a-z0-9_-]{20,})\b/iu

/** A display name is an operator label, never a place for contact or credential data. */
export const isSafeApplicationBotDisplayName = (value: string): boolean =>
    value.length >= 1 &&
    value.trim() === value &&
    !/[\p{Cc}\p{Cf}@:+]/u.test(value) &&
    (() => {
        let codePointLength = 0
        let decimalDigitCount = 0
        for (const character of value) {
            codePointLength += 1
            if (codePointLength > 120) return false
            if (/\p{Decimal_Number}/u.test(character)) decimalDigitCount += 1
        }
        return decimalDigitCount < 7
    })() &&
    !displayNameDisclosurePattern.test(value) &&
    !displayNameCredentialPattern.test(value)

const applicationBotDisplayNameSchema = z.string().refine(isSafeApplicationBotDisplayName)
const applicationBotDisplayNameInputSchema = z.string().trim().refine(isSafeApplicationBotDisplayName)

/** Canonical API DTO for a managed Telegram or MAX bot binding. */
export const applicationBotBindingSchema = z
    .object({
        id: uuidV7Schema,
        applicationId: uuidV7Schema,
        platform: applicationBotPlatformSchema,
        botUsername: z.string().min(1).max(64),
        displayName: applicationBotDisplayNameSchema.nullable(),
        shortId: messengerBotShortIdSchema,
        status: applicationBotBindingStatusSchema,
        version: z.number().int().positive(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
        releasedAt: z.string().datetime().nullable().optional()
    })
    .strip()

export const applicationBotBindingApiResponseSchema = z.union([
    applicationBotBindingSchema,
    z
        .object({ item: applicationBotBindingSchema })
        .strip()
        .transform(({ item }) => item)
])

export const applicationBotBindingListResponseSchema = z.object({ items: z.array(applicationBotBindingSchema) }).strip()

export const createApplicationBotBindingInputSchema = z
    .object({
        platform: applicationBotPlatformSchema,
        botUsername: z.string().trim().min(1).max(64),
        displayName: applicationBotDisplayNameInputSchema.nullable().optional()
    })
    .strict()

export const updateApplicationBotBindingInputSchema = z
    .object({
        botUsername: z.string().trim().min(1).max(64).optional(),
        displayName: applicationBotDisplayNameInputSchema.nullable().optional(),
        status: applicationBotBindingStatusSchema.optional(),
        expectedVersion: z.number().int().positive()
    })
    .strict()
    .refine((value) => value.botUsername !== undefined || value.displayName !== undefined || value.status !== undefined, {
        message: 'At least one binding field is required'
    })

export const releaseApplicationBotBindingInputSchema = z.object({ expectedVersion: z.number().int().positive() }).strict()

export type ApplicationBotPlatform = z.infer<typeof applicationBotPlatformSchema>
export type ApplicationBotBindingStatus = z.infer<typeof applicationBotBindingStatusSchema>
export type ApplicationBotBinding = z.infer<typeof applicationBotBindingSchema>
export type ApplicationBotBindingListResponse = z.infer<typeof applicationBotBindingListResponseSchema>
export type CreateApplicationBotBindingInput = z.infer<typeof createApplicationBotBindingInputSchema>
export type UpdateApplicationBotBindingInput = z.infer<typeof updateApplicationBotBindingInputSchema>
export type ReleaseApplicationBotBindingInput = z.infer<typeof releaseApplicationBotBindingInputSchema>
