import { test, expect } from '../../fixtures/test'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import {
    getBootstrapCredentials,
    resolvePrimaryInstance,
    createBootstrapApiContext,
    disposeBootstrapApiContext
} from '../../support/backend/bootstrap.mjs'

test('@smoke @permission least-privilege user is redirected away from admin panel routes', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })

    await expect.poll(() => new URL(page.url()).pathname.startsWith('/admin')).toBe(false)
})

test('@smoke @permission bootstrap admin can open admin routes and stays inside admin workspace', async ({ browser }) => {
    const api = await createBootstrapApiContext()
    const instance = await resolvePrimaryInstance(api)
    let adminSession = null

    try {
        adminSession = await createLoggedInBrowserContext(browser, getBootstrapCredentials(), {
            basePathAfterLogin: '/admin'
        })

        const page = adminSession.page
        await page.goto('/admin')

        await expect(page).toHaveURL(/\/admin(?:\/instance\/[^/]+)?(?:\?.*)?$/)
        await expect(page.getByRole('heading', { name: 'Instances' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Add' })).toBeVisible()

        await page.goto(`/admin/instance/${instance.id}/users`)
        await expect(page).toHaveURL(new RegExp(`/admin/instance/${instance.id}/users(?:\\?.*)?$`))
        await expect(page.getByRole('heading', { name: 'Users Management' })).toBeVisible()
    } finally {
        await adminSession?.context.close().catch(() => undefined)
        await disposeBootstrapApiContext(api)
    }
})
