import type { Locator, Page, TestInfo } from '@playwright/test'
import { expect } from '../../../fixtures/test'
import {
    assertRuntimeMutationActionsUnavailable,
    expectNoClippedTextContent,
    expectDataGridHorizontalScrollConstrained,
    expectNoDataGridTechnicalLeakage,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage
} from '../../../support/browser/runtimeUx'
import { readAnonymousRuntime, type PublicDetailsTablePlacement } from './support'

const inspectTextLayout = async (element: Locator) =>
    element.evaluate((target) => {
        const range = document.createRange()
        range.selectNodeContents(target)
        const textRects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0)
        const lineTops = new Set(textRects.map((rect) => Math.round(rect.top)))
        const style = window.getComputedStyle(target)
        let clipped = false
        const clippedAncestors: string[] = []
        let ancestor: Element | null = target
        while (ancestor && ancestor !== document.body) {
            const ancestorStyle = window.getComputedStyle(ancestor)
            if (
                ancestorStyle.overflowX === 'hidden' ||
                ancestorStyle.overflowX === 'clip' ||
                ancestorStyle.overflowY === 'hidden' ||
                ancestorStyle.overflowY === 'clip'
            ) {
                const bounds = ancestor.getBoundingClientRect()
                const outsideTextBounds = textRects.some(
                    (rect) =>
                        ((ancestorStyle.overflowX === 'hidden' || ancestorStyle.overflowX === 'clip') &&
                            (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)) ||
                        ((ancestorStyle.overflowY === 'hidden' || ancestorStyle.overflowY === 'clip') &&
                            (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1))
                )
                if (outsideTextBounds) {
                    clipped = true
                    clippedAncestors.push(
                        `${ancestor.tagName.toLowerCase()}.${String(ancestor.className).replace(/\s+/gu, '.')} ` +
                            `overflow=${ancestorStyle.overflowX}/${ancestorStyle.overflowY} ` +
                            `bounds=${Math.round(bounds.left)},${Math.round(bounds.top)},${Math.round(bounds.right)},${Math.round(
                                bounds.bottom
                            )}`
                    )
                }
            }
            ancestor = ancestor.parentElement
        }
        return {
            lineCount: lineTops.size,
            whiteSpace: style.whiteSpace,
            lineClamp: style.webkitLineClamp,
            clientWidth: target.clientWidth,
            scrollWidth: target.scrollWidth,
            clientHeight: target.clientHeight,
            scrollHeight: target.scrollHeight,
            clipped,
            clippedAncestors
        }
    })

