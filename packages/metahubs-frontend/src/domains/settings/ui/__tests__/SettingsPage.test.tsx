import '@testing-library/jest-dom/vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import SettingsPage from '../SettingsPage'

const updateMutateAsync = vi.fn()
const resetMutateAsync = vi.fn()

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string }) => {
            const mapped: Record<string, string> = {
                'settings.title': 'Settings',
                'settings.search': 'Search settings...',
                'settings.tabs.general': 'General',
                'settings.tabs.common': 'Common',
                'settings.tabs.page': 'Pages',
                'settings.keys.general.language': 'Language',
                'settings.keys.general.language.description': 'Default language',
                'settings.keys.entity.page.allowCopy': 'Allow Copy',
                'settings.keys.entity.page.allowCopy.description': 'Allow copying pages within this metahub',
                'settings.keys.entity.page.allowDelete': 'Allow Delete',
                'settings.keys.entity.page.allowDelete.description': 'Allow deleting pages from this metahub',
                'settings.languages.system': 'System'
            }

            return mapped[key] ?? options?.defaultValue ?? key
        }
    })
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: vi.fn() })
}))

vi.mock('@universo/template-mui', () => ({
    APIEmptySVG: 'empty',
    EmptyListState: ({ title }: { title?: string }) => <div>{title}</div>,
    TemplateMainCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    ViewHeaderMUI: ({ title }: { title: string }) => <h1>{title}</h1>,
    useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }),
    useDebouncedSearch: ({ onSearchChange }: { onSearchChange: (value: string) => void }) => ({
        handleSearchChange: (value: string) => onSearchChange(value)
    })
}))

vi.mock('../SettingControl', () => ({
    default: ({ value }: { value: unknown }) => <span>{String(value)}</span>
}))

vi.mock('../CodenameStylePreview', () => ({
    default: () => null
}))

vi.mock('../../hooks/useSettings', () => ({
    useSettings: () => ({
        data: {
            registry: [
                {
                    key: 'general.language',
                    tab: 'general',
                    valueType: 'select',
                    defaultValue: 'system',
                    options: ['system', 'en', 'ru'],
                    sortOrder: 1
                },
                {
                    key: 'entity.page.allowCopy',
                    tab: 'page',
                    valueType: 'boolean',
                    defaultValue: true,
                    sortOrder: 1
                },
                {
                    key: 'entity.page.allowDelete',
                    tab: 'page',
                    valueType: 'boolean',
                    defaultValue: true,
                    sortOrder: 2
                }
            ],
            settings: [
                { key: 'general.language', value: { _value: 'system' }, id: null, version: 0, updatedAt: null, isDefault: true },
                { key: 'entity.page.allowCopy', value: { _value: true }, id: null, version: 0, updatedAt: null, isDefault: true },
                { key: 'entity.page.allowDelete', value: { _value: true }, id: null, version: 0, updatedAt: null, isDefault: true }
            ],
            meta: {}
        },
        isLoading: false,
        isError: false
    }),
    useUpdateSettings: () => ({ mutateAsync: updateMutateAsync }),
    useResetSetting: () => ({ mutateAsync: resetMutateAsync })
}))

describe('SettingsPage', () => {
    it('renders Page settings from the registry without leaking tab or setting keys', async () => {
        const user = userEvent.setup()

        render(<SettingsPage />)

        expect(screen.getByRole('tab', { name: 'Pages' })).toBeInTheDocument()
        expect(screen.queryByText('settings.tabs.page')).not.toBeInTheDocument()

        await user.click(screen.getByRole('tab', { name: 'Pages' }))

        expect(screen.getByText('Allow Copy')).toBeInTheDocument()
        expect(screen.getByText('Allow deleting pages from this metahub')).toBeInTheDocument()
        expect(screen.queryByText('settings.keys.entity.page.allowCopy')).not.toBeInTheDocument()
        expect(screen.queryByText('settings.keys.entity.page.allowDelete')).not.toBeInTheDocument()
    })
})
