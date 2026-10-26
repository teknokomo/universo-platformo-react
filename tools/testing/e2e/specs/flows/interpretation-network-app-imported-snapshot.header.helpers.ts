// Focused helpers for the imported Interpretation Network snapshot flow.

import { expect } from '../../fixtures/test'

import type { Page, TestInfo } from '@playwright/test'

import { expectNoPageHorizontalOverflow, expectRuntimeNavigationIconSemantics } from '../../support/browser/runtimeUx'

import { getVisibleRuntimeNavigation } from './interpretation-network-app-imported-snapshot.navigation.helpers'

export const expectRuntimeHeaderPreferences = async (page: Page, testInfo: TestInfo): Promise<void> => {
    const languageButton = page.getByTestId('runtime-language-switcher')
    const themeButton = page.locator('button[data-screenshot="toggle-mode"]')
    const headerActions = page.getByTestId('runtime-header-actions')

    const expectControlsInsideViewport = async (label: string): Promise<void> => {
        const viewport = page.viewportSize()
        const controls = [headerActions, languageButton, themeButton]
        if (!viewport) throw new Error(`${label} requires a fixed browser viewport`)
        for (const control of controls) {
            const bounds = await control.boundingBox()
            expect(bounds, `${label}: ${await control.getAttribute('data-testid')}`).not.toBeNull()
            expect(bounds?.x).toBeGreaterThanOrEqual(0)
            expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(viewport.width + 1)
        }
    }

    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(languageButton).toBeVisible()
    await expect(languageButton).toHaveCount(1)
    await expect(themeButton).toBeVisible()
    await expect(themeButton).toHaveCount(1)
    await expect(headerActions).toBeVisible()
    await expectControlsInsideViewport('English Dashboard header at 1280px')
    await expectNoPageHorizontalOverflow(page, 'English Dashboard header controls at 1280px')
    await testInfo.attach('interpretation-network-header-controls-en-desktop-1280', {
        body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
        contentType: 'image/png'
    })

    await languageButton.focus()
    await page.keyboard.press('Enter')
    await page.getByRole('menu').getByRole('menuitem', { name: 'Russian', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
    await expect(languageButton).toHaveAttribute('aria-label', 'Язык')
    const russianNavigation = getVisibleRuntimeNavigation(page)
    const startPage = russianNavigation.getByRole('link', { name: 'Начало', exact: true })
    const structures = russianNavigation.getByRole('link', { name: 'Структуры', exact: true })
    await expect(startPage).toBeVisible()
    await expect(structures).toBeVisible()
    await expect(russianNavigation.getByRole('heading', { name: 'Основной', exact: true })).toHaveCount(0)
    await expectRuntimeNavigationIconSemantics(russianNavigation, [
        { label: 'Начало', family: 'home' },
        { label: 'Структуры', family: 'structures' }
    ])

    await themeButton.focus()
    await page.keyboard.press('Enter')
    await page.getByRole('menuitem', { name: 'Тёмная', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-mui-color-scheme', 'dark')
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('mui-mode'))).toBe('dark')

    await page.setViewportSize({ width: 390, height: 844 })
    await expectControlsInsideViewport('Russian Dashboard header at 390px')
    await expectNoPageHorizontalOverflow(page, 'Russian Dashboard header controls at 390px')
    await testInfo.attach('interpretation-network-header-controls-ru-dark-mobile-390', {
        body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
        contentType: 'image/png'
    })

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
    await expect(page.locator('html')).toHaveAttribute('data-mui-color-scheme', 'dark')
    await expect(languageButton).toHaveCount(1)
    await expect(themeButton).toHaveCount(1)

    await themeButton.focus()
    await page.keyboard.press('Enter')
    await page.getByRole('menuitem', { name: 'Системная', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('mui-mode'))).toBe('system')

    await languageButton.focus()
    await page.keyboard.press('Enter')
    await page.getByRole('menu').getByRole('menuitem', { name: 'Английский', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(languageButton).toHaveAttribute('aria-label', 'Language')
    await expectNoPageHorizontalOverflow(page, 'Restored English Dashboard header')
}
