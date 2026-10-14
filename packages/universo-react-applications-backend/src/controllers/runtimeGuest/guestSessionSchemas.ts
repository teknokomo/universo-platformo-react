import { z } from 'zod'
import { globalShortLinkUuidV7Schema } from '@universo-react/types'
import { MAX_GUEST_SESSION_TOKEN_LENGTH } from './guestSessionTokens'

export const createGuestSessionSchema = z
    .object({
        accessLinkId: z.string().uuid(),
        workspaceId: globalShortLinkUuidV7Schema.optional(),
        displayName: z.string().trim().min(1).max(255).optional(),
        firstName: z.string().trim().max(100).optional(),
        lastName: z.string().trim().max(100).optional(),
        email: z.string().trim().email().max(320).optional(),
        phone: z.string().trim().max(32).optional(),
        termsAccepted: z.boolean().optional(),
        privacyAccepted: z.boolean().optional(),
        captchaToken: z.string().trim().max(8192).optional()
    })
    .strict()

export const publicRuntimeQuerySchema = z
    .object({
        slug: z.string().trim().min(1).max(255),
        targetType: z.enum(['content', 'assessment', 'quiz']).optional(),
        targetId: z.string().uuid().optional(),
        locale: z.string().trim().min(2).max(32).optional()
    })
    .superRefine((value, ctx) => {
        if (value.targetType && !value.targetId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['targetId'],
                message: 'targetId is required when targetType is provided'
            })
        }
    })

export const guestRuntimeLocaleSchema = z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[a-zA-Z]{2,3}(?:[-_][a-zA-Z0-9]{2,8})*$/)

export const resolveGuestRuntimeLocale = (value: unknown): { valid: true; locale: string } | { valid: false } => {
    if (value === undefined) return { valid: true, locale: 'en' }
    const parsed = guestRuntimeLocaleSchema.safeParse(value)
    return parsed.success ? { valid: true, locale: parsed.data } : { valid: false }
}

export const guestProgressSchema = z
    .object({
        participantId: z.string().uuid().optional(),
        studentId: z.string().uuid().optional(),
        sessionToken: z.string().trim().min(1).max(MAX_GUEST_SESSION_TOKEN_LENGTH),
        contentNodeId: z.string().uuid(),
        contentItemId: z.string().uuid().optional(),
        action: z.enum(['view', 'complete', 'recalculate'])
    })
    .strict()
    .superRefine((value, ctx) => {
        if (!value.participantId && !value.studentId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['participantId'], message: 'participantId is required' })
        }
        if (value.participantId && value.studentId && value.participantId !== value.studentId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['studentId'], message: 'studentId alias must match participantId' })
        }
    })
    .transform((value) => ({
        participantId: value.participantId ?? value.studentId!,
        sessionToken: value.sessionToken,
        contentNodeId: value.contentNodeId,
        contentItemId: value.contentItemId,
        action: value.action
    }))
