import { expect, test } from '@playwright/test'

const expectHeaderContains = (headers: Record<string, string>, name: string, expected: string) => {
    expect(headers[name.toLowerCase()]).toContain(expected)
}

test('PlayCanvas Editor artifact smoke page is safe and nonblank', async ({ page }, testInfo) => {
    const consoleErrors: string[] = []
    const failedRequests: string[] = []
    page.on('console', (message) => {
        if (message.type() === 'error') {
            consoleErrors.push(message.text())
        }
    })
    page.on('requestfailed', (request) => {
        failedRequests.push(`${request.method()} ${request.url()}`)
    })
    page.on('pageerror', (error) => {
        consoleErrors.push(error.message)
    })

    const rootResponse = await page.goto('/', { waitUntil: 'networkidle' })
    expect(rootResponse?.ok()).toBe(true)
    expectHeaderContains(rootResponse?.headers() ?? {}, 'content-type', 'text/html')
    expect(rootResponse?.headers()['x-content-type-options']).toBe('nosniff')
    expect(rootResponse?.headers()['cache-control']).toBe('no-cache')

    await expect(page.getByRole('heading', { name: 'PlayCanvas Editor artifact is available' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Артефакт PlayCanvas Editor доступен' })).toBeVisible()
    await expect(page.locator('body')).not.toContainText('[object Object]')
    await expect(page.locator('body')).not.toContainText(/\{[\s\S]*"[^"]+"\s*:/)
    await expect(page.locator('body')).not.toContainText(/stack trace|Zod|Vite|absolute filesystem/i)

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)

    const jsResponse = await page.request.get('/js/editor-empty.js')
    expect(jsResponse.ok()).toBe(true)
    expectHeaderContains(jsResponse.headers(), 'content-type', 'application/javascript')
    expect(jsResponse.headers()['x-content-type-options']).toBe('nosniff')
    expect(jsResponse.headers()['cache-control']).toBe('no-cache')

    const cssResponse = await page.request.get('/css/editor.css')
    expect(cssResponse.ok()).toBe(true)
    expectHeaderContains(cssResponse.headers(), 'content-type', 'text/css')
    expect(cssResponse.headers()['x-content-type-options']).toBe('nosniff')

    const forbiddenResponse = await page.request.get('/..%2feditor2/file.js')
    expect(forbiddenResponse.status()).toBe(403)
    expectHeaderContains(forbiddenResponse.headers(), 'content-type', 'text/plain')
    expect(forbiddenResponse.headers()['x-content-type-options']).toBe('nosniff')

    const encodedForbiddenResponse = await page.request.get('/%2e%2e%2feditor-evil/file.js')
    expect(encodedForbiddenResponse.status()).toBe(403)
    expect(encodedForbiddenResponse.headers()['x-content-type-options']).toBe('nosniff')

    const notFoundResponse = await page.request.get('/js/not-found.js')
    expect(notFoundResponse.status()).toBe(404)
    expectHeaderContains(notFoundResponse.headers(), 'content-type', 'text/plain')
    expect(notFoundResponse.headers()['x-content-type-options']).toBe('nosniff')

    await page.screenshot({ path: testInfo.outputPath(`playcanvas-editor-artifact-smoke-${testInfo.project.name}.png`), fullPage: true })
    expect(consoleErrors).toEqual([])
    expect(failedRequests).toEqual([])
})
