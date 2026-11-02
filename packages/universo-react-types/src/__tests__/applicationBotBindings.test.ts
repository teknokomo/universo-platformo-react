import { describe, expect, it } from 'vitest'

import {
    applicationBotBindingApiResponseSchema,
    applicationBotBindingListResponseSchema,
    createApplicationBotBindingInputSchema,
    isSafeApplicationBotDisplayName,
    releaseApplicationBotBindingInputSchema,
    updateApplicationBotBindingInputSchema
} from '../common/applicationBotBindings'

const binding = {
    id: '019ccefc-2f7b-7b36-82f4-85cdb1312268',
    applicationId: '019ccefc-2f7b-7b36-82f4-85cdb1312299',
    platform: 'telegram',
    botUsername: 'supportbot',
    displayName: null,
    shortId: 'aBcdefGhijkLmNopQrStUv',
    status: 'active',
    version: 3,
    createdAt: '2026-10-31T10:00:00.000Z',
    updatedAt: '2026-10-31T10:01:00.000Z',
    releasedAt: null
} as const

describe('application bot binding shared contract', () => {
    it('parses and projects binding responses without returning unknown credentials or internal audit fields', () => {
        const response = applicationBotBindingApiResponseSchema.parse({ ...binding, token: 'must-not-escape', updatedBy: 'internal' })

        expect(response).toEqual(binding)
        expect(response).not.toHaveProperty('token')
        expect(response).not.toHaveProperty('updatedBy')
        expect(applicationBotBindingApiResponseSchema.safeParse({ ...binding, displayName: 'Bearer unsafecredentialvalue' }).success).toBe(
            false
        )
    })

    it('accepts the optional item envelope and validates v7 ids and 128-bit short-id shape', () => {
        expect(applicationBotBindingApiResponseSchema.parse({ item: binding })).toEqual(binding)
        expect(applicationBotBindingApiResponseSchema.safeParse({ ...binding, id: '019ccefc-2f7b-4b36-82f4-85cdb1312268' }).success).toBe(
            false
        )
        expect(applicationBotBindingApiResponseSchema.safeParse({ ...binding, shortId: 'too-short' }).success).toBe(false)
        expect(applicationBotBindingListResponseSchema.safeParse({ items: [binding] }).success).toBe(true)
    })

    it('rejects unknown input fields and empty or stale-version mutations', () => {
        expect(createApplicationBotBindingInputSchema.safeParse({ ...binding, botToken: 'secret' }).success).toBe(false)
        expect(updateApplicationBotBindingInputSchema.safeParse({ expectedVersion: 1 }).success).toBe(false)
        expect(updateApplicationBotBindingInputSchema.safeParse({ status: 'active', expectedVersion: 1, token: 'secret' }).success).toBe(
            false
        )
        expect(releaseApplicationBotBindingInputSchema.safeParse({ expectedVersion: 0 }).success).toBe(false)
    })

    it('accepts human-readable labels and rejects contact details, credential markers, and control characters', () => {
        expect(isSafeApplicationBotDisplayName('Команда поддержки')).toBe(true)
        expect(isSafeApplicationBotDisplayName('Messenger support team')).toBe(true)
        expect(isSafeApplicationBotDisplayName(`Support ${'١'.repeat(6)}`)).toBe(true)
        expect(isSafeApplicationBotDisplayName(`${'😀'.repeat(120)}`)).toBe(true)
        expect(
            createApplicationBotBindingInputSchema.safeParse({
                platform: 'telegram',
                botUsername: 'supportbot',
                displayName: '😀'.repeat(120)
            }).success
        ).toBe(true)
        for (const unsafeLabel of [
            'support@example.com',
            '+1 (555) 123-4567',
            `Телефон ${'١'.repeat(7)}`,
            `Телефон ${'१'.repeat(7)}`,
            `Телефон ${'１'.repeat(7)}`,
            '😀'.repeat(121),
            'Bearer abcdefghijklmnopqrstuvwxyz',
            'Telegram 123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi',
            'line\nbreak'
        ]) {
            expect(isSafeApplicationBotDisplayName(unsafeLabel)).toBe(false)
            expect(
                createApplicationBotBindingInputSchema.safeParse({
                    platform: 'telegram',
                    botUsername: 'supportbot',
                    displayName: unsafeLabel
                }).success
            ).toBe(false)
        }
        expect(
            createApplicationBotBindingInputSchema.safeParse({
                platform: 'telegram',
                botUsername: 'supportbot',
                displayName: '😀'.repeat(121)
            }).success
        ).toBe(false)
    })
})
