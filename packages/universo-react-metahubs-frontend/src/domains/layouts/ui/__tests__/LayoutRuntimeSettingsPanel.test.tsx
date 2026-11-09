import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'

import LayoutRuntimeSettingsPanel from '../LayoutRuntimeSettingsPanel'

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (key: string, fallback?: string | { defaultValue?: string }) =>
            (typeof fallback === 'string' ? fallback : fallback?.defaultValue) ?? key,
        i18n: { language: 'en' }
    })
}))

const baseProps = {
    t: ((key: string, fallback?: string) => fallback ?? key) as never,
    isScopedLayout: false,
    objectBehaviorConfig: {
        showCreateButton: true,
        createSurface: 'dialog',
        editSurface: 'dialog',
        copySurface: 'dialog'
    },
    sideMenuConfig: { availableModes: ['wide'], primaryMode: 'wide', rememberUserChoice: true },
    viewSettingsSaving: false,
    canManageLayouts: true,
    onObjectBehaviorChange: vi.fn(),
    onSideMenuConfigChange: vi.fn()
} satisfies ComponentProps<typeof LayoutRuntimeSettingsPanel>

describe('LayoutRuntimeSettingsPanel dashboard-only runtime settings', () => {
    it('renders the entity behavior and side-menu panels for the dashboard template', () => {
        render(<LayoutRuntimeSettingsPanel {...baseProps} templateKey='dashboard' />)

        expect(screen.getByTestId('layout-runtime-settings-panel')).toBeInTheDocument()
        expect(screen.getByText('Default entity runtime behavior')).toBeInTheDocument()
        expect(screen.getByText('Side menu display')).toBeInTheDocument()
    })

    it.each(['marketing-page', 'messenger-app'] as const)('keeps the dashboard-only panels out of the %s template', (templateKey) => {
        render(<LayoutRuntimeSettingsPanel {...baseProps} templateKey={templateKey} />)

        expect(screen.queryByTestId('layout-runtime-settings-panel')).not.toBeInTheDocument()
        expect(screen.queryByText('Default entity runtime behavior')).not.toBeInTheDocument()
        expect(screen.queryByText('Side menu display')).not.toBeInTheDocument()
    })

    it('no longer owns the appearance section (it moved to the dedicated LayoutDetails tab)', () => {
        render(<LayoutRuntimeSettingsPanel {...baseProps} templateKey='dashboard' />)

        expect(screen.queryByTestId('metahub-appearance-section')).not.toBeInTheDocument()
    })
})
