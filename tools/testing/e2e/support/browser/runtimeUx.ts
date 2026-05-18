import { expect, type Locator, type Page } from '@playwright/test'

export type TechnicalLeakageOptions = {
    label?: string
    allowTextPatterns?: RegExp[]
    checkUuidOnlyLines?: boolean
    checkJsonLikeText?: boolean
    checkInternalValidationText?: boolean
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
const JSON_LIKE_PATTERN = /\{[^{}]*(?:"(?:type|url|source|blocks|data|_schema)"\s*:)[\s\S]{0,700}\}|\[object Object\]/i
const INTERNAL_VALIDATION_PATTERN =
    /String must contain|Expected .* received|Invalid input|Required property|required_type|too_small|invalid_type|Zod/i

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
        checkJsonLikeText = true,
        checkInternalValidationText = true
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

    if (checkUuidOnlyLines) {
        const uuidLines = lines.filter((line) => UUID_ONLY_PATTERN.test(line) && !isAllowedText(line, allowTextPatterns))
        if (uuidLines.length > 0) {
            issues.push(`visible UUID-only line(s): ${uuidLines.slice(0, 3).join(', ')}`)
        }
    }

    expect(issues, `${label} must not expose technical leakage`).toEqual([])
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
    const overflowPx = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth))
    expect(overflowPx, `${label} must not create horizontal page overflow`).toBeLessThanOrEqual(1)
}

export async function expectRuntimeUxViewportMatrix(
    page: Page,
    label: string,
    options: RuntimeUxViewportMatrixOptions = {}
): Promise<void> {
    const { viewports = RUNTIME_UX_VIEWPORT_MATRIX, beforeEachViewport, restoreViewport = true } = options
    const originalViewport = page.viewportSize()

    for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
        await beforeEachViewport?.(viewport)
        await expectNoPageHorizontalOverflow(page, `${label} at ${viewport.name} ${viewport.width}x${viewport.height}`)
    }

    if (restoreViewport && originalViewport) {
        await page.setViewportSize(originalViewport)
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    }
}

export async function expectElementFitsViewport(page: Page, testId: string, label: string): Promise<void> {
    const box = await page.getByTestId(testId).boundingBox()
    expect(box, `${label} must be rendered`).not.toBeNull()
    if (!box) return

    const viewport = page.viewportSize()
    expect(viewport, `${label} requires a viewport`).not.toBeNull()
    if (!viewport) return

    expect(box.x, `${label} must start inside the viewport`).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width, `${label} must fit inside the viewport`).toBeLessThanOrEqual(viewport.width + 1)
}
