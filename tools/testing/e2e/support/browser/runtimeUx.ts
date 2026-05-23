import { expect, type Locator, type Page } from '@playwright/test'

export type TechnicalLeakageOptions = {
    label?: string
    allowTextPatterns?: RegExp[]
    checkUuidOnlyLines?: boolean
    checkUuidSubstrings?: boolean
    checkJsonLikeText?: boolean
    checkInternalValidationText?: boolean
    checkIsoDateText?: boolean
}

export type SemanticFieldControlContract = {
    longTextLabels?: string[]
    forbiddenEditableIdLabels?: string[]
    referenceFieldLabels?: string[]
}

export type RuntimeUxViewport = {
    name: string
    width: number
    height: number
}

export type RuntimeUxViewportMatrixOptions = {
    viewports?: RuntimeUxViewport[]
    beforeEachViewport?: (viewport: RuntimeUxViewport) => Promise<void>
    restoreViewport?: boolean
}

export const RUNTIME_UX_VIEWPORT_MATRIX: RuntimeUxViewport[] = [
    { name: 'desktop-1920', width: 1920, height: 1080 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'mobile-390', width: 390, height: 844 }
]

const UUID_ONLY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UUID_SUBSTRING_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi
const JSON_LIKE_PATTERN =
    /\{[\s\S]{0,700}"(?:type|url|source|blocks|data|_schema|storageKey|mimeType|launchMode|packageDescriptor|recordId|targetId|resourceKey|storagePath|bucket)"\s*:[\s\S]{0,700}\}|\[[\s\S]{0,120}\{[\s\S]{0,700}"(?:type|url|source|blocks|data|_schema|storageKey|mimeType|launchMode|packageDescriptor|recordId|targetId|resourceKey|storagePath|bucket)"\s*:[\s\S]{0,700}\}[\s\S]{0,120}\]|\[object Object\]/i
const INTERNAL_VALIDATION_PATTERN =
    /String must contain|Expected .* received|Invalid input|Required property|required_type|too_small|invalid_type|Zod/i
const ISO_DATETIME_TEXT_PATTERN = /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z\b/

const readVisibleText = async (locator: Locator): Promise<string> =>
    locator.evaluate((node) => {
        const element = node as HTMLElement
        return element.innerText || element.textContent || ''
    })

const isAllowedText = (text: string, allowTextPatterns: RegExp[]) => allowTextPatterns.some((pattern) => pattern.test(text))
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export async function expectNoTechnicalLeakage(surface: Locator, options: TechnicalLeakageOptions = {}): Promise<void> {
    const {
        label = 'Runtime UX surface',
        allowTextPatterns = [],
        checkUuidOnlyLines = true,
        checkUuidSubstrings = false,
        checkJsonLikeText = true,
        checkInternalValidationText = true,
        checkIsoDateText = true
    } = options
    const text = await readVisibleText(surface)
    const lines = text
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
    const issues: string[] = []

    if (checkJsonLikeText && JSON_LIKE_PATTERN.test(text) && !isAllowedText(text, allowTextPatterns)) {
        issues.push('visible raw JSON/object text')
    }

    if (checkInternalValidationText && INTERNAL_VALIDATION_PATTERN.test(text) && !isAllowedText(text, allowTextPatterns)) {
        issues.push('visible internal validation text')
    }

    if (checkIsoDateText && ISO_DATETIME_TEXT_PATTERN.test(text) && !isAllowedText(text, allowTextPatterns)) {
        issues.push('visible raw ISO date/time text')
    }

    if (checkUuidOnlyLines) {
        const uuidLines = lines.filter((line) => UUID_ONLY_PATTERN.test(line) && !isAllowedText(line, allowTextPatterns))
        if (uuidLines.length > 0) {
            issues.push(`visible UUID-only line(s): ${uuidLines.slice(0, 3).join(', ')}`)
        }
    }

    if (checkUuidSubstrings) {
        const uuidMatches = Array.from(text.matchAll(UUID_SUBSTRING_PATTERN))
            .map((match) => match[0])
            .filter((match) => !isAllowedText(match, allowTextPatterns))
        if (uuidMatches.length > 0) {
            issues.push(`visible raw UUID value(s): ${uuidMatches.slice(0, 3).join(', ')}`)
        }
    }

    expect(issues, `${label} must not expose technical leakage`).toEqual([])
}

