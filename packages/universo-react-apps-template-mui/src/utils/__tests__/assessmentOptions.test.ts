import { describe, expect, it } from 'vitest'
import { isUuidV7 } from '@universo-react/utils'
import {
    createAssessmentOptionDraft,
    readAssessmentOptionDrafts,
    resolveAssessmentOptionBounds,
    serializeAssessmentOptionDrafts
} from '../assessmentOptions'

describe('assessment option metadata and identities', () => {
    it('defaults to the server-supported range of two through twenty options', () => {
        expect(resolveAssessmentOptionBounds(undefined)).toEqual({ min: 2, max: 20 })
        expect(resolveAssessmentOptionBounds({})).toEqual({ min: 2, max: 20 })
    })

    it('never configures a minimum below two and clamps the maximum to the server limit', () => {
        expect(resolveAssessmentOptionBounds({ minOptions: 1, maxOptions: 1 })).toEqual({ min: 2, max: 20 })
        expect(resolveAssessmentOptionBounds({ minOptions: 4, maxOptions: 4 })).toEqual({ min: 4, max: 4 })
        expect(resolveAssessmentOptionBounds({ minOptions: 3, maxOptions: 21 })).toEqual({ min: 3, max: 20 })
        expect(resolveAssessmentOptionBounds({ minOptions: 30, maxOptions: 40 })).toEqual({ min: 20, max: 20 })
    })

    it('repairs malformed metadata and raises max to min when configured max is too small', () => {
        expect(resolveAssessmentOptionBounds(null)).toEqual({ min: 2, max: 20 })
        expect(resolveAssessmentOptionBounds({ minOptions: '4', maxOptions: 3 })).toEqual({ min: 2, max: 3 })
        expect(resolveAssessmentOptionBounds({ minOptions: 3, maxOptions: 2 })).toEqual({ min: 3, max: 3 })
        expect(resolveAssessmentOptionBounds({ minOptions: -1, maxOptions: Number.POSITIVE_INFINITY })).toEqual({
            min: 2,
            max: 20
        })
    })

    it('repairs missing and duplicate option IDs with unique UUID v7 values', () => {
        const options = readAssessmentOptionDrafts(
            [
                { id: 'stored-option', label: 'First', isCorrect: true },
                { id: 'stored-option', label: 'Second', isCorrect: false },
                { label: 'Third', isCorrect: false }
            ],
            'en'
        )

        expect(options).toHaveLength(3)
        expect(isUuidV7(options[0]?.id ?? '')).toBe(true)
        expect(isUuidV7(options[1]?.id ?? '')).toBe(true)
        expect(isUuidV7(options[2]?.id ?? '')).toBe(true)
        expect(new Set(options.map(({ id }) => id)).size).toBe(3)
    })

    it('preserves the first locale when new answers are added and translated later', () => {
        const firstDraft = createAssessmentOptionDraft([], 'en')
        const savedEnglish = serializeAssessmentOptionDrafts([{ ...firstDraft, text: 'First answer' }], 'en')
        const russianDraft = readAssessmentOptionDrafts(savedEnglish, 'ru')

        expect(russianDraft[0]?.text).toBe('First answer')
        const savedRussian = serializeAssessmentOptionDrafts(
            russianDraft.map((option) => ({ ...option, text: 'Первый ответ' })),
            'ru'
        )

        expect(savedRussian[0]?.label).toMatchObject({
            _primary: 'en',
            locales: {
                en: { content: 'First answer' },
                ru: { content: 'Первый ответ' }
            }
        })
    })
})
