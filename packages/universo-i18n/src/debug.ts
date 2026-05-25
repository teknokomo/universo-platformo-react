const normalizeBooleanFlag = (value: unknown): boolean => {
    if (typeof value === 'boolean') {
        return value
    }

    if (typeof value === 'number') {
        return value === 1
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
    }

    return false
}

type DebugGlobal = typeof globalThis & {
    __UNIVERSO_I18N_DEBUG__?: unknown
    process?: {
        env?: Record<string, string | undefined>
    }
}

export const isI18nDebugEnabled = (): boolean => {
    const debugGlobal = globalThis as DebugGlobal

    if (normalizeBooleanFlag(debugGlobal.__UNIVERSO_I18N_DEBUG__)) {
        return true
    }

    const envFlag = debugGlobal.process?.env?.UNIVERSO_I18N_DEBUG
    return normalizeBooleanFlag(envFlag)
}

export const debugI18n = (message: string, payload?: unknown): void => {
    if (!isI18nDebugEnabled()) {
        return
    }

    if (typeof payload === 'undefined') {
        // eslint-disable-next-line no-console
        console.log(message)
        return
    }

    // eslint-disable-next-line no-console
    console.log(message, payload)
}
