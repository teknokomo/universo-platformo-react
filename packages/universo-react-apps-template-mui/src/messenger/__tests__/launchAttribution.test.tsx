import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import type { DashboardDetailsSlot } from '../../dashboard/contracts'
import { useDashboardDetails } from '../../dashboard/DashboardDetailsContext'
import type { MessengerZoneWidgets } from '../../api/api'
import { MessengerRuntimeShell } from '../MessengerRuntimeShell'
import { detectMessengerLaunchPlatform, isValidMessengerShortId, readMessengerLaunchHint } from '../launchHints'

import '../../i18n'

const validShortId = 'a'.repeat(22)
const otherShortId = 'b'.repeat(22)
const zones: MessengerZoneWidgets = { top: [], center: [], bottom: [] }
const details: DashboardDetailsSlot = {
    applicationId: 'public-alias',
    title: 'Messenger runtime',
    runtimeAccessMode: 'public'
}
const fetchMock = vi.fn()

const renderShell = () =>
    render(
        <ThemeProvider theme={createTheme()}>
            <MessengerRuntimeShell zones={zones} details={details}>
                <LaunchPlatformProbe />
            </MessengerRuntimeShell>
        </ThemeProvider>
    )

const response = (platform: 'telegram' | 'max' | null) => ({
    ok: true,
    json: vi.fn().mockResolvedValue({ platform })
})

beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/')
})

afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    document.querySelectorAll('script[data-universo-messenger-bridge]').forEach((script) => script.remove())
    Reflect.deleteProperty(window, 'Telegram')
    Reflect.deleteProperty(window, 'WebApp')
    window.history.replaceState({}, '', '/')
})

describe('Messenger launch attribution hints', () => {
    it('accepts only the server-issued 22-character URL-safe short id shape', () => {
        expect(isValidMessengerShortId(validShortId)).toBe(true)
        expect(isValidMessengerShortId('a'.repeat(21))).toBe(false)
        expect(isValidMessengerShortId('a'.repeat(21) + '.')).toBe(false)
    })

    it('prefers Telegram bridge start_param and exposes only the resolved platform', async () => {
        window.history.replaceState({}, '', '/?startapp=' + otherShortId)
        Reflect.set(window, 'Telegram', {
            WebApp: {
                get initData() {
                    throw new Error('Telegram initData must not be read')
                },
                initDataUnsafe: {
                    start_param: validShortId,
                    get user() {
                        throw new Error('Messenger identity must not be read')
                    }
                }
            }
        })
        fetchMock.mockResolvedValue(response('telegram'))

        renderShell()

        await waitFor(() => expect(screen.getByTestId('messenger-launch-platform')).toHaveTextContent('telegram'))
        expect(fetchMock).toHaveBeenCalledWith('/api/v1/public/applications/public-alias/attribution/' + validShortId, expect.any(Object))
        expect(screen.getByTestId('messenger-launch-platform')).toHaveTextContent('telegram')
        expect(screen.getByTestId('messenger-runtime-shell')).toBeInTheDocument()
    })

    it('detects official Telegram query and MAX hash markers before the bridge has loaded', () => {
        window.history.replaceState({}, '', '/?tgWebAppPlatform=ios&tgWebAppStartParam=' + validShortId)
        expect(detectMessengerLaunchPlatform()).toBe('telegram')
        expect(readMessengerLaunchHint()).toEqual({ platform: 'telegram', shortId: validShortId })

        Reflect.set(window, 'Telegram', { WebApp: {} })
        expect(readMessengerLaunchHint()).toEqual({ platform: 'telegram', shortId: validShortId })

        Reflect.deleteProperty(window, 'Telegram')
        window.history.replaceState({}, '', '/#WebAppData=opaque&WebAppPlatform=web&WebAppStartParam=' + otherShortId)
        expect(detectMessengerLaunchPlatform()).toBe('max')
        expect(readMessengerLaunchHint()).toEqual({ platform: 'max', shortId: otherShortId })

        window.history.replaceState({}, '', '/?startapp=' + validShortId)
        expect(detectMessengerLaunchPlatform()).toBeNull()
        expect(readMessengerLaunchHint()).toBeNull()
    })

    it('supports the MAX bridge hint and its startapp query fallback', () => {
        Reflect.set(window, 'WebApp', { initDataUnsafe: { start_param: validShortId, user: { id: 12345 } } })
        expect(readMessengerLaunchHint()).toEqual({ platform: 'max', shortId: validShortId })

        Reflect.set(window, 'WebApp', {})
        window.history.replaceState({}, '', '/?startapp=' + otherShortId)
        expect(readMessengerLaunchHint()).toEqual({ platform: 'max', shortId: otherShortId })
    })

    it('resolves MAX attribution into the neutral runtime context', async () => {
        Reflect.set(window, 'WebApp', { initDataUnsafe: { start_param: validShortId, user: { id: 12345 } } })
        fetchMock.mockResolvedValue(response('max'))

        renderShell()

        await waitFor(() => expect(screen.getByTestId('messenger-launch-platform')).toHaveTextContent('max'))
        expect(fetchMock).toHaveBeenCalledWith('/api/v1/public/applications/public-alias/attribution/' + validShortId, expect.any(Object))
    })

    it('silently ignores browser-only, malformed, and unresolved hints', async () => {
        window.history.replaceState({}, '', '/?startapp=' + validShortId)
        renderShell()
        expect(fetchMock).not.toHaveBeenCalled()
        expect(screen.getByTestId('messenger-launch-platform')).toHaveTextContent('none')

        cleanup()
        Reflect.set(window, 'Telegram', { WebApp: { initDataUnsafe: { start_param: 'unsafe' } } })
        window.history.replaceState({}, '', '/?startapp=' + validShortId)
        renderShell()
        expect(fetchMock).not.toHaveBeenCalled()
        expect(screen.getByTestId('messenger-launch-platform')).toHaveTextContent('none')

        cleanup()
        Reflect.set(window, 'Telegram', { WebApp: { initDataUnsafe: { start_param: validShortId } } })
        fetchMock.mockResolvedValue(response(null))
        renderShell()
        await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
        expect(screen.getByTestId('messenger-launch-platform')).toHaveTextContent('none')
    })
})

function LaunchPlatformProbe() {
    const runtimeDetails = useDashboardDetails()
    return <span data-testid='messenger-launch-platform'>{runtimeDetails?.messengerLaunchAttribution?.platform ?? 'none'}</span>
}