export async function expectNoVisibleTextPatterns(
    surface: Locator,
    forbiddenPatterns: RegExp[],
    options: { label?: string } = {}
): Promise<void> {
    const { label = 'Runtime UX surface' } = options
    const text = await readVisibleText(surface)
    const matches = forbiddenPatterns.filter((pattern) => pattern.test(text))
    expect(matches, `${label} must not expose forbidden visible text`).toEqual([])
}

export async function expectSemanticFieldControls(dialog: Locator, contract: SemanticFieldControlContract): Promise<void> {
    for (const label of contract.longTextLabels ?? []) {
        const control = dialog.getByLabel(label, { exact: false }).first()
        await expect(control, `${label} must be visible as a form control`).toBeVisible()
        const tagName = await control.evaluate((node) => node.tagName.toLowerCase())
        const ariaMultiline = await control.getAttribute('aria-multiline')
        expect(tagName === 'textarea' || ariaMultiline === 'true', `${label} must be a multiline text control`).toBe(true)
    }

    for (const label of contract.forbiddenEditableIdLabels ?? []) {
        const controls = dialog.getByLabel(label, { exact: false })
        const count = await controls.count()
        for (let index = 0; index < count; index += 1) {
            const control = controls.nth(index)
            const readonly = await control.getAttribute('readonly')
            const disabled = await control.isDisabled().catch(() => false)
            expect(readonly === '' || readonly === 'true' || disabled, `${label} must not be an editable raw ID field`).toBe(true)
        }
    }

    for (const label of contract.referenceFieldLabels ?? []) {
        const labelled = dialog.getByLabel(label, { exact: false }).first()
        const combobox = dialog.getByRole('combobox', { name: new RegExp(escapeRegExp(label), 'i') }).first()
        const visibleLabelled = await labelled.isVisible().catch(() => false)
        const visibleCombobox = await combobox.isVisible().catch(() => false)
        expect(visibleLabelled || visibleCombobox, `${label} must be a visible picker or labelled reference control`).toBe(true)
    }
}

export async function expectLocalizedValidation(
    surface: Locator,
    locale: 'en' | 'ru',
    options: { label?: string; forbiddenPatterns?: RegExp[] } = {}
): Promise<void> {
    const { label = 'Localized validation surface', forbiddenPatterns = [] } = options
    const text = await readVisibleText(surface)
    const defaultForbidden =
        locale === 'ru'
            ? [INTERNAL_VALIDATION_PATTERN, /String must contain|This resource source is not valid|Invalid input/i]
            : [INTERNAL_VALIDATION_PATTERN]
    const matches = [...defaultForbidden, ...forbiddenPatterns].filter((pattern) => pattern.test(text))
    expect(matches, `${label} must not expose internal validation text for ${locale}`).toEqual([])
}

export async function expectNoPageHorizontalOverflow(page: Page, label: string): Promise<void> {
    const overflowPx = await page.evaluate(() => {
        const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0)
        const viewportWidth = Math.max(document.documentElement.clientWidth, document.body?.clientWidth ?? 0)
        return Math.max(0, documentWidth - viewportWidth)
    })
    expect(overflowPx, `${label} must not create horizontal page overflow`).toBeLessThanOrEqual(1)
}

export async function expectNoDataGridTechnicalLeakage(
    surface: Locator,
    options: TechnicalLeakageOptions & { label?: string } = {}
): Promise<void> {
    const grids = surface.locator('.MuiDataGrid-root')
    const gridCount = await grids.count()

    for (let index = 0; index < gridCount; index += 1) {
        const grid = grids.nth(index)
        const scroller = grid.locator('.MuiDataGrid-virtualScroller').first()
        const scrollPoints = await scroller
            .evaluate((node) => {
                const element = node as HTMLElement
                const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth)
                return Array.from(new Set([0, Math.floor(maxScrollLeft / 2), maxScrollLeft]))
            })
            .catch(() => [0])

        for (const scrollLeft of scrollPoints) {
            await scroller
                .evaluate((node, nextScrollLeft) => {
                    ;(node as HTMLElement).scrollLeft = nextScrollLeft
                }, scrollLeft)
                .catch(() => undefined)
            await waitForLayoutFrame(surface.page())
            await expectNoTechnicalLeakage(grid, {
                ...options,
                label: `${options.label ?? 'Runtime UX surface'} DataGrid #${index} at scrollLeft ${scrollLeft}`,
                checkUuidSubstrings: options.checkUuidSubstrings ?? true
            })
        }
    }
}

