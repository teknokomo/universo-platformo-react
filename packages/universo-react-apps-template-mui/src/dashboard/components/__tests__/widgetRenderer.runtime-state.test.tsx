import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, act } from '@testing-library/react'

vi.mock('../../../components/resource-preview', async () => {
    const { MockResourcePreview } = await import('./widgetRenderer.test-mocks')
    return { ResourcePreview: MockResourcePreview }
})

import { placement, renderRuntimeWidget, resetRuntimeLanguage } from './widgetRenderer.test-support'
import i18n from '@universo-react/i18n'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'
import { renderWidget } from '../widgetRenderer'

describe('Dashboard runtime widget ownership renderers', () => {
    afterEach(resetRuntimeLanguage)

    it('distinguishes omitted required and optional source states', () => {
        const { container, rerender } = renderRuntimeWidget(placement('infoCard'))
        expect(screen.getByText('A required content source is unavailable.')).toBeInTheDocument()

        rerender(
            <DashboardDetailsProvider value={{ title: 'Runtime', locale: 'en' }}>
                {renderWidget(placement('resourcePreview'))}
            </DashboardDetailsProvider>
        )
        expect(container).toBeEmptyDOMElement()
    })

    it('renders required-source and transport failures with Russian messages', async () => {
        await act(async () => {
            await i18n.changeLanguage('ru')
        })
        const { rerender } = renderRuntimeWidget(placement('infoCard', { status: 'required-missing' }))
        expect(screen.getByText('Обязательный источник содержимого недоступен.')).toBeInTheDocument()

        rerender(
            <DashboardDetailsProvider value={{ title: 'Runtime', locale: 'ru' }}>
                {renderWidget(placement('infoCard', { status: 'permission-denied' }))}
            </DashboardDetailsProvider>
        )
        expect(screen.getByText('У вас нет доступа к этому содержимому.')).toBeInTheDocument()

        rerender(
            <DashboardDetailsProvider value={{ title: 'Runtime', locale: 'ru' }}>
                {renderWidget(placement('infoCard', { status: 'network-error' }))}
            </DashboardDetailsProvider>
        )
        expect(screen.getByText('Не удалось подключиться к службе содержимого.')).toBeInTheDocument()
    })

    it('keeps all source and transport runtime states distinct and localized', () => {
        const states = [
            ['required-missing', 'A required content source is unavailable.'],
            ['stale-source', 'This content source is no longer available.'],
            ['permission-denied', 'You do not have access to this content.'],
            ['malformed-config', 'This widget is configured incorrectly.'],
            ['network-error', 'Could not reach the content service.'],
            ['server-error', 'The content service could not complete the request.'],
            ['empty', 'No matching content was found.']
        ] as const
        const optional = renderRuntimeWidget(placement('detailsTable', { status: 'optional-unbound' }))
        expect(optional.container).toBeEmptyDOMElement()
        optional.unmount()
        for (const [status, expected] of states) {
            const view = renderRuntimeWidget(placement('detailsTable', { status }))
            expect(screen.getByRole('status')).toHaveTextContent(expected)
            view.unmount()
        }
        renderRuntimeWidget(placement('detailsTable', { status: 'loading' }))
        expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading widget content')
    })
})
