import { expect, type Locator, type Page } from '@playwright/test'
import { publicMarketingApplicationRuntimeSchema, type PublicMarketingApplicationRuntime } from '@universo-react/types'

const PRIVATE_MARKETING_RUNTIME_KEYS = new Set([
    'id',
    'applicationid',
    'entityid',
    'entitytypeid',
    'objectid',
    'recordid',
    'componentid',
    'layoutid',
    'widgetid',
    'placementid',
    'lineageid',
    'physicalid',
    'sourceid',
    'metahubid',
    'workspaceid',
    'sourceconfig',
    'source_config',
    'sourcecontenthash',
    'physicaltablename',
    'physicalcolumnname',
    'tablename',
    'columnname'
])

export type MarketingImageAltText = { en: string; ru: string }

const findPrivateMarketingRuntimeKeyPaths = (value: unknown, path = '$'): string[] => {
    if (Array.isArray(value)) {
        return value.flatMap((item, index) => findPrivateMarketingRuntimeKeyPaths(item, `${path}[${index}]`))
    }
    if (!value || typeof value !== 'object') return []

    return Object.entries(value).flatMap(([key, nested]) => {
        const keyPath = `${path}.${key}`
        const privateKeyPath = PRIVATE_MARKETING_RUNTIME_KEYS.has(key.toLowerCase()) ? [keyPath] : []
        return [...privateKeyPath, ...findPrivateMarketingRuntimeKeyPaths(nested, keyPath)]
    })
}

export function expectAnonymousMarketingImagePayload(options: {
    payload: unknown
    locale: 'en' | 'ru'
    applicationId: string
    brandLogoUrl: string
    imageAltText: MarketingImageAltText
}): PublicMarketingApplicationRuntime {
    const { payload, locale, applicationId, brandLogoUrl, imageAltText } = options
    const runtime = publicMarketingApplicationRuntimeSchema.parse(payload)
    expect(runtime.marketingPage.locale).toBe(locale)
    expect(JSON.stringify(runtime)).not.toContain(applicationId)
    expect(findPrivateMarketingRuntimeKeyPaths(runtime)).toEqual([])

    const imageWidget = runtime.marketingPage.widgets.find(
        (widget) => widget.widgetKey === 'marketing.image' && widget.instanceKey === 'hero-image'
    )
    expect(imageWidget, `Anonymous ${locale.toUpperCase()} runtime must contain the published bound Marketing Image`).toBeDefined()
    if (!imageWidget) throw new Error(`The anonymous ${locale.toUpperCase()} Marketing Image widget is missing from the public runtime DTO`)
    expect(imageWidget.data.records[0]).toMatchObject({
        kind: 'image',
        media: {
            resource: { type: 'url', url: brandLogoUrl },
            alt: imageAltText,
            decorative: false
        }
    })
    expect(imageWidget.data.records[0]).not.toHaveProperty('id')
    return runtime
}

export async function expectRenderedMarketingImage(options: {
    page: Page
    image: Locator
    alt: string
    url: string
    requestedUrls: ReadonlySet<string>
}): Promise<void> {
    const { page, image, alt, url, requestedUrls } = options
    await expect(image).toBeVisible()
    await expect(image).toHaveAttribute('alt', alt)
    await expect(image).toHaveAttribute('src', url)
    expect(requestedUrls).toContain(url)
    await expect
        .poll(async () => image.evaluate((element) => (element as HTMLImageElement).naturalWidth), {
            message: `Waiting for anonymous published image “${alt}” to decode`,
            timeout: 30_000
        })
        .toBeGreaterThan(0)
    await expect(page.locator('#marketing-page-main img[src=""]')).toHaveCount(0)
}

export async function expectNoFixedMarketingHeaderOverlap(page: Page, target: Locator, label: string): Promise<void> {
    const [targetBounds, headerBounds] = await Promise.all([target.boundingBox(), page.getByTestId('marketing-header-shell').boundingBox()])
    expect(targetBounds, `${label} must have visible viewport bounds`).not.toBeNull()
    expect(headerBounds, 'The mobile marketing header must have visible viewport bounds').not.toBeNull()
    if (!targetBounds || !headerBounds) return

    const overlapsHeader =
        targetBounds.x < headerBounds.x + headerBounds.width &&
        targetBounds.x + targetBounds.width > headerBounds.x &&
        targetBounds.y < headerBounds.y + headerBounds.height &&
        targetBounds.y + targetBounds.height > headerBounds.y
    expect(overlapsHeader, `${label} must not be covered by the fixed mobile marketing header`).toBe(false)
}
