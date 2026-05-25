import '@testing-library/jest-dom/vitest'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ContainerSelectionPanel } from '../ContainerSelectionPanel'
import { ContainerParentSelectionPanel } from '../ContainerParentSelectionPanel'
import type { TreeEntity } from '../../types'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, defaultValueOrOptions?: string | { defaultValue?: string }) => {
            if (typeof defaultValueOrOptions === 'string') return defaultValueOrOptions
            return defaultValueOrOptions?.defaultValue ?? _key
        },
        i18n: { language: 'ru' }
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() }
}))

const vlc = (en: string, ru: string = en) => ({
    _schema: 'vlc.v1',
    _primary: 'en',
    locales: {
        en: { content: en },
        ru: { content: ru }
    }
})

const buildContainer = (overrides: Partial<TreeEntity> = {}): TreeEntity =>
    ({
        id: 'hub-1',
        metahubId: 'metahub-1',
        name: vlc('Main hub', 'Основной хаб'),
        codename: vlc('MainHub', 'MainHub'),
        description: vlc('Hub description', 'Описание хаба'),
        sortOrder: 1,
        parentTreeEntityId: null,
        createdAt: '2026-05-05T00:00:00.000Z',
        updatedAt: '2026-05-05T00:00:00.000Z',
        ...overrides
    } as TreeEntity)

describe('ContainerSelectionPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('opens the add-container picker when container codenames are stored as VLC objects', async () => {
        const user = userEvent.setup()
        const onSelectionChange = vi.fn()

        render(
            <ContainerSelectionPanel
                availableContainers={[buildContainer()]}
                selectedContainerIds={[]}
                onSelectionChange={onSelectionChange}
                isContainerRequired={false}
                onRequiredContainerChange={vi.fn()}
                isSingleContainer={false}
                onSingleContainerChange={vi.fn()}
                uiLocale='ru'
            />
        )

        await user.click(screen.getByTestId('entity-selection-add-button'))

        expect(screen.getByRole('dialog', { name: 'Select containers' })).toBeInTheDocument()
        expect(screen.getByText('Основной хаб')).toBeInTheDocument()
        expect(screen.getByText('MainHub')).toBeInTheDocument()

        await user.click(screen.getByText('Основной хаб'))
        await user.click(screen.getByTestId('entity-selection-confirm'))

        expect(onSelectionChange).toHaveBeenCalledWith(['hub-1'])
    })

    it('opens the parent-container picker when container codenames are stored as VLC objects', async () => {
        const user = userEvent.setup()
        const onParentContainerChange = vi.fn()

        render(
            <ContainerParentSelectionPanel
                availableContainers={[buildContainer()]}
                parentContainerId={null}
                onParentContainerChange={onParentContainerChange}
                uiLocale='ru'
            />
        )

        await user.click(screen.getByTestId('entity-selection-add-button'))

        expect(screen.getByRole('dialog', { name: 'Select parent container' })).toBeInTheDocument()
        expect(screen.getByText('Основной хаб')).toBeInTheDocument()
        expect(screen.getByText('MainHub')).toBeInTheDocument()

        await user.click(screen.getByText('Основной хаб'))
        await user.click(screen.getByTestId('entity-selection-confirm'))

        expect(onParentContainerChange).toHaveBeenCalledWith('hub-1')
    })
})
