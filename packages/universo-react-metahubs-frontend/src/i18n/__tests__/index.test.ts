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

    it('keeps projects (PlayCanvas binding surface) translations inside the consolidated metahubs namespace', () => {
        const ruTranslations = getMetahubsTranslations('ru') as {
            projects?: { binding?: { title?: string; resourceTabTitle?: string; actions?: { openEditor?: string } } }
        }
        const enTranslations = getMetahubsTranslations('en') as {
            projects?: { binding?: { title?: string; resourceTabTitle?: string; actions?: { openEditor?: string } } }
        }

        expect(ruTranslations.projects?.binding?.title).toBe('Проект PlayCanvas')
        // The edit-dialog tab is labelled "PlayCanvas" (not "Проект"/"Project").
        expect(ruTranslations.projects?.binding?.resourceTabTitle).toBe('PlayCanvas')
        expect(ruTranslations.projects?.binding?.actions?.openEditor).toBe('Открыть редактор')
        expect(enTranslations.projects?.binding?.title).toBe('PlayCanvas project')
        expect(enTranslations.projects?.binding?.resourceTabTitle).toBe('PlayCanvas')
        expect(enTranslations.projects?.binding?.actions?.openEditor).toBe('Open editor')
    })

    it('keeps layout widget shared behavior translations inside the consolidated metahubs namespace', () => {
        const ruTranslations = getMetahubsTranslations('ru') as {
            layouts?: { sharedBehavior?: { title?: string; description?: string } }
        }

        expect(ruTranslations.layouts?.sharedBehavior?.title).toBe('Общее поведение')
        expect(ruTranslations.layouts?.sharedBehavior?.description).toBe(
            'Определяет, можно ли в унаследованных макетах отключать, исключать или перемещать этот виджет.'
        )
    })
})
