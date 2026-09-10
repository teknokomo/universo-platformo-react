import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import '../../../i18n'
import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog'
import { FormDialog, type FieldConfig } from '../FormDialog'

vi.mock('@universo-react/block-editor', () => ({
    EditorJsBlockEditor: () => null
}))

const formFields: FieldConfig[] = [{ id: 'title', label: 'Название', type: 'STRING' }]

describe('runtime dialog accessibility', () => {
    it('links FormDialog title and description with stable IDs and closes on Escape', async () => {
        const user = userEvent.setup()
        const onClose = vi.fn()
        const props = {
            open: true,
            title: 'Создать запись',
            fields: formFields,
            locale: 'ru',
            contentHeaderId: 'runtime-form-context-description',
            contentHeader: <span>Описание формы</span>,
            saveButtonText: 'Сохранить',
            cancelButtonText: 'Отмена',
            onClose,
            onSubmit: vi.fn().mockResolvedValue(undefined)
        }
        const { rerender } = render(<FormDialog {...props} />)
        const dialog = screen.getByRole('dialog', { name: 'Создать запись' })
        const titleId = dialog.getAttribute('aria-labelledby')
        const descriptionIds = (dialog.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)

        expect(titleId).toBeTruthy()
        expect(document.getElementById(titleId ?? '')).toHaveTextContent('Создать запись')
        expect(descriptionIds).toHaveLength(1)
        expect(descriptionIds[0]).toBe('runtime-form-context-description')
        expect(descriptionIds.every((id) => document.getElementById(id))).toBe(true)
        expect(screen.getByRole('button', { name: 'Сохранить' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Отмена' })).toBeInTheDocument()

        rerender(<FormDialog {...props} />)
        expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', titleId)
        expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby', descriptionIds.join(' '))

        await user.keyboard('{Escape}')
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('uses the shared destructive confirmation contract and restores focus after Escape', async () => {
        const user = userEvent.setup()

        function DeleteHarness() {
            const [open, setOpen] = useState(false)
            return (
                <>
                    <button type='button' onClick={() => setOpen(true)}>
                        Открыть удаление
                    </button>
                    <ConfirmDeleteDialog
                        open={open}
                        title='Удалить запись?'
                        description='Эта запись будет удалена.'
                        confirmButtonText='Удалить'
                        deletingButtonText='Удаление...'
                        cancelButtonText='Отмена'
                        onCancel={() => setOpen(false)}
                        onConfirm={() => setOpen(false)}
                    />
                </>
            )
        }

        render(<DeleteHarness />)
        const opener = screen.getByRole('button', { name: 'Открыть удаление' })

        await user.click(opener)
        const dialog = screen.getByRole('dialog', { name: 'Удалить запись?' })
        const titleId = dialog.getAttribute('aria-labelledby')
        const descriptionId = dialog.getAttribute('aria-describedby')

        expect(titleId).toBeTruthy()
        expect(descriptionId).toBeTruthy()
        expect(document.getElementById(titleId ?? '')).toHaveTextContent('Удалить запись?')
        expect(document.getElementById(descriptionId ?? '')).toHaveTextContent('Эта запись будет удалена.')
        expect(screen.getByRole('button', { name: 'Удалить' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Отмена' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /resize|fullscreen/i })).not.toBeInTheDocument()

        await user.keyboard('{Escape}')
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(opener).toHaveFocus()
    })
})
