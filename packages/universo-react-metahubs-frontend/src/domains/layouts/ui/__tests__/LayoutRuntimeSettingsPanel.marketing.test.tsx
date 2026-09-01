import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import LayoutRuntimeSettingsPanel from '../LayoutRuntimeSettingsPanel'

const t = ((key: string, fallback?: string) => fallback ?? key) as never

describe('LayoutRuntimeSettingsPanel marketing appearance', () => {
    it('keeps a color draft local until blur instead of submitting every keystroke', () => {
        const onViewSettingChange = vi.fn()

        render(
            <LayoutRuntimeSettingsPanel
                t={t}
                templateKey='marketing-page'
                isScopedLayout={false}
                layoutConfig={{ themeMode: 'light', primaryColor: '#1976d2' }}
                objectBehaviorConfig={{
                    showCreateButton: true,
                    searchMode: 'page-local',
                    createSurface: 'dialog',
                    editSurface: 'dialog',
                    copySurface: 'dialog',
                    enableRowReordering: false,
                    reorderPersistenceField: null
                }}
                sideMenuConfig={{ availableModes: ['wide'], primaryMode: 'wide', rememberUserChoice: true }}
                reorderPersistenceFieldDraft=''
                viewSettingsSaving={false}
                canManageLayouts
                onObjectBehaviorChange={vi.fn()}
                onViewSettingChange={onViewSettingChange}
                onSideMenuConfigChange={vi.fn()}
                onReorderPersistenceFieldDraftChange={vi.fn()}
                onCommitReorderPersistenceField={vi.fn()}
            />
        )

        const primaryColor = screen.getByLabelText('Primary color')
        fireEvent.change(primaryColor, { target: { value: '#' } })
        expect(onViewSettingChange).not.toHaveBeenCalled()

        fireEvent.blur(primaryColor)
        expect(onViewSettingChange).toHaveBeenCalledWith('primaryColor', '#')
    })
})
