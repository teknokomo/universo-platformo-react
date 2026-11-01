import type { MessengerLaunchPlatform } from './launchHints'

type MessengerBridgeWindow = Window & {
    Telegram?: { WebApp?: unknown }
    WebApp?: unknown
}

const BRIDGE_SCRIPT_URLS: Record<MessengerLaunchPlatform, string> = {
    telegram: 'https://telegram.org/js/telegram-web-app.js?64',
    max: 'https://st.max.ru/js/max-web-app.js'
}

const pendingLoads = new WeakMap<Document, Map<MessengerLaunchPlatform, Promise<void>>>()

const hasBridgeGlobal = (ownerDocument: Document, platform: MessengerLaunchPlatform): boolean => {
    const currentWindow = ownerDocument.defaultView as MessengerBridgeWindow | null
    return platform === 'telegram' ? Boolean(currentWindow?.Telegram?.WebApp) : Boolean(currentWindow?.WebApp)
}

/** Load a fixed official bridge URL only after a provider-specific launch marker is present. */
export const loadMessengerBridgeScript = (platform: MessengerLaunchPlatform, ownerDocument: Document = document): Promise<void> => {
    if (hasBridgeGlobal(ownerDocument, platform)) return Promise.resolve()

    let documentLoads = pendingLoads.get(ownerDocument)
    if (!documentLoads) {
        documentLoads = new Map()
        pendingLoads.set(ownerDocument, documentLoads)
    }

    const existingLoad = documentLoads.get(platform)
    if (existingLoad) return existingLoad

    const script = ownerDocument.createElement('script')
    script.src = BRIDGE_SCRIPT_URLS[platform]
    script.async = true
    script.dataset.universoMessengerBridge = platform

    const load = new Promise<void>((resolve, reject) => {
        script.addEventListener(
            'load',
            () => {
                documentLoads?.delete(platform)
                if (hasBridgeGlobal(ownerDocument, platform)) {
                    resolve()
                    return
                }
                script.remove()
                reject(new Error(`The ${platform} bridge did not expose its documented WebApp global`))
            },
            { once: true }
        )
        script.addEventListener(
            'error',
            () => {
                documentLoads?.delete(platform)
                script.remove()
                reject(new Error(`The ${platform} bridge script could not be loaded`))
            },
            { once: true }
        )
    })

    documentLoads.set(platform, load)
    ownerDocument.head.append(script)
    return load
}
