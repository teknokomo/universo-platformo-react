import AxeBuilder from '@axe-core/playwright'
import type { Page, Response } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import {
    expectLocalizedValidation,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectRuntimeUxViewportMatrix,
    waitForLayoutFrame
} from '../../support/browser/runtimeUx'

type TemplateKey = 'dashboard' | 'marketing-page'
type TargetKind = 'page' | 'object'
type StandaloneTarget = { kind: TargetKind; entityTypeId: string }

const baseUrl = process.env.E2E_MARKETING_PAGE_STANDALONE_BASE_URL?.trim() || ''
const applicationId = process.env.E2E_MARKETING_PAGE_STANDALONE_APPLICATION_ID?.trim() || ''
const pageEntityTypeId = process.env.E2E_MARKETING_PAGE_STANDALONE_PAGE_ENTITY_TYPE_ID?.trim() || ''
const objectEntityTypeId = process.env.E2E_MARKETING_PAGE_STANDALONE_OBJECT_ENTITY_TYPE_ID?.trim() || ''
const globalTemplate = process.env.E2E_MARKETING_PAGE_STANDALONE_GLOBAL_TEMPLATE?.trim() || ''
const pageTemplate = process.env.E2E_MARKETING_PAGE_STANDALONE_PAGE_TEMPLATE?.trim() || ''
const objectTemplate = process.env.E2E_MARKETING_PAGE_STANDALONE_OBJECT_TEMPLATE?.trim() || ''

const missingStandaloneConfiguration = [
    ['E2E_MARKETING_PAGE_STANDALONE_BASE_URL', baseUrl],
    ['E2E_MARKETING_PAGE_STANDALONE_APPLICATION_ID', applicationId],
    ['E2E_MARKETING_PAGE_STANDALONE_PAGE_ENTITY_TYPE_ID', pageEntityTypeId],
    ['E2E_MARKETING_PAGE_STANDALONE_OBJECT_ENTITY_TYPE_ID', objectEntityTypeId],
    ['E2E_MARKETING_PAGE_STANDALONE_GLOBAL_TEMPLATE', globalTemplate],
    ['E2E_MARKETING_PAGE_STANDALONE_PAGE_TEMPLATE', pageTemplate],
    ['E2E_MARKETING_PAGE_STANDALONE_OBJECT_TEMPLATE', objectTemplate]
]
    .filter(([, value]) => !value)
    .map(([name]) => name)

const readConfiguration = (): { base: URL; application: string; targets: Array<[StandaloneTarget | null, TemplateKey]> } => {
    const missing: string[] = []
    if (!baseUrl) missing.push('E2E_MARKETING_PAGE_STANDALONE_BASE_URL')
    if (!applicationId) missing.push('E2E_MARKETING_PAGE_STANDALONE_APPLICATION_ID')
    if (!pageEntityTypeId) missing.push('E2E_MARKETING_PAGE_STANDALONE_PAGE_ENTITY_TYPE_ID')
    if (!objectEntityTypeId) missing.push('E2E_MARKETING_PAGE_STANDALONE_OBJECT_ENTITY_TYPE_ID')
    if (!globalTemplate) missing.push('E2E_MARKETING_PAGE_STANDALONE_GLOBAL_TEMPLATE')
    if (!pageTemplate) missing.push('E2E_MARKETING_PAGE_STANDALONE_PAGE_TEMPLATE')
    if (!objectTemplate) missing.push('E2E_MARKETING_PAGE_STANDALONE_OBJECT_TEMPLATE')
    if (missing.length > 0) {
        throw new Error(
            `BLOCKED: standalone cross-template acceptance requires ${missing.join(
                ', '
            )}. The supplied host must expose the built shell, same-origin /api/v1 proxy, authenticated E2E session support, and Page/Object entity type IDs.`
        )
    }
    const configuredTemplates = [globalTemplate, pageTemplate, objectTemplate]
    if (configuredTemplates.some((value) => value !== 'dashboard' && value !== 'marketing-page')) {
        throw new Error(
            `BLOCKED: standalone template expectations must be dashboard or marketing-page; received ${configuredTemplates.join(', ')}`
        )
    }
    try {
        return {
            base: new URL(baseUrl),
            application: applicationId,
            targets: [
                [null, globalTemplate as TemplateKey],
                [{ kind: 'page', entityTypeId: pageEntityTypeId }, pageTemplate as TemplateKey],
                [{ kind: 'object', entityTypeId: objectEntityTypeId }, objectTemplate as TemplateKey]
            ]
        }
    } catch {
        throw new Error(`BLOCKED: E2E_MARKETING_PAGE_STANDALONE_BASE_URL is not a valid absolute URL: ${baseUrl}`)
    }
}

