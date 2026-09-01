import fs from 'node:fs/promises'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { expect } from '../fixtures/test'
import { repoRoot } from './env/load-e2e-env.mjs'

const LOCAL_MEDIA_FIXTURE_ROOT = path.join(repoRoot, 'tools', 'testing', 'e2e', 'fixtures', 'marketing-page-media', 'originals')

const MEDIA_HOSTS = new Set(['mui.com', 'assets-global.website-files.com'])
const IMAGE_PATH_PATTERN = /\.(?:jpe?g|png|gif|svg|webp)(?:[?#]|$)/i

const mediaFixturePath = (url: URL): string | undefined => {
    if (url.hostname === 'mui.com') {
        const avatar = url.pathname.match(/^\/static\/images\/avatar\/(\d+)\.jpg$/)
        if (avatar && Number(avatar[1]) >= 1 && Number(avatar[1]) <= 6) {
            return path.join(LOCAL_MEDIA_FIXTURE_ROOT, `avatar-${avatar[1]}.jpg`)
        }

        const muiPaths: Record<string, string> = {
            '/static/screenshots/material-ui/getting-started/templates/dashboard.jpg': 'hero-light.jpg',
            '/static/screenshots/material-ui/getting-started/templates/dashboard-dark.jpg': 'hero-dark.jpg',
            '/static/images/templates/templates-images/dash-light.png': 'feature-dash-light.png',
            '/static/images/templates/templates-images/dash-dark.png': 'feature-dash-dark.png',
            '/static/images/templates/templates-images/mobile-light.png': 'feature-mobile-light.png',
            '/static/images/templates/templates-images/mobile-dark.png': 'feature-mobile-dark.png',
            '/static/images/templates/templates-images/devices-light.png': 'feature-devices-light.png',
            '/static/images/templates/templates-images/devices-dark.png': 'feature-devices-dark.png'
        }
        const filename = muiPaths[url.pathname]
        return filename ? path.join(LOCAL_MEDIA_FIXTURE_ROOT, filename) : undefined
    }

    const webflowLogos: Record<string, string> = {
        Sydney: 'sydney',
        Bern: 'bern',
        Montreal: 'montreal',
        Terra: 'terra',
        colorado: 'colorado',
        Ankara: 'ankara'
    }
    const terra = url.pathname.match(/_Terra(Light|Dark)\.svg$/)
    if (terra) {
        return path.join(LOCAL_MEDIA_FIXTURE_ROOT, `logo-terra-${terra[1] === 'Light' ? 'light' : 'dark'}.svg`)
    }

    const logo = url.pathname.match(/_([A-Za-z]+)-(black|white)\.svg$/)
    if (!logo) return undefined
    const slug = webflowLogos[logo[1]]
    if (!slug) return undefined
    return path.join(LOCAL_MEDIA_FIXTURE_ROOT, `logo-${slug}-${logo[2] === 'white' ? 'light' : 'dark'}.svg`)
}

export type MarketingPageMediaStub = {
    requestedUrls: ReadonlySet<string>
    assertLoaded: (page: Page, expectedCount?: number) => Promise<void>
}

const isMarketingPageMediaUrl = (value: string): boolean => {
    try {
        const url = new URL(value)
        return MEDIA_HOSTS.has(url.hostname) && IMAGE_PATH_PATTERN.test(url.pathname)
    } catch {
        return false
    }
}

/**
 * Replace remote demo media with checked-in copies of the reference assets so
 * image assertions do not depend on MUI/Webflow availability or CDN responses.
 */
export async function installMarketingPageLocalMedia(page: Page): Promise<MarketingPageMediaStub> {
    const requestedUrls = new Set<string>()

    const fulfillLocalMedia = async (route: import('@playwright/test').Route) => {
        const url = route.request().url()
        let parsedUrl: URL
        try {
            parsedUrl = new URL(url)
        } catch {
            await route.continue()
            return
        }

        if (!isMarketingPageMediaUrl(url)) {
            await route.continue()
            return
        }

        const fixturePath = mediaFixturePath(parsedUrl)
        if (!fixturePath) {
            await route.continue()
            return
        }

        const fixtureBody = await fs.readFile(fixturePath)
        requestedUrls.add(url)
        await route.fulfill({
            status: 200,
            contentType: parsedUrl.pathname.endsWith('.svg')
                ? 'image/svg+xml'
                : parsedUrl.pathname.endsWith('.png')
                ? 'image/png'
                : 'image/jpeg',
            body: fixtureBody,
            headers: { 'cache-control': 'no-store', 'x-marketing-page-media': 'local-reference-fixture' }
        })
    }

    await page.route('https://mui.com/**', fulfillLocalMedia)
    await page.route('https://assets-global.website-files.com/**', fulfillLocalMedia)

    return {
        requestedUrls,
        assertLoaded: async (currentPage, expectedCount = 21) => {
            const images = currentPage.locator('img')
            await expect(images).toHaveCount(expectedCount)

            for (let index = 0; index < expectedCount; index += 1) {
                const image = images.nth(index)
                // Scroll visible images to activate lazy loading, but do not
                // try to scroll a display:none responsive branch into view.
                if (await image.isVisible()) await image.scrollIntoViewIfNeeded()
                await expect
                    .poll(
                        async () =>
                            image.evaluate((element) => ({
                                complete: element.complete,
                                naturalWidth: element.naturalWidth,
                                source: element.currentSrc || element.getAttribute('src') || ''
                            })),
                        { message: `Waiting for marketing media image ${index + 1} to load` }
                    )
                    .toMatchObject({ complete: true, naturalWidth: expect.any(Number) })

                const state = await image.evaluate((element) => ({
                    naturalWidth: element.naturalWidth,
                    source: element.currentSrc || element.getAttribute('src') || ''
                }))
                expect(state.naturalWidth, `Marketing media image ${index + 1} has no decoded pixels`).toBeGreaterThan(0)
                expect(isMarketingPageMediaUrl(state.source), `Unexpected marketing media source: ${state.source}`).toBe(true)
                expect(requestedUrls, `Marketing media was not served by the local fixture: ${state.source}`).toContain(state.source)
            }
        }
    }
}
