import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog'
import { DialogPresentationProvider } from '../dialogPresentation'

describe('ConfirmDeleteDialog', () => {
    it('does not expose resize or fullscreen controls from dialog presentation settings', () => {
        render(
            <DialogPresentationProvider value={{ enabled: true, allowResize: true, allowFullscreen: true }}>
                <ConfirmDeleteDialog
                    open
                    title='Delete package'
                    description='Delete this package attachment?'
                    onCancel={() => undefined}
                    onConfirm={() => undefined}
                />
            </DialogPresentationProvider>
        )

        expect(screen.getByRole('dialog', { name: 'Delete package' })).toBeVisible()
        expect(screen.queryByTestId('dialog-resize-handle')).not.toBeInTheDocument()
        expect(screen.queryByTestId('dialog-toggle-fullscreen')).not.toBeInTheDocument()
    })
})
