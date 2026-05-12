import { describe, expect, it } from 'vitest'
import { buildVLC } from '@universo/utils'
import { formatRuntimeValue } from '../displayValue'

describe('formatRuntimeValue', () => {
    it('renders localized content in the requested locale', () => {
        expect(formatRuntimeValue(buildVLC('Learning readiness', 'Готовность к обучению'), 'ru')).toBe('Готовность к обучению')
    })

    it('renders arrays of option objects by their localized labels', () => {
        const value = [
            { id: 'a', label: buildVLC('Departure window', 'Окно отправления'), isCorrect: true },
            { id: 'b', label: buildVLC('Docking corridor', 'Коридор стыковки'), isCorrect: false }
        ]

        expect(formatRuntimeValue(value, 'ru')).toBe('Окно отправления, Коридор стыковки')
    })

    it('falls back to compact JSON for structured values without a display field', () => {
        expect(formatRuntimeValue({ status: ['active'], score: { gte: 80 } }, 'en')).toBe('{"status":["active"],"score":{"gte":80}}')
    })
})
