import { expect, type Page } from '@playwright/test'

/**
 * Layout oracles for the published marketing page. jsdom cannot measure real
 * grid geometry, so the geometry regressions (shrunk card grids, flex-shrunk
 * cards overlapping, half-width accordion answers) are only observable in a
 * real browser and are asserted here.
 */

export interface GridFillOptions {
    containerSelector: string
    gridSelector: string
    label: string
    minRatio?: number
    /** Optional floor proving the container itself widened (not only the grid). */
    minContainerWidth?: number
    /** Optional ceiling proving the container stays inside the base layout width. */
    maxContainerWidth?: number
}

interface GridFillMetrics {
    containerContentWidth: number
    containerWidth: number
    gridWidth: number
    ratio: number
}

export async function expectGridFillsContainer(page: Page, options: GridFillOptions): Promise<void> {
    const { containerSelector, gridSelector, label, minRatio = 0.9, minContainerWidth, maxContainerWidth } = options
    const metrics = await page.evaluate<GridFillMetrics | null, { containerSelector: string; gridSelector: string }>(
        ({ containerSelector: container, gridSelector: grid }) => {
            const containerElement = document.querySelector<HTMLElement>(container)
            const gridElement = containerElement?.querySelector<HTMLElement>(grid)
            if (!containerElement || !gridElement) return null
            const containerRect = containerElement.getBoundingClientRect()
            const computed = window.getComputedStyle(containerElement)
            const padding = Number.parseFloat(computed.paddingLeft) + Number.parseFloat(computed.paddingRight)
            const containerContentWidth = containerRect.width - padding
            const gridWidth = gridElement.getBoundingClientRect().width
            return {
                containerContentWidth: Math.round(containerContentWidth),
                containerWidth: Math.round(containerRect.width),
                gridWidth: Math.round(gridWidth),
                ratio: containerContentWidth > 0 ? gridWidth / containerContentWidth : 0
            }
        },
        { containerSelector, gridSelector }
    )

    expect(metrics, `${label}: section container ${containerSelector} must render a grid ${gridSelector}`).not.toBeNull()
    expect(
        metrics?.ratio ?? 0,
        `${label}: grid must fill the section content width (grid ${metrics?.gridWidth}px of ${metrics?.containerContentWidth}px)`
    ).toBeGreaterThanOrEqual(minRatio)
    if (typeof minContainerWidth === 'number') {
        expect(
            metrics?.containerWidth ?? 0,
            `${label}: section container must widen with the full card width (container ${metrics?.containerWidth}px, expected >= ${minContainerWidth}px)`
        ).toBeGreaterThanOrEqual(minContainerWidth)
    }
    if (typeof maxContainerWidth === 'number') {
        expect(
            metrics?.containerWidth ?? 0,
            `${label}: section container must stay inside the base layout width (container ${metrics?.containerWidth}px, expected <= ${maxContainerWidth}px)`
        ).toBeLessThanOrEqual(options.maxContainerWidth)
    }
}

export interface NoContentClippingOptions {
    selector: string
    label: string
    tolerancePx?: number
}

interface ClippingEntry {
    index: number
    text: string
    clientHeight: number
    scrollHeight: number
    clientWidth: number
    scrollWidth: number
}

const countMatches = async (page: Page, selector: string): Promise<number> => page.locator(selector).count()

export async function expectNoContentClipping(page: Page, options: NoContentClippingOptions): Promise<void> {
    const { selector, label, tolerancePx = 1 } = options
    const clipped = await page.evaluate<ClippingEntry[], { selector: string; tolerancePx: number }>(
        ({ selector: target, tolerancePx: tolerance }) =>
            Array.from(document.querySelectorAll<HTMLElement>(target))
                .map((element, index) => ({
                    index,
                    text: element.innerText?.replace(/\s+/g, ' ').trim().slice(0, 120) ?? '',
                    clientHeight: element.clientHeight,
                    scrollHeight: element.scrollHeight,
                    clientWidth: element.clientWidth,
                    scrollWidth: element.scrollWidth
                }))
                .filter(
                    (entry) => entry.scrollHeight > entry.clientHeight + tolerance || entry.scrollWidth > entry.clientWidth + tolerance
                ),
        { selector, tolerancePx }
    )

    expect(clipped, `${label}: ${selector} must not clip its own content`).toEqual([])
    expect(await countMatches(page, selector), `${label}: expected at least one ${selector}`).toBeGreaterThan(0)
}

export interface NoVerticalOverlapOptions {
    selector: string
    label: string
    gapPx?: number
}

interface OverlapDiagnostic {
    previous: { index: number; bottom: number; text: string }
    next: { index: number; top: number; text: string }
}

