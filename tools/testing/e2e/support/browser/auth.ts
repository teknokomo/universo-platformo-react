import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { loadE2eEnvironment } from '../env/load-e2e-env.mjs'
import { authSelectors, toolbarSelectors } from '../selectors/contracts'

export interface UserCredentials {
    email: string
    password: string
}

async function fillWithRetry(page: Page, testId: string, value: string, attempts = 3) {
    let lastError: unknown

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const locator = page.getByTestId(testId)

        try {
            await expect(locator).toBeVisible()
            await locator.fill(value)
            return
        } catch (error) {
            lastError = error
        }
    }

    throw lastError instanceof Error ? lastError : new Error(`Failed to fill ${testId}`)
}

async function getVisibleAlertText(page: Page) {
    const alert = page.getByRole('alert').first()

    try {
        await expect(alert).toBeVisible({ timeout: 1_000 })
        return (await alert.textContent())?.trim() ?? ''
    } catch {
        return ''
    }
}

export async function loginThroughUi(page: Page, credentials: UserCredentials, options?: { authPath?: string }) {
    const env = loadE2eEnvironment()
    const authUrl = new URL(options?.authPath ?? '/auth', env.baseURL).toString()
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= 3; attempt += 1) {
        await page.goto(authUrl, { waitUntil: 'domcontentloaded' })

        let formReady = false

        try {
            await expect(page.getByTestId(authSelectors.emailInput)).toBeVisible({ timeout: 5_000 })
            formReady = true
        } catch {
            formReady = false
        }

        if (!formReady && !new URL(page.url()).pathname.startsWith('/auth')) {
            return
        }

        await fillWithRetry(page, authSelectors.emailInput, credentials.email)
        await fillWithRetry(page, authSelectors.passwordInput, credentials.password)
        await page.getByTestId(authSelectors.submitButton).click()

        try {
            await page.waitForURL((url) => !url.pathname.startsWith('/auth'), {
                timeout: 15_000
            })
            return
        } catch (error) {
            const alertText = await getVisibleAlertText(page)
            const staysOnAuthPage = new URL(page.url()).pathname.startsWith('/auth')
            const isRetryableAuthFailure = staysOnAuthPage && Boolean(alertText)

            lastError =
                error instanceof Error ? error : new Error(`Failed to log in as ${credentials.email}${alertText ? `: ${alertText}` : ''}`)

            if (!isRetryableAuthFailure || attempt === 3) {
                throw lastError
            }
        }
    }

    throw lastError ?? new Error(`Failed to log in as ${credentials.email}`)
}

export async function createLoggedInBrowserContext(
    browser: Browser,
    credentials: UserCredentials,
    options?: { authPath?: string; basePathAfterLogin?: string }
): Promise<{ context: BrowserContext; page: Page }> {
    const env = loadE2eEnvironment()
    const context = await browser.newContext({
        storageState: {
            cookies: [],
            origins: []
        }
    })
    const page = await context.newPage()

    await loginThroughUi(page, credentials, options)

    if (options?.basePathAfterLogin) {
        await page.goto(new URL(options.basePathAfterLogin, env.baseURL).toString())
    }

    return { context, page }
}

export async function expectAuthenticatedWorkspace(page: Page) {
    await page.goto('/metahubs')
    await expect(page.getByTestId(toolbarSelectors.primaryAction)).toBeVisible()
}
