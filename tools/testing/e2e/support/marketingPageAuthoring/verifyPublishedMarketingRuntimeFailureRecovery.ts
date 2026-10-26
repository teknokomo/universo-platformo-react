import { expect, type Browser, type Page, type Response, type TestInfo } from '@playwright/test'
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
    browser: Browser
    page: Page
    testInfo: TestInfo
    applicationId: string
    firstHero: { en: string; ru: string }
    secondHero: { en: string; ru: string }
}): Promise<RegExp> {
    const { browser, page, testInfo, applicationId, firstHero, secondHero } = options
    const runtimeProbeContext = await browser.newContext({
        storageState: { cookies: [], origins: [] },
        viewport: { width: 390, height: 844 },
        locale: 'en-US',
        timezoneId: 'UTC',
        colorScheme: 'light',
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
        ignoreHTTPSErrors: true
    })
    await runtimeProbeContext.clearCookies()
    expect(await runtimeProbeContext.cookies(), 'The public runtime recovery probe must remain anonymous').toHaveLength(0)
    const runtimeProbePage = await runtimeProbeContext.newPage()
    const baseURL = new URL(page.url()).origin
    const publicRuntimePath = `/api/v1/public/applications/${applicationId}/runtime`
    const publicRuntimeRoute = (url: URL): boolean => url.pathname === publicRuntimePath
    const expectedRuntimeFailurePattern = new RegExp(`(?=.*503)(?=.*${publicRuntimePath})`, 'is')
    const evidence: Record<RuntimeLocaleCase['locale'], number> = { en: 0, ru: 0 }
    const authenticatedRuntimeRequests: string[] = []
    const runtimeMutationRequests: string[] = []
    const authenticatedRuntimePrefix = `/api/v1/applications/${applicationId}/runtime`
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

    try {
        runtimeProbePage.on('request', (request) => {
            const url = new URL(request.url())
            if (/^\/api\/v1\/applications\/[^/]+\/runtime(?:\/|$)/u.test(url.pathname)) {
                authenticatedRuntimeRequests.push(`${request.method()} ${url.pathname}`)
            }
            if (
                (url.pathname === authenticatedRuntimePrefix || url.pathname.startsWith(`${authenticatedRuntimePrefix}/`)) &&
                request.method() !== 'GET' &&
                request.method() !== 'HEAD'
            ) {
                runtimeMutationRequests.push(`${request.method()} ${url.pathname}`)
            }
        })

        for (const localeCase of localeCases) {
            let interceptedFailures = 0
            await runtimeProbePage.setViewportSize({ width: 390, height: 844 })
            await runtimeProbePage.route(publicRuntimeRoute, async (route) => {
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
            const permissionsResponsePromise = runtimeProbePage.waitForResponse(isAbilityPermissionsResponse)
            await runtimeProbePage.goto(new URL(`/a/${applicationId}?locale=${localeCase.locale}`, baseURL).toString())
            const permissionsResponse = await permissionsResponsePromise
            expect([200, 401]).toContain(permissionsResponse.status())
            await expect(runtimeProbePage.locator('html')).toHaveAttribute('lang', localeCase.locale)

            await expect
                .poll(() => interceptedFailures, {
                    message: `${localeCase.locale} anonymous public runtime should make its initial request and two automatic retries`,
                    timeout: 120_000
                })
                .toBeGreaterThanOrEqual(3)
            expect(authenticatedRuntimeRequests, 'Anonymous runtime recovery must not call authenticated runtime endpoints').toEqual([])
            expect(runtimeMutationRequests, 'Anonymous runtime recovery must not issue application runtime mutations').toEqual([])

            const alert = runtimeProbePage.getByRole('alert')
            const visibleErrorMessage = alert.getByText(localeCase.errorMessage, { exact: true })
            await expect(visibleErrorMessage, `${localeCase.locale} public runtime error should be localized`).toBeVisible({
                timeout: 120_000
            })
            expect(
                interceptedFailures,
                `${localeCase.locale} should make one initial request and two automatic retries`
            ).toBeGreaterThanOrEqual(3)
            await expect(alert).not.toContainText(/\{|\}|503|E2E transient marketing runtime failure/i)
            await expect(runtimeProbePage.locator('body')).not.toContainText('E2E transient marketing runtime failure')
            await expectNoTechnicalLeakage(runtimeProbePage.locator('body'), {
                label: `${localeCase.locale.toUpperCase()} public runtime error screen`,
                checkUuidSubstrings: true
            })
            await runtimeProbePage.screenshot({
                path: testInfo.outputPath(`marketing-runtime-error-${localeCase.locale}-mobile-390.png`),
                animations: 'disabled'
            })

            await runtimeProbePage.unroute(publicRuntimeRoute)
            await runtimeProbePage.getByRole('button', { name: localeCase.retryLabel, exact: true }).click()
            await expect(alert).toHaveCount(0, { timeout: 120_000 })
            await expect(runtimeProbePage.getByRole('heading', { name: localeCase.firstHeroName, exact: true })).toBeVisible({
                timeout: 120_000
            })
            await expect(runtimeProbePage.getByRole('heading', { name: localeCase.secondHeroName, exact: true })).toBeVisible({
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
    } finally {
        await runtimeProbeContext.close()
    }
}
