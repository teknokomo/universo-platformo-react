import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import type { RuntimePlacement } from '../../dashboard/runtime/widgetPlacementGraph'
import type { DashboardDetailsSlot } from '../../dashboard/contracts'
import { useDashboardDetails } from '../../dashboard/DashboardDetailsContext'
import type { MessengerZoneWidgets } from '../../api/api'
import { MessengerRuntimeShell } from '../MessengerRuntimeShell'
import { getMaxMessengerBridge } from '../bridges/max'
import { getTelegramMessengerBridge } from '../bridges/telegram'

vi.mock('../../dashboard/components/widgetRenderer', () => ({
    renderWidget: (widget: { instanceKey: string; widgetKey: string }) => (
        <span data-testid={`rendered-${widget.instanceKey}`}>{widget.widgetKey}</span>
    )
}))

import '../../i18n'

const placement = (instanceKey: string, zone: RuntimePlacement['zone'], isActive = true): RuntimePlacement => ({
    instanceKey,
    widgetKey: 'divider',
    zone,
    sortOrder: 0,
    config: {},
    isActive,
    parentInstanceKey: null,
    slotKey: null
})

const zones: MessengerZoneWidgets = {
    top: [placement('top-divider', 'top')],
    center: [placement('center-divider', 'center'), placement('inactive-divider', 'center', false)],
    bottom: [placement('bottom-divider', 'bottom')]
}

const originalVisualViewportDescriptor = Object.getOwnPropertyDescriptor(window, 'visualViewport')

const details: DashboardDetailsSlot = {
    title: 'Messenger runtime',
    locale: 'en',
    runtimeAccessMode: 'public',
    permissions: {
        manageMembers: false,
        manageApplication: false,
        createContent: false,
        editContent: false,
        deleteContent: false,
        readReports: false
    }
}

const renderShell = (children?: ReactNode, onViewportHeightChange?: (height: string | undefined) => void) =>
    render(
        <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
            <MessengerRuntimeShell zones={zones} details={details} onViewportHeightChange={onViewportHeightChange}>
                {children}
            </MessengerRuntimeShell>
        </ThemeProvider>
    )

const renderShellWithDetails = (children: ReactNode, runtimeDetails: DashboardDetailsSlot) =>
    render(
        <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
            <MessengerRuntimeShell zones={zones} details={runtimeDetails}>
                {children}
            </MessengerRuntimeShell>
        </ThemeProvider>
    )

const setVisualViewport = () => {
    const visualViewport = new EventTarget()
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport })
    return visualViewport
}

const emittedStyles = () => [...document.head.querySelectorAll('style')].map((style) => style.textContent ?? '').join('\n')

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    document.querySelectorAll('script[data-universo-messenger-bridge]').forEach((script) => script.remove())
    Reflect.deleteProperty(window, 'Telegram')
    Reflect.deleteProperty(window, 'WebApp')
    if (originalVisualViewportDescriptor) {
        Object.defineProperty(window, 'visualViewport', originalVisualViewportDescriptor)
    } else {
        Reflect.deleteProperty(window, 'visualViewport')
    }
    window.history.replaceState({}, '', '/')
})