export async function expectNoVerticalOverlap(page: Page, options: NoVerticalOverlapOptions): Promise<void> {
    const { selector, label, gapPx = 1 } = options
    const overlaps = await page.evaluate<OverlapDiagnostic[], { selector: string; gap: number }>(
        ({ selector: target, gap }) => {
            const entries = Array.from(document.querySelectorAll<HTMLElement>(target))
                .map((element, index) => {
                    const rect = element.getBoundingClientRect()
                    return {
                        index,
                        top: rect.top,
                        bottom: rect.bottom,
                        text: element.innerText?.replace(/\s+/g, ' ').trim().slice(0, 80) ?? ''
                    }
                })
                .sort((left, right) => left.top - right.top)
            const diagnostics: OverlapDiagnostic[] = []
            for (let index = 1; index < entries.length; index += 1) {
                const previous = entries[index - 1]
                const next = entries[index]
                if (next.top < previous.bottom - gap) {
                    diagnostics.push({ previous, next })
                }
            }
            return diagnostics
        },
        { selector, gap: gapPx }
    )

    expect(overlaps, `${label}: ${selector} cards must not overlap each other`).toEqual([])
    expect(await countMatches(page, selector), `${label}: expected at least two ${selector} cards`).toBeGreaterThanOrEqual(2)
}

export interface ContentContainedOptions {
    cardSelector: string
    contentSelector: string
    label: string
    tolerancePx?: number
}

interface ContainmentDiagnostic {
    index: number
    cardBottom: number
    contentBottom: number
    overflowPx: number
    text: string
}

interface ContainmentScan extends Partial<ContainmentDiagnostic> {
    missingContent: boolean
}

/**
 * Catches the flex-shrink card defect directly: a shrunken card keeps its box
 * height while its content overflows the box (overflow is visible, so
 * scrollHeight alone is not a reliable proof across engines). Every card must
 * fully contain its content element.
 */
export async function expectContentContainedInCards(page: Page, options: ContentContainedOptions): Promise<void> {
    const { cardSelector, contentSelector, label, tolerancePx = 1 } = options
    const diagnostics = await page.evaluate<ContainmentScan[], { cardSelector: string; contentSelector: string; tolerance: number }>(
        ({ cardSelector: card, contentSelector: content, tolerance }) =>
            Array.from(document.querySelectorAll<HTMLElement>(card))
                .map((cardElement, index) => {
                    const contentElement = cardElement.querySelector<HTMLElement>(content)
                    if (!contentElement) return { missingContent: true, index, text: cardElement.textContent?.slice(0, 80) ?? '' }
                    const cardRect = cardElement.getBoundingClientRect()
                    const contentRect = contentElement.getBoundingClientRect()
                    return {
                        missingContent: false,
                        index,
                        cardBottom: Math.round(cardRect.bottom),
                        contentBottom: Math.round(contentRect.bottom),
                        overflowPx: Math.round(contentRect.bottom - cardRect.bottom),
                        text: cardElement.innerText?.replace(/\s+/g, ' ').trim().slice(0, 80) ?? ''
                    }
                })
                .filter((entry) => entry.missingContent || (entry.overflowPx ?? 0) > tolerance),
        { cardSelector, contentSelector, tolerance: tolerancePx }
    )

    expect(
        diagnostics,
        `${label}: every card must render the expected content element and keep it inside the card box (no flex-shrink overflow)`
    ).toEqual([])
    expect(await countMatches(page, cardSelector), `${label}: expected at least one ${cardSelector}`).toBeGreaterThan(0)
}

/**
 * FAQ answers intentionally span the full accordion content width (upstream
 * parity). If typography ever needs a reading-width cap, update this contract
 * together with `FAQ.tsx` instead of silently narrowing the answer.
 */
export interface AnswerWidthOptions {
    itemSelector: string
    answerSelector: string
    label: string
    minRatio?: number
}

interface AnswerWidthMetrics {
    ratios: number[]
}

export async function expectAnswerUsesFullWidth(page: Page, options: AnswerWidthOptions): Promise<void> {
    const { itemSelector, answerSelector, label, minRatio = 0.9 } = options
    const metrics = await page.evaluate<AnswerWidthMetrics | null, { itemSelector: string; answerSelector: string }>(
        ({ itemSelector: item, answerSelector: answer }) => {
            const items = Array.from(document.querySelectorAll<HTMLElement>(item))
            if (items.length === 0) return null
            const ratios: number[] = []
            for (const itemElement of items) {
                const answerElement = itemElement.querySelector<HTMLElement>(answer)
                if (!answerElement) continue
                const container = answerElement.parentElement
                if (!container) continue
                const containerRect = container.getBoundingClientRect()
                const computed = window.getComputedStyle(container)
                const padding = Number.parseFloat(computed.paddingLeft) + Number.parseFloat(computed.paddingRight)
                const contentWidth = containerRect.width - padding
                const answerWidth = answerElement.getBoundingClientRect().width
                if (contentWidth > 0) ratios.push(answerWidth / contentWidth)
            }
            return { ratios }
        },
        { itemSelector, answerSelector }
    )

    expect(metrics, `${label}: expected at least one ${itemSelector} with ${answerSelector}`).not.toBeNull()
    expect(metrics?.ratios.length ?? 0, `${label}: expected at least one rendered ${answerSelector}`).toBeGreaterThan(0)
    const worstRatio = Math.min(...(metrics?.ratios ?? []))
    expect(
        worstRatio,
        `${label}: accordion answers must use the full content width (worst ratio ${worstRatio.toFixed(3)})`
    ).toBeGreaterThanOrEqual(minRatio)
}
