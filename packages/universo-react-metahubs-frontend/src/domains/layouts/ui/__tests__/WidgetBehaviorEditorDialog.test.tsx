import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'

const mocks = vi.hoisted(() => ({ onSave: vi.fn(), onCancel: vi.fn() }))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key
    })
}))

vi.mock('@universo-react/i18n', () => ({
    useCommonTranslations: () => ({
        t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key
    })
}))

vi.mock('@universo-react/template-mui', () => ({
    EntityFormDialog: ({
        open,
        title,
        extraFields,
        onSave
    }: {
        open: boolean
        title: string
        extraFields: () => ReactNode
        onSave: () => void
    }) =>
        open ? (
            <section>
                <h2>{title}</h2>
                {extraFields()}
                <button type='button' onClick={onSave}>
                    Save
                </button>
            </section>
        ) : null
}))

import WidgetBehaviorEditorDialog from '../WidgetBehaviorEditorDialog'

describe('WidgetBehaviorEditorDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders registry presentation fields and saves only their edited values', async () => {
        const user = userEvent.setup()
        render(
            <WidgetBehaviorEditorDialog
                open
                widgetKey='overviewTitle'
                widgetLabel='Overview title'
                config={{ align: 'left', level: 'h2' }}
                onSave={mocks.onSave}
                onCancel={mocks.onCancel}
            />
        )

        expect(screen.getByRole('heading', { name: 'Presentation settings: Overview title' })).toBeInTheDocument()
        const alignment = screen.getByRole('combobox', { name: 'Heading alignment' })
        await user.click(alignment)
        await user.click(await screen.findByRole('option', { name: 'center' }))
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(mocks.onSave).toHaveBeenCalledWith({ align: 'center', level: 'h2' })
    })

    it('does not expose renderer configuration or preserve legacy placement fields without registered controls', async () => {
        const user = userEvent.setup()
        render(
            <WidgetBehaviorEditorDialog
                open
                widgetKey='languageSwitcher'
                widgetLabel='Language switcher'
                config={{
                    privateValue: 'must not be shown as a control',
                    sharedBehavior: { canDeactivate: false, canExclude: false, positionLocked: true }
                }}
                onSave={mocks.onSave}
                onCancel={mocks.onCancel}
            />
        )

        expect(screen.queryByLabelText('privateValue')).not.toBeInTheDocument()
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Save' }))
        expect(mocks.onSave).toHaveBeenCalledWith({ privateValue: 'must not be shown as a control' })
    })
})
