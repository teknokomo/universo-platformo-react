import { expect, test } from '../../fixtures/test'
import type { Locator, Page, Request } from '@playwright/test'
import { createLoggedInApiContext, disposeApiContext } from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { loginThroughUi } from '../../support/browser/auth'
import { switchRuntimeLocale } from '../../support/browser/preferences'
import { expectLocalizedValidation, expectNoPageHorizontalOverflow } from '../../support/browser/runtimeUx'
import { INTERPRETATION_NETWORK_FIXTURE_FILENAME } from '../../support/interpretationNetworkFixtureContract'
import { importInterpretationNetworkSnapshot } from '../../support/interpretationNetworkSnapshotImport'
import {
    ensureSystemStructure,
    expectSingleSystemMatrix,
    getMatrixRows,
    openStructures,
    resolveRuntimeIds,
    setInterpretationNetworkWidgetConfig
} from '../../support/interpretationNetworkFocused'

const validationLabels = {
    en: {
        addCell: 'Add',
        dialog: 'Add cell',
        title: 'Title',
        submit: 'Create',
        required: 'This field is required.'
    },
    ru: {
        addCell: 'Добавить',
        dialog: 'Добавить ячейку',
        title: 'Название',
        submit: 'Создать',
        required: 'Заполните это поле.'
    }
} as const

const tabUntilFocused = async (page: Page, target: Locator, label: string) => {
    for (let index = 0; index < 40; index += 1) {
        if (await target.evaluate((element) => element === document.activeElement)) return
        await page.keyboard.press('Tab')
    }
    throw new Error(`Keyboard Tab navigation did not reach ${label}`)
}

