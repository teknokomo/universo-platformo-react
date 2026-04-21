import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import QRCodeWidget from '../QRCodeWidget'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'

const mocks = vi.hoisted(() => ({
    toCanvas: vi.fn()
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}))

vi.mock('qrcode', () => ({
    default: {
        toCanvas: mocks.toCanvas
    }
}))

describe('QRCodeWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.toCanvas.mockResolvedValue(undefined)
        vi.stubGlobal('navigator', {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined)
            }
        })
    })

    it('renders the QR code and copies the link', async () => {
        render(<QRCodeWidget config={{ url: 'https://example.com/module/demo', size: 128, title: 'Demo QR' }} />)

        expect(screen.getByText('Demo QR')).toBeInTheDocument()

        await waitFor(() => {
            expect(mocks.toCanvas).toHaveBeenCalledWith(
                expect.any(HTMLCanvasElement),
                'https://example.com/module/demo',
                expect.objectContaining({ width: 128 })
            )
        })

        fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))

        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/module/demo')
            expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument()
        })
    })

    it('builds a public link from the application context when only a slug is provided', async () => {
        render(
            <DashboardDetailsProvider value={{ applicationId: 'app-demo' } as never}>
                <QRCodeWidget config={{ publicLinkSlug: 'demo-module' }} />
            </DashboardDetailsProvider>
        )

        await waitFor(() => {
            expect(mocks.toCanvas).toHaveBeenCalledWith(
                expect.any(HTMLCanvasElement),
                'http://localhost:3000/public/a/app-demo/links/demo-module',
                expect.objectContaining({ width: 256 })
            )
        })

        expect(screen.getByText('http://localhost:3000/public/a/app-demo/links/demo-module')).toBeInTheDocument()
    })
})
