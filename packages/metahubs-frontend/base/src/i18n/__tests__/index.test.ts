import { describe, expect, it } from 'vitest'
import { getMetahubsTranslations } from '../index'

describe('metahubs i18n consolidation', () => {
    it('keeps top-level shared translations inside the consolidated metahubs namespace', () => {
        const translations = getMetahubsTranslations('ru') as {
            shared?: { list?: { badge?: string } }
        }

        expect(translations.shared?.list?.badge).toBe('Общая')
    })

    it('keeps top-level documents translations inside the consolidated metahubs namespace', () => {
        const translations = getMetahubsTranslations('ru') as {
            documents?: { title?: string }
        }

        expect(translations.documents?.title).toBe('Документы')
    })
})
