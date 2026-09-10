import { describe, expect, it } from 'vitest'

import {
    canonicalRuntimeTargetIdentity,
    canonicalRuntimeTargetKey,
    normalizeRuntimeLayoutTarget,
    normalizeRuntimeTarget,
    uuidV7Schema
} from '../identity'

const applicationId = '0190a9b5-3cde-7abc-8def-0123456789a1'
const entityTypeId = '0190a9b5-3cde-7abc-8def-0123456789a2'

describe('layout identity helpers', () => {
    it('shares canonical optional target normalization with hosted and standalone clients', () => {
        expect(
            normalizeRuntimeLayoutTarget({
                targetKind: 'object',
                entityTypeCodename: '  ContentObject  ',
                workspaceId: '  0190A9B5-3CDE-7ABC-8DEF-0123456789A3  ',
                locale: ' EN_us ',
                themeVariant: 'dark'
            })
        ).toEqual({
            targetKind: 'object',
            entityTypeId: null,
            entityTypeCodename: 'ContentObject',
            workspaceId: '0190a9b5-3cde-7abc-8def-0123456789a3',
            locale: 'en-us',
            themeVariant: 'dark'
        })
    })

    it('validates UUID v7 without changing generic UUID validation', () => {
        expect(uuidV7Schema.safeParse(applicationId).success).toBe(true)
        expect(uuidV7Schema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(false)
    })

    it('normalizes target identity while preserving the five-way selector', () => {
        expect(
            normalizeRuntimeTarget({
                applicationId: applicationId.toUpperCase(),
                targetKind: 'page',
                entityTypeId: entityTypeId.toUpperCase(),
                workspaceId: '0190a9b5-3cde-7abc-8def-0123456789a3',
                locale: ' EN_us ',
                themeVariant: 'dark'
            })
        ).toEqual({
            applicationId,
            targetKind: 'page',
            entityTypeId,
            workspaceId: '0190a9b5-3cde-7abc-8def-0123456789a3',
            locale: 'en-us',
            themeVariant: 'dark'
        })
    })

    it('rejects record selectors and unknown target fields', () => {
        expect(() =>
            normalizeRuntimeTarget({
                applicationId,
                targetKind: null,
                locale: 'en',
                recordKey: 'hero'
            })
        ).toThrow()
        expect(() =>
            normalizeRuntimeTarget({
                applicationId,
                targetKind: 'object',
                entityTypeCodename: 'ContentObject',
                locale: 'en',
                unknown: true
            })
        ).toThrow()
    })

    it('produces stable canonical identity and query-key segments', () => {
        const input = {
            applicationId,
            targetKind: 'object' as const,
            entityTypeCodename: ' ContentObject ',
            locale: 'EN_us'
        }

        expect(canonicalRuntimeTargetIdentity(input)).toBe(
            '{"applicationId":"0190a9b5-3cde-7abc-8def-0123456789a1","locale":"en-us","targetKind":"object","entityTypeCodename":"ContentObject"}'
        )
        expect(canonicalRuntimeTargetKey(input)).toEqual([
            'applications',
            applicationId,
            'runtime',
            'effective-layout',
            {
                applicationId,
                targetKind: 'object',
                entityTypeCodename: 'ContentObject',
                locale: 'en-us'
            }
        ])
    })
})
