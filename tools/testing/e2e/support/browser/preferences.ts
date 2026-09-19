import type { Page } from '@playwright/test'

export type BrowserPreferenceOptions = {
    language?: string
    isDarkMode?: boolean
}

export async function applyBrowserPreferences(page: Page, options: BrowserPreferenceOptions = {}) {
    const language = options.language ?? 'en'
    const isDarkMode = options.isDarkMode === true
    const preferences = {
        nextLanguage: language,
        nextIsDarkMode: isDarkMode
    }

    await page.addInitScript(({ nextLanguage, nextIsDarkMode }) => {
        window.localStorage.setItem('i18nextLng', nextLanguage)
        window.localStorage.setItem('isDarkMode', String(nextIsDarkMode))
        window.localStorage.setItem('mui-mode', nextIsDarkMode ? 'dark' : 'light')
    }, preferences)

    await page.evaluate(({ nextLanguage, nextIsDarkMode }) => {
        try {
            window.localStorage.setItem('i18nextLng', nextLanguage)
            window.localStorage.setItem('isDarkMode', String(nextIsDarkMode))
            window.localStorage.setItem('mui-mode', nextIsDarkMode ? 'dark' : 'light')
        } catch {
            // about:blank has no origin-local storage; the init script covers the next navigation.
        }
    }, preferences)
}

/**
 * Switches the locale of a published application runtime through the canonical
 * `?locale=` query the in-app language switcher writes. Browser preferences
 * alone cannot win once a runtime URL already carries a locale parameter.
 */
export async function switchRuntimeLocale(page: Page, locale: string): Promise<void> {
    const url = new URL(page.url())
    url.searchParams.set('locale', locale)
    await page.goto(url.toString())
}

export function parseRgbColor(input: string): [number, number, number] | null {
    const match = input.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
    if (!match) {
        return null
    }

    return [Number.parseInt(match[1], 10), Number.parseInt(match[2], 10), Number.parseInt(match[3], 10)]
}

export function calculateRelativeBrightness(input: string): number | null {
    const rgb = parseRgbColor(input)
    if (!rgb) {
        return null
    }

    return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000
}
