export interface PublicGuestRuntimeLocaleSource {
    navigator?: {
        language?: string
        languages?: readonly string[]
    }
    document?: {
        documentElement?: {
            lang?: string
        }
    }
    location?: {
        href?: string
        search?: string
    }
    localStorage?: {
        getItem(key: string): string | null
    }
}

const normalizeLocale = (value?: string) => {
    if (typeof value !== 'string') {
        return null
    }

    const normalized = value.trim().slice(0, 2).toLowerCase()
    return /^[a-z]{2}$/.test(normalized) ? normalized : null
}

export const resolvePublicGuestRuntimeLocale = (source?: PublicGuestRuntimeLocaleSource) => {
    const runtimeSource = source ?? (typeof window !== 'undefined' ? window : undefined)
    if (!runtimeSource) {
        return 'en'
    }

    const search = runtimeSource.location?.search ?? runtimeSource.location?.href ?? ''
    const explicitLocale = (() => {
        if (typeof search !== 'string' || search.length === 0) {
            return null
        }

        try {
            const query = search.startsWith('?') ? search : new URL(search, 'http://localhost').search
            return new URLSearchParams(query).get('locale')
        } catch {
            return null
        }
    })()
    const persistedLocale = runtimeSource.localStorage?.getItem('i18nextLng') ?? null
    const navigatorLanguages = runtimeSource.navigator?.languages ?? []
    const candidates = [explicitLocale, persistedLocale, ...navigatorLanguages, runtimeSource.navigator?.language, runtimeSource.document?.documentElement?.lang, 'en']

    for (const candidate of candidates) {
        const locale = normalizeLocale(candidate)
        if (locale) {
            return locale
        }
    }

    return 'en'
}