describe('MessengerRuntimeShell', () => {
    it('renders top, center, and bottom placements through the shared renderer', () => {
        renderShell(<RuntimeTemplateProbe />)

        expect(screen.getAllByRole('main')).toHaveLength(1)
        expect(screen.getByTestId('messenger-zone-top')).toContainElement(screen.getByTestId('rendered-top-divider'))
        expect(screen.getByTestId('messenger-zone-center')).toContainElement(screen.getByTestId('rendered-center-divider'))
        expect(screen.getByTestId('messenger-zone-bottom')).toContainElement(screen.getByTestId('rendered-bottom-divider'))
        expect(screen.queryByTestId('rendered-inactive-divider')).not.toBeInTheDocument()
        expect(screen.getByTestId('runtime-template-key')).toHaveTextContent('messenger-app')
    })

    it('inherits the host MUI dark palette and renders public host content', () => {
        renderShell(<div data-testid='injected-content'>Read only content</div>)

        expect(screen.getByTestId('injected-content')).toBeInTheDocument()
        expect(screen.getByTestId('messenger-runtime-shell')).toHaveStyle({ color: '#fff' })
        const styles = emittedStyles()
        expect(styles).toContain('--tg-content-safe-area-inset-top')
        expect(styles).toContain('--tg-viewport-stable-height')
        expect(styles).toContain('env(safe-area-inset-top')
        expect(styles).toContain('100dvh')
        expect(styles).toContain('100vh')
    })

    it('keeps Messenger navigation visible before the selected Page content', () => {
        const pageZones: MessengerZoneWidgets = {
            ...zones,
            center: [
                { ...placement('overview-tabs', 'center'), widgetKey: 'detailsTabs' },
                { ...placement('page-navigation', 'center'), widgetKey: 'menuWidget' },
                placement('overview-divider', 'center')
            ]
        }
        const runtimeDetails: DashboardDetailsSlot = {
            ...details,
            contentMode: 'page',
            content: <div data-testid='selected-page-content'>Welcome page</div>
        }

        render(
            <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
                <MessengerRuntimeShell zones={pageZones} details={runtimeDetails} />
            </ThemeProvider>
        )

        const centerZone = screen.getByTestId('messenger-zone-center')
        const menu = screen.getByTestId('rendered-page-navigation')
        const pageContent = screen.getByTestId('selected-page-content')
        expect(centerZone).toContainElement(menu)
        expect(centerZone).toContainElement(pageContent)
        expect(menu.compareDocumentPosition(pageContent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(screen.queryByTestId('rendered-overview-tabs')).not.toBeInTheDocument()
        expect(screen.queryByTestId('rendered-overview-divider')).not.toBeInTheDocument()
    })

    it('uses the MAX viewport capability without requiring a BackButton', async () => {
        const getViewportSize = vi.fn().mockResolvedValue({ width: '390px', height: '640px' })
        const onViewportHeightChange = vi.fn()
        Object.defineProperty(window, 'WebApp', { configurable: true, value: { getViewportSize } })

        const bridge = getMaxMessengerBridge()
        expect(bridge?.platform).toBe('max')
        expect(bridge?.backButton).toBeUndefined()
        expect(bridge?.getViewportSize).toBeTypeOf('function')

        renderShell(undefined, onViewportHeightChange)
        const shell = screen.getByTestId('messenger-runtime-shell')
        await waitFor(() => expect(shell.style.getPropertyValue('--max-viewport-height')).toBe('640px'))
        expect(getViewportSize).toHaveBeenCalledOnce()
        expect(onViewportHeightChange).toHaveBeenCalledWith('640px')
    })

    it('refreshes the MAX viewport height after window, visualViewport, and orientation changes', async () => {
        const visualViewport = setVisualViewport()
        const getViewportSize = vi
            .fn()
            .mockResolvedValueOnce({ width: '390px', height: '640px' })
            .mockResolvedValueOnce({ width: '420px', height: '720px' })
            .mockResolvedValueOnce({ width: '420px', height: '680px' })
            .mockResolvedValueOnce({ width: '844px', height: '390px' })
        Object.defineProperty(window, 'WebApp', { configurable: true, value: { getViewportSize } })

        renderShell()
        const shell = screen.getByTestId('messenger-runtime-shell')
        await waitFor(() => expect(shell.style.getPropertyValue('--max-viewport-height')).toBe('640px'))

        window.dispatchEvent(new Event('resize'))
        await waitFor(() => expect(shell.style.getPropertyValue('--max-viewport-height')).toBe('720px'))

        visualViewport.dispatchEvent(new Event('resize'))
        await waitFor(() => expect(shell.style.getPropertyValue('--max-viewport-height')).toBe('680px'))

        window.dispatchEvent(new Event('orientationchange'))
        await waitFor(() => expect(shell.style.getPropertyValue('--max-viewport-height')).toBe('390px'))
        expect(getViewportSize).toHaveBeenCalledTimes(4)
    })

    it('keeps the CSS viewport fallback when MAX sizing is unavailable', () => {
        renderShell()

        expect(screen.getByTestId('messenger-runtime-shell').style.getPropertyValue('--max-viewport-height')).toBe('')
        expect(emittedStyles()).toContain('100dvh')
        expect(emittedStyles()).toContain('100vh')
    })

    it.each(['rejected', 'invalid'])('keeps the CSS viewport fallback after a %s MAX response', async (responseState) => {
        const getViewportSize =
            responseState === 'rejected'
                ? vi.fn().mockRejectedValue(new Error('MAX viewport unavailable'))
                : vi.fn().mockResolvedValue({ width: 'auto', height: '640px' })
        Object.defineProperty(window, 'WebApp', { configurable: true, value: { getViewportSize } })

        renderShell()
        const shell = screen.getByTestId('messenger-runtime-shell')
        await waitFor(() => expect(getViewportSize).toHaveBeenCalledOnce())
        await act(async () => {
            await Promise.resolve()
            await Promise.resolve()
        })

        expect(shell.style.getPropertyValue('--max-viewport-height')).toBe('')
        expect(emittedStyles()).toContain('100dvh')
        expect(emittedStyles()).toContain('100vh')
    })

    it('removes MAX viewport listeners when the shell unmounts', async () => {
        const visualViewport = setVisualViewport()
        const getViewportSize = vi.fn().mockResolvedValue({ width: '390px', height: '640px' })
        Object.defineProperty(window, 'WebApp', { configurable: true, value: { getViewportSize } })
        const removeWindowListener = vi.spyOn(window, 'removeEventListener')
        const removeVisualViewportListener = vi.spyOn(visualViewport, 'removeEventListener')

        const view = renderShell()
        await waitFor(() =>
            expect(screen.getByTestId('messenger-runtime-shell').style.getPropertyValue('--max-viewport-height')).toBe('640px')
        )
        const callsBeforeUnmount = getViewportSize.mock.calls.length

        view.unmount()
        expect(removeWindowListener).toHaveBeenCalledWith('resize', expect.any(Function))
        expect(removeWindowListener).toHaveBeenCalledWith('orientationchange', expect.any(Function))
        expect(removeVisualViewportListener).toHaveBeenCalledWith('resize', expect.any(Function))

        window.dispatchEvent(new Event('resize'))
        window.dispatchEvent(new Event('orientationchange'))
        visualViewport.dispatchEvent(new Event('resize'))
        await act(async () => {
            await Promise.resolve()
        })
        expect(getViewportSize).toHaveBeenCalledTimes(callsBeforeUnmount)
    })

    it('does not add a second main landmark when embedded inside an existing main', () => {
        render(
            <ThemeProvider theme={createTheme()}>
                <main>
                    <MessengerRuntimeShell zones={zones} details={details} rootElement='div' />
                </main>
            </ThemeProvider>
        )

        expect(screen.getAllByRole('main')).toHaveLength(1)
        expect(screen.getByTestId('messenger-runtime-shell').tagName).toBe('DIV')
    })

    it.each([
        { url: '/?tgWebAppPlatform=ios', platform: 'telegram', scriptUrl: 'https://telegram.org/js/telegram-web-app.js?64' },
        { url: '/#WebAppPlatform=web', platform: 'max', scriptUrl: 'https://st.max.ru/js/max-web-app.js' }
    ])('loads the public $platform bridge from the allowlisted script loader', async ({ url, platform, scriptUrl }) => {
        let appendedScript: HTMLScriptElement | undefined
        vi.spyOn(document.head, 'append').mockImplementation((...nodes) => {
            appendedScript = nodes.find((node): node is HTMLScriptElement => node instanceof HTMLScriptElement)
        })
        window.history.replaceState({}, '', url)
        renderShell()

        const script = await waitFor(() => {
            const loadedScript = appendedScript
            expect(loadedScript).not.toBeNull()
            return loadedScript as HTMLScriptElement
        })
        expect(script.src).toBe(scriptUrl)

        fireEvent.error(script)
        await waitFor(() => expect(document.querySelector(`script[data-universo-messenger-bridge="${platform}"]`)).not.toBeInTheDocument())
    })

    it('loads and selects MAX when its launch marker is present even if Telegram is already available', async () => {
        const telegramBackButton = { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() }
        const maxBackButton = { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() }
        Object.defineProperty(window, 'Telegram', {
            configurable: true,
            value: { WebApp: { BackButton: telegramBackButton } }
        })
        window.history.replaceState({}, '', '/#WebAppPlatform=web')

        let appendedScript: HTMLScriptElement | undefined
        vi.spyOn(document.head, 'append').mockImplementation((...nodes) => {
            appendedScript = nodes.find((node): node is HTMLScriptElement => node instanceof HTMLScriptElement)
        })
        renderShellWithDetails(<NavigationProbe />, { ...details, navigate: vi.fn() })

        const script = await waitFor(() => {
            expect(appendedScript?.src).toBe('https://st.max.ru/js/max-web-app.js')
            return appendedScript as HTMLScriptElement
        })
        Object.defineProperty(window, 'WebApp', {
            configurable: true,
            value: { BackButton: maxBackButton }
        })
        fireEvent.load(script)
        fireEvent.click(screen.getByRole('button', { name: 'Navigate in app' }))

        await waitFor(() => expect(maxBackButton.show).toHaveBeenCalledOnce())
        expect(telegramBackButton.show).not.toHaveBeenCalled()
    })

    it('uses the existing provider fallback only when the launch URL has no platform marker', async () => {
        const telegramBackButton = { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() }
        const maxBackButton = { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() }
        Object.defineProperty(window, 'Telegram', {
            configurable: true,
            value: { WebApp: { BackButton: telegramBackButton } }
        })
        Object.defineProperty(window, 'WebApp', {
            configurable: true,
            value: { BackButton: maxBackButton }
        })

        renderShellWithDetails(<NavigationProbe />, { ...details, navigate: vi.fn() })
        fireEvent.click(screen.getByRole('button', { name: 'Navigate in app' }))

        await waitFor(() => expect(telegramBackButton.show).toHaveBeenCalledOnce())
        expect(maxBackButton.show).not.toHaveBeenCalled()
        expect(document.querySelector('script[data-universo-messenger-bridge]')).not.toBeInTheDocument()
    })

    it('does not load a remote bridge for authenticated routes with provider URL markers', async () => {
        window.history.replaceState({}, '', '/?tgWebAppPlatform=ios')
        renderShellWithDetails(<RuntimeTemplateProbe />, { ...details, runtimeAccessMode: 'authenticated' })

        expect(screen.getByTestId('runtime-template-key')).toHaveTextContent('messenger-app')
        expect(document.querySelector('script[data-universo-messenger-bridge]')).not.toBeInTheDocument()
    })

    it('uses Telegram native controls when feature detected and cleans up its BackButton listener', async () => {
        const backButton = {
            show: vi.fn(),
            hide: vi.fn(),
            onClick: vi.fn(),
            offClick: vi.fn()
        }
        const close = vi.fn()
        Object.defineProperty(window, 'Telegram', {
            configurable: true,
            value: { WebApp: { BackButton: backButton, close } }
        })
        const runtimeDetails = { ...details, navigate: vi.fn() }

        const view = renderShellWithDetails(<NavigationProbe />, runtimeDetails)
        fireEvent.click(screen.getByRole('button', { name: 'Navigate in app' }))

        await waitFor(() => expect(backButton.show).toHaveBeenCalledOnce())
        expect(backButton.onClick).toHaveBeenCalledWith(expect.any(Function))
        fireEvent.click(screen.getByRole('button', { name: 'Close' }))
        expect(close).toHaveBeenCalledOnce()

        view.unmount()
        expect(backButton.offClick).toHaveBeenCalledWith(expect.any(Function))
        expect(backButton.hide).toHaveBeenCalledOnce()
    })

    it('keeps browser Back available when no messenger bridge is installed', async () => {
        const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
        const runtimeDetails = {
            ...details,
            navigate: vi.fn((href: string) => window.history.pushState({}, '', href))
        }
        renderShellWithDetails(<NavigationProbe />, runtimeDetails)
        fireEvent.click(screen.getByRole('button', { name: 'Navigate in app' }))

        await waitFor(() => expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Back' }))

        expect(back).toHaveBeenCalledOnce()
    })

    it('tracks app Back availability correctly across back, forward, and back navigation', async () => {
        const runtimeDetails = {
            ...details,
            navigate: vi.fn((href: string) => window.history.pushState({}, '', href))
        }
        renderShellWithDetails(<NavigationProbe />, runtimeDetails)
        fireEvent.click(screen.getByRole('button', { name: 'Navigate in app' }))

        await waitFor(() => expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument())

        window.history.replaceState({ __universoMessengerHistoryIndex: 0 }, '', '/a/base')
        fireEvent.popState(window)
        expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()

        window.history.replaceState({ __universoMessengerHistoryIndex: 1 }, '', '/a/next')
        fireEvent.popState(window)
        expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()

        window.history.replaceState({ __universoMessengerHistoryIndex: 0 }, '', '/a/base')
        fireEvent.popState(window)
        expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    })

    it('detects MAX independently and does not assume a close bridge exists', () => {
        const backButton = { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() }
        Object.defineProperty(window, 'WebApp', { configurable: true, value: { BackButton: backButton } })

        expect(getMaxMessengerBridge()?.platform).toBe('max')
        expect(getTelegramMessengerBridge()).toBeUndefined()
    })
})

function NavigationProbe() {
    const runtimeDetails = useDashboardDetails()
    return <button onClick={() => runtimeDetails?.navigate?.('/a/next')}>Navigate in app</button>
}

function RuntimeTemplateProbe() {
    const runtimeDetails = useDashboardDetails()
    return <span data-testid='runtime-template-key'>{runtimeDetails?.runtimeTemplateKey}</span>
}
