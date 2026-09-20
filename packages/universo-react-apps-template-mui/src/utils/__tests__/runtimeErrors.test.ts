import { describe, expect, it } from 'vitest'
import appsEn from '../../i18n/locales/en/apps.json'
import appsRu from '../../i18n/locales/ru/apps.json'
import {
    RUNTIME_RULE_ERROR_KEYS,
    RUNTIME_RULE_ERROR_MESSAGES,
    extractRuntimeErrorMessage,
    isUnsafeRuntimeErrorMessage,
    resolveRuntimeRuleErrorMessage
} from '../runtimeErrors'

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

    it('resolves the rule codes from the shared apps bundles in both locales', () => {
        for (const code of Object.keys(RUNTIME_RULE_ERROR_KEYS)) {
            const leaf = (RUNTIME_RULE_ERROR_KEYS[code] ?? '').split('.').pop() as keyof typeof appsEn.errors
            expect(typeof appsEn.errors[leaf]).toBe('string')
            expect(typeof appsRu.errors[leaf]).toBe('string')
            expect(appsRu.errors[leaf]).not.toBe(appsEn.errors[leaf])
        }
    })

    it('keeps every rule code localized in both product locales', () => {
        for (const [code, messages] of Object.entries(RUNTIME_RULE_ERROR_MESSAGES)) {
            expect(messages.en.trim().length, `${code} en`).toBeGreaterThan(0)
            expect(messages.ru.trim().length, `${code} ru`).toBeGreaterThan(0)
            expect(messages.ru, `${code} ru must be localized`).not.toBe(messages.en)
        }
    })

    it('maps runtime rule violation codes to localized explanations', () => {
        const duplicate = { code: 'RECORD_KEY_DUPLICATE' }
        expect(resolveRuntimeRuleErrorMessage(duplicate, 'en')).toContain('already exists')
        expect(resolveRuntimeRuleErrorMessage(duplicate, 'ru')).toContain('уже существует')
        expect(resolveRuntimeRuleErrorMessage({ code: 'RECORD_PATTERN_MISMATCH' }, 'ru')).toContain('формату')

        expect(extractRuntimeErrorMessage(duplicate, 'Try again.', 'ru')).toContain('уже существует')
        expect(
            extractRuntimeErrorMessage(
                { response: { data: { error: 'A record with the same value already exists', code: 'RECORD_KEY_DUPLICATE' } } },
                'Try again.',
                'en'
            )
        ).toContain('already exists')
        expect(extractRuntimeErrorMessage({ code: 'SOME_OTHER_CODE' }, 'Try again.', 'en')).toBe('Try again.')
    })
})
