import type { Page, TestInfo } from '@playwright/test'
import { createLocalizedContent } from '@universo-react/utils'
import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createApplicationLayout as createAppLayout,
    createMetahub,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    disposeApiContext,
    listApplicationLayouts,
    listLayouts,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'

const DRAG_HINT = 'Drag widgets between zones to change runtime composition.'

async function captureProofScreenshot(page: Page, testInfo: TestInfo, name: string) {
    await page.screenshot({
        path: testInfo.outputPath(name),
        fullPage: true,
        animations: 'disabled'
    })
}

type ApplicationLayoutListResponse = {
    items?: Array<{ id?: string }>
}

async function waitForMetahubLayoutId(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, metahubId: string): Promise<string> {
    let layoutId: string | undefined
    await expect
        .poll(async () => {
            const response = (await listLayouts(api, metahubId, { limit: 20, offset: 0 })) as { items?: Array<{ id?: string }> }
            layoutId = response?.items?.[0]?.id
            return typeof layoutId === 'string'
        })
        .toBe(true)
    if (!layoutId) {
        throw new Error(`Metahub ${metahubId} did not expose any layouts`)
    }
    return layoutId
}

async function waitForApplicationLayoutId(
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    applicationId: string
): Promise<string> {
    let layoutId: string | undefined
    await expect
        .poll(async () => {
            const response = (await listApplicationLayouts(api, applicationId, { limit: 20, offset: 0 })) as ApplicationLayoutListResponse
            layoutId = response.items?.[0]?.id
            return typeof layoutId === 'string'
        })
        .toBe(true)
    if (!layoutId) {
        throw new Error(`Application ${applicationId} did not expose any managed layouts`)
    }
    return layoutId
}

/**
 * Layout details split the authoring surface into "Main" (zones/widgets) and
 * "Appearance" (theme preset authoring) tabs; the preset manager dialog is
 * strict-modal (Escape/backdrop trigger a visual pulse instead of closing,
 * see dialogPresentation.tsx), so only the explicit Close action exits it.
 *
 * `keyboardTabActivation` exercises the MUI Tabs roving-tabindex keyboard
 * path (focus Main → ArrowRight → Enter) instead of a mouse click.
 */
async function expectAppearanceTabsAndPresetDialog(
    page: Page,
    testInfo: TestInfo,
    detailUrl: string,
    prefixes: { tab: string; appearance: string },
    { keyboardTabActivation = false }: { keyboardTabActivation?: boolean } = {}
) {
    await page.goto(detailUrl)
    await page.waitForURL(`**${detailUrl}`)

    const mainTab = page.getByTestId(`${prefixes.tab}-main`)
    const appearanceTab = page.getByTestId(`${prefixes.tab}-appearance`)
    await expect(mainTab).toBeVisible()
    await expect(appearanceTab).toBeVisible()
    await expect(mainTab).toHaveAttribute('aria-selected', 'true')

    // Default tab: zone authoring, no appearance section.
    await expect(page.getByText(DRAG_HINT)).toBeVisible()
    await expect(page.getByTestId(`${prefixes.appearance}-section`)).toHaveCount(0)

    if (keyboardTabActivation) {
        // Keyboard path: MUI Tabs moves focus with ArrowRight (roving
        // tabindex) and activates the focused tab with Enter/Space.
        await mainTab.focus()
        await expect(mainTab).toBeFocused()
        await page.keyboard.press('ArrowRight')
        await expect(appearanceTab).toBeFocused()
        await page.keyboard.press('Enter')
    } else {
        await appearanceTab.click()
    }
    await expect(appearanceTab).toHaveAttribute('aria-selected', 'true')
    const appearanceSection = page.getByTestId(`${prefixes.appearance}-section`)
    await expect(appearanceSection).toBeVisible()
    await expect(page.getByText(DRAG_HINT)).toHaveCount(0)
    await captureProofScreenshot(page, testInfo, `${prefixes.appearance}-tab.png`)

    // The preset manager dialog is strict-modal: only the Close action exits it.
    await appearanceSection.getByTestId(`${prefixes.appearance}-manage-presets`).click()
    const closeAction = page.getByTestId(`${prefixes.appearance}-close`)
    await expect(closeAction).toBeVisible()

    // At least one preset item card (the universo-default file preset) is
    // rendered inside the dialog before it is closed.
    await expect(page.getByTestId(`${prefixes.appearance}-manager`)).toBeVisible()
    await expect(page.getByTestId(`${prefixes.appearance}-card-universo-default`)).toBeVisible()

    // Strict-modal guard: neither Escape nor a backdrop click may close the
    // dialog — the presentation layer pulses instead of dismissing it.
    await page.keyboard.press('Escape')
    await expect(closeAction).toBeVisible()
    await page.mouse.click(5, 5)
    await expect(closeAction).toBeVisible()

    await captureProofScreenshot(page, testInfo, `${prefixes.appearance}-manager-dialog.png`)
    await closeAction.click()
    await expect(closeAction).toHaveCount(0)

    // Back to the main tab restores zone authoring.
    await mainTab.click()
    await expect(mainTab).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText(DRAG_HINT)).toBeVisible()
    await expect(page.getByTestId(`${prefixes.appearance}-section`)).toHaveCount(0)
}

