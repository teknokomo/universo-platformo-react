import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { StandardDialog } from '../StandardDialog'
import { DialogPresentationProvider } from '../dialogPresentation'

describe('StandardDialog', () => {
    it('uses the dialog title as its accessible name when presentation controls are present', () => {
        render(
            <DialogPresentationProvider
                value={{
                    enabled: true,
                    allowFullscreen: true,
                    titleActionLabels: { expand: 'Expand dialog' }
                }}
            >
                <StandardDialog open onClose={() => undefined} title='Hero content'>
                    <p>Content</p>
                </StandardDialog>
            </DialogPresentationProvider>
        )

        expect(screen.getByRole('dialog', { name: 'Hero content' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Expand dialog' })).toBeInTheDocument()
    })
})
