import { expect } from '../fixtures/test'
import { createLoggedInApiContext, disposeApiContext, listLayouts, listObjectCollections } from './backend/api-session.mjs'
import { expectNoTechnicalLeakage } from './browser/runtimeUx'

export function readCodename(value: unknown): string {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
    const record = value as { locales?: Record<string, { content?: unknown }>; _primary?: unknown }
    const primary = typeof record._primary === 'string' ? record._primary : 'en'
    const primaryContent = record.locales?.[primary]?.content
    if (typeof primaryContent === 'string') return primaryContent
    const englishContent = record.locales?.en?.content
    return typeof englishContent === 'string' ? englishContent : ''
}

export async function waitForLayoutId(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, metahubId: string) {
    let layoutId: string | undefined

    await expect
        .poll(async () => {
            const response = await listLayouts(api, metahubId, { limit: 20, offset: 0 })
            layoutId = response?.items?.[0]?.id
            return typeof layoutId === 'string'
        })
        .toBe(true)

    if (!layoutId) {
        throw new Error(`No layout was returned for metahub ${metahubId}`)
    }

    return layoutId
}

export async function waitForObjectId(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, metahubId: string) {
    let objectCollectionId: string | undefined

    await expect
        .poll(async () => {
            const response = await listObjectCollections(api, metahubId, { limit: 100, offset: 0 })
            objectCollectionId = response?.items?.[0]?.id
            return typeof objectCollectionId === 'string'
        })
        .toBe(true)

    if (!objectCollectionId) {
        throw new Error(`No objectCollection was returned for metahub ${metahubId}`)
    }

    return objectCollectionId
}

export async function waitForUser(credentials: { email: string; password: string }): Promise<void> {
    await expect
        .poll(async () => {
            try {
                const api = await createLoggedInApiContext(credentials)
                await disposeApiContext(api)
                return true
            } catch {
                return false
            }
        })
        .toBe(true)
}

export async function expectNoDashboardRuntimeHandles(
    surface: Parameters<typeof expectNoTechnicalLeakage>[0],
    label: string,
    options: { checkJsonLikeText?: boolean } = {}
) {
    await expectNoTechnicalLeakage(surface, {
        label,
        checkUuidSubstrings: true,
        checkJsonLikeText: options.checkJsonLikeText ?? true,
        forbiddenVisibleTextPatterns: [/\brh1\.[A-Za-z0-9_-]+\b/u]
    })

    const controlValues = await surface.locator('input:not([type="hidden"]), textarea, [contenteditable="true"]').evaluateAll((controls) =>
        controls.map((control) => {
            if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) return control.value
            return control.textContent ?? ''
        })
    )
    const serializedControlValues = controlValues.join('\n')
    expect(serializedControlValues, `${label} control values must not expose UUIDs`).not.toMatch(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/iu
    )
    expect(serializedControlValues, `${label} control values must not expose runtime record handles`).not.toMatch(
        /\brh1\.[A-Za-z0-9_-]+\b/u
    )
    expect(serializedControlValues, `${label} control values must not expose internal user handles`).not.toMatch(
        /\busr_internal_[A-Za-z0-9_-]+\b/u
    )
}
