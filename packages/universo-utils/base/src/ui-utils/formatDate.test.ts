/**
 * Unit tests for formatDate utility
 * Testing dayjs-based date formatting with i18n integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { formatDate, formatRange } from './formatDate'

// Mock i18n instance for testing
interface I18nInstance {
    language: string
}

describe('formatDate', () => {
    // Store original globalThis state
    let originalI18n: any

    beforeEach(() => {
        // Save original globalThis state
        if (typeof globalThis !== 'undefined') {
            originalI18n = (globalThis as any).__universo_i18n__instance
        }
    })

    afterEach(() => {
        // Restore original globalThis state
        if (typeof globalThis !== 'undefined') {
            if (originalI18n) {
                (globalThis as any).__universo_i18n__instance = originalI18n
            } else {
                delete (globalThis as any).__universo_i18n__instance
            }
        }
    })

    describe('Valid date formatting', () => {
        const testDate = new Date('2025-10-31T14:30:00Z')

        it('should format valid date with "full" pattern', () => {
            const result = formatDate(testDate, 'full')
            expect(result).toBeTruthy()
            expect(result).toContain('2025')
        })

        it('should format valid date with "short" pattern', () => {
            const result = formatDate(testDate, 'short')
            expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/)
            expect(result).toContain('2025-10-31')
        })

        it('should format valid date with "date" pattern', () => {
            const result = formatDate(testDate, 'date')
            expect(result).toBeTruthy()
            expect(result).toContain('2025')
            expect(result).toContain('31')
        })

        it('should format valid date with "time" pattern', () => {
            const result = formatDate(testDate, 'time')
            expect(result).toMatch(/\d{2}:\d{2}:\d{2}/)
        })

        it('should format valid date with "iso" pattern', () => {
            const result = formatDate(testDate, 'iso')
            expect(result).toBe('2025-10-31T14:30:00.000Z')
        })

        it('should format valid date with "relative" pattern', () => {
            const recentDate = new Date(Date.now() - 60000) // 1 minute ago
            const result = formatDate(recentDate, 'relative')
            expect(result).toBeTruthy()
            expect(result.toLowerCase()).toMatch(/minute|ago/)
        })
    })

    describe('Invalid date handling', () => {
        it('should return empty string for null', () => {
            expect(formatDate(null)).toBe('')
        })

        it('should return empty string for undefined', () => {
            expect(formatDate(undefined)).toBe('')
        })

        it('should return empty string for invalid date string', () => {
            expect(formatDate('invalid-date-string')).toBe('')
        })

        it('should return empty string for NaN', () => {
            expect(formatDate(NaN)).toBe('')
        })
    })

    describe('Input type flexibility', () => {
        it('should handle Date object', () => {
            const date = new Date('2025-01-15T10:00:00Z')
            const result = formatDate(date, 'iso')
            expect(result).toBe('2025-01-15T10:00:00.000Z')
        })

        it('should handle ISO string', () => {
            const result = formatDate('2025-01-15T10:00:00Z', 'iso')
            expect(result).toBe('2025-01-15T10:00:00.000Z')
        })

        it('should handle timestamp number', () => {
            const timestamp = 1705315200000 // 2024-01-15 10:00:00 UTC
            const result = formatDate(timestamp, 'short')
            expect(result).toContain('2024-01-15')
        })

        it('should handle common date string formats', () => {
            const result = formatDate('2025-10-31', 'date')
            expect(result).toBeTruthy()
            expect(result).toContain('2025')
        })
    })

    describe('i18n integration', () => {
        it('should use English locale when no i18n instance', () => {
            delete (globalThis as any).__universo_i18n__instance
            const result = formatDate('2025-10-31', 'full', 'en')
            expect(result).toBeTruthy()
            // English format should contain month name
            expect(result.toLowerCase()).toMatch(/oct|october/)
        })

        it('should use Russian locale when specified', () => {
            const result = formatDate('2025-10-31', 'full', 'ru')
            expect(result).toBeTruthy()
            // Russian format should contain Cyrillic month name
            expect(result).toMatch(/окт/i)
        })

        it('should respect globalThis i18n instance', () => {
            // Mock Russian i18n instance
            (globalThis as any).__universo_i18n__instance = { language: 'ru' }
            
            const result = formatDate('2025-10-31', 'full')
            expect(result).toBeTruthy()
            expect(result).toMatch(/окт/i)
        })

        it('should override globalThis i18n with explicit langOverride', () => {
            // Set global to Russian
            (globalThis as any).__universo_i18n__instance = { language: 'ru' }
            
            // But override with English
            const result = formatDate('2025-10-31', 'full', 'en')
            expect(result).toBeTruthy()
            expect(result.toLowerCase()).toMatch(/oct|october/)
        })

        it('should use options.i18n when provided', () => {
            const customI18n: I18nInstance = { language: 'en' }
            const result = formatDate('2025-10-31', 'full', undefined, { i18n: customI18n })
            expect(result).toBeTruthy()
            expect(result.toLowerCase()).toMatch(/oct|october/)
        })
    })

    describe('Default pattern behavior', () => {
        it('should use "full" pattern when no pattern specified', () => {
            const result = formatDate('2025-10-31')
            expect(result).toBeTruthy()
            expect(result).toContain('2025')
            // Full format should be detailed (includes time)
            expect(result.length).toBeGreaterThan(10)
        })

        it('should fallback to "full" pattern for unknown pattern', () => {
            const result = formatDate('2025-10-31', 'unknown-pattern' as any)
            expect(result).toBeTruthy()
            expect(result).toContain('2025')
        })
    })

    describe('Edge cases', () => {
        it('should handle leap year date', () => {
            const result = formatDate('2024-02-29', 'short')
            expect(result).toContain('2024-02-29')
        })

        it('should handle year boundaries', () => {
            const newYear = formatDate('2025-01-01T00:00:00Z', 'iso')
            expect(newYear).toBe('2025-01-01T00:00:00.000Z')
        })

        it('should handle very old dates', () => {
            const result = formatDate('1900-01-01', 'date')
            expect(result).toBeTruthy()
            expect(result).toContain('1900')
        })

        it('should handle far future dates', () => {
            const result = formatDate('2099-12-31', 'date')
            expect(result).toBeTruthy()
            expect(result).toContain('2099')
        })
    })
})

describe('formatRange', () => {
    describe('Valid range formatting', () => {
        it('should format valid date range with "short" pattern', () => {
            const start = '2025-10-01'
            const end = '2025-10-31'
            const result = formatRange(start, end, 'short')
            expect(result).toContain('2025-10-01')
            expect(result).toContain('2025-10-31')
            expect(result).toContain('–') // en dash separator
        })

        it('should format valid date range with "date" pattern', () => {
            const start = new Date('2025-01-01')
            const end = new Date('2025-01-31')
            const result = formatRange(start, end, 'date')
            expect(result).toBeTruthy()
            expect(result).toContain('–')
        })

        it('should handle same start and end date', () => {
            const date = '2025-10-31'
            const result = formatRange(date, date, 'short')
            expect(result).toContain('2025-10-31')
            expect(result).toMatch(/2025-10-31.*–.*2025-10-31/)
        })
    })

    describe('Invalid range handling', () => {
        it('should return empty string when start is null', () => {
            expect(formatRange(null, '2025-10-31')).toBe('')
        })

        it('should return empty string when end is null', () => {
            expect(formatRange('2025-10-01', null)).toBe('')
        })

        it('should return empty string when both are null', () => {
            expect(formatRange(null, null)).toBe('')
        })

        it('should return empty string when start is undefined', () => {
            expect(formatRange(undefined, '2025-10-31')).toBe('')
        })

        it('should return empty string when end is undefined', () => {
            expect(formatRange('2025-10-01', undefined)).toBe('')
        })
    })

    describe('i18n integration in ranges', () => {
        it('should format range with Russian locale', () => {
            const result = formatRange('2025-10-01', '2025-10-31', 'date', 'ru')
            expect(result).toBeTruthy()
            expect(result).toContain('–')
            expect(result).toMatch(/окт/i)
        })

        it('should format range with English locale', () => {
            const result = formatRange('2025-10-01', '2025-10-31', 'date', 'en')
            expect(result).toBeTruthy()
            expect(result).toContain('–')
            expect(result.toLowerCase()).toMatch(/oct/)
        })
    })

    describe('Cross-boundary ranges', () => {
        it('should handle range across year boundary', () => {
            const result = formatRange('2024-12-25', '2025-01-05', 'short')
            expect(result).toContain('2024-12-25')
            expect(result).toContain('2025-01-05')
        })

        it('should handle range across month boundary', () => {
            const result = formatRange('2025-10-28', '2025-11-03', 'short')
            expect(result).toContain('2025-10-28')
            expect(result).toContain('2025-11-03')
        })
    })
})
