import type { MessengerBackButtonBridge, MessengerViewportSize } from './types'

export interface MaxMessengerBridge {
    platform: 'max'
    backButton?: MessengerBackButtonBridge
    getViewportSize?: () => Promise<MessengerViewportSize>
}

type MaxWebApp = {
    BackButton?: Partial<MessengerBackButtonBridge>
    getViewportSize?: () => Promise<MessengerViewportSize>
}

type MaxWindow = Window & {
    WebApp?: MaxWebApp
}

/** Detect the MAX WebApp bridge independently from Telegram's global object. */
export function getMaxMessengerBridge(): MaxMessengerBridge | undefined {
    if (typeof window === 'undefined') return undefined
    const webApp = (window as MaxWindow).WebApp
    if (!webApp) return undefined

    const button = webApp.BackButton
    const backButton =
        button &&
        typeof button.show === 'function' &&
        typeof button.hide === 'function' &&
        typeof button.onClick === 'function' &&
        typeof button.offClick === 'function'
            ? (button as MessengerBackButtonBridge)
            : undefined

    const getViewportSize = typeof webApp.getViewportSize === 'function' ? () => webApp.getViewportSize!() : undefined
    if (!backButton && !getViewportSize) return undefined
    return { platform: 'max', backButton, getViewportSize }
}
