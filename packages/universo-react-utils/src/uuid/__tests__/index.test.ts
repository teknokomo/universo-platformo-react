import { extractTimestampFromUuidV7, isUuidV7, isValidUuid } from '../index'
import { describe, expect, it } from 'vitest'

describe('UUID utilities', () => {
    it('recognizes UUID v7 and rejects other UUID versions', () => {
        expect(isUuidV7('019ccefc-2f7b-7b36-82f4-85cdb1312268')).toBe(true)
        expect(isUuidV7('550e8400-e29b-41d4-a716-446655440000')).toBe(false)
        expect(isUuidV7('not-a-uuid')).toBe(false)
        expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
    })

    it('keeps UUID v7 timestamp extraction available for valid values', () => {
        expect(extractTimestampFromUuidV7('019ccefc-2f7b-7b36-82f4-85cdb1312268')).toBeInstanceOf(Date)
    })
})
