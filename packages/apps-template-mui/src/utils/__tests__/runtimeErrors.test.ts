import { describe, expect, it } from 'vitest'
import { extractRuntimeErrorMessage, isUnsafeRuntimeErrorMessage } from '../runtimeErrors'

describe('runtimeErrors', () => {
    it('keeps short user-facing messages in English runtime surfaces', () => {
        expect(extractRuntimeErrorMessage(new Error('Posting is blocked by the current state.'), 'Try again.', 'en')).toBe(
            'Posting is blocked by the current state.'
        )
    })

    it('suppresses internal and technical backend details', () => {
        const fallback = 'Please try again or reload the page.'

        expect(extractRuntimeErrorMessage(new Error('backend exploded'), fallback, 'en')).toBe(fallback)
        expect(extractRuntimeErrorMessage(new Error('duplicate key value violates unique constraint "rows_pkey"'), fallback, 'en')).toBe(
            fallback
        )
        expect(extractRuntimeErrorMessage(new Error('Record 019e44fc-a16a-760c-8190-280c4d9dc720 failed validation'), fallback, 'en')).toBe(
            fallback
        )
        expect(extractRuntimeErrorMessage({ response: { data: { error: '{"storageKey":"demo"}' } } }, fallback, 'en')).toBe(fallback)
    })

    it('suppresses plain English backend text on localized non-English surfaces', () => {
        expect(extractRuntimeErrorMessage(new Error('Posting is blocked by the current state.'), 'Повторите действие.', 'ru')).toBe(
            'Повторите действие.'
        )
    })

    it('classifies empty messages as unsafe', () => {
        expect(isUnsafeRuntimeErrorMessage('')).toBe(true)
    })
})
