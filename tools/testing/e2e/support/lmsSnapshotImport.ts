import fs from 'node:fs/promises'
import path from 'node:path'
import type { Locator, Page, Response } from '@playwright/test'
import { expect } from '../fixtures/test'
import { toolbarSelectors } from './selectors/contracts'
import { LMS_FIXTURE_FILENAME, assertLmsFixtureEnvelopeContract } from './lmsFixtureContract'

type SnapshotFixture = Record<string, unknown>

function readLocalizedText(value: unknown, locale = 'en'): string | undefined {
    if (typeof value === 'string') {
        return value
    }

    if (!value || typeof value !== 'object' || !('locales' in value)) {
        return undefined
    }

    const localized = value as { _primary?: string; locales?: Record<string, { content?: string }> }
    const normalizedLocale = locale.split(/[-_]/)[0]?.toLowerCase() || 'en'
    const locales = localized.locales ?? {}
    const directValue = locales[normalizedLocale]?.content
    if (typeof directValue === 'string' && directValue.length > 0) {
        return directValue
    }

    const primaryValue = localized._primary ? locales[localized._primary]?.content : undefined
    if (typeof primaryValue === 'string' && primaryValue.length > 0) {
        return primaryValue
    }

    const fallbackValue = Object.values(locales).find((entry) => typeof entry?.content === 'string' && entry.content.length > 0)?.content
    return typeof fallbackValue === 'string' ? fallbackValue : undefined
}

export async function loadLmsSnapshotFixture(): Promise<{ fixturePath: string; metahubName: string }> {
    const fixturePath = path.join(process.cwd(), 'tools', 'fixtures', LMS_FIXTURE_FILENAME)
    const rawFixture = await fs.readFile(fixturePath, 'utf8')
    const fixture = JSON.parse(rawFixture) as SnapshotFixture

    assertLmsFixtureEnvelopeContract(fixture)

    const metahubName = readLocalizedText((fixture as { metahub?: { name?: unknown } }).metahub?.name)
    if (!metahubName) {
        throw new Error('LMS snapshot fixture does not contain a metahub name')
    }

    return { fixturePath, metahubName }
}

async function submitSnapshotImportDialog(page: Page, dialog: Locator): Promise<Response> {
    const importButton = dialog.getByRole('button', { name: /import|импорт/i })
    await expect(importButton).toBeEnabled({ timeout: 120_000 })

    const pendingWaiters: Array<{
        resolve: (response: Response) => void
        reject: (error: Error) => void
        timer: NodeJS.Timeout
    }> = []
    const onResponse = (response: Response) => {
        const request = response.request()
        if (request.method() !== 'POST' || !/\/api\/v1\/metahubs\/import(?:\?|$)/.test(response.url())) return
        const waiter = pendingWaiters.shift()
        if (!waiter) return
        clearTimeout(waiter.timer)
        waiter.resolve(response)
    }
    const waitForNextImportResponse = (timeoutMs: number) =>
        new Promise<Response>((resolve, reject) => {
            const waiter = {
                resolve,
                reject,
                timer: setTimeout(() => {
                    const index = pendingWaiters.indexOf(waiter)
                    if (index >= 0) {
                        pendingWaiters.splice(index, 1)
                    }
                    reject(new Error(`Timed out waiting for metahub import response after ${timeoutMs}ms`))
                }, timeoutMs)
            }
            pendingWaiters.push(waiter)
        })

    page.on('response', onResponse)
    try {
        await importButton.click()
        const response = await waitForNextImportResponse(420_000)
        if (response.status() === 201) return response
        throw new Error(`Snapshot import failed with HTTP ${response.status()}: ${(await response.text()).slice(0, 500)}`)
    } finally {
        page.off('response', onResponse)
    }
}

export async function importLmsSnapshotThroughUi(page: Page): Promise<{
    fixturePath: string
    metahubName: string
    metahubId: string
    publicationId: string
}> {
    const fixture = await loadLmsSnapshotFixture()

    await page.goto('/metahubs')
    const primaryActionBtn = page.getByTestId(toolbarSelectors.primaryAction)
    await expect(primaryActionBtn).toBeVisible({ timeout: 30_000 })

    const dropdownArrow = page.getByTestId(`${toolbarSelectors.primaryAction}-menu-trigger`)
    await dropdownArrow.click()
    const importOption = page.getByRole('menuitem', { name: /import|импорт/i })
    await expect(importOption).toBeVisible({ timeout: 30_000 })
    await importOption.click()

    const dialog = page.getByRole('dialog', { name: /import|импорт/i })
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await dialog.locator('input[type="file"]').setInputFiles(fixture.fixturePath)
    await expect(dialog.getByText(LMS_FIXTURE_FILENAME)).toBeVisible()

    const importResponse = await submitSnapshotImportDialog(page, dialog)
    const importBody = await importResponse.json()
    const metahubId = importBody?.metahub?.id
    const publicationId = importBody?.publication?.id
    if (typeof metahubId !== 'string' || typeof publicationId !== 'string') {
        throw new Error('LMS snapshot import did not return metahub and publication ids')
    }

    await expect(dialog).toHaveCount(0)

    return {
        fixturePath: fixture.fixturePath,
        metahubName: fixture.metahubName,
        metahubId,
        publicationId
    }
}
