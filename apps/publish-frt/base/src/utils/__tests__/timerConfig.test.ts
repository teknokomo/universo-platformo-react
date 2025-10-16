import { describe, expect, it } from 'vitest'
import { DEFAULT_TIMER_CONFIG, normalizeTimerConfig, sanitizeTimerInput } from '../timerConfig'

describe('timerConfig utils', () => {
    it('returns default config when input is missing', () => {
        expect(normalizeTimerConfig(undefined)).toEqual(DEFAULT_TIMER_CONFIG)
        expect(normalizeTimerConfig(null)).toEqual(DEFAULT_TIMER_CONFIG)
    })

    it('clamps limit seconds into allowed range', () => {
        expect(normalizeTimerConfig({ enabled: true, limitSeconds: 5, position: 'bottom-left' })).toEqual({
            enabled: true,
            limitSeconds: 10,
            position: 'bottom-left'
        })

        expect(normalizeTimerConfig({ enabled: true, limitSeconds: 4000, position: 'bottom-right' })).toEqual({
            enabled: true,
            limitSeconds: 3600,
            position: 'bottom-right'
        })
    })

    it('sanitizes raw input values', () => {
        expect(sanitizeTimerInput(true, '120', 'top-left')).toEqual({
            enabled: true,
            limitSeconds: 120,
            position: 'top-left'
        })

        expect(sanitizeTimerInput(true, 90, 'top-center')).toEqual({
            enabled: true,
            limitSeconds: 90,
            position: 'top-center'
        })

        expect(sanitizeTimerInput(false, NaN, 'invalid')).toEqual(DEFAULT_TIMER_CONFIG)
    })
})
