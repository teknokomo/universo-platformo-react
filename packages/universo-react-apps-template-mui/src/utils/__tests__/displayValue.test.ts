import { describe, expect, it } from 'vitest'
import { buildVLC } from '@universo-react/utils'
import {
    formatRuntimeColumnValue,
    formatRuntimeDateValue,
    formatRuntimeSafeValue,
    formatRuntimeValue,
    hasRuntimeTechnicalValueLeakage,
    isRuntimeTechnicalFieldName
} from '../displayValue'

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

    it('keeps structured values without a display field out of normal runtime cells', () => {
        expect(formatRuntimeValue({ status: ['active'], score: { gte: 80 } }, 'en')).toBe('')
    })

    it('does not treat object-only codenames or IDs as user-facing display labels', () => {
        expect(formatRuntimeValue({ codename: 'LearningResources' }, 'en')).toBe('')
        expect(formatRuntimeValue({ id: 'project-1' }, 'en')).toBe('')
        expect(formatRuntimeSafeValue({ codename: 'CourseItems', id: 'project-1' }, 'en')).toBe('')
        expect(formatRuntimeSafeValue({ label: 'Learning resources', codename: 'LearningResources' }, 'en')).toBe('Learning resources')
        expect(formatRuntimeSafeValue({ displayName: 'Course item', id: 'course-item-1' }, 'en')).toBe('Course item')
    })

    it('keeps raw resource and block JSON strings out of normal runtime cells', () => {
        expect(formatRuntimeValue('{"storageKey":"lesson.pdf","mimeType":"application/pdf"}', 'en')).toBe('')
        expect(formatRuntimeValue('{"blocks":[{"type":"paragraph","data":{"text":"Raw"}}]}', 'en')).toBe('')
    })

    it('formats ISO date strings for normal runtime display instead of exposing raw timestamps', () => {
        expect(formatRuntimeDateValue('2061-02-01T08:00:00.000Z', 'ru')).toBe('01.02.2061, 08:00')
        expect(formatRuntimeValue('2061-02-01T08:00:00.000Z', 'ru')).toBe('01.02.2061, 08:00')
        expect(formatRuntimeColumnValue({ dataType: 'DATE' }, '2061-02-01T08:00:00.000Z', 'en')).toBe('02/01/2061, 08:00')
        expect(
            formatRuntimeColumnValue({ dataType: 'DATE', validationRules: { dateComposition: 'date' } }, '2061-02-01T08:00:00.000Z', 'ru')
        ).toBe('01.02.2061')
    })

    it('identifies technical runtime fields for generic grid and builder surfaces', () => {
        expect(isRuntimeTechnicalFieldName('ProjectId')).toBe(true)
        expect(isRuntimeTechnicalFieldName('target_record_id')).toBe(true)
        expect(isRuntimeTechnicalFieldName('_upl_version')).toBe(true)
        expect(isRuntimeTechnicalFieldName('Valid')).toBe(false)
        expect(isRuntimeTechnicalFieldName('Candidate')).toBe(false)
        expect(isRuntimeTechnicalFieldName('Title')).toBe(false)
    })

    it('suppresses raw UUID and JSON strings for safe runtime display values', () => {
        expect(hasRuntimeTechnicalValueLeakage('Project 017f22e2-79b0-7cc3-98c4-dc0c0c073990')).toBe(true)
        expect(formatRuntimeSafeValue('Project 017f22e2-79b0-7cc3-98c4-dc0c0c073990', 'en')).toBe('')
        expect(formatRuntimeSafeValue('Safety course', 'en')).toBe('Safety course')
    })

    it('renders metadata string option labels instead of stored codenames', () => {
        const column = {
            dataType: 'STRING',
            uiConfig: {
                stringOptions: [
                    { value: 'selectedItems', label: buildVLC('Selected items', 'Выбранные элементы') },
                    { value: 'passedFailed', label: buildVLC('Passed / Failed', 'Пройдено / Не пройдено') }
                ]
            }
        }

        expect(formatRuntimeColumnValue(column, 'selectedItems', 'en')).toBe('Selected items')
        expect(formatRuntimeColumnValue(column, 'passedFailed', 'en')).toBe('Passed / Failed')
        expect(formatRuntimeColumnValue(column, 'selectedItems', 'ru')).toBe('Выбранные элементы')
        expect(formatRuntimeColumnValue(column, 'unknown', 'en')).toBe('unknown')
    })
})
