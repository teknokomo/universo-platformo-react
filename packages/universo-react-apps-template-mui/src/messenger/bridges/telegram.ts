import type { MessengerBackButtonBridge } from './types'

export type { MessengerBackButtonBridge } from './types'

export interface TelegramMessengerBridge {
    platform: 'telegram'
    backButton?: MessengerBackButtonBridge
    close?: () => void
}

type TelegramWebApp = {
    BackButton?: Partial<MessengerBackButtonBridge>
    close?: () => void
}

type TelegramWindow = Window & {
    Telegram?: { WebApp?: TelegramWebApp }
}

/** Detect only the documented Telegram WebApp surface; browser mode remains the default. */
export function getTelegramMessengerBridge(): TelegramMessengerBridge | undefined {
    if (typeof window === 'undefined') return undefined
    const webApp = (window as TelegramWindow).Telegram?.WebApp
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

    return {
        platform: 'telegram',
        ...(backButton ? { backButton } : {}),
        ...(typeof webApp.close === 'function' ? { close: () => webApp.close?.() } : {})
    }
}
