import { describe, expect, it } from 'vitest'

import { isSemanticLongTextRuntimeField } from '../fieldSemantics'

describe('isSemanticLongTextRuntimeField', () => {
    it('recognizes semantic names used by metadata-driven record forms', () => {
        expect(isSemanticLongTextRuntimeField({ id: 'Description', label: 'Описание' })).toBe(true)
        expect(isSemanticLongTextRuntimeField({ codename: 'HeroDescription', label: 'Text' })).toBe(true)
        expect(isSemanticLongTextRuntimeField({ id: 'Quote', label: 'Quote' })).toBe(true)
        expect(isSemanticLongTextRuntimeField({ codename: 'NewsletterDescription', label: 'Text' })).toBe(true)
        expect(isSemanticLongTextRuntimeField({ codename: 'HeroSubtitle', label: 'Text' })).toBe(true)
        expect(isSemanticLongTextRuntimeField({ id: 'Title', label: 'Title' })).toBe(false)
    })

    it('honors explicit widget metadata over the name fallback', () => {
        expect(isSemanticLongTextRuntimeField({ id: 'Title', label: 'Title', uiConfig: { widget: 'textarea' } })).toBe(true)
        expect(isSemanticLongTextRuntimeField({ id: 'Description', label: 'Description', uiConfig: { widget: 'text' } })).toBe(false)
        expect(isSemanticLongTextRuntimeField({ id: 'Title', label: 'Title', uiConfig: { multiline: true } })).toBe(true)
    })
})
