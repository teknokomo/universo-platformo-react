import { describe, expect, it } from 'vitest'

import { applicationsTranslations } from '../index'

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

describe('applications translations', () => {
    it('localizes layout widget labels used by the application layout editor', () => {
        const ru = applicationsTranslations.ru.applications

        expect(getPath(ru, 'layouts.widgets.relationBuilder')).toBe('Конструктор связей')
        expect(getPath(ru, 'layouts.widgets.detailsTabs')).toBe('Вкладки деталей')
        expect(getPath(ru, 'layouts.widgets.interpretationNetworkWorkspace')).toBe('Рабочая область трактовочной сети')
        expect(getPath(ru, 'layouts.widgets.playcanvasCanvas')).toBe('Холст PlayCanvas')
        expect(getPath(ru, 'layouts.widgets.learnerPlayer')).toBe('Плеер обучения')
    })

    it('localizes menu widget side-menu settings in the application layout editor', () => {
        const ru = applicationsTranslations.ru.applications

        expect(getPath(ru, 'layouts.menuEditor.sideMenu.title')).toBe('Отображение бокового меню')
        expect(getPath(ru, 'layouts.menuEditor.sideMenu.primaryMode')).toBe('Основной режим отображения')
        expect(getPath(ru, 'layouts.menuEditor.sideMenu.rememberUserChoice')).toBe('Запоминать выбор пользователя')
        expect(getPath(ru, 'layouts.menuEditor.sideMenu.modes.wide')).toBe('Широкое')
        expect(getPath(ru, 'layouts.menuEditor.sideMenu.modes.compact')).toBe('Компактное с иконками')
        expect(getPath(ru, 'layouts.menuEditor.sideMenu.modes.overlay')).toBe('Шторка поверх контента')
    })

    it('localizes inherited layout shared behavior fields in the application layout editor', () => {
        const ru = applicationsTranslations.ru.applications

        expect(getPath(ru, 'layouts.sharedBehavior.title')).toBe('Общее поведение')
        expect(getPath(ru, 'layouts.sharedBehavior.description')).toBe(
            'Определяет, можно ли в унаследованных макетах отключать, исключать или перемещать этот виджет.'
        )
        expect(getPath(ru, 'layouts.sharedBehavior.canDeactivate')).toBe('Можно деактивировать')
        expect(getPath(ru, 'layouts.sharedBehavior.canExclude')).toBe('Можно исключать')
        expect(getPath(ru, 'layouts.sharedBehavior.positionLocked')).toBe('Позиция зафиксирована')
    })
})
