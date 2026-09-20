import { describe, expect, it } from 'vitest'

import commonEn from '@universo-react/i18n/locales/en/common.json'
import commonRu from '@universo-react/i18n/locales/ru/common.json'
import { getApplicationsTranslations } from '../index'

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

describe('application notification messages', () => {
    it('localizes application and connector notifications in Russian', () => {
        const ru = getApplicationsTranslations('ru')

        expect(getPath(ru, 'createSuccess')).toBe('Приложение успешно создано')
        expect(getPath(ru, 'updateSuccess')).toBe('Приложение успешно обновлено')
        expect(getPath(ru, 'copyInProgress')).toBe('Копирование…')
        expect(getPath(ru, 'connectors.createSuccess')).toBe('Коннектор успешно создан')
        expect(getPath(ru, 'connectors.updateSuccess')).toBe('Коннектор успешно обновлён')
        expect(getPath(ru, 'connectors.deleteSuccess')).toBe('Коннектор успешно удалён')
        expect(getPath(ru, 'connectors.copyInProgress')).toBe('Создание…')
        expect(getPath(ru, 'connectors.sync.success')).toBe('Схема успешно синхронизирована')
        expect(getPath(ru, 'connectors.sync.error')).toBe('Не удалось синхронизировать схему')
        expect(getPath(ru, 'connectors.sync.confirmDestructive')).toBe('Применить изменения, включая деструктивные')
    })

    it('keeps English notifications in parity with the Russian bundle', () => {
        const en = getApplicationsTranslations('en')

        expect(getPath(en, 'createSuccess')).toBe('Application created')
        expect(getPath(en, 'updateSuccess')).toBe('Application updated')
        expect(getPath(en, 'copyInProgress')).toBe('Copying…')
        expect(getPath(en, 'connectors.createSuccess')).toBe('Connector created')
        expect(getPath(en, 'connectors.updateSuccess')).toBe('Connector updated')
        expect(getPath(en, 'connectors.deleteSuccess')).toBe('Connector deleted')
        expect(getPath(en, 'connectors.copyInProgress')).toBe('Creating…')
        expect(getPath(en, 'connectors.sync.success')).toBe('Schema synchronized successfully')
        expect(getPath(en, 'connectors.sync.error')).toBe('Failed to sync schema')
        expect(getPath(en, 'connectors.sync.confirmDestructive')).toBe('Apply changes including destructive ones')
    })

    it('localizes member invitation validation messages from the shared common namespace', () => {
        // The member hooks use useCommonTranslations(), so these strings come
        // from @universo-react/i18n rather than the applications bundle.
        expect(getPath(commonRu.common, 'members.userNotFound')).toBe(
            'Пользователь с email "{{email}}" не найден. Пожалуйста, проверьте адрес электронной почты.'
        )
        expect(getPath(commonRu.common, 'members.userAlreadyMember')).toBe('Пользователь с email "{{email}}" уже имеет доступ.')
        expect(getPath(commonEn.common, 'members.userNotFound')).toBe(
            'User with email "{{email}}" not found. Please check the email address.'
        )
        expect(getPath(commonEn.common, 'members.userAlreadyMember')).toBe('User with email "{{email}}" already has access.')
    })

    it('localizes the error-state retry action and runtime loading state', () => {
        const ru = getApplicationsTranslations('ru')
        const en = getApplicationsTranslations('en')

        expect(getPath(ru, 'actions.retry')).toBe('Повторить')
        expect(getPath(en, 'actions.retry')).toBe('Retry')
        expect(getPath(ru, 'app.runtime.loading')).toBe('Загрузка приложения')
        expect(getPath(en, 'app.runtime.loading')).toBe('Loading application')
    })
})