test('@matrix @interpretation-network Interpretation Network editable cell validation is localized', async ({
    browser,
    runManifest
}, testInfo) => {
    test.skip(!['en-light', 'ru-light'].includes(testInfo.project.name), 'Editable-form locale acceptance runs in en-light and ru-light')
    test.setTimeout(180_000)

    const locale = testInfo.project.name === 'ru-light' ? 'ru' : 'en'
    const labels = validationLabels[locale]
    const api = await createLoggedInApiContext(runManifest.testUser)
    let context: Awaited<ReturnType<typeof browser.newContext>> | null = null

    try {
        const imported = await importInterpretationNetworkSnapshot(api, {
            snapshotFilename: INTERPRETATION_NETWORK_FIXTURE_FILENAME,
            label: `localized-validation-${locale}-${runManifest.runId}`
        })
        await recordCreatedMetahub({
            id: imported.metahub.id,
            name: `Interpretation Network localized validation (${locale})`,
            codename: `interpretation-network-localized-validation-${locale}-${runManifest.runId}`
        })
        await recordCreatedPublication({ id: imported.publication.id, metahubId: imported.metahub.id })
        await recordCreatedApplication({ id: imported.applicationId })

        const runtimeIds = await resolveRuntimeIds(api, imported.applicationId)
        await setInterpretationNetworkWidgetConfig(api, imported.applicationId, { structureMode: 'singleSystem' })
        const system = await ensureSystemStructure(api, imported.applicationId, runtimeIds.workspaceId)
        const rowsBeforeInvalidSubmit = await getMatrixRows(api, imported.applicationId, runtimeIds, system.interpretationId)

        const baseURL = testInfo.project.use.baseURL
        if (typeof baseURL !== 'string') throw new Error('The locale acceptance project must define the E2E base URL')
        context = await browser.newContext({
            baseURL,
            storageState: { cookies: [], origins: [] },
            locale: locale === 'ru' ? 'ru-RU' : 'en-US',
            colorScheme: 'light'
        })
        const page = await context.newPage()
        const runtimeApiFailures: string[] = []
        page.on('response', (response) => {
            const url = new URL(response.url())
            const runtimePath = `/api/v1/applications/${imported.applicationId}/runtime`
            if ((url.pathname === runtimePath || url.pathname.startsWith(`${runtimePath}/`)) && response.status() >= 500) {
                runtimeApiFailures.push(`${response.status()} ${url.pathname}`)
            }
        })
        await loginThroughUi(page, runManifest.testUser)
        await page.goto(`/a/${imported.applicationId}?locale=en`)
        await expect(page.locator('html')).toHaveAttribute('lang', 'en')
        await expect(page.getByTestId('interpretation-network-workspace')).toHaveCount(0)
        await openStructures(page)
        await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
        await expectSingleSystemMatrix(page)

        await switchRuntimeLocale(page, locale)
        await expect(page.locator('html')).toHaveAttribute('lang', locale)

        const matrixPane = page.getByTestId('interpretation-network-matrix-workspace')
        await expect(matrixPane).toBeVisible({ timeout: 30_000 })
        const rootCell = matrixPane.getByRole('button', { name: /Universe|Вселенная/ }).first()
        await expect(rootCell).toBeVisible({ timeout: 30_000 })
        await rootCell.focus()
        await expect(rootCell).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(rootCell).toHaveAttribute('aria-pressed', 'true')

        const addCellButton = matrixPane.getByRole('button', { name: labels.addCell, exact: true }).first()
        await expect(addCellButton).toBeEnabled({ timeout: 30_000 })
        await tabUntilFocused(page, addCellButton, `${locale} Add Cell button`)
        await expect(addCellButton).toBeFocused()
        await page.keyboard.press('Enter')

        const dialog = page.getByRole('dialog', { name: labels.dialog })
        await expect(dialog).toBeVisible({ timeout: 30_000 })
        const titleField = dialog.getByRole('textbox', { name: labels.title, exact: true })
        await tabUntilFocused(page, titleField, `${locale} cell title field`)
        await expect(titleField).toBeFocused()
        await page.keyboard.press('Tab')
        const localeButtons = dialog.getByRole('button', { name: locale.toUpperCase(), exact: true })
        await expect(localeButtons.nth(0)).toBeFocused()
        await page.keyboard.press('Tab')
        const descriptionField = dialog.getByRole('textbox', { name: locale === 'ru' ? 'Описание' : 'Description', exact: true })
        await expect(descriptionField).toBeFocused()
        await page.keyboard.press('Tab')
        await expect(localeButtons.nth(1)).toBeFocused()
        await page.keyboard.press('Tab')
        const cancelButton = dialog.getByRole('button', { name: locale === 'ru' ? 'Отмена' : 'Cancel', exact: true })
        await expect(cancelButton).toBeFocused()
        await page.keyboard.press('Tab')
        await expect(titleField).toHaveValue('')
        const submitButton = dialog.getByRole('button', { name: labels.submit, exact: true })
        await expect(submitButton).toBeFocused()
        const createCellRequests: string[] = []
        const captureCreateCellRequest = (request: Request) => {
            const url = new URL(request.url())
            if (
                request.method() === 'POST' &&
                url.pathname === `/api/v1/applications/${imported.applicationId}/runtime/interpretation-network/matrix/cells`
            ) {
                createCellRequests.push(request.url())
            }
        }
        page.on('request', captureCreateCellRequest)
        await page.keyboard.press('Enter')

        await expect(dialog.getByText(labels.required, { exact: true })).toBeVisible()
        await expectLocalizedValidation(dialog, locale, {
            label: `${locale.toUpperCase()} Interpretation Network editable cell validation`
        })
        await expect(page.locator('html')).toHaveAttribute('lang', locale)
        expect(createCellRequests, 'Invalid localized form submission must not send a cell-creation request').toEqual([])
        expect(
            await getMatrixRows(api, imported.applicationId, runtimeIds, system.interpretationId),
            'Invalid localized form submission must leave persisted matrix rows unchanged'
        ).toEqual(rowsBeforeInvalidSubmit)
        page.off('request', captureCreateCellRequest)

        for (const viewport of [
            { name: 'wide-desktop', width: 1920, height: 1080 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'mobile', width: 390, height: 844 }
        ]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height })
            await expect(dialog, `The ${locale} validation dialog remains visible at ${viewport.width}px`).toBeVisible()
            await expect(dialog.getByText(labels.required, { exact: true })).toBeVisible()
            await expect(titleField).toBeVisible()
            await expect(submitButton).toBeVisible()
            await expectNoPageHorizontalOverflow(page, `${locale.toUpperCase()} localized validation at ${viewport.width}px`)
            await testInfo.attach(
                `interpretation-network-localized-validation-${locale}-${viewport.name}-${viewport.width}x${viewport.height}`,
                { body: await page.screenshot(), contentType: 'image/png' }
            )
        }

        await page.keyboard.press('Escape')
        await expect(dialog).toHaveCount(0)
        expect(runtimeApiFailures, 'The localized runtime workflow must not produce failed runtime API responses').toEqual([])
    } finally {
        try {
            if (context) await context.close()
        } finally {
            await disposeApiContext(api)
        }
    }
})
