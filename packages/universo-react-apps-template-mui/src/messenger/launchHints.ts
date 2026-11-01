export type MessengerLaunchPlatform = 'telegram' | 'max'

export interface MessengerLaunchHint {
    platform: MessengerLaunchPlatform
    shortId: string
}

export interface MessengerLaunchAttributionContext {
    platform: MessengerLaunchPlatform
}

declare module '../dashboard/contracts' {
    interface DashboardDetailsSlot {
        /** Server-resolved platform for this public Messenger launch, without its short id. */
        messengerLaunchAttribution?: MessengerLaunchAttributionContext | null
    }
}

const MESSENGER_SHORT_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/u

export const isValidMessengerShortId = (value: unknown): value is string =>
    typeof value === 'string' && MESSENGER_SHORT_ID_PATTERN.test(value)

type LaunchBridgeWindow = Window & {
    Telegram?: { WebApp?: unknown }
    WebApp?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const readBridgeStartParam = (webApp: Record<string, unknown>): { present: boolean; value?: unknown } => {
    const initDataUnsafe = webApp.initDataUnsafe
    if (!isRecord(initDataUnsafe) || !Object.prototype.hasOwnProperty.call(initDataUnsafe, 'start_param')) {
        return { present: false }
    }
    return { present: true, value: initDataUnsafe.start_param }
}

const toLaunchHint = (platform: MessengerLaunchPlatform, value: unknown): MessengerLaunchHint | null =>
    isValidMessengerShortId(value) ? { platform, shortId: value } : null

const launchParams = (currentWindow: LaunchBridgeWindow): URLSearchParams[] => [
    new URLSearchParams(currentWindow.location.search),
    new URLSearchParams(currentWindow.location.hash.replace(/^#/u, ''))
]

/** Detect only the provider-specific URL markers documented by each mini-app host. */
export const detectMessengerLaunchPlatform = (targetWindow?: LaunchBridgeWindow): MessengerLaunchPlatform | null => {
    const currentWindow = targetWindow ?? (typeof window === 'undefined' ? undefined : (window as LaunchBridgeWindow))
    if (!currentWindow) return null

    try {
        const keys = launchParams(currentWindow).flatMap((source) => Array.from(source.keys()))
        const hasTelegramMarkers = keys.some((key) => key.startsWith('tgWebApp'))
        const hasMaxMarkers = keys.some((key) => key.startsWith('WebApp'))
        if (hasTelegramMarkers === hasMaxMarkers) return null
        return hasTelegramMarkers ? 'telegram' : 'max'
    } catch {
        return null
    }
}

const readPlatformHint = (
    platform: MessengerLaunchPlatform,
    webApp: Record<string, unknown>,
    sources: URLSearchParams[]
): MessengerLaunchHint | null => {
    const bridgeParam = readBridgeStartParam(webApp)
    if (bridgeParam.present && bridgeParam.value !== undefined && bridgeParam.value !== '') {
        return toLaunchHint(platform, bridgeParam.value)
    }

    const names = platform === 'telegram' ? ['tgWebAppStartParam', 'startapp'] : ['WebAppStartParam', 'startapp']
    const values = [...new Set(names.flatMap((name) => sources.flatMap((source) => source.getAll(name))))]
    return values.length === 1 ? toLaunchHint(platform, values[0]) : null
}

/** Read only non-secret start hints from a detected bridge or its documented launch query. */
export const readMessengerLaunchHint = (targetWindow?: LaunchBridgeWindow): MessengerLaunchHint | null => {
    const currentWindow = targetWindow ?? (typeof window === 'undefined' ? undefined : (window as LaunchBridgeWindow))
    if (!currentWindow) return null

    try {
        const sources = launchParams(currentWindow)
        const telegramWebApp = currentWindow.Telegram?.WebApp
        if (isRecord(telegramWebApp)) {
            return readPlatformHint('telegram', telegramWebApp, sources)
        }

        const maxWebApp = currentWindow.WebApp
        if (isRecord(maxWebApp)) {
            return readPlatformHint('max', maxWebApp, sources)
        }

        const platform = detectMessengerLaunchPlatform(currentWindow)
        return platform ? readPlatformHint(platform, {}, sources) : null
    } catch {
        return null
    }
}
