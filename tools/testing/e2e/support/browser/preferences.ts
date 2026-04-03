import type { Page } from '@playwright/test'

export type BrowserPreferenceOptions = {
    language?: string
    isDarkMode?: boolean
}

export async function applyBrowserPreferences(page: Page, options: BrowserPreferenceOptions = {}) {
    const language = options.language ?? 'en'
    const isDarkMode = options.isDarkMode === true

    await page.addInitScript(
        ({ nextLanguage, nextIsDarkMode }) => {
            window.localStorage.setItem('i18nextLng', nextLanguage)
            window.localStorage.setItem('isDarkMode', String(nextIsDarkMode))
            window.localStorage.setItem('mui-mode', nextIsDarkMode ? 'dark' : 'light')
        },
        {
            nextLanguage: language,
            nextIsDarkMode: isDarkMode
        }
    )
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
