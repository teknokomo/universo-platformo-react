import { describe, expect, it } from 'vitest'
import { getMetahubsTranslations } from '../index'

describe('metahubs i18n consolidation', () => {
    it('keeps top-level shared translations inside the consolidated metahubs namespace', () => {
        const translations = getMetahubsTranslations('ru') as {
            shared?: { list?: { badge?: string } }
        }

        expect(translations.shared?.list?.badge).toBe('Общая')
    })

    it('keeps components translations inside the consolidated metahubs namespace', () => {
        const translations = getMetahubsTranslations('ru') as {
            components?: { title?: string }
        }

        expect(translations.components?.title).toBe('Компоненты')
    })

    it('keeps Objects translations inside the consolidated metahubs namespace', () => {
        const translations = getMetahubsTranslations('ru') as {
            objects?: { allTitle?: string; searchPlaceholder?: string }
        }

        expect(translations.objects?.allTitle).toBe('Объекты')
        expect(translations.objects?.searchPlaceholder).toBe('Поиск объектов...')
    })

    it('keeps Pages translations inside the consolidated metahubs namespace', () => {
        const translations = getMetahubsTranslations('ru') as {
            pages?: { title?: string }
        }

        expect(translations.pages?.title).toBe('Страницы')
    })
})
