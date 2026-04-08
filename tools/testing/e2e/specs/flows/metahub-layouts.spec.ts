import { createLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import { expectLeftEdgeAligned, expectNotNarrowerThan, getHorizontalBounds } from '../../support/browser/spacing'
import {
    createLoggedInApiContext,
    createMetahub,
    disposeApiContext,
    getLayout,
    listLayouts,
    listLayoutZoneWidgets
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import {
    buildLayoutWidgetSelector,
    buildLayoutWidgetToggleSelector,
    buildLayoutZoneSelector,
    pageSpacingSelectors,
    viewHeaderSelectors
} from '../../support/selectors/contracts'

function readLocalizedText(value, locale = 'en') {
    if (!value || typeof value !== 'object' || !('locales' in value)) {
        return undefined
    }

    const normalizedLocale = locale.split(/[-_]/)[0]?.toLowerCase() || 'en'
    const locales = value.locales ?? {}
    return locales[normalizedLocale]?.content || locales[value._primary || 'en']?.content || locales.en?.content
}

test('@flow metahub General layouts tab and layout details load through the shipped route contract and persist widget toggles', async ({
    page,
    runManifest
}) => {
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} layouts metahub`
    const metahubCodename = `${runManifest.runId}-layouts-metahub`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for layouts coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        let layoutId
        await expect
            .poll(async () => {
                const response = await listLayouts(api, metahub.id, { limit: 20, offset: 0 })
                layoutId = response?.items?.[0]?.id
                return typeof layoutId === 'string'
            })
            .toBe(true)

        if (typeof layoutId !== 'string') {
            throw new Error(`No layout was returned for metahub ${metahub.id}`)
        }

        const layout = await getLayout(api, metahub.id, layoutId)
        const layoutName = readLocalizedText(layout?.name, 'en') || 'Dashboard'

        let detailsTitleWidget
        await expect
            .poll(async () => {
                const response = await listLayoutZoneWidgets(api, metahub.id, layoutId)
                detailsTitleWidget = response?.items?.find((item) => item.widgetKey === 'detailsTitle')
                return Boolean(detailsTitleWidget?.id)
            })
            .toBe(true)

        if (!detailsTitleWidget?.id) {
            throw new Error(`Details title widget was not found for layout ${layoutId}`)
        }

        const expectedActiveState = detailsTitleWidget.isActive !== true

        await page.goto(`/metahub/${metahub.id}/layouts`)
        await page.waitForURL(`**/metahub/${metahub.id}/common`)
        await expect(page.getByRole('heading', { name: 'Common' })).toBeVisible()
        await expect(page.getByTestId(pageSpacingSelectors.metahubCommonTabs)).toBeVisible()
        await expect(page.getByRole('tab', { name: 'Layouts' })).toHaveAttribute('aria-selected', 'true')
        await expect(page.getByText(layoutName, { exact: true })).toBeVisible()

        const layoutsListBounds = await getHorizontalBounds(
            page.getByTestId(pageSpacingSelectors.metahubLayoutsListContent),
            'Layouts list content'
        )

        await page.getByText(layoutName, { exact: true }).click()
        await page.waitForURL(`**/metahub/${metahub.id}/common/layouts/${layoutId}`)
        await expect(page.getByText('Drag widgets between zones to change runtime composition.')).toBeVisible()
        await expect(page.getByTestId(buildLayoutZoneSelector('left'))).toBeVisible()
        await expect(page.getByTestId(buildLayoutZoneSelector('center'))).toBeVisible()
        await expect(page.getByTestId(buildLayoutWidgetSelector(detailsTitleWidget.id))).toBeVisible()
        await expectNotNarrowerThan(layoutsListBounds, page.getByTestId(pageSpacingSelectors.metahubLayoutDetailsContent))
        await expectLeftEdgeAligned(
            page.getByTestId(pageSpacingSelectors.metahubLayoutDetailsContent),
            page.getByTestId(viewHeaderSelectors.titleRegion),
            4
        )

        await page.getByTestId(buildLayoutWidgetToggleSelector(detailsTitleWidget.id)).click()

        await expect
            .poll(async () => {
                const response = await listLayoutZoneWidgets(api, metahub.id, layoutId)
                const widget = response?.items?.find((item) => item.id === detailsTitleWidget.id)
                return widget?.isActive === expectedActiveState
            })
            .toBe(true)
    } finally {
        await disposeApiContext(api)
    }
})