export const verifyResponsiveMessengerRuntime = async ({
    anonymousPage,
    primaryAlias,
    testInfo
}: {
    anonymousPage: Page
    primaryAlias: string
    testInfo: TestInfo
}): Promise<void> => {
    const viewports = [
        { name: 'desktop', width: 1920, height: 1080, locale: 'en' as const },
        { name: 'tablet', width: 768, height: 1024, locale: 'en' as const },
        { name: 'mobile-en', width: 390, height: 844, locale: 'en' as const },
        { name: 'mobile-narrow', width: 320, height: 740, locale: 'en' as const },
        { name: 'mobile-ru', width: 390, height: 844, locale: 'ru' as const }
    ]

    for (const viewport of viewports) {
        const localized =
            viewport.locale === 'en'
                ? {
                      activeLearners: 'Active learners',
                      learningOverview: 'Learning overview',
                      platformFoundations: 'Platform foundations',
                      dataModeling: 'Data modeling',
                      applicationDesign: 'Application design',
                      focusedRecordDetail: 'Focused record detail',
                      singleRecordDescription: 'A single safe record projected in the public read-only detail view.',
                      resourceGuide: 'Messenger resource guide',
                      relatedRecords: 'Related records',
                      relatedArchitectureNotes: 'Related architecture notes',
                      relatedPublicRoutingGuide: 'Related public routing guide',
                      weeklySessions: 'Weekly sessions',
                      learningActivity: 'Learning activity',
                      weeklyPageViews: 'Weekly page views',
                      pageViews: 'Page views'
                  }
                : {
                      activeLearners: 'Активные учащиеся',
                      learningOverview: 'Обзор обучения',
                      platformFoundations: 'Основы платформы',
                      dataModeling: 'Моделирование данных',
                      applicationDesign: 'Проектирование приложений',
                      focusedRecordDetail: 'Карточка записи',
                      singleRecordDescription: 'Одна безопасная запись в публичном режиме просмотра без редактирования.',
                      resourceGuide: 'Руководство Messenger',
                      relatedRecords: 'Связанные записи',
                      relatedArchitectureNotes: 'Заметки по архитектуре',
                      relatedPublicRoutingGuide: 'Руководство по публичной маршрутизации',
                      weeklySessions: 'Сессии за неделю',
                      learningActivity: 'Учебная активность',
                      weeklyPageViews: 'Просмотры страниц за неделю',
                      pageViews: 'Просмотры страниц'
                  }
        await anonymousPage.setViewportSize({ width: viewport.width, height: viewport.height })
        const payload = await readAnonymousRuntime(anonymousPage, `/a/${primaryAlias}?locale=${viewport.locale}`)
        expect(payload.templateKey).toBe('messenger-app')
        const projectedPlacements = payload.messengerApp.placements
        const placementFor = (widgetKey: string) => projectedPlacements.filter((placement) => placement.widgetKey === widgetKey)
        const requireOnePlacement = (widgetKey: string) => {
            const matches = placementFor(widgetKey)
            expect(matches, `Public Messenger must project ${widgetKey}`).toHaveLength(1)
            const placement = matches[0]
            if (!placement) throw new Error(`Public Messenger did not project ${widgetKey}`)
            return placement
        }

        const overviewCards = requireOnePlacement('overviewCards')
        expect(overviewCards.widgetKey).toBe('overviewCards')
        if (overviewCards.widgetKey !== 'overviewCards') throw new Error('overviewCards projection has an unexpected widget key')
        expect(overviewCards.runtimeData.status).toBe('ready')
        if (overviewCards.runtimeData.status === 'ready') {
            expect(overviewCards.runtimeData.data.kind).toBe('metrics')
            if (overviewCards.runtimeData.data.kind === 'metrics') {
                expect(overviewCards.runtimeData.data.cards).toEqual(
                    expect.arrayContaining([expect.objectContaining({ label: localized.activeLearners, value: '128' })])
                )
            }
        }

        const tabsPlacement = requireOnePlacement('detailsTabs')
        expect(tabsPlacement.widgetKey).toBe('detailsTabs')
        const titlePlacement = requireOnePlacement('detailsTitle')
        expect(titlePlacement.widgetKey).toBe('detailsTitle')
        if (titlePlacement.widgetKey !== 'detailsTitle') throw new Error('detailsTitle projection has an unexpected widget key')
        expect(titlePlacement.runtimeData.status).toBe('ready')
        if (titlePlacement.runtimeData.status === 'ready') {
            expect(titlePlacement.runtimeData.data).toEqual({ kind: 'title', text: localized.learningOverview })
        }

        const tablePlacements = projectedPlacements.filter(
            (placement): placement is PublicDetailsTablePlacement => placement.widgetKey === 'detailsTable'
        )
        expect(tablePlacements).toHaveLength(2)
        expect(tablePlacements.map((placement) => placement.runtimeData.status)).toEqual(['ready', 'ready'])
        const multiRowPlacement = tablePlacements.find(
            (placement) => placement.runtimeData.status === 'ready' && placement.runtimeData.data.kind === 'table'
        )
        const multiRowData = multiRowPlacement?.runtimeData
        if (!multiRowData || multiRowData.status !== 'ready' || multiRowData.data.kind !== 'table') {
            throw new Error('Public Messenger did not project the multi-row detailsTable data')
        }
        const multiRowValues = multiRowData.data.rows.flatMap((row) => row.cells.map((cell) => cell.value))
        expect(multiRowValues).toEqual(
            expect.arrayContaining([localized.platformFoundations, localized.dataModeling, localized.applicationDesign])
        )

        const detailTablePlacement = tablePlacements.find(
            (placement) => placement.runtimeData.status === 'ready' && placement.runtimeData.data.kind === 'record'
        )
        const detailTableData = detailTablePlacement?.runtimeData
        if (!detailTableData || detailTableData.status !== 'ready' || detailTableData.data.kind !== 'record') {
            throw new Error('Public Messenger did not project the single-record detailsTable case')
        }
        expect(detailTableData.data.title).toBe(localized.focusedRecordDetail)
        expect(detailTableData.data.fields).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    value: localized.singleRecordDescription
                })
            ])
        )

        const resourcePlacement = requireOnePlacement('resourcePreview')
        expect(resourcePlacement.widgetKey).toBe('resourcePreview')
        if (resourcePlacement.widgetKey !== 'resourcePreview') throw new Error('resourcePreview projection has an unexpected widget key')
        expect(resourcePlacement.runtimeData.status).toBe('ready')
        if (resourcePlacement.runtimeData.status === 'ready') {
            expect(resourcePlacement.runtimeData.data).toMatchObject({
                kind: 'resource',
                title: localized.resourceGuide,
                source: { type: 'url', url: 'https://example.com/messenger-guide' }
            })
        }

        const relationPlacement = requireOnePlacement('relationBuilder')
        expect(relationPlacement.widgetKey).toBe('relationBuilder')
        if (relationPlacement.widgetKey !== 'relationBuilder') throw new Error('relationBuilder projection has an unexpected widget key')
        expect(relationPlacement.runtimeData.status).toBe('ready')
        if (relationPlacement.runtimeData.status === 'ready') {
            expect(relationPlacement.runtimeData.data.kind).toBe('relation')
            if (relationPlacement.runtimeData.data.kind === 'relation') {
                expect(relationPlacement.runtimeData.data.parents).toEqual([
                    expect.objectContaining({ label: localized.focusedRecordDetail })
                ])
                expect(relationPlacement.runtimeData.data.panels[0]?.rows).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ label: localized.relatedArchitectureNotes }),
                        expect.objectContaining({ label: localized.relatedPublicRoutingGuide })
                    ])
                )
            }
        }

        const columnsPlacement = requireOnePlacement('columnsContainer')
        expect(columnsPlacement.widgetKey).toBe('columnsContainer')
        if (columnsPlacement.widgetKey !== 'columnsContainer') throw new Error('columnsContainer projection has an unexpected widget key')
        expect(columnsPlacement.config.columns.map(({ slotKey }) => slotKey)).toEqual(['column:sessions', 'column:page-views'])
        const sessionsPlacement = requireOnePlacement('sessionsChart')
        const pageViewsPlacement = requireOnePlacement('pageViewsChart')
        expect(sessionsPlacement.parentInstanceKey, 'The sessions chart must remain nested in the imported columns widget').toBe(
            columnsPlacement.instanceKey
        )
        expect(sessionsPlacement.slotKey, 'The sessions chart must keep its imported column slot').toBe(
            columnsPlacement.config.columns[0]?.slotKey
        )
        expect(pageViewsPlacement.parentInstanceKey, 'The page-views chart must remain nested in the imported columns widget').toBe(
            columnsPlacement.instanceKey
        )
        expect(pageViewsPlacement.slotKey, 'The page-views chart must keep its imported column slot').toBe(
            columnsPlacement.config.columns[1]?.slotKey
        )
        for (const [chart, widgetKey, title, seriesLabel] of [
            [sessionsPlacement, 'sessionsChart', localized.weeklySessions, localized.learningActivity],
            [pageViewsPlacement, 'pageViewsChart', localized.weeklyPageViews, localized.pageViews]
        ] as const) {
            expect(chart.widgetKey).toBe(widgetKey)
            if (chart.widgetKey !== widgetKey) throw new Error(`${widgetKey} projection has an unexpected widget key`)
            expect(chart.runtimeData.status).toBe('ready')
            if (chart.runtimeData.status === 'ready') {
                expect(chart.runtimeData.data.kind).toBe('series')
                if (chart.runtimeData.data.kind === 'series') {
                    expect(chart.runtimeData.data.title).toBe(title)
                    expect(chart.runtimeData.data.labels).toHaveLength(7)
                    expect(chart.runtimeData.data.series).toEqual(
                        expect.arrayContaining([
                            expect.objectContaining({ label: seriesLabel, values: expect.arrayContaining([expect.any(Number)]) })
                        ])
                    )
                }
            }
        }
        const main = anonymousPage.getByRole('main')
        await expect(main).toBeVisible({ timeout: 30_000 })
        await expect(main).toHaveCount(1)
        await expectNoClippedTextContent(main, { label: `Messenger public runtime ${viewport.name}` })
        const entityTables = main.getByTestId('dashboard-entity-table')
        await expect(entityTables, 'The fixture must render the multi-row details and related-record table surfaces').toHaveCount(2)
        const multiRowTable = entityTables.filter({ hasText: localized.platformFoundations })
        await expect(multiRowTable, 'The multi-row details widget must render its shared entity-table surface').toHaveCount(1)
        await expect(multiRowTable).toBeVisible()
        for (const rowTitle of [localized.platformFoundations, localized.dataModeling, localized.applicationDesign]) {
            await expect(multiRowTable.getByText(rowTitle, { exact: true }), `The multi-row table must render ${rowTitle}`).toBeVisible()
        }
        const singleRecordDescription = main.getByText(localized.singleRecordDescription, { exact: true })
        await expect(singleRecordDescription, 'The focused record card must render its localized description').toBeVisible()
        const applicationHeading = main.getByRole('heading', {
            name: viewport.locale === 'en' ? 'Team Workspace' : 'Командное пространство'
        })
        if (!(await applicationHeading.isVisible().catch(() => false))) {
            await anonymousPage.screenshot({
                path: testInfo.outputPath(`messenger-anonymous-${viewport.name}-${viewport.locale}-missing-heading.png`),
                fullPage: true
            })
        }
        await expect(applicationHeading).toBeVisible()
        await expect(main.getByText(/Forged (Telegram|MAX) Identity/u)).toHaveCount(0)
        // The imported fixture supplies localized records to the Overview tab.
        await expect(anonymousPage.getByTestId('public-messenger-top-zone')).toBeVisible()
        await expect(main.getByTestId('messenger-zone-center')).toBeVisible()
        const overviewTab = anonymousPage.getByRole('tab', { name: viewport.locale === 'en' ? 'Overview' : 'Обзор' })
        await expect(overviewTab).toBeVisible()
        await overviewTab.focus()
        await expect(overviewTab).toBeFocused()
        await overviewTab.press('Enter')
        await expect(overviewTab).toHaveAttribute('aria-selected', 'true')
        const detailsTabGroups = anonymousPage.getByTestId('runtime-details-tabs')
        await expect(detailsTabGroups).toHaveCount(1)
        await expect(detailsTabGroups.first()).toBeVisible()
        await expect(main.getByRole('heading', { name: localized.learningOverview })).toBeVisible()
        await expect(main.getByText(localized.platformFoundations, { exact: true })).toBeVisible()
        await expect(main.getByText(localized.dataModeling, { exact: true })).toBeVisible()
        await expect(main.getByText(localized.applicationDesign, { exact: true })).toBeVisible()
        await expect(main.getByRole('heading', { name: localized.activeLearners })).toBeVisible()
        await expect(main.getByText('128', { exact: true })).toBeVisible()
        await expect(main.getByText(localized.focusedRecordDetail, { exact: true }).first()).toBeVisible()
        await expectNoDataGridTechnicalLeakage(main, {
            label: `Messenger public DataGrid ${viewport.name}`,
            checkUuidSubstrings: true,
            checkOpaqueRuntimeHandles: true,
            requireVisibleGrid: true
        })
        await expectDataGridHorizontalScrollConstrained(anonymousPage, `Messenger public DataGrid ${viewport.name}`)
        await expect(singleRecordDescription).toBeVisible()
        if (viewport.width === 320) {
            const descriptionLayout = await inspectTextLayout(singleRecordDescription)
            expect(descriptionLayout.lineCount, 'Long public detail text must wrap into multiple visible lines at 320px').toBeGreaterThan(1)
            expect(descriptionLayout.whiteSpace).not.toBe('nowrap')
            expect(descriptionLayout.scrollWidth).toBeLessThanOrEqual(descriptionLayout.clientWidth + 1)
            expect(descriptionLayout.scrollHeight).toBeLessThanOrEqual(descriptionLayout.clientHeight + 1)
            expect(
                descriptionLayout.clipped,
                `Public detail description must fit clipping ancestors: ${JSON.stringify(descriptionLayout)}`
            ).toBe(false)
        }
        await expect(main.getByTestId('resource-preview')).toBeVisible()
        await expect(main.getByText(localized.resourceGuide, { exact: true })).toBeVisible()
        await expect(main.getByTestId('resource-preview-domain')).toContainText('example.com')
        const overviewPanelId = await overviewTab.getAttribute('aria-controls')
        expect(overviewPanelId).toBeTruthy()
        const overviewPanel = main.locator(`[id="${overviewPanelId ?? ''}"]`)
        await expect(overviewPanel).toBeVisible()
        await expect(
            overviewPanel.getByRole('heading', {
                name: localized.relatedRecords
            })
        ).toBeVisible()
        const relationPanel = overviewPanel
        await expect(relationPanel.getByText(localized.relatedArchitectureNotes, { exact: true })).toBeVisible()
        const relatedRoutingTitle = relationPanel.getByText(localized.relatedPublicRoutingGuide, { exact: true })
        await expect(relatedRoutingTitle).toBeVisible()
        if (viewport.width <= 390) {
            const titleLayout = await inspectTextLayout(relatedRoutingTitle)
            expect(titleLayout.whiteSpace, 'Messenger relation titles must wrap on mobile').not.toBe('nowrap')
            expect(titleLayout.lineCount, 'Messenger relation titles must remain visible').toBeGreaterThan(0)
            expect(titleLayout.lineCount, 'Messenger relation titles may use at most two visible lines').toBeLessThanOrEqual(2)
            expect(titleLayout.clipped, 'Messenger relation titles must not be clipped').toBe(false)
            expect(titleLayout.scrollWidth, 'Messenger relation title must not overflow horizontally').toBeLessThanOrEqual(
                titleLayout.clientWidth + 1
            )
            expect(titleLayout.scrollHeight, 'Messenger relation title must not be clipped vertically').toBeLessThanOrEqual(
                titleLayout.clientHeight + 1
            )
        }
        const sessionsHeading = main.getByRole('heading', { name: localized.weeklySessions })
        const pageViewsHeading = main.getByRole('heading', { name: localized.weeklyPageViews })
        await expect(sessionsHeading).toBeVisible()
        await expect(pageViewsHeading).toBeVisible()
        const columnsRenderer = main.getByTestId('runtime-columns-container')
        await expect(columnsRenderer, 'The imported columns widget must render its shared columns container').toHaveCount(1)
        await expect(
            columnsRenderer.getByTestId('runtime-columns-slot-1').getByRole('heading', { name: localized.weeklySessions, exact: true }),
            'The sessions chart must render inside the first configured column slot'
        ).toBeVisible()
        await expect(
            columnsRenderer.getByTestId('runtime-columns-slot-2').getByRole('heading', { name: localized.weeklyPageViews, exact: true }),
            'The page-views chart must render inside the second configured column slot'
        ).toBeVisible()
        const sessionsChartCard = main.getByTestId('sessions-chart-card')
        const pageViewsChartCard = main.getByTestId('page-views-chart-card')
        await expect(sessionsChartCard).toHaveCount(1)
        await expect(pageViewsChartCard).toHaveCount(1)
        await expect(sessionsChartCard.getByRole('heading', { name: localized.weeklySessions, exact: true })).toBeVisible()
        await expect(pageViewsChartCard.getByRole('heading', { name: localized.weeklyPageViews, exact: true })).toBeVisible()
        await expect(sessionsChartCard.locator('svg').last()).toBeVisible()
        await expect(pageViewsChartCard.locator('svg').last()).toBeVisible()
        expect(await sessionsChartCard.locator('svg path').count()).toBeGreaterThan(0)
        expect(await pageViewsChartCard.locator('svg rect').count()).toBeGreaterThan(0)
        await expectNoPageHorizontalOverflow(anonymousPage, `Messenger public runtime ${viewport.name}`)
        await expectNoTechnicalLeakage(main, {
            label: `Messenger public runtime ${viewport.name}`,
            checkUuidSubstrings: true,
            checkOpaqueRuntimeHandles: true
        })
        await assertRuntimeMutationActionsUnavailable(anonymousPage, `Messenger public runtime ${viewport.name}`)
        await anonymousPage.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())

        if (viewport.name === 'desktop' || viewport.name === 'mobile-ru') {
            await expect(main).toHaveScreenshot(`messenger-public-runtime-${viewport.name}.png`, {
                animations: 'disabled',
                caret: 'hide',
                maxDiffPixelRatio: 0.01
            })
        }

        const artifactPath = testInfo.outputPath(`messenger-app-runtime-${viewport.name}.png`)
        await anonymousPage.screenshot({ path: artifactPath, animations: 'disabled' })
        const inspectVerticalScrollContainers = () =>
            anonymousPage.evaluate(() => {
                const documentScroller = document.scrollingElement ?? document.documentElement
                const candidates = [documentScroller, ...Array.from(document.querySelectorAll<HTMLElement>('*'))]
                const describe = (element: HTMLElement) => ({
                    tagName: element.tagName.toLowerCase(),
                    testId: element.dataset.testid ?? null,
                    id: element.id || null,
                    overflowY: window.getComputedStyle(element).overflowY,
                    clientHeight: element.clientHeight,
                    scrollHeight: element.scrollHeight,
                    scrollTop: element.scrollTop
                })
                return {
                    viewportHeight: window.innerHeight,
                    documentScroller: describe(documentScroller as HTMLElement),
                    main: document.querySelector<HTMLElement>('main') ? describe(document.querySelector<HTMLElement>('main')!) : null,
                    candidates: candidates
                        .filter((element, index) => {
                            const overflowY = window.getComputedStyle(element).overflowY
                            return (
                                element.scrollHeight > element.clientHeight + 1 &&
                                (index === 0 || overflowY === 'auto' || overflowY === 'scroll')
                            )
                        })
                        .map(describe)
                }
            })
        const initialScrollContainers = await inspectVerticalScrollContainers()
        expect(
            initialScrollContainers.candidates.length > 0,
            `${viewport.name} must expose a real vertical scroll container: ${JSON.stringify(initialScrollContainers)}`
        ).toBe(true)
        const runtimeRequiresVerticalScroll = initialScrollContainers.candidates.length > 0
        if (runtimeRequiresVerticalScroll) {
            const runtimeScrollContainer = main.getByTestId('messenger-runtime-shell')
            await expect(runtimeScrollContainer, 'The Messenger runtime shell must own its vertical content scrolling').toBeVisible()
            const scrollContainerBounds = await runtimeScrollContainer.boundingBox()
            expect(scrollContainerBounds, 'The Messenger runtime scroll container must have a visible hit area').not.toBeNull()
            if (!scrollContainerBounds) throw new Error('The Messenger runtime scroll container has no visible hit area')
            await runtimeScrollContainer.hover({
                position: { x: scrollContainerBounds.width / 2, y: Math.min(scrollContainerBounds.height / 2, 64) }
            })
            await anonymousPage.mouse.wheel(0, Math.max(400, Math.floor(viewport.height * 0.7)))
            try {
                await expect
                    .poll(async () => (await inspectVerticalScrollContainers()).candidates.some(({ scrollTop }) => scrollTop > 0), {
                        timeout: 5_000
                    })
                    .toBe(true)
            } catch {
                const finalScrollContainers = await inspectVerticalScrollContainers()
                throw new Error(
                    `${viewport.name} did not scroll after a user wheel gesture; before=${JSON.stringify(
                        initialScrollContainers
                    )}; after=${JSON.stringify(finalScrollContainers)}`
                )
            }
            const getPageViewsChartVisibleRatio = () =>
                pageViewsChartCard.evaluate((element) => {
                    const bounds = element.getBoundingClientRect()
                    const visibleWidth = Math.max(0, Math.min(bounds.right, window.innerWidth) - Math.max(bounds.left, 0))
                    const visibleHeight = Math.max(0, Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, 0))
                    const area = bounds.width * bounds.height
                    return area > 0 ? (visibleWidth * visibleHeight) / area : 0
                })
            let pageViewsChartVisibleRatio = await getPageViewsChartVisibleRatio()
            for (let attempt = 0; attempt < 10 && pageViewsChartVisibleRatio < 0.5; attempt += 1) {
                await anonymousPage.mouse.wheel(0, Math.max(400, Math.floor(viewport.height * 0.7)))
                pageViewsChartVisibleRatio = await getPageViewsChartVisibleRatio()
            }
            const reachedLastChart = pageViewsChartVisibleRatio >= 0.5
            const scrolledContainers = await inspectVerticalScrollContainers()
            expect(
                scrolledContainers.candidates.some(({ scrollTop }) => scrollTop > 0),
                `${viewport.name} must scroll a runtime container: ${JSON.stringify(scrolledContainers)}`
            ).toBe(true)
            expect(
                reachedLastChart,
                `${viewport.name} must make at least half of its lower chart card visible by scrolling; ` +
                    `visibleRatio=${pageViewsChartVisibleRatio.toFixed(3)}`
            ).toBe(true)
            await expect(pageViewsHeading).toBeInViewport()
            await expect(pageViewsChartCard).toBeInViewport({ ratio: 0.5 })
            await expectNoPageHorizontalOverflow(anonymousPage, `Messenger public runtime after vertical scroll ${viewport.name}`)

            if (viewport.name === 'mobile-en' || viewport.name === 'mobile-ru') {
                const scrolledArtifactPath = testInfo.outputPath(`messenger-app-runtime-${viewport.name}-scrolled.png`)
                await anonymousPage.screenshot({ path: scrolledArtifactPath, animations: 'disabled' })
                await testInfo.attach(`messenger-app-runtime-${viewport.name}-scrolled`, {
                    path: scrolledArtifactPath,
                    contentType: 'image/png'
                })
            }
            await runtimeScrollContainer.evaluate((element) => element.scrollTo({ top: 0, behavior: 'instant' }))
            await expect.poll(() => runtimeScrollContainer.evaluate((element) => element.scrollTop), { timeout: 5_000 }).toBe(0)
            await expect(
                applicationHeading,
                'The public application header must remain visible after restoring the top scroll position'
            ).toBeInViewport()
        }

        const visibleText = (await main.innerText()).toLowerCase()
        expect(visibleText).not.toMatch(/\b(edit|delete|изменить|удалить)\b/u)
        const managementLinks = await anonymousPage
            .getByRole('link')
            .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).getAttribute('href') ?? ''))
        expect(managementLinks.filter((href) => /\/admin(?:\/|$)|\/metahub\//u.test(href))).toEqual([])
        expect(
            await anonymousPage.evaluate(() => {
                const runtimeWindow = window as Window & { Telegram?: unknown; WebApp?: unknown }
                return Boolean(runtimeWindow.Telegram || runtimeWindow.WebApp)
            })
        ).toBe(false)
    }
}
