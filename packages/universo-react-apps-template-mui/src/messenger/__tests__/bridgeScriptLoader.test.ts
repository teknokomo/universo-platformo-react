import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadMessengerBridgeScript } from '../bridgeScriptLoader'

afterEach(() => {
    document.querySelectorAll('script[data-universo-messenger-bridge]').forEach((script) => script.remove())
    Reflect.deleteProperty(window, 'Telegram')
    Reflect.deleteProperty(window, 'WebApp')
    vi.restoreAllMocks()
})

const interceptScriptAppend = (): (() => HTMLScriptElement) => {
    let appendedScript: HTMLScriptElement | undefined
    vi.spyOn(document.head, 'append').mockImplementation((...nodes) => {
        appendedScript = nodes.find((node): node is HTMLScriptElement => node instanceof HTMLScriptElement)
    })
    return () => {
        if (!appendedScript) throw new Error('The messenger bridge script was not appended')
        return appendedScript
    }
}

describe('Messenger bridge script loader', () => {
    it('loads only the official Telegram URL and coalesces concurrent requests', async () => {
        const getAppendedScript = interceptScriptAppend()
        const load = loadMessengerBridgeScript('telegram', document)
        const duplicateLoad = loadMessengerBridgeScript('telegram', document)
        const script = getAppendedScript()

        expect(duplicateLoad).toBe(load)
        expect(script?.src).toBe('https://telegram.org/js/telegram-web-app.js?64')

        Reflect.set(window, 'Telegram', { WebApp: {} })
        script?.dispatchEvent(new Event('load'))
        await expect(load).resolves.toBeUndefined()
    })

    it('loads the official MAX URL and rejects failed script requests', async () => {
        const getAppendedScript = interceptScriptAppend()
        const load = loadMessengerBridgeScript('max', document)
        const script = getAppendedScript()

        expect(script?.src).toBe('https://st.max.ru/js/max-web-app.js')
        script?.dispatchEvent(new Event('error'))
        await expect(load).rejects.toThrow('The max bridge script could not be loaded')
        expect(script?.isConnected).toBe(false)
    })
})
