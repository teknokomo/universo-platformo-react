import { describe, expect, it } from 'vitest'

import { getMetahubsTranslations } from '../index'

const getPath = (source: Record<string, unknown>, path: string): unknown =>
    path
        .split('.')
        .reduce<unknown>(
            (current, segment) =>
                current && typeof current === 'object' && !Array.isArray(current)
                    ? (current as Record<string, unknown>)[segment]
                    : undefined,
            source
        )

describe('metahub notification messages', () => {
    it('localizes metahub and publication notifications in Russian', () => {
        const ru = getMetahubsTranslations('ru')

        expect(getPath(ru, 'createSuccess')).toBe('Метахаб создан')
        expect(getPath(ru, 'updateSuccess')).toBe('Метахаб обновлён')
        expect(getPath(ru, 'copyInProgress')).toBe('Копирование…')
        expect(getPath(ru, 'publications.applications.createSuccess')).toBe('Приложение успешно создано')
        expect(getPath(ru, 'publications.messages.createSuccess')).toBe('Публикация успешно создана')
        expect(getPath(ru, 'publications.messages.updateSuccess')).toBe('Публикация успешно обновлена')
        expect(getPath(ru, 'publications.messages.deleteSuccess')).toBe('Публикация успешно удалена')
        expect(getPath(ru, 'publications.copyInProgress')).toBe('Создание…')
        expect(getPath(ru, 'publications.versions.createError')).toBe('Не удалось создать версию')
        expect(getPath(ru, 'publications.versions.updateSuccess')).toBe('Версия успешно обновлена')
        expect(getPath(ru, 'publications.versions.updateError')).toBe('Не удалось обновить версию')
        expect(getPath(ru, 'publications.versions.activateError')).toBe('Не удалось активировать версию')
    })

    it('keeps English publication notifications in parity with the Russian bundle', () => {
        const en = getMetahubsTranslations('en')

        expect(getPath(en, 'createSuccess')).toBe('Metahub created')
        expect(getPath(en, 'updateSuccess')).toBe('Metahub updated')
        expect(getPath(en, 'copyInProgress')).toBe('Copying…')
        expect(getPath(en, 'publications.applications.createSuccess')).toBe('Application created')
        expect(getPath(en, 'publications.messages.createSuccess')).toBe('Publication created successfully')
        expect(getPath(en, 'publications.messages.updateSuccess')).toBe('Publication updated')
        expect(getPath(en, 'publications.messages.deleteSuccess')).toBe('Publication deleted')
        expect(getPath(en, 'publications.copyInProgress')).toBe('Creating…')
        expect(getPath(en, 'publications.versions.createError')).toBe('Failed to create version')
        expect(getPath(en, 'publications.versions.updateSuccess')).toBe('Version updated successfully')
        expect(getPath(en, 'publications.versions.updateError')).toBe('Failed to update version')
        expect(getPath(en, 'publications.versions.activateError')).toBe('Failed to activate version')
    })

    it('resolves shared table labels through the consolidated namespace', () => {
        const ru = getMetahubsTranslations('ru')
        const en = getMetahubsTranslations('en')

        expect(getPath(ru, 'table.name')).toBe('Название')
        expect(getPath(ru, 'table.type')).toBe('Тип')
        expect(getPath(ru, 'table.codename')).toBe('Кодовое имя')
        expect(getPath(ru, 'table.email')).toBe('Email')
        expect(getPath(en, 'table.name')).toBe('Name')
        expect(getPath(en, 'table.type')).toBe('Type')
        expect(getPath(en, 'table.codename')).toBe('Codename')
        expect(getPath(en, 'table.email')).toBe('Email')
    })

    it('localizes entity and component success notifications in Russian', () => {
        const ru = getMetahubsTranslations('ru')

        expect(getPath(ru, 'entities.createSuccess')).toBe('Тип сущности создан')
        expect(getPath(ru, 'entities.instances.deletePermanentSuccess')).toBe('Сущность удалена безвозвратно')
        expect(getPath(ru, 'components.createSuccess')).toBe('Компонент создан')
        expect(getPath(ru, 'components.copySuccess')).toBe('Компонент скопирован')
        expect(getPath(ru, 'hubs.deleteSuccess')).toBe('Хаб удалён')
        expect(getPath(ru, 'objects.updateSuccess')).toBe('Объект обновлён')
    })
})
