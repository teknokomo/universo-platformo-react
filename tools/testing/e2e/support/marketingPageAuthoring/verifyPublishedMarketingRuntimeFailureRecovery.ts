import { expect, type Page, type Response, type TestInfo } from '@playwright/test'
import { expectNoTechnicalLeakage } from '../browser/runtimeUx'

type RuntimeLocaleCase = {
    locale: 'en' | 'ru'
    errorMessage: string
    retryLabel: string
    firstHeroName: string
    secondHeroName: string
}

const isAbilityPermissionsResponse = (response: Response): boolean =>
    response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/v1/auth/permissions'

export async function verifyPublishedMarketingRuntimeFailureRecovery(options: {
    page: Page
    testInfo: TestInfo
    applicationId: string
    firstHero: { en: string; ru: string }
    secondHero: { en: string; ru: string }
}): Promise<RegExp> {
    const { page, testInfo, applicationId, firstHero, secondHero } = options
    const publicRuntimePath = `/api/v1/public/applications/${applicationId}/runtime`
    const publicRuntimeRoute = (url: URL): boolean => url.pathname === publicRuntimePath
    const expectedRuntimeFailurePattern = new RegExp(`(?=.*503)(?=.*${publicRuntimePath})`, 'is')
    const evidence: Record<RuntimeLocaleCase['locale'], number> = { en: 0, ru: 0 }
    const localeCases: RuntimeLocaleCase[] = [
        {
            locale: 'en',
            errorMessage: 'Failed to load runtime data',
            retryLabel: 'Retry',
            firstHeroName: firstHero.en,
            secondHeroName: secondHero.en
        },
        {
            locale: 'ru',
            errorMessage: 'Не удалось загрузить данные пользовательского интерфейса',
            retryLabel: 'Повторить',
            firstHeroName: firstHero.ru,
            secondHeroName: secondHero.ru
        }
    ]

    for (const localeCase of localeCases) {
        let interceptedFailures = 0
        await page.setViewportSize({ width: 390, height: 844 })
        await page.route(publicRuntimeRoute, async (route) => {
            if (route.request().method() !== 'GET') {
                await route.fallback()
                return
            }
            interceptedFailures += 1
            await route.fulfill({
                status: 503,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'E2E transient marketing runtime failure' })
            })
        })
        const permissionsResponsePromise = page.waitForResponse(isAbilityPermissionsResponse)
        await page.goto(`/a/${applicationId}?locale=${localeCase.locale}`)
        const permissionsResponse = await permissionsResponsePromise
        expect([200, 401]).toContain(permissionsResponse.status())
        await expect(page.locator('html')).toHaveAttribute('lang', localeCase.locale)

        const alert = page.getByRole('alert')
        const visibleErrorMessage = alert.getByText(localeCase.errorMessage, { exact: true })
        await expect(visibleErrorMessage, `${localeCase.locale} public runtime error should be localized`).toBeVisible({
            timeout: 120_000
        })
        expect(interceptedFailures, `${localeCase.locale} should make one initial request and two automatic retries`).toBe(3)
        await expect(alert).not.toContainText(/\{|\}|503|E2E transient marketing runtime failure/i)
        await expect(page.locator('body')).not.toContainText('E2E transient marketing runtime failure')
        await expectNoTechnicalLeakage(page.locator('body'), {
            label: `${localeCase.locale.toUpperCase()} public runtime error screen`,
            checkUuidSubstrings: true
        })
        await page.screenshot({
            path: testInfo.outputPath(`marketing-runtime-error-${localeCase.locale}-mobile-390.png`),
            animations: 'disabled'
        })

        await page.unroute(publicRuntimeRoute)
        await page.getByRole('button', { name: localeCase.retryLabel, exact: true }).click()
        await expect(alert).toHaveCount(0, { timeout: 120_000 })
        await expect(page.getByRole('heading', { name: localeCase.firstHeroName, exact: true })).toBeVisible({ timeout: 120_000 })
        await expect(page.getByRole('heading', { name: localeCase.secondHeroName, exact: true })).toBeVisible({
            timeout: 120_000
        })
        evidence[localeCase.locale] = interceptedFailures
    }

    await testInfo.attach('marketing-runtime-retry-observability.json', {
        body: Buffer.from(
            JSON.stringify(
                {
                    interceptedFailures: evidence,
                    localizedErrorObserved: ['en', 'ru'],
                    retryRecoveredRuntime: ['en', 'ru'],
                    retryIndex: testInfo.retry
                },
                null,
                2
            )
        ),
        contentType: 'application/json'
    })

    return expectedRuntimeFailurePattern
}