test('@flow theme appearance tabs: metahub and application layout details split authoring and close the preset dialog', async ({
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} appearance tabs metahub`
    const metahubCodename = `${runManifest.runId}-appearance-tabs-metahub`
    const applicationName = `E2E ${runManifest.runId} appearance tabs app`

    try {
        // --- Metahub surface ---
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })
        expect(metahub?.id).toBeTruthy()
        await recordCreatedMetahub({ id: metahub.id, name: metahubName, codename: metahubCodename })
        const metahubLayoutId = await waitForMetahubLayoutId(api, metahub.id)

        await expectAppearanceTabsAndPresetDialog(
            page,
            testInfo,
            `/metahub/${metahub.id}/resources/layouts/${metahubLayoutId}`,
            {
                tab: 'metahub-layout-details-tab',
                appearance: 'metahub-appearance'
            },
            { keyboardTabActivation: true }
        )

        // Runtime UX gate: at a realistic mobile width the Theme tab must
        // stack its controls without page-level horizontal overflow.
        const desktopViewport = page.viewportSize()
        await page.setViewportSize({ width: 390, height: 844 })
        await page.goto(`/metahub/${metahub.id}/resources/layouts/${metahubLayoutId}`)
        await page.getByTestId('metahub-layout-details-tab-appearance').click()
        await expect(page.getByTestId('metahub-appearance-section')).toBeVisible()
        const mobileScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
        expect(mobileScrollWidth).toBeLessThanOrEqual(390)
        await captureProofScreenshot(page, testInfo, 'metahub-appearance-tab-mobile.png')
        await page.setViewportSize(desktopViewport ?? { width: 1280, height: 720 })

        // --- Application surface (publication-linked application) ---
        const publication = await createPublication(api, metahub.id, {
            name: { en: `${applicationName} publication` },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })
        expect(publication?.id).toBeTruthy()
        await createPublicationVersion(api, metahub.id, publication.id, {
            name: { en: `${applicationName} v1` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, metahub.id, publication.id)
        await waitForPublicationReady(api, metahub.id, publication.id)

        const linked = await createPublicationLinkedApplication(api, metahub.id, publication.id, {
            name: { en: applicationName },
            namePrimaryLocale: 'en',
            createApplicationSchema: false
        })
        const applicationId = linked?.application?.id
        expect(typeof applicationId).toBe('string')
        await recordCreatedApplication({ id: applicationId })
        await syncApplicationSchema(api, applicationId)

        // A local application-owned layout guarantees the details route renders
        // even if the synced metahub layout takes a moment to appear.
        const localLayout = await createAppLayout(api, applicationId, {
            templateKey: 'dashboard',
            name: { en: `${applicationName} local layout` },
            isActive: true
        })
        const localLayoutId = localLayout?.item?.id ?? localLayout?.id
        expect(typeof localLayoutId).toBe('string')
        await waitForApplicationLayoutId(api, applicationId)

        await expectAppearanceTabsAndPresetDialog(page, testInfo, `/a/${applicationId}/admin/layouts/${localLayoutId}`, {
            tab: 'application-layout-details-tab',
            appearance: 'application-appearance'
        })
    } finally {
        await disposeApiContext(api)
    }
})
