import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const useQueryMock = vi.fn()
const useSharedEntityOverridesByEntityMock = vi.fn()
const i18nState = vi.hoisted(() => ({ language: 'en' }))
const localizedStrings = vi.hoisted(() => ({
    en: {
        'shared.behavior.title': 'Shared behavior',
        'shared.behavior.description':
            'Control how this shared entity behaves inside target objects and which overrides remain available there.',
        'shared.behavior.canDeactivate': 'Can be deactivated',
        'shared.behavior.canDeactivateHelper': 'Allow target objects to switch this shared entity off without removing it completely.',
        'shared.behavior.canExclude': 'Can be excluded',
        'shared.behavior.canExcludeHelper': 'Allow target objects to exclude this shared entity from their own list.',
        'shared.behavior.positionLocked': 'Position locked',
        'shared.behavior.positionLockedHelper': 'Keep this shared entity fixed in inherited order so target objects cannot reorder it.',
        'shared.exclusions.title': 'Exclusions',
        'shared.exclusions.description':
            'Disable inheritance for selected target objects while keeping this shared entity available everywhere else.'
    },
    ru: {
        'shared.behavior.title': 'Поведение общего объекта',
        'shared.behavior.description':
            'Управляйте тем, как этот общий объект ведет себя в целевых объектах и какие переопределения там доступны.',
        'shared.behavior.canDeactivate': 'Можно отключать',
        'shared.behavior.canDeactivateHelper': 'Разрешить целевым объектам отключать этот общий объект без полного удаления.',
        'shared.behavior.canExclude': 'Можно исключать',
        'shared.behavior.canExcludeHelper': 'Разрешить целевым объектам исключать этот общий объект из своего списка.',
        'shared.behavior.positionLocked': 'Позиция зафиксирована',
        'shared.behavior.positionLockedHelper':
            'Сохранить фиксированный порядок общего объекта, чтобы целевые объекты не могли его переупорядочить.',
        'shared.exclusions.title': 'Исключения',
        'shared.exclusions.description':
            'Отключите наследование для выбранных целевых объектов, сохранив общий объект доступным в остальных.'
    }
}))
const translateShared = (key: string, fallback?: string) => localizedStrings[i18nState.language as 'en' | 'ru']?.[key] ?? fallback ?? key

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-i18next')>()
    return {
        ...actual,
        useTranslation: () => ({
            t: translateShared,
            i18n: i18nState
        })
    }
})

vi.mock('@tanstack/react-query', () => ({
    useQuery: (args: unknown) => useQueryMock(args)
}))

vi.mock('react-redux', () => ({
    useSelector: (selector: (state: { customization: { isDarkMode: boolean } }) => unknown) =>
        selector({ customization: { isDarkMode: false } })
}))

vi.mock('../../hooks/useSharedEntityOverrides', () => ({
    useSharedEntityOverridesByEntity: (...args: unknown[]) => useSharedEntityOverridesByEntityMock(...args)
}))

import SharedEntitySettingsFields, { resolveSharedTargetLabel, resolveSharedTargetSecondaryLabel } from '../SharedEntitySettingsFields'

