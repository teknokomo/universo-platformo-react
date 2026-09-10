import { normalizeLocale } from '@universo-react/utils'

const STANDALONE_HASH_PREFIX = '#/'

const isStandaloneHashRoute = (hash: string): boolean => hash.startsWith(STANDALONE_HASH_PREFIX)

const readRuntimeUrl = (): URL | null => {
    if (typeof window === 'undefined') return null

    if (isStandaloneHashRoute(window.location.hash)) {
        return new URL(window.location.hash.slice(1), window.location.origin)
    }

    return new URL(window.location.href)
}

const serializeRuntimeUrl = (url: URL): string => `${url.pathname}${url.search}${url.hash}`

const writeRuntimeUrl = (url: URL): string => {
    if (!window.location.hash || !isStandaloneHashRoute(window.location.hash)) {
        return serializeRuntimeUrl(url)
    }

    const route = serializeRuntimeUrl(url)
    return `${window.location.pathname}${window.location.search}#${route}`
}

export const readRuntimeLocale = (): string | null => {
    const url = readRuntimeUrl()
    const rawLocale = url?.searchParams.get('locale')?.trim()
    return rawLocale ? normalizeLocale(rawLocale) : null
}

export const updateRuntimeLocale = (locale: string, mode: 'push' | 'replace' = 'push'): string | null => {
    if (typeof window === 'undefined') return null

    const url = readRuntimeUrl()
    if (!url) return null

    const normalizedLocale = normalizeLocale(locale)
    const previousHref = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (url.searchParams.get('locale') === normalizedLocale) return null

    url.searchParams.set('locale', normalizedLocale)
    const nextHref = writeRuntimeUrl(url)
    window.history[mode === 'push' ? 'pushState' : 'replaceState'](window.history.state, '', nextHref)
    window.dispatchEvent(new PopStateEvent('popstate'))
    return previousHref
}

export const restoreRuntimeLocation = (href: string): void => {
    if (typeof window === 'undefined') return

    window.history.replaceState(window.history.state, '', href)
    window.dispatchEvent(new PopStateEvent('popstate'))
}

export const subscribeRuntimeLocation = (listener: () => void): (() => void) => {
    if (typeof window === 'undefined') return () => undefined

    window.addEventListener('popstate', listener)
    window.addEventListener('hashchange', listener)
    return () => {
        window.removeEventListener('popstate', listener)
        window.removeEventListener('hashchange', listener)
    }
}

export const getRuntimeLocationSnapshot = (): string => {
    if (typeof window === 'undefined') return ''
    return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export const getRuntimeLocationServerSnapshot = (): string => ''