export async function expectDataGridHorizontalScrollConstrained(page: Page, label: string): Promise<void> {
    const metrics = await page.locator('.MuiDataGrid-root').evaluateAll((nodes) => {
        const viewportWidth = document.documentElement.clientWidth
        const pageOverflowPx = Math.max(0, document.documentElement.scrollWidth - viewportWidth)

        return nodes
            .map((node, index) => {
                const root = node as HTMLElement
                const rootRect = root.getBoundingClientRect()
                const scroller = root.querySelector('.MuiDataGrid-virtualScroller') as HTMLElement | null
                const scrollerOverflowPx = scroller ? Math.max(0, scroller.scrollWidth - scroller.clientWidth) : 0

                return {
                    index,
                    visible: rootRect.width > 0 && rootRect.height > 0,
                    pageOverflowPx,
                    rootLeft: rootRect.left,
                    rootRight: rootRect.right,
                    viewportWidth,
                    scrollerOverflowPx,
                    scrollerClientWidth: scroller?.clientWidth ?? 0,
                    scrollerScrollWidth: scroller?.scrollWidth ?? 0
                }
            })
            .filter((item) => item.visible)
    })

    for (const metric of metrics) {
        expect(metric.rootLeft, `${label} DataGrid #${metric.index} must start inside the viewport`).toBeGreaterThanOrEqual(-1)
        expect(metric.rootRight, `${label} DataGrid #${metric.index} must fit inside the viewport`).toBeLessThanOrEqual(
            metric.viewportWidth + 1
        )

        if (metric.scrollerOverflowPx > 1) {
            expect(
                metric.pageOverflowPx,
                `${label} DataGrid #${metric.index} may scroll internally (${metric.scrollerClientWidth}/${metric.scrollerScrollWidth}) but must not widen the page`
            ).toBeLessThanOrEqual(1)
        }
    }
}

const waitForLayoutFrame = async (page: Page) =>
    page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

export async function expectRuntimeUxViewportMatrix(
    page: Page,
    label: string,
    options: RuntimeUxViewportMatrixOptions = {}
): Promise<void> {
    const { viewports = RUNTIME_UX_VIEWPORT_MATRIX, beforeEachViewport, restoreViewport = true } = options
    const originalViewport = page.viewportSize()

    try {
        for (const viewport of viewports) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height })
            await waitForLayoutFrame(page)
            await beforeEachViewport?.(viewport)
            await expectNoPageHorizontalOverflow(page, `${label} at ${viewport.name} ${viewport.width}x${viewport.height}`)
        }
    } finally {
        if (restoreViewport && originalViewport) {
            await page.setViewportSize(originalViewport)
            await waitForLayoutFrame(page)
        }
    }
}

export async function expectElementFitsViewport(page: Page, testId: string, label: string): Promise<void> {
    await expectLocatorFitsViewport(page.getByTestId(testId).first(), label)
}

export async function expectLocatorFitsViewport(locator: Locator, label: string): Promise<void> {
    const box = await locator.boundingBox()
    expect(box, `${label} must be rendered`).not.toBeNull()
    if (!box) return

    const viewport = locator.page().viewportSize()
    expect(viewport, `${label} requires a viewport`).not.toBeNull()
    if (!viewport) return

    expect(box.x, `${label} must start inside the viewport`).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width, `${label} must fit inside the viewport`).toBeLessThanOrEqual(viewport.width + 1)
}

export async function expectLocatorHasNoInlineOverflow(locator: Locator, label: string): Promise<void> {
    await expect(locator, `${label} must be visible before inline overflow assertions`).toBeVisible()
    const overflow = await locator.evaluate((node) => {
        const element = node as HTMLElement
        return Math.max(0, element.scrollWidth - element.clientWidth)
    })

    expect(overflow, `${label} must not clip its own inline content`).toBeLessThanOrEqual(1)
}
