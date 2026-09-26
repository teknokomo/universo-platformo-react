import { expect, type Locator, type Page } from '@playwright/test'

export type TechnicalLeakageOptions = {
    label?: string
    allowTextPatterns?: RegExp[]
    checkUuidOnlyLines?: boolean
    checkUuidSubstrings?: boolean
    checkJsonLikeText?: boolean
    checkInternalValidationText?: boolean
    checkIsoDateText?: boolean
    forbiddenVisibleTextPatterns?: RegExp[]
}

export type DataGridTechnicalLeakageOptions = TechnicalLeakageOptions & {
    label?: string
    requireVisibleGrid?: boolean
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

export type BrowserRuntimeIssue = {
    source: 'console' | 'pageerror'
    text: string
    url?: string
}

const EXPECTED_CONFLICT_RESOURCE_ERROR = 'Failed to load resource: the server responded with a status of 409 (Conflict)'

export const isExpectedConflictResourceFailure = (issue: BrowserRuntimeIssue, expectedUrls: readonly string[]): boolean =>
    issue.source === 'console' && issue.text === EXPECTED_CONFLICT_RESOURCE_ERROR && Boolean(issue.url && expectedUrls.includes(issue.url))

export type StrictRuntimeUxOptions = {
    label: string
    locale: 'en' | 'ru'
    longTextLabels?: string[]
    allowTextPatterns?: RegExp[]
    forbiddenVisibleTextPatterns?: RegExp[]
}

export const RUNTIME_UX_VIEWPORT_MATRIX: RuntimeUxViewport[] = [
    { name: 'desktop-1920', width: 1920, height: 1080 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'mobile-390', width: 390, height: 844 }
]

const UUID_ONLY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UUID_SUBSTRING_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi
const JSON_LIKE_PATTERN =
    /(?:^|[\s:=])\{\s*"[^"\n]{1,120}"\s*:\s*(?:"|-|\d|\{|\[|true\b|false\b|null\b)[\s\S]{0,700}\}|(?:^|[\s:=])\[\s*\{\s*"[^"\n]{1,120}"\s*:\s*(?:"|-|\d|\{|\[|true\b|false\b|null\b)[\s\S]{0,700}\}[\s\S]{0,120}\]|\[object Object\]/i
const INTERNAL_VALIDATION_PATTERN =
    /String must contain|Expected .* received|Invalid input|Required property|required_type|too_small|invalid_type|Zod/i
const ENGLISH_VALIDATION_FALLBACK_PATTERN =
    /^(?:required|this field is required|.+\b(?:is required|is a required field)|please\s+(?:enter|select|choose)\b.*)[.!?]?\s*$/i
const ISO_DATETIME_TEXT_PATTERN = /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z\b/
const RAW_STRUCTURED_VALUE_PATTERNS = [
    /\[object (?:Object|Array)\]/i,
    /(?:^|[\s:=])\{\s*"(?:kind|href|path|target|type|url|src|alt|source|blocks|data|recordId|targetId|resourceKey|storagePath|mimeType)"\s*:/im,
    /(?:^|\n)\s*\{\s*(?:\n\s*)?"[^"\n]{1,120}"\s*:/m,
    /(?:^|\n)\s*\[\s*(?:\n\s*)?\{\s*(?:\n\s*)?"[^"\n]{1,120}"\s*:/m
]
const INTERNAL_ERROR_CODE_PATTERN = /\b(?:APPLICATION|METAHUB|LAYOUT|VALIDATION|ZOD|INTERNAL)_[A-Z0-9_]+\b/

const readVisibleText = async (locator: Locator): Promise<string> =>
    locator.evaluate((node) => {
        const root = node as HTMLElement
        const isVisible = (element: HTMLElement): boolean => {
            const rect = element.getBoundingClientRect()
            const style = window.getComputedStyle(element)
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
        }
        const contentNodes = [
            ...(root.matches(
                '[aria-label], [aria-description], [title], img[alt], input:not([type="hidden"]):not([type="password"]), textarea'
            )
                ? [root]
                : []),
            ...Array.from(
                root.querySelectorAll<HTMLElement>(
                    '[aria-label], [aria-description], [title], img[alt], input:not([type="hidden"]):not([type="password"]), textarea'
                )
            )
        ]
        const accessibleContent = contentNodes
            .filter(isVisible)
            .flatMap((element) => [
                element.matches('input, textarea') ? String((element as HTMLInputElement | HTMLTextAreaElement).value ?? '') : '',
                element.getAttribute('aria-label') ?? '',
                element.getAttribute('aria-description') ?? '',
                element.getAttribute('placeholder') ?? '',
                element.getAttribute('title') ?? '',
                element.matches('img') ? element.getAttribute('alt') ?? '' : ''
            ])
            .filter(Boolean)
        return [root.innerText || root.textContent || '', ...accessibleContent].filter(Boolean).join('\n')
    })

const isAllowedText = (text: string, allowTextPatterns: RegExp[]) => allowTextPatterns.some((pattern) => pattern.test(text))
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const matchesPattern = (pattern: RegExp, value: string): boolean => {
    pattern.lastIndex = 0
    return pattern.test(value)
}

export const watchBrowserRuntimeIssues = (page: Page): BrowserRuntimeIssue[] => {
    const issues: BrowserRuntimeIssue[] = []

    page.on('console', (message) => {
        if (message.type() !== 'error') return
        const location = message.location()
        issues.push({ source: 'console', text: message.text(), url: location.url || undefined })
    })
    page.on('pageerror', (error) => {
        issues.push({ source: 'pageerror', text: error.message })
    })

    return issues
}

export function expectNoUnexpectedBrowserRuntimeIssues(
    issues: BrowserRuntimeIssue[],
    label: string,
    options: { allowTextPatterns?: RegExp[]; allowExpectedConflictResourceUrls?: readonly string[] } = {}
): void {
    const allowTextPatterns = options.allowTextPatterns ?? []
    const unexpected = issues.filter(
        (issue) =>
            !isExpectedConflictResourceFailure(issue, options.allowExpectedConflictResourceUrls ?? []) &&
            !allowTextPatterns.some((pattern) => matchesPattern(pattern, `${issue.text}\n${issue.url ?? ''}`))
    )

    expect(unexpected, `${label} must not emit unexpected console errors or page errors`).toEqual([])
}

const collectTechnicalLeakageIssues = (text: string, options: Required<TechnicalLeakageOptions>): string[] => {
    const {
        allowTextPatterns,
        checkUuidOnlyLines,
        checkUuidSubstrings,
        checkJsonLikeText,
        checkInternalValidationText,
        checkIsoDateText,
        forbiddenVisibleTextPatterns
    } = options
    const lines = text
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
    const issues: string[] = []

    const containsRawStructuredValue =
        JSON_LIKE_PATTERN.test(text) || RAW_STRUCTURED_VALUE_PATTERNS.some((pattern) => matchesPattern(pattern, text))
    if (checkJsonLikeText && containsRawStructuredValue && !isAllowedText(text, allowTextPatterns)) {
        issues.push('visible raw JSON/object text')
    }

    if (checkInternalValidationText && INTERNAL_VALIDATION_PATTERN.test(text) && !isAllowedText(text, allowTextPatterns)) {
        issues.push('visible internal validation text')
    }

    if (checkIsoDateText && ISO_DATETIME_TEXT_PATTERN.test(text) && !isAllowedText(text, allowTextPatterns)) {
        issues.push('visible raw ISO date/time text')
    }

    const forbiddenMatches = forbiddenVisibleTextPatterns.filter((pattern) => pattern.test(text) && !isAllowedText(text, allowTextPatterns))
    if (forbiddenMatches.length > 0) {
        issues.push(
            `visible forbidden technical label(s): ${forbiddenMatches
                .map((pattern) => pattern.source)
                .slice(0, 3)
                .join(', ')}`
        )
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

    return issues
}

const normalizeTechnicalLeakageOptions = (options: TechnicalLeakageOptions = {}): Required<TechnicalLeakageOptions> => ({
    label: options.label ?? 'Runtime UX surface',
    allowTextPatterns: options.allowTextPatterns ?? [],
    checkUuidOnlyLines: options.checkUuidOnlyLines ?? true,
    checkUuidSubstrings: options.checkUuidSubstrings ?? false,
    checkJsonLikeText: options.checkJsonLikeText ?? true,
    checkInternalValidationText: options.checkInternalValidationText ?? true,
    checkIsoDateText: options.checkIsoDateText ?? true,
    forbiddenVisibleTextPatterns: options.forbiddenVisibleTextPatterns ?? []
})

export async function expectNoTechnicalLeakage(surface: Locator, options: TechnicalLeakageOptions = {}): Promise<void> {
    const {
        label = 'Runtime UX surface',
        allowTextPatterns = [],
        checkUuidOnlyLines = true,
        checkUuidSubstrings = false,
        checkJsonLikeText = true,
        checkInternalValidationText = true,
        checkIsoDateText = true,
        forbiddenVisibleTextPatterns = []
    } = options
    const text = await readVisibleText(surface)
    const issues = collectTechnicalLeakageIssues(text, {
        label,
        allowTextPatterns,
        checkUuidOnlyLines,
        checkUuidSubstrings,
        checkJsonLikeText,
        checkInternalValidationText,
        checkIsoDateText,
        forbiddenVisibleTextPatterns
    })

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
        const controls = dialog.getByLabel(label, { exact: false })
        let visibleCount = 0
        for (let index = 0; index < (await controls.count()); index += 1) {
            const control = controls.nth(index)
            if (!(await control.isVisible().catch(() => false))) continue
            visibleCount += 1
            const tagName = await control.evaluate((node) => node.tagName.toLowerCase())
            const ariaMultiline = await control.getAttribute('aria-multiline')
            expect(tagName === 'textarea' || ariaMultiline === 'true', `${label} control #${index + 1} must be multiline`).toBe(true)
        }
        expect(visibleCount, `${label} must expose at least one visible multiline form control`).toBeGreaterThan(0)
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
    const matches = [...defaultForbidden, ...forbiddenPatterns].filter((pattern) => matchesPattern(pattern, text))
    if (locale === 'ru') {
        const messages = await surface
            .locator('[role="alert"], [aria-live="assertive"], [aria-live="polite"], .MuiFormHelperText-root.Mui-error')
            .evaluateAll((nodes) =>
                nodes
                    .filter((node) => {
                        const element = node as HTMLElement
                        const rect = element.getBoundingClientRect()
                        const style = window.getComputedStyle(element)
                        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
                    })
                    .map((node) => node.textContent?.trim() ?? '')
                    .filter(Boolean)
            )
        for (const message of messages) {
            if (matchesPattern(ENGLISH_VALIDATION_FALLBACK_PATTERN, message)) matches.push(ENGLISH_VALIDATION_FALLBACK_PATTERN)
        }
    }
    expect(matches, `${label} must not expose internal validation text for ${locale}`).toEqual([])
}

export async function expectStrictRuntimeUxSurface(surface: Locator, options: StrictRuntimeUxOptions): Promise<void> {
    const { label, locale, longTextLabels = [], allowTextPatterns = [], forbiddenVisibleTextPatterns = [] } = options

    await expectNoTechnicalLeakage(surface, {
        label,
        allowTextPatterns,
        checkUuidOnlyLines: true,
        checkUuidSubstrings: true,
        checkJsonLikeText: true,
        checkInternalValidationText: true,
        checkIsoDateText: true,
        forbiddenVisibleTextPatterns
    })

    const text = await readVisibleText(surface)
    const rawStructuredMatches = RAW_STRUCTURED_VALUE_PATTERNS.filter(
        (pattern) => matchesPattern(pattern, text) && !allowTextPatterns.some((allowPattern) => matchesPattern(allowPattern, text))
    )
    expect(rawStructuredMatches, `${label} must render structured values semantically instead of exposing raw JSON/object text`).toEqual([])
    expect(matchesPattern(INTERNAL_ERROR_CODE_PATTERN, text), `${label} must not expose internal error codes`).toBe(false)

    await expectLocalizedValidation(surface, locale, { label })
    if (longTextLabels.length > 0) {
        await expectSemanticFieldControls(surface, { longTextLabels })
    }
    await expectNoPageHorizontalOverflow(surface.page(), label)
}

export async function expectNoPageHorizontalOverflow(page: Page, label: string): Promise<void> {
    const overflowDiagnostics = await page.evaluate(() => {
        const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0)
        const viewportWidth = Math.max(document.documentElement.clientWidth, document.body?.clientWidth ?? 0)
        const overflowingElements = Array.from(document.querySelectorAll<HTMLElement>('body *'))
            .map((element) => {
                const rect = element.getBoundingClientRect()
                const computed = window.getComputedStyle(element)
                return {
                    tag: element.tagName.toLowerCase(),
                    id: element.id || null,
                    testId: element.getAttribute('data-testid'),
                    role: element.getAttribute('role'),
                    className: typeof element.className === 'string' ? element.className.slice(0, 160) : null,
                    text: element.innerText?.replace(/\s+/g, ' ').trim().slice(0, 160) || null,
                    left: Math.round(rect.left),
                    right: Math.round(rect.right),
                    width: Math.round(rect.width),
                    scrollWidth: element.scrollWidth,
                    clientWidth: element.clientWidth,
                    position: computed.position,
                    overflowX: computed.overflowX
                }
            })
            .filter((entry) => entry.right > viewportWidth + 1 || entry.scrollWidth > entry.clientWidth + 1)
            .sort(
                (left, right) =>
                    Math.max(right.right - viewportWidth, right.scrollWidth - right.clientWidth) -
                    Math.max(left.right - viewportWidth, left.scrollWidth - left.clientWidth)
            )
            .slice(0, 8)
        return {
            overflowPx: Math.max(0, documentWidth - viewportWidth),
            documentWidth,
            viewportWidth,
            bodyScrollWidth: document.body?.scrollWidth ?? 0,
            bodyClientWidth: document.body?.clientWidth ?? 0,
            documentElementScrollWidth: document.documentElement.scrollWidth,
            documentElementClientWidth: document.documentElement.clientWidth,
            overflowingElements
        }
    })
    expect(
        overflowDiagnostics.overflowPx,
        `${label} must not create horizontal page overflow. Diagnostics: ${JSON.stringify(overflowDiagnostics)}`
    ).toBeLessThanOrEqual(1)
}

export async function expectNoDataGridTechnicalLeakage(surface: Locator, options: DataGridTechnicalLeakageOptions = {}): Promise<void> {
    const normalizedOptions = normalizeTechnicalLeakageOptions({
        ...options,
        checkUuidSubstrings: options.checkUuidSubstrings ?? true
    })
    const { requireVisibleGrid = false } = options
    const grids = surface.locator('.MuiDataGrid-root')
    const gridCount = await grids.count()
    let visibleGridCount = 0

    for (let index = 0; index < gridCount; index += 1) {
        const grid = grids.nth(index)
        const visible = await grid.evaluate((node) => {
            const element = node as HTMLElement
            const rect = element.getBoundingClientRect()
            const style = window.getComputedStyle(element)
            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
        })
        if (!visible) {
            continue
        }
        visibleGridCount += 1

        const scroller = grid.locator('.MuiDataGrid-virtualScroller').first()
        const scrollerCount = await scroller.count()
        expect(
            scrollerCount,
            `${normalizedOptions.label ?? 'Runtime UX surface'} DataGrid #${index} must expose its virtual scroller`
        ).toBeGreaterThan(0)
        const scrollPoints = await scroller.evaluate((node) => {
            const element = node as HTMLElement
            const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth)
            return Array.from(new Set([0, Math.floor(maxScrollLeft / 2), maxScrollLeft]))
        })

        for (const scrollLeft of scrollPoints) {
            await scroller.evaluate((node, nextScrollLeft) => {
                ;(node as HTMLElement).scrollLeft = nextScrollLeft
            }, scrollLeft)
            await waitForLayoutFrame(surface.page())
            const actualScrollLeft = await scroller.evaluate((node) => (node as HTMLElement).scrollLeft)
            expect(
                Math.abs(actualScrollLeft - scrollLeft),
                `${
                    normalizedOptions.label ?? 'Runtime UX surface'
                } DataGrid #${index} must reach scrollLeft ${scrollLeft} before its visible cells are inspected`
            ).toBeLessThanOrEqual(1)
            const text = await readVisibleText(grid)
            const issues = collectTechnicalLeakageIssues(text, normalizedOptions)
            expect(
                issues,
                `${
                    normalizedOptions.label ?? 'Runtime UX surface'
                } DataGrid #${index} at scrollLeft ${scrollLeft} must not expose technical leakage`
            ).toEqual([])
        }

        await scroller.evaluate((node) => {
            ;(node as HTMLElement).scrollLeft = 0
        })
        await waitForLayoutFrame(surface.page())
    }

    if (requireVisibleGrid) {
        expect(
            visibleGridCount,
            `${normalizedOptions.label ?? 'Runtime UX surface'} must contain at least one visible DataGrid`
        ).toBeGreaterThan(0)
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
    expect(metrics.length, `${label} must contain at least one visible DataGrid`).toBeGreaterThan(0)

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

/**
 * Verify that a FlowListTable keeps optional horizontal scrolling inside its
 * named table container instead of widening the document.
 *
 * The caller supplies the existing FlowListTable container locator. This
 * helper deliberately does not choose a product selector or test id.
 */
export async function expectTableHorizontalScrollConstrained(surface: Locator, label: string): Promise<void> {
    await expect(surface, `${label} must contain a visible FlowListTable surface`).toBeVisible()

    const metrics = await surface.evaluate((node) => {
        const root = node as HTMLElement
        const table = root.matches('table') ? root : root.querySelector('table')
        const viewportWidth = document.documentElement.clientWidth
        const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0)
        const rootRect = root.getBoundingClientRect()
        const rootStyle = window.getComputedStyle(root)

        return {
            hasTable: Boolean(table),
            viewportWidth,
            pageOverflowPx: Math.max(0, documentWidth - viewportWidth),
            rootLeft: rootRect.left,
            rootRight: rootRect.right,
            rootClientWidth: root.clientWidth,
            rootScrollWidth: root.scrollWidth,
            rootOverflowPx: Math.max(0, root.scrollWidth - root.clientWidth),
            overflowX: rootStyle.overflowX,
            tableScrollWidth: table?.scrollWidth ?? 0
        }
    })

    expect(metrics.hasTable, `${label} must contain a semantic table`).toBe(true)
    expect(metrics.rootLeft, `${label} must start inside the viewport`).toBeGreaterThanOrEqual(-1)
    expect(metrics.rootRight, `${label} must fit inside the viewport`).toBeLessThanOrEqual(metrics.viewportWidth + 1)
    expect(metrics.pageOverflowPx, `${label} must not widen the page`).toBeLessThanOrEqual(1)

    if (metrics.rootOverflowPx > 1 || metrics.tableScrollWidth > metrics.rootClientWidth + 1) {
        expect(['auto', 'scroll'], `${label} may scroll only inside its named container`).toContain(metrics.overflowX)
    }
}

export const waitForLayoutFrame = async (page: Page) =>
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

export async function expectLocatorFullyFitsViewport(locator: Locator, label: string): Promise<void> {
    await expectLocatorFitsViewport(locator, label)
    const box = await locator.boundingBox()
    const viewport = locator.page().viewportSize()
    expect(box, `${label} must be rendered`).not.toBeNull()
    expect(viewport, `${label} requires a viewport`).not.toBeNull()
    if (!box || !viewport) return

    expect(box.y, `${label} must start inside the viewport vertically`).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height, `${label} must fit inside the viewport vertically`).toBeLessThanOrEqual(viewport.height + 1)
}

export async function expectTextOnSingleLine(locator: Locator, label: string): Promise<void> {
    await expect(locator, `${label} must be visible before text layout checks`).toBeVisible()
    const metrics = await locator.evaluate((node) => {
        const element = node as HTMLElement
        const text = element.innerText.replace(/\s+/g, ' ').trim()
        const elementBounds = element.getBoundingClientRect()
        const lineCenters: number[] = []
        let clipped = false
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)

        while (walker.nextNode()) {
            const textNode = walker.currentNode
            if (!textNode.textContent?.trim()) continue

            const range = document.createRange()
            range.selectNodeContents(textNode)
            for (const rect of Array.from(range.getClientRects())) {
                if (rect.width <= 0 || rect.height <= 0) continue

                const center = rect.top + rect.height / 2
                if (!lineCenters.some((knownCenter) => Math.abs(knownCenter - center) < 3)) lineCenters.push(center)
                if (
                    rect.left < elementBounds.left - 1 ||
                    rect.right > elementBounds.right + 1 ||
                    rect.top < elementBounds.top - 1 ||
                    rect.bottom > elementBounds.bottom + 1
                ) {
                    clipped = true
                }

                let ancestor = textNode.parentElement
                while (ancestor && element.contains(ancestor)) {
                    const style = window.getComputedStyle(ancestor)
                    const bounds = ancestor.getBoundingClientRect()
                    const clipsX = style.overflowX !== 'visible' && style.overflowX !== 'unset'
                    const clipsY = style.overflowY !== 'visible' && style.overflowY !== 'unset'

                    if (
                        (clipsX &&
                            (rect.left < bounds.left - 1 ||
                                rect.right > bounds.right + 1 ||
                                ancestor.scrollWidth > ancestor.clientWidth + 1)) ||
                        (clipsY &&
                            (rect.top < bounds.top - 1 ||
                                rect.bottom > bounds.bottom + 1 ||
                                ancestor.scrollHeight > ancestor.clientHeight + 1)) ||
                        (style.textOverflow === 'ellipsis' && ancestor.scrollWidth > ancestor.clientWidth + 1)
                    ) {
                        clipped = true
                    }

                    const lineClamp = Number.parseInt(style.webkitLineClamp, 10)
                    if (Number.isFinite(lineClamp) && lineClamp > 0 && ancestor.scrollHeight > ancestor.clientHeight + 1) clipped = true
                    if (ancestor === element) break
                    ancestor = ancestor.parentElement
                }
            }
        }

        return { text, visualLines: lineCenters.length, clipped }
    })

    expect(metrics.text, `${label} must contain visible text`).not.toBe('')
    expect(metrics.visualLines, `${label} must occupy exactly one visual line`).toBe(1)
    expect(metrics.clipped, `${label} text must not be clipped`).toBe(false)
}

export async function expectLocatorHasNoInlineOverflow(locator: Locator, label: string): Promise<void> {
    await expect(locator, `${label} must be visible before inline overflow assertions`).toBeVisible()
    const overflow = await locator.evaluate((node) => {
        const element = node as HTMLElement
        return Math.max(0, element.scrollWidth - element.clientWidth)
    })

    expect(overflow, `${label} must not clip its own inline content`).toBeLessThanOrEqual(1)
}
