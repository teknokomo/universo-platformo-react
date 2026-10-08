import { describe, expect, it } from 'vitest'
import { getMetahubsTranslations } from '../index'

const getLeafPaths = (value: unknown, prefix = ''): string[] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix]
    return Object.entries(value).flatMap(([key, nested]) => getLeafPaths(nested, prefix ? `${prefix}.${key}` : key))
}

describe('metahubs i18n consolidation', () => {
    it('keeps top-level shared translations inside the consolidated metahubs namespace', () => {
        const translations = getMetahubsTranslations('ru') as {
            shared?: { list?: { badge?: string } }
        }

        expect(translations.shared?.list?.badge).toBe('Общая')
    })

    it('keeps generic resource-source translations inside the consolidated metahubs namespace', () => {
        const ruTranslations = getMetahubsTranslations('ru') as {
            resourceSource?: { type?: string; url?: string; launchModes?: { inline?: string } }
        }
        const enTranslations = getMetahubsTranslations('en') as {
            resourceSource?: { type?: string; url?: string; launchModes?: { inline?: string } }
        }

        expect(ruTranslations.resourceSource?.type).toBe('Тип ресурса')
        expect(ruTranslations.resourceSource?.url).toBe('URL источника')
        expect(ruTranslations.resourceSource?.launchModes?.inline).toBe('Встроенно')
        expect(enTranslations.resourceSource?.type).toBe('Resource type')
        expect(enTranslations.resourceSource?.url).toBe('Source URL')
        expect(enTranslations.resourceSource?.launchModes?.inline).toBe('Inline')
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

    it('keeps only current generated/manual menu and side-menu strings in both locales', () => {
        const ruTranslations = getMetahubsTranslations('ru') as {
            layouts?: { menuEditor?: unknown; sharedBehavior?: unknown; actions?: { exclude?: string } }
            shared?: { behavior?: { canExclude?: string } }
        }
        const enTranslations = getMetahubsTranslations('en') as {
            layouts?: { menuEditor?: unknown; sharedBehavior?: unknown }
            shared?: { behavior?: { canExclude?: string } }
        }
        const expectedMenuEditorKeys = [
            'continueToSource',
            'description',
            'generatedHint',
            'manualHint',
            'sideMenu.modes.compact',
            'sideMenu.modes.overlay',
            'sideMenu.modes.wide',
            'sideMenu.primaryMode',
            'sideMenu.rememberUserChoice',
            'sideMenu.title',
            'title',
            'variant',
            'variants.generated',
            'variants.manual'
        ]

        expect(getLeafPaths(ruTranslations.layouts?.menuEditor).sort()).toEqual(expectedMenuEditorKeys)
        expect(getLeafPaths(enTranslations.layouts?.menuEditor).sort()).toEqual(expectedMenuEditorKeys)
        expect(ruTranslations.layouts).not.toHaveProperty('sharedBehavior')
        expect(enTranslations.layouts).not.toHaveProperty('sharedBehavior')
        expect(ruTranslations.layouts?.menuEditor).not.toHaveProperty('autoShowAllSections')
        expect(ruTranslations.layouts?.menuEditor).not.toHaveProperty('startPage')
        expect(ruTranslations.layouts?.menuEditor).not.toHaveProperty('overflowLabelKey')
        expect(ruTranslations.layouts?.actions?.exclude).toBe('Исключить')
        expect(ruTranslations.shared?.behavior?.canExclude).toBe('Можно исключать')
        expect(enTranslations.shared?.behavior?.canExclude).toBe('Can be excluded')
    })

    it('merges module authoring translations with resource scope labels', () => {
        const ruTranslations = getMetahubsTranslations('ru') as {
            modules?: {
                scopes?: { metahub?: string; general?: string }
                fields?: { name?: string }
                errors?: { sourcePathModulesPrefix?: string }
            }
        }
        const enTranslations = getMetahubsTranslations('en') as {
            modules?: {
                scopes?: { metahub?: string; general?: string }
                fields?: { name?: string }
                errors?: { sourcePathModulesPrefix?: string }
            }
        }

        expect(ruTranslations.modules?.scopes?.metahub).toBe('Модули метахаба')
        expect(ruTranslations.modules?.scopes?.general).toBe('Общие модули')
        expect(ruTranslations.modules?.fields?.name).toBe('Название')
        expect(ruTranslations.modules?.errors?.sourcePathModulesPrefix).toBe('Путь к исходному файлу должен начинаться с modules/.')
        expect(enTranslations.modules?.scopes?.general).toBe('Shared modules')
        expect(enTranslations.modules?.fields?.name).toBe('Name')
        expect(enTranslations.modules?.errors?.sourcePathModulesPrefix).toBe('Source paths must start with modules/.')
    })
})