const buildRuntimeUrl = (base: URL, application: string, target: StandaloneTarget | null): string => {
    const url = new URL(base.toString())
    const query = new URLSearchParams({ locale: 'en', themeVariant: 'light' })
    if (target) {
        query.set('targetKind', target.kind)
        query.set('entityTypeId', target.entityTypeId)
        url.hash = `/a/${encodeURIComponent(application)}/${encodeURIComponent(target.entityTypeId)}?${query.toString()}`
    } else {
        url.hash = `/a/${encodeURIComponent(application)}?${query.toString()}`
    }
    return url.toString()
}

const waitForTargetResponse = (page: Page, application: string, target: StandaloneTarget | null): Promise<Response> =>
    page.waitForResponse(
        (response) => {
            if (response.request().method() !== 'GET') return false
            const url = new URL(response.url())
            if (url.pathname !== `/api/v1/applications/${application}/runtime/effective-layout`) return false
            return target
                ? url.searchParams.get('targetKind') === target.kind && url.searchParams.get('entityTypeId') === target.entityTypeId
                : !url.searchParams.has('targetKind') && !url.searchParams.has('entityTypeId')
        },
        { timeout: 60_000 }
    )

const waitForMarketingResponse = (page: Page, application: string, target: StandaloneTarget | null): Promise<Response> =>
    page.waitForResponse(
        (response) => {
            if (response.request().method() !== 'GET') return false
            const url = new URL(response.url())
            if (url.pathname !== `/api/v1/applications/${application}/runtime/marketing-page`) return false
            return target
                ? url.searchParams.get('targetKind') === target.kind && url.searchParams.get('entityTypeId') === target.entityTypeId
                : !url.searchParams.has('targetKind') && !url.searchParams.has('entityTypeId')
        },
        { timeout: 60_000 }
    )

const targetLabel = (target: StandaloneTarget | null): string => (target ? `${target.kind}-${target.entityTypeId}` : 'global')

const assertSurface = async (page: Page, template: TemplateKey, label: string): Promise<void> => {
    if (template === 'marketing-page') {
        await expect(page.locator('#marketing-page-main')).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Our latest products', exact: true })).toBeVisible()
        await expect(page.getByTestId('runtime-main-content')).toHaveCount(0)
    } else {
        await expect(page.getByTestId('runtime-main-content')).toBeVisible()
        await expect(page.locator('#marketing-page-main')).toHaveCount(0)
    }
    await expectNoPageHorizontalOverflow(page, label)
    await expectNoTechnicalLeakage(page.locator('body'), { label, checkUuidSubstrings: true })
    await expectLocalizedValidation(page.locator('body'), 'en', { label })
}

test('@flow @cross-template @standalone verifies configured global/Page/Object target separation', async ({ page }, testInfo) => {
    test.setTimeout(240_000)

    if (missingStandaloneConfiguration.length > 0) {
        testInfo.skip(
            true,
            `Standalone cross-template acceptance is opt-in: provide ${missingStandaloneConfiguration.join(', ')} to run it.`
        )
        return
    }

    const configuration = readConfiguration()
    const effectiveTargets = new Set<string>()
    const marketingTargets = new Set<string>()

    for (const [target, template] of configuration.targets) {
        const label = `Standalone ${targetLabel(target)} ${template}`
        const effectivePromise = waitForTargetResponse(page, configuration.application, target)
        const marketingPromise = template === 'marketing-page' ? waitForMarketingResponse(page, configuration.application, target) : null
        await page.goto(buildRuntimeUrl(configuration.base, configuration.application, target))
        const effectiveResponse = await effectivePromise
        expect(effectiveResponse.ok(), `${label} effective-layout response`).toBe(true)
        expect(((await effectiveResponse.json()) as { layout?: { templateKey?: string } }).layout?.templateKey).toBe(template)
        effectiveTargets.add(targetLabel(target))
        if (marketingPromise) {
            const marketingResponse = await marketingPromise
            expect(marketingResponse.ok(), `${label} marketing-page response`).toBe(true)
            marketingTargets.add(targetLabel(target))
        }
        await assertSurface(page, template, label)
        await expectRuntimeUxViewportMatrix(page, `${label} responsive`, {
            beforeEachViewport: async () => {
                await assertSurface(page, template, label)
            }
        })
        await waitForLayoutFrame(page)
        await page.screenshot({ path: testInfo.outputPath(`cross-template-standalone-${targetLabel(target)}.png`), fullPage: true })
    }

    expect(effectiveTargets).toEqual(expect.arrayContaining(['global', `page-${pageEntityTypeId}`, `object-${objectEntityTypeId}`]))
    expect(marketingTargets.size).toBeGreaterThanOrEqual(1)

    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(accessibility.violations, JSON.stringify(accessibility.violations)).toEqual([])
})