describe('SharedEntitySettingsFields', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        i18nState.language = 'en'
        useQueryMock.mockReturnValue({
            data: [
                { id: 'catalog-1', label: 'Catalog One', secondaryLabel: 'catalog_one' },
                { id: 'catalog-2', label: 'Catalog Two', secondaryLabel: 'catalog_two' }
            ],
            isLoading: false,
            error: null
        })
        useSharedEntityOverridesByEntityMock.mockReturnValue({
            data: [{ targetObjectId: 'catalog-2', isExcluded: true }],
            isLoading: false,
            error: null
        })
    })

    it('updates shared behavior through the selected storage field', async () => {
        const user = userEvent.setup()
        const setValue = vi.fn()

        render(
            <SharedEntitySettingsFields
                metahubId='metahub-1'
                entityKind='attribute'
                sharedEntityId='attribute-1'
                storageField='uiConfig'
                section='behavior'
                values={{
                    uiConfig: {
                        sharedBehavior: {
                            canDeactivate: false,
                            canExclude: false,
                            positionLocked: false
                        }
                    }
                }}
                setValue={setValue}
            />
        )

        await user.click(screen.getByLabelText(/Can be deactivated/))

        expect(setValue).toHaveBeenCalledWith('uiConfig', {
            sharedBehavior: {
                canDeactivate: true,
                canExclude: false,
                positionLocked: false
            }
        })
    })

    it('renders descriptive helper copy for shared behavior and exclusions', () => {
        render(
            <SharedEntitySettingsFields
                metahubId='metahub-1'
                entityKind='attribute'
                sharedEntityId='attribute-1'
                storageField='uiConfig'
                section='all'
                values={{
                    uiConfig: {
                        sharedBehavior: {
                            canDeactivate: true,
                            canExclude: true,
                            positionLocked: false
                        }
                    }
                }}
                setValue={vi.fn()}
            />
        )

        expect(
            screen.getByText('Control how this shared entity behaves inside target objects and which overrides remain available there.')
        ).toBeInTheDocument()
        expect(
            screen.getByText('Allow target objects to switch this shared entity off without removing it completely.')
        ).toBeInTheDocument()
        expect(screen.getByText('Allow target objects to exclude this shared entity from their own list.')).toBeInTheDocument()
        expect(
            screen.getByText('Keep this shared entity fixed in inherited order so target objects cannot reorder it.')
        ).toBeInTheDocument()
        expect(
            screen.getByText('Disable inheritance for selected target objects while keeping this shared entity available everywhere else.')
        ).toBeInTheDocument()
    })

    it('stores exclusion changes in local form state until the dialog is saved', async () => {
        const user = userEvent.setup()
        const setValue = vi.fn()

        render(
            <SharedEntitySettingsFields
                metahubId='metahub-1'
                entityKind='attribute'
                sharedEntityId='attribute-1'
                storageField='uiConfig'
                section='exclusions'
                values={{ uiConfig: {} }}
                setValue={setValue}
            />
        )

        expect(screen.getByText('Catalog Two')).toBeInTheDocument()

        await user.click(screen.getByTestId('entity-selection-add-button'))
        await user.click(screen.getByTestId('entity-selection-option-catalog-1'))
        await user.click(screen.getByTestId('entity-selection-confirm'))

        expect(setValue).toHaveBeenCalledWith('_sharedExcludedTargetIds', ['catalog-2', 'catalog-1'])
    })

    it('drops unsaved new exclusions when canExclude is turned off in the same dialog', async () => {
        const user = userEvent.setup()
        const setValue = vi.fn()

        render(
            <SharedEntitySettingsFields
                metahubId='metahub-1'
                entityKind='attribute'
                sharedEntityId='attribute-1'
                storageField='uiConfig'
                section='behavior'
                values={{
                    uiConfig: {
                        sharedBehavior: {
                            canDeactivate: true,
                            canExclude: true,
                            positionLocked: false
                        }
                    },
                    _sharedExcludedTargetIds: ['catalog-1', 'catalog-2']
                }}
                setValue={setValue}
            />
        )

        await user.click(screen.getByLabelText(/Can be excluded/))

        expect(setValue).toHaveBeenCalledWith('uiConfig', {
            sharedBehavior: {
                canDeactivate: true,
                canExclude: false,
                positionLocked: false
            }
        })
        expect(setValue).toHaveBeenCalledWith('_sharedExcludedTargetIds', ['catalog-2'])
    })

    it('normalizes VLC target labels into strings before rendering exclusion options', () => {
        expect(
            resolveSharedTargetLabel(
                {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Catalog One' }
                    }
                },
                {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'catalog_one' }
                    }
                },
                'en',
                'catalog-1'
            )
        ).toBe('Catalog One')

        expect(
            resolveSharedTargetSecondaryLabel(
                {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'catalog_one' }
                    }
                },
                [
                    {
                        codename: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'main_hub' }
                            }
                        }
                    }
                ],
                'en',
                'catalog-1'
            )
        ).toBe('catalog_one • main_hub')
    })

    it('refreshes localized helper copy and target query keys when the UI language changes', () => {
        const setValue = vi.fn()

        const view = render(
            <SharedEntitySettingsFields
                metahubId='metahub-1'
                entityKind='attribute'
                sharedEntityId='attribute-1'
                storageField='uiConfig'
                section='all'
                values={{ uiConfig: {} }}
                setValue={setValue}
            />
        )

        expect(screen.getByText(localizedStrings.en['shared.behavior.description'])).toBeInTheDocument()
        expect(screen.getByText(localizedStrings.en['shared.exclusions.title'])).toBeInTheDocument()
        expect(useQueryMock.mock.lastCall?.[0]?.queryKey).toEqual(expect.arrayContaining(['en']))

        i18nState.language = 'ru'
        view.rerender(
            <SharedEntitySettingsFields
                metahubId='metahub-1'
                entityKind='attribute'
                sharedEntityId='attribute-1'
                storageField='uiConfig'
                section='all'
                values={{ uiConfig: {} }}
                setValue={setValue}
            />
        )

        expect(screen.getByText(localizedStrings.ru['shared.behavior.description'])).toBeInTheDocument()
        expect(screen.getByText(localizedStrings.ru['shared.exclusions.title'])).toBeInTheDocument()
        expect(useQueryMock.mock.lastCall?.[0]?.queryKey).toEqual(expect.arrayContaining(['ru']))
    })
})
