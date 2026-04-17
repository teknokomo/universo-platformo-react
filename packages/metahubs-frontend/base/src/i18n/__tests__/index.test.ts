import { describe, expect, it } from 'vitest'
import { getMetahubsTranslations } from '../index'

describe('metahubs i18n consolidation', () => {
    it('keeps top-level shared translations inside the consolidated metahubs namespace', () => {
        const translations = getMetahubsTranslations('ru') as {
            shared?: { list?: { badge?: string } }
        }

        expect(translations.shared?.list?.badge).toBe('Общая')
    })

    it('keeps fieldDefinitions translations inside the consolidated metahubs namespace', () => {
        const translations = getMetahubsTranslations('ru') as {
            fieldDefinitions?: { title?: string }
        }

        expect(translations.fieldDefinitions?.title).toBe('Определения полей')
    })
})
