import { describe, expect, it } from 'vitest'
import {
    GlobalShortLinkSlugValidationError,
    globalShortLinkQuizAccessOptionSchema,
    globalShortLinkCreateInputSchema,
    globalShortLinkRecordSchema,
    globalShortLinkResourceOptionsResponseSchema,
    globalShortLinkResolveResponseSchema,
    globalShortLinkSlugSchema,
    globalShortLinkTargetSchema,
    normalizeGlobalShortLinkSlug,
    RESERVED_GLOBAL_SHORT_LINK_SLUGS
} from '../common/globalShortLinks'

const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
const workspaceId = '019ccefc-2f7b-7b36-82f4-85cdb1312269'
const accessLinkId = '019ccefc-2f7b-7b36-82f4-85cdb1312270'
const compactUuidV7 = '019ccefc2f7b7b3682f485cdb1312268'

describe('global short-link contracts', () => {
    it('keeps quiz target selectors human-readable and free of record identities', () => {
        expect(
            globalShortLinkQuizAccessOptionSchema.parse({
                id: accessLinkId,
                slug: 'grade-5',
                label: '5 класс — Интеллектуальный марафон',
                workspaceId,
                workspaceLabel: 'Лицей'
            })
        ).toEqual({
            id: accessLinkId,
            slug: 'grade-5',
            label: '5 класс — Интеллектуальный марафон',
            workspaceId,
            workspaceLabel: 'Лицей'
        })
        expect(() =>
            globalShortLinkQuizAccessOptionSchema.parse({
                slug: 'grade-5',
                label: 'Quiz',
                workspaceId: null,
                workspaceLabel: null,
                id: 'raw-id'
            })
        ).toThrow()
    })

    it('limits application-resource options to user-facing labels and supported runtime target kinds', () => {
        const option = { targetKind: 'page', entityTypeCodename: 'home', label: 'Главная страница' }
        expect(globalShortLinkResourceOptionsResponseSchema.parse({ items: [option] })).toEqual({ items: [option] })
        expect(globalShortLinkResourceOptionsResponseSchema.safeParse({ items: [{ ...option, schemaName: 'tenant' }] }).success).toBe(false)
        expect(globalShortLinkResourceOptionsResponseSchema.safeParse({ items: [{ ...option, targetKind: 'table' }] }).success).toBe(false)
    })

    it('normalizes ordinary slugs and accepts one compact UUID v7 segment', () => {
        expect(normalizeGlobalShortLinkSlug('  Lyceum-Marathon-7  ')).toBe('lyceum-marathon-7')
        expect(globalShortLinkSlugSchema.parse(compactUuidV7)).toBe(compactUuidV7)
        expect(globalShortLinkSlugSchema.parse(applicationId)).toBe(applicationId)
    })

    it('rejects path delimiters, encoded delimiters, non-ASCII, controls and malformed segments', () => {
        for (const value of ['a/b', 'a\\b', 'a%2fb', 'пример', 'quiz\u0000x', 'a b', '-start', 'end-']) {
            expect(() => normalizeGlobalShortLinkSlug(value)).toThrow(GlobalShortLinkSlugValidationError)
        }
        expect(() => normalizeGlobalShortLinkSlug('a'.repeat(64))).toThrow(GlobalShortLinkSlugValidationError)
        expect(() => normalizeGlobalShortLinkSlug(null as unknown as string)).toThrowError(
            expect.objectContaining<GlobalShortLinkSlugValidationError>({ reason: 'format' })
        )
    })

    it('allows UUID-shaped slugs only when they are valid UUID v7 values', () => {
        const invalidV4 = '019ccefc-2f7b-4b36-82f4-85cdb1312268'
        const invalidVariant = '019ccefc-2f7b-7b36-72f4-85cdb1312268'
        expect(() => normalizeGlobalShortLinkSlug(invalidV4)).toThrowError(
            expect.objectContaining<GlobalShortLinkSlugValidationError>({ reason: 'uuid' })
        )
        expect(() => normalizeGlobalShortLinkSlug(invalidVariant)).toThrowError(
            expect.objectContaining<GlobalShortLinkSlugValidationError>({ reason: 'uuid' })
        )
    })

    it('rejects platform route and system names case-insensitively', () => {
        expect(Object.isFrozen(RESERVED_GLOBAL_SHORT_LINK_SLUGS)).toBe(true)
        for (const slug of RESERVED_GLOBAL_SHORT_LINK_SLUGS) {
            expect(() => normalizeGlobalShortLinkSlug(slug)).toThrowError(
                expect.objectContaining<GlobalShortLinkSlugValidationError>({ reason: 'reserved' })
            )
        }
        expect(() => normalizeGlobalShortLinkSlug('ADMIN')).toThrow(GlobalShortLinkSlugValidationError)
    })

    it('accepts only supported, allowlisted destination contracts', () => {
        const targets = [
            { kind: 'application-entry', applicationId },
            { kind: 'application-section', applicationId, section: 'dashboard' },
            { kind: 'application-section', applicationId, section: 'workspace' },
            { kind: 'application-resource', applicationId, targetKind: 'page', entityTypeCodename: 'home' },
            { kind: 'application-resource', applicationId, targetKind: 'object', entityTypeCodename: 'quizzes' },
            { kind: 'lms-access-link', applicationId, accessLinkId, accessLinkSlug: 'grade-7-quiz', workspaceId }
        ]

        for (const target of targets) expect(globalShortLinkTargetSchema.safeParse(target).success).toBe(true)
        expect(globalShortLinkTargetSchema.safeParse({ kind: 'redirect', url: 'https://example.com' }).success).toBe(false)
        expect(globalShortLinkTargetSchema.safeParse({ kind: 'application-section', applicationId, section: '../admin' }).success).toBe(
            false
        )
        expect(globalShortLinkTargetSchema.safeParse({ kind: 'application-section', applicationId, section: 'reports' }).success).toBe(
            false
        )
        expect(
            globalShortLinkTargetSchema.safeParse({ kind: 'application-resource', applicationId, entityTypeId: applicationId }).success
        ).toBe(false)
        expect(
            globalShortLinkTargetSchema.safeParse({
                kind: 'application-resource',
                applicationId,
                targetKind: 'table',
                entityTypeCodename: 'invalid kind'
            }).success
        ).toBe(false)
        expect(
            globalShortLinkTargetSchema.safeParse({ kind: 'lms-access-link', applicationId, accessLinkSlug: 'https://example.com' }).success
        ).toBe(false)
        expect(globalShortLinkTargetSchema.safeParse({ kind: 'application-entry', applicationId, path: '/admin' }).success).toBe(false)
    })

    it('validates the public global short-link resolution response', () => {
        const target = { kind: 'application-entry', applicationId } as const
        expect(globalShortLinkResolveResponseSchema.safeParse({ target }).success).toBe(true)
        expect(globalShortLinkResolveResponseSchema.safeParse({ target, applicationId }).success).toBe(false)
        expect(globalShortLinkResolveResponseSchema.safeParse({ target: { kind: 'redirect', url: 'https://example.com' } }).success).toBe(
            false
        )
    })

    it('requires UUID v7 identifiers and strict record fields', () => {
        const target = { kind: 'application-entry', applicationId } as const
        expect(globalShortLinkCreateInputSchema.safeParse({ slug: 'entry', target }).success).toBe(true)
        expect(globalShortLinkCreateInputSchema.safeParse({ slug: 'entry', target, url: 'https://example.com' }).success).toBe(false)
        expect(
            globalShortLinkTargetSchema.safeParse({ kind: 'application-entry', applicationId: '019ccefc-2f7b-4b36-82f4-85cdb1312268' })
                .success
        ).toBe(false)
        expect(
            globalShortLinkTargetSchema.safeParse({
                kind: 'application-entry',
                applicationId: '019ccefc-2f7b-7b36-72f4-85cdb1312268'
            }).success
        ).toBe(false)

        expect(
            globalShortLinkRecordSchema.safeParse({
                id: '019ccefc-2f7b-4b36-82f4-85cdb1312268',
                slug: 'entry',
                target,
                releasedAt: null,
                createdAt: '2026-10-11T10:00:00.000Z',
                updatedAt: '2026-10-11T10:00:00.000Z'
            }).success
        ).toBe(false)
    })
})
