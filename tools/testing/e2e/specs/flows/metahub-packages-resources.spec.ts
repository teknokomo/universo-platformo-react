import { createLocalizedContent } from '@universo-react/utils'
import type { Locator, Page } from '@playwright/test'
import { PNG } from 'pngjs'

import { expect, test } from '../../fixtures/test'
import {
    addMetahubMember,
    createAdminUser,
    createLoggedInApiContext,
    createMetahub,
    disposeApiContext,
    getAssignableRoles
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext } from '../../support/backend/personas.mjs'
import { recordCreatedGlobalUser, recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    expectLocatorHasNoInlineOverflow,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectNoVisibleTextPatterns,
    expectRuntimeUxViewportMatrix,
    waitForLayoutFrame
} from '../../support/browser/runtimeUx'

const resolveUserRoleIds = (roles: Array<{ id?: string; codename?: string }>): string[] => {
    const userRole = roles.find((role) => String(role.codename ?? '').toLowerCase() === 'user') ?? roles[0]
    return userRole?.id ? [userRole.id] : []
}

const rawPackageTextPatterns = [/@universo-react\//, /@colyseus\//, /\bcolyseus\.js\b/i]

const projectCardByName = (projectsPanel: Locator, projectName: string) =>
    projectsPanel.getByRole('heading', { name: projectName }).locator('xpath=ancestor::*[contains(@class, "MuiBox-root")][1]')

const expectImageLoaded = async (image: Locator, label: string) => {
    await expect(image, `${label} must be visible`).toBeVisible()
    const imageState = await image.evaluate((node) => {
        const element = node as HTMLImageElement
        return {
            alt: element.alt,
            src: element.getAttribute('src') ?? '',
            complete: element.complete,
            naturalWidth: element.naturalWidth,
            naturalHeight: element.naturalHeight
        }
    })

    expect(imageState.alt, `${label} must have useful alt text`).toBeTruthy()
    expect(imageState.src, `${label} must have a non-empty source`).toBeTruthy()
    expect(imageState.complete, `${label} must finish loading`).toBeTruthy()
    expect(imageState.naturalWidth, `${label} must have loaded pixels`).toBeGreaterThan(0)
    expect(imageState.naturalHeight, `${label} must have loaded pixels`).toBeGreaterThan(0)
}

const openPlayCanvasEditorSettingsDialog = async (page: Page) => {
    const editorRow = page.getByTestId('metahub-packages-tab').getByRole('row', { name: /PlayCanvas Editor/ })
    await editorRow.getByRole('button', { name: 'Actions for PlayCanvas Editor' }).click()
    await page.getByRole('menuitem', { name: 'Settings' }).click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    const dialog = page.getByRole('dialog', { name: 'Package display settings' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
    await waitForLayoutFrame(page)
    return dialog
}

const scrollPackagesTableActionsIntoViewByGesture = async (page: Page) => {
    const table = page.getByRole('table', { name: /Packages|Пакеты/ })
    const container = table.locator('xpath=./ancestor::*[contains(@class, "MuiTableContainer-root")][1]')
    await expect(container).toBeVisible()
    await container.hover()
    await page.mouse.wheel(1200, 0)

    await expect.poll(() => container.evaluate((element) => (element as HTMLElement).scrollLeft)).toBeGreaterThan(0)
}

const expectPlayCanvasEditorIframeLoaded = async (page: Page, locale: 'en' | 'ru' = 'en') => {
    const editorIframe = page.locator('iframe[title="PlayCanvas Editor"]')
    await expect(editorIframe).toBeVisible()
    await expect(editorIframe).toHaveAttribute('sandbox', 'allow-scripts')
    await expect(editorIframe).toHaveAttribute('referrerpolicy', 'no-referrer')
    await expect(editorIframe).toHaveAttribute('allow', '')
    await expect(editorIframe).toHaveAttribute('src', new RegExp(`[?&]locale=${locale}(?:&|$)`))

    const editorFrame = page.frameLocator('iframe[title="PlayCanvas Editor"]')
    if (locale === 'ru') {
        await expect(editorFrame.getByRole('heading', { name: 'Артефакт PlayCanvas Editor доступен' })).toBeVisible()
        await expect(editorFrame.getByRole('heading', { name: 'PlayCanvas Editor artifact is available' })).toBeHidden()
    } else {
        await expect(editorFrame.getByRole('heading', { name: 'PlayCanvas Editor artifact is available' })).toBeVisible()
        await expect(editorFrame.getByRole('heading', { name: 'Артефакт PlayCanvas Editor доступен' })).toBeHidden()
    }
    const previewCanvas = editorFrame.getByLabel('PlayCanvas Editor artifact preview')
    await expect(previewCanvas).toBeVisible()
    const canvasBox = await previewCanvas.boundingBox()
    expect(canvasBox?.width ?? 0).toBeGreaterThan(200)
    expect(canvasBox?.height ?? 0).toBeGreaterThan(100)
    const canvasScreenshot = await previewCanvas.screenshot()
    const screenshotPng = PNG.sync.read(canvasScreenshot)
    const canvasPaint = (() => {
        const buckets = new Set<string>()
        let sampledOpaquePixels = 0
        const { data } = screenshotPng
        for (let index = 0; index < data.length; index += 4 * 97) {
            const alpha = data[index + 3] ?? 0
            if (alpha === 0) continue
            sampledOpaquePixels += 1
            const red = Math.floor((data[index] ?? 0) / 32)
            const green = Math.floor((data[index + 1] ?? 0) / 32)
            const blue = Math.floor((data[index + 2] ?? 0) / 32)
            buckets.add(`${red}:${green}:${blue}`)
        }
        return {
            colorBuckets: buckets.size,
            sampledOpaquePixels
        }
    })()
    expect(canvasPaint.sampledOpaquePixels).toBeGreaterThan(20)
    expect(canvasPaint.colorBuckets).toBeGreaterThan(1)
    expect(new Set(canvasScreenshot).size).toBeGreaterThan(16)
}

const expectPlayCanvasEditorHostKeyboardLoop = async (page: Page, locale: 'en' | 'ru' = 'en') => {
    const backLinkName = locale === 'ru' ? 'Назад к пакетам' : 'Back to packages'
    const backLink = page.getByRole('link', { name: backLinkName })
    const editorIframe = page.locator('iframe[title="PlayCanvas Editor"]')
    const editorFrame = page.frameLocator('iframe[title="PlayCanvas Editor"]')
    const previewCanvas = editorFrame.getByLabel('PlayCanvas Editor artifact preview')

    await expect(backLink).toBeVisible()
    await backLink.focus()
    await expect(backLink).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(editorIframe).toBeFocused()
    await previewCanvas.click()
    await expect(editorIframe).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(backLink).toBeFocused()
}

const expectPlayCanvasEditorHostWarning = async (page: Page, message: string, label: string) => {
    await expect(page.getByRole('heading', { name: 'PlayCanvas Editor' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to packages' })).toBeVisible()
    await expect(page.getByText(message)).toBeVisible()
    await expect(page.locator('iframe[title="PlayCanvas Editor"]')).toHaveCount(0)
    await expectNoTechnicalLeakage(page.locator('body'), {
        label,
        checkUuidSubstrings: true
    })
    await expectNoVisibleTextPatterns(
        page.locator('body'),
        [/editor-artifact\/index\.html/i, /artifactStatus/i, /\bblocked\b/i, /\bmisconfigured\b/i, /\bERR_[A-Z_]+\b/i],
        { label }
    )
    await expectNoPageHorizontalOverflow(page, label)
}

test('@flow @packages metahub resources packages tab is usable and localized', async ({ browser, page, runManifest }, testInfo) => {
    test.setTimeout(240_000)

    const metahubName = `E2E ${runManifest.runId} packages resources`
    const metahubCodename = `${runManifest.runId}-packages-resources`
    const memberEmail = `e2e+${runManifest.runId}-packages-reader@example.test`
    const memberPassword = 'ChangeMe_E2E-123456!'

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })
    let bootstrapApi: Awaited<ReturnType<typeof createBootstrapApiContext>> | null = null
    let memberContext: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null

    try {
        bootstrapApi = await createBootstrapApiContext()
        const assignableRoles = await getAssignableRoles(bootstrapApi)
        const memberUser = await createAdminUser(bootstrapApi, {
            email: memberEmail,
            password: memberPassword,
            roleIds: resolveUserRoleIds(assignableRoles),
            comment: `Playwright package read-only member ${runManifest.runId}`
        })
        await recordCreatedGlobalUser({
            userId: memberUser.userId,
            email: memberUser.email ?? memberEmail
        })

        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for packages resources coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })
        await addMetahubMember(api, metahub.id, { email: memberUser.email ?? memberEmail, role: 'member' })

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto('/metahubs')
        const metahubEntry = page.getByText(metahubName, { exact: true }).first()
        await expect(metahubEntry).toBeVisible({ timeout: 30_000 })
        const metahubLink = metahubEntry
            .locator('xpath=ancestor::*[.//a[starts-with(@href, "/metahub/")]][1]//a[starts-with(@href, "/metahub/")]')
            .first()
        await expect(metahubLink).toBeVisible()
        await metahubLink.click()
        await page.getByRole('link', { name: 'Resources' }).click()
        await page.waitForURL('**/resources')
        await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible()
        await expect(page.getByRole('tab', { name: 'Packages', selected: true })).toBeVisible()

        const packagesTab = page.getByTestId('metahub-packages-tab')
        await expect(packagesTab).toBeVisible()
        await expect(page.getByRole('table', { name: 'Packages' })).toBeVisible()
        await expect(packagesTab.getByRole('heading', { name: 'PlayCanvas Engine' })).toBeVisible()
        await expect(packagesTab.getByRole('heading', { name: 'PlayCanvas Editor' })).toBeVisible()
        await expect(packagesTab.getByRole('heading', { name: 'Colyseus Server' })).toBeVisible()
        await expect(packagesTab.getByRole('heading', { name: 'Colyseus Client' })).toBeVisible()
        await expectNoTechnicalLeakage(packagesTab, {
            label: 'Metahub packages tab',
            checkUuidSubstrings: true
        })
        await expectNoVisibleTextPatterns(packagesTab, rawPackageTextPatterns, { label: 'Metahub packages tab' })
        await expectNoPageHorizontalOverflow(page, 'Metahub packages resources page desktop')
        await page.screenshot({ path: testInfo.outputPath('metahub-packages-en.png'), fullPage: true })

        await page.getByRole('button', { name: 'Connect Colyseus Client' }).focus()
        await page.keyboard.press('Enter')
        const keyboardAttachDialog = page.getByRole('dialog', { name: 'Connect package' })
        await expect(keyboardAttachDialog).toBeVisible()
        await expect(keyboardAttachDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        await keyboardAttachDialog.getByRole('button', { name: 'Cancel' }).click()
        await expect(keyboardAttachDialog).toHaveCount(0)

        await page.getByRole('button', { name: 'Connect PlayCanvas Editor' }).click()
        const editorAttachDialog = page.getByRole('dialog', { name: 'Connect package' })
        await expect(editorAttachDialog).toBeVisible()
        await expect(editorAttachDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        await editorAttachDialog.getByRole('button', { name: 'Connect package' }).click()
        await expect(editorAttachDialog).toHaveCount(0)
        const editorRow = packagesTab.getByRole('row', { name: /PlayCanvas Editor/ })
        await expect(editorRow.getByText('Connected')).toBeVisible()
        const projectsPanel = packagesTab.getByText('PlayCanvas projects').locator('xpath=ancestor::*[contains(@class, "MuiBox-root")][1]')
        await expect(projectsPanel.getByText('No PlayCanvas projects yet')).toBeVisible()
        await expectImageLoaded(projectsPanel.getByRole('img', { name: 'No PlayCanvas projects' }), 'PlayCanvas projects empty state image')
        await projectsPanel.getByRole('button', { name: 'Create project' }).click()
        const createProjectDialog = page.getByRole('dialog', { name: 'Create PlayCanvas project' })
        await expect(createProjectDialog).toBeVisible()
        await expect(createProjectDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        await expect(createProjectDialog.getByLabel(/Codename|Кодовое имя/)).toHaveCount(0)
        await expect(createProjectDialog.getByRole('button', { name: 'Create' })).toBeVisible()
        await expect(createProjectDialog.getByRole('button', { name: 'Create project' })).toHaveCount(0)
        await createProjectDialog.getByLabel('Project name').focus()
        await expectLocatorHasNoInlineOverflow(
            createProjectDialog.locator('label', { hasText: 'Project name' }),
            'PlayCanvas create project label'
        )
        await expectLocatorHasNoInlineOverflow(
            createProjectDialog.getByRole('button', { name: 'Create' }),
            'PlayCanvas create project button'
        )
        await page.screenshot({ path: testInfo.outputPath('playcanvas-project-create-dialog-en.png'), fullPage: true })
        await createProjectDialog.getByRole('button', { name: 'Create' }).click()
        await expect(createProjectDialog.getByText('Enter a project name.')).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath('playcanvas-project-create-validation-en.png'), fullPage: true })
        await createProjectDialog.getByLabel('Project name').fill('Flight Authoring')
        const createProjectRequest = page.waitForRequest((request) => {
            return request.method() === 'POST' && /\/api\/v1\/metahub\/[^/]+\/playcanvas\/projects$/.test(request.url())
        })
        await createProjectDialog.getByLabel('Project name').press('Enter')
        const createProjectPayload = await (await createProjectRequest).postDataJSON()
        expect(createProjectPayload.displayName).toBeTruthy()
        expect(createProjectPayload.codename).toBeUndefined()
        await expect(createProjectDialog).toHaveCount(0)
        const authoringProjectCard = projectCardByName(projectsPanel, 'Flight Authoring')
        await expect(authoringProjectCard).toBeVisible()
        await expect(authoringProjectCard.getByText('Default', { exact: true })).toBeVisible()
        await expect(authoringProjectCard.getByText('Ready', { exact: true })).toBeVisible()
        await expect(authoringProjectCard.getByText(/0 scenes, 0 assets, 0 scripts, 0 generated artifacts/)).toBeVisible()
        await projectsPanel.getByRole('button', { name: 'Create project' }).click()
        const createSecondProjectDialog = page.getByRole('dialog', { name: 'Create PlayCanvas project' })
        await expect(createSecondProjectDialog).toBeVisible()
        await createSecondProjectDialog.getByLabel('Project name').fill('Flight Backup')
        const createSecondProjectRequest = page.waitForRequest((request) => {
            return request.method() === 'POST' && /\/api\/v1\/metahub\/[^/]+\/playcanvas\/projects$/.test(request.url())
        })
        await createSecondProjectDialog.getByRole('button', { name: 'Create' }).click()
        await createSecondProjectRequest
        await expect(createSecondProjectDialog).toHaveCount(0)
        const backupProjectCard = projectCardByName(projectsPanel, 'Flight Backup')
        await expect(backupProjectCard).toBeVisible()
        await expect(backupProjectCard.getByText('Default', { exact: true })).toHaveCount(0)
        const defaultProjectSelect = projectsPanel.getByLabel('Default project')
        await expect(defaultProjectSelect).toContainText('Flight Authoring')
        const configEndpointPattern = /\/api\/v1\/metahub\/[^/]+\/package\/[^/]+\/config$/
        const waitForDefaultSave = () =>
            page.waitForResponse(
                (response) =>
                    response.request().method() === 'PATCH' && configEndpointPattern.test(new URL(response.url()).pathname) && response.ok()
            )
        const backupDefaultSave = waitForDefaultSave()
        await defaultProjectSelect.click()
        await page.getByRole('option', { name: 'Flight Backup' }).click()
        await backupDefaultSave
        await expect(defaultProjectSelect).toContainText('Flight Backup')
        await expect(backupProjectCard.getByText('Default', { exact: true })).toBeVisible()
        await expect(authoringProjectCard.getByText('Default', { exact: true })).toHaveCount(0)
        const resetDefaultSave = waitForDefaultSave()
        await defaultProjectSelect.click()
        await page.getByRole('option', { name: 'No default project' }).click()
        await resetDefaultSave
        await expect(defaultProjectSelect).toContainText('No default project')
        await expect(projectsPanel.getByText('Default', { exact: true })).toHaveCount(0)
        const authoringDefaultSave = waitForDefaultSave()
        await defaultProjectSelect.click()
        await page.getByRole('option', { name: 'Flight Authoring' }).click()
        await authoringDefaultSave
        await expect(defaultProjectSelect).toContainText('Flight Authoring')
        await expect(authoringProjectCard.getByText('Default', { exact: true })).toBeVisible()
        await expectNoTechnicalLeakage(projectsPanel, {
            label: 'PlayCanvas projects panel',
            checkUuidSubstrings: true
        })
        await expectNoVisibleTextPatterns(projectsPanel, [/^\{.*\}$/m, /\[object Object\]/, /playcanvas-projects\//], {
            label: 'PlayCanvas projects panel'
        })
        await expectNoPageHorizontalOverflow(page, 'PlayCanvas projects panel desktop')
        await page.screenshot({ path: testInfo.outputPath('playcanvas-projects-panel-en.png'), fullPage: true })
        await page.setViewportSize({ width: 768, height: 900 })
        await page.goto(`/metahub/${metahub.id}/resources`)
        const tabletProjectsPanel = page
            .getByTestId('metahub-packages-tab')
            .getByText('PlayCanvas projects')
            .locator('xpath=ancestor::*[contains(@class, "MuiBox-root")][1]')
        await expect(tabletProjectsPanel.getByRole('heading', { name: 'Flight Authoring' })).toBeVisible()
        await expect(tabletProjectsPanel.getByRole('heading', { name: 'Flight Backup' })).toBeVisible()
        await expectNoPageHorizontalOverflow(page, 'PlayCanvas projects panel tablet')
        await page.screenshot({ path: testInfo.outputPath('playcanvas-projects-panel-tablet.png'), fullPage: true })
        await page.setViewportSize({ width: 390, height: 844 })
        await page.goto(`/metahub/${metahub.id}/resources`)
        const mobileProjectsPanel = page
            .getByTestId('metahub-packages-tab')
            .getByText('PlayCanvas projects')
            .locator('xpath=ancestor::*[contains(@class, "MuiBox-root")][1]')
        await expect(mobileProjectsPanel.getByRole('heading', { name: 'Flight Authoring' })).toBeVisible()
        await expect(mobileProjectsPanel.getByRole('heading', { name: 'Flight Backup' })).toBeVisible()
        await expectNoPageHorizontalOverflow(page, 'PlayCanvas projects panel mobile')
        await page.screenshot({ path: testInfo.outputPath('playcanvas-projects-panel-mobile.png'), fullPage: true })
        await page.setViewportSize({ width: 1280, height: 900 })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await projectsPanel.getByRole('button', { name: 'Delete Flight Authoring' }).focus()
        await page.keyboard.press('Enter')
        const deleteProjectDialog = page.getByRole('dialog', { name: 'Delete PlayCanvas project' })
        await expect(deleteProjectDialog).toBeVisible()
        await expect(deleteProjectDialog.getByRole('button', { name: 'Delete' })).toBeVisible()
        await expect(deleteProjectDialog.getByRole('button', { name: 'Delete project' })).toHaveCount(0)
        await expectLocatorHasNoInlineOverflow(
            deleteProjectDialog.getByRole('button', { name: 'Delete' }),
            'PlayCanvas delete project button'
        )
        await page.screenshot({ path: testInfo.outputPath('playcanvas-project-delete-dialog-en.png'), fullPage: true })
        await deleteProjectDialog.getByRole('button', { name: 'Cancel' }).click()
        await expect(authoringProjectCard).toBeVisible()
        await projectsPanel.getByRole('button', { name: 'Delete Flight Authoring' }).click()
        const confirmDeleteProjectDialog = page.getByRole('dialog', { name: 'Delete PlayCanvas project' })
        await expect(confirmDeleteProjectDialog).toBeVisible()
        const deleteProjectResponse = page.waitForResponse(
            (response) =>
                response.request().method() === 'DELETE' &&
                /\/api\/v1\/metahub\/[^/]+\/playcanvas\/projects\/[^/]+$/.test(new URL(response.url()).pathname) &&
                response.ok()
        )
        await confirmDeleteProjectDialog.getByRole('button', { name: 'Delete' }).click()
        await deleteProjectResponse
        await expect(confirmDeleteProjectDialog).toHaveCount(0)
        await expect(projectsPanel.getByRole('heading', { name: 'Flight Authoring' })).toHaveCount(0)
        await expect(backupProjectCard).toBeVisible()
        const backupDefaultAfterDeleteSave = waitForDefaultSave()
        await defaultProjectSelect.click()
        await page.getByRole('option', { name: 'Flight Backup' }).click()
        await backupDefaultAfterDeleteSave
        await expect(defaultProjectSelect).toContainText('Flight Backup')

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByRole('heading', { name: 'Ресурсы' })).toBeVisible()
        const ruProjectsPanel = page
            .getByTestId('metahub-packages-tab')
            .getByText('Проекты PlayCanvas')
            .locator('xpath=ancestor::*[contains(@class, "MuiBox-root")][1]')
        await expect(ruProjectsPanel.getByLabel('Проект по умолчанию')).toBeVisible()
        await ruProjectsPanel.getByLabel('Проект по умолчанию').click()
        await expect(page.getByRole('option', { name: 'Без проекта по умолчанию' })).toBeVisible()
        await expect(page.getByRole('option', { name: 'Flight Backup' })).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(ruProjectsPanel.getByRole('button', { name: 'Создать проект' })).toBeVisible()
        await expect(ruProjectsPanel.getByRole('button', { name: 'Удалить Flight Backup' })).toBeVisible()
        await ruProjectsPanel.getByRole('button', { name: 'Создать проект' }).click()
        const ruCreateProjectDialog = page.getByRole('dialog', { name: 'Создать проект PlayCanvas' })
        await expect(ruCreateProjectDialog).toBeVisible()
        await expect(ruCreateProjectDialog.getByLabel('Название проекта')).toBeVisible()
        await ruCreateProjectDialog.getByLabel('Название проекта').focus()
        await expectLocatorHasNoInlineOverflow(
            ruCreateProjectDialog.locator('label', { hasText: 'Название проекта' }),
            'PlayCanvas create project label ru'
        )
        await expect(ruCreateProjectDialog.getByRole('button', { name: 'Создать' })).toBeVisible()
        await expect(ruCreateProjectDialog.getByRole('button', { name: 'Создать проект' })).toHaveCount(0)
        await ruCreateProjectDialog.getByRole('button', { name: 'Отмена' }).click()
        await expect(ruCreateProjectDialog).toHaveCount(0)
        await ruProjectsPanel.getByRole('button', { name: 'Удалить Flight Backup' }).click()
        const ruDeleteProjectDialog = page.getByRole('dialog', { name: 'Удалить проект PlayCanvas' })
        await expect(ruDeleteProjectDialog).toBeVisible()
        await expect(ruDeleteProjectDialog.getByText('Удалить Flight Backup и файлы этого проекта PlayCanvas.')).toBeVisible()
        await expect(ruDeleteProjectDialog.getByRole('button', { name: 'Удалить' })).toBeVisible()
        await expect(ruDeleteProjectDialog.getByRole('button', { name: 'Удалить проект' })).toHaveCount(0)
        await expectLocatorHasNoInlineOverflow(
            ruDeleteProjectDialog.getByRole('button', { name: 'Удалить' }),
            'PlayCanvas delete project button ru'
        )
        await ruDeleteProjectDialog.getByRole('button', { name: 'Отмена' }).click()
        await expect(ruDeleteProjectDialog).toHaveCount(0)
        await expectNoTechnicalLeakage(page.getByTestId('metahub-packages-tab'), {
            label: 'Metahub packages PlayCanvas projects panel ru',
            checkUuidSubstrings: true
        })
        await expectNoVisibleTextPatterns(page.getByTestId('metahub-packages-tab'), rawPackageTextPatterns, {
            label: 'Metahub packages PlayCanvas projects panel ru'
        })
        await page.screenshot({ path: testInfo.outputPath('playcanvas-projects-panel-ru.png'), fullPage: true })
        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible()

        const authoringHostEndpointPattern = /\/api\/v1\/metahub\/[^/]+\/packages\/playcanvas-editor\/authoring-host$/

        await editorRow.getByRole('button', { name: 'Actions for PlayCanvas Editor' }).focus()
        await page.keyboard.press('Enter')
        await page.getByRole('menuitem', { name: 'Settings' }).click()
        await expect(page.getByRole('menu')).toHaveCount(0)
        const editorSettingsDialog = page.getByRole('dialog', { name: 'Package display settings' })
        await expect(editorSettingsDialog).toBeVisible()
        await expect(editorSettingsDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        await expectNoPageHorizontalOverflow(page, 'PlayCanvas Editor settings dialog desktop')
        await waitForLayoutFrame(page)
        await page.screenshot({ path: testInfo.outputPath('playcanvas-editor-settings-en.png'), fullPage: true })
        await expect(editorSettingsDialog.getByLabel('Display mode')).toContainText('Embedded')
        await editorSettingsDialog.getByLabel('Display mode').press('Tab')
        await expect(editorSettingsDialog.getByRole('switch', { name: 'Show artifact status notice' })).toBeFocused()
        await expect(editorSettingsDialog.getByText('Development URL mode is disabled on this server.')).toBeVisible()
        await editorSettingsDialog.getByLabel('Display mode').click()
        await expect(page.getByRole('option', { name: 'Development URL' })).toHaveCount(0)
        await page.keyboard.press('Escape')
        await editorSettingsDialog.getByRole('button', { name: 'Reset to defaults' }).click()
        await expect(editorSettingsDialog.getByLabel('Display mode')).toContainText('Embedded')
        await expect(editorSettingsDialog.getByRole('button', { name: 'Save settings' })).toBeEnabled()
        await editorSettingsDialog.getByRole('button', { name: 'Cancel' }).click()
        await expect(editorSettingsDialog).toHaveCount(0)

        await page.route(authoringHostEndpointPattern, async (route) => {
            const response = await route.fetch()
            const descriptor = await response.json()
            await route.fulfill({
                status: response.status(),
                headers: response.headers(),
                contentType: 'application/json',
                body: JSON.stringify({
                    ...descriptor,
                    allowedDisplayModes: ['disabled', 'embeddedIframe', 'openSeparately', 'developmentUrl']
                })
            })
        })
        await page.route(configEndpointPattern, async (route) => {
            if (route.request().method() === 'PATCH') {
                await route.fulfill({
                    status: 400,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Development URL is not allowed' })
                })
                return
            }
            await route.continue()
        })
        const devUrlDialog = await openPlayCanvasEditorSettingsDialog(page)
        await devUrlDialog.getByLabel('Display mode').click()
        await page.getByRole('option', { name: 'Development URL' }).click()
        await devUrlDialog.getByLabel('Development URL').fill('not-a-url')
        await expect(devUrlDialog.getByText('Enter a valid http or https URL.')).toBeVisible()
        await expect(devUrlDialog.getByRole('button', { name: 'Save settings' })).toBeDisabled()
        await devUrlDialog.getByLabel('Development URL').fill('http://127.0.0.1:5999/editor')
        await expect(devUrlDialog.getByRole('button', { name: 'Save settings' })).toBeEnabled()
        const rejectedDevUrlSave = page.waitForResponse(
            (response) =>
                response.request().method() === 'PATCH' &&
                configEndpointPattern.test(new URL(response.url()).pathname) &&
                response.status() === 400
        )
        await devUrlDialog.getByRole('button', { name: 'Save settings' }).click()
        await rejectedDevUrlSave
        await expect(page.getByText('Package operation failed. Please refresh and try again.')).toBeVisible()
        await devUrlDialog.getByRole('button', { name: 'Cancel' }).click()
        await expect(devUrlDialog).toHaveCount(0)
        await page.unroute(configEndpointPattern)
        await page.unroute(authoringHostEndpointPattern)

        await expectRuntimeUxViewportMatrix(page, 'PlayCanvas Editor settings dialog', {
            beforeEachViewport: async (viewport) => {
                await page.goto(`/metahub/${metahub.id}/resources`)
                await expect(page.getByTestId('metahub-packages-tab')).toBeVisible()
                const dialog = await openPlayCanvasEditorSettingsDialog(page)
                await expect(dialog.getByLabel('Display mode')).toBeVisible()
                await expect(dialog.getByRole('button', { name: 'Reset to defaults' })).toBeVisible()
                await expect(dialog.getByRole('button', { name: 'Save settings' })).toBeVisible()
                await page.screenshot({ path: testInfo.outputPath(`playcanvas-editor-settings-${viewport.name}.png`), fullPage: true })
            }
        })
        await page.goto(`/metahub/${metahub.id}/resources`)
        const editorRowAfterSettingsMatrix = page.getByTestId('metahub-packages-tab').getByRole('row', { name: /PlayCanvas Editor/ })
        await editorRowAfterSettingsMatrix.getByRole('button', { name: 'Actions for PlayCanvas Editor' }).click()
        await page.getByRole('menuitem', { name: 'Settings' }).click()
        await expect(page.getByRole('menu')).toHaveCount(0)
        const editorSettingsDialogAfterMatrix = page.getByRole('dialog', { name: 'Package display settings' })
        await expect(editorSettingsDialogAfterMatrix).toBeVisible()
        await editorSettingsDialogAfterMatrix.getByLabel('Display mode').click()
        await page.getByRole('option', { name: 'Open separately' }).click()
        await editorSettingsDialogAfterMatrix.getByRole('button', { name: 'Save settings' }).click()
        await expect(editorSettingsDialogAfterMatrix).toHaveCount(0)

        const editorRowForSeparateMode = page.getByTestId('metahub-packages-tab').getByRole('row', { name: /PlayCanvas Editor/ })
        await editorRowForSeparateMode.getByRole('button', { name: 'Actions for PlayCanvas Editor' }).click()
        const separateHostPopupPromise = page.waitForEvent('popup')
        await page.getByRole('menuitem', { name: 'Open editor' }).click()
        const separateHostPage = await separateHostPopupPromise
        await separateHostPage.waitForLoadState('domcontentloaded')
        await expect(page).toHaveURL(new RegExp(`/metahub/${metahub.id}/resources$`))
        await applyBrowserPreferences(separateHostPage, { language: 'en' })
        await expect(separateHostPage).toHaveURL(new RegExp(`/metahub/${metahub.id}/resources/packages/playcanvas-editor/editor$`))
        await expect(separateHostPage.getByRole('heading', { name: 'PlayCanvas Editor' })).toBeVisible()
        await expect(separateHostPage.getByRole('link', { name: 'Back to packages' })).toBeVisible()
        await expect(separateHostPage.getByText('This editor is configured to open separately.')).toBeVisible()
        const separateEditorLink = separateHostPage.getByRole('link', { name: 'Open editor' })
        await expect(separateEditorLink).toHaveAttribute('target', '_blank')
        await expect(separateEditorLink).toHaveAttribute('rel', /noopener/)
        await expect(separateEditorLink).toHaveAttribute('rel', /noreferrer/)
        await expect(separateEditorLink).toHaveAttribute(
            'href',
            /\/metahub\/[^/]+\/resources\/packages\/playcanvas-editor\/editor\?view=sandboxed-frame$/
        )
        await expect(separateEditorLink).not.toHaveAttribute('href', /editor-artifact\/index\.html/)
        const popupPromise = separateHostPage.waitForEvent('popup')
        await separateEditorLink.click()
        const separateEditorPage = await popupPromise
        await separateEditorPage.waitForLoadState('domcontentloaded')
        await applyBrowserPreferences(separateEditorPage, { language: 'en' })
        await expect(separateEditorPage).toHaveURL(/\/resources\/packages\/playcanvas-editor\/editor\?view=sandboxed-frame$/)
        await expect(separateEditorPage.getByText('Editor artifact is ready.')).toBeVisible()
        await expectPlayCanvasEditorIframeLoaded(separateEditorPage)
        await expectNoPageHorizontalOverflow(separateEditorPage, 'PlayCanvas Editor separate sandboxed host page')
        await separateEditorPage.close()
        await separateHostPage.close()

        await page.goto(`/metahub/${metahub.id}/resources`)
        const editorRowForEmbeddedMode = page.getByTestId('metahub-packages-tab').getByRole('row', { name: /PlayCanvas Editor/ })
        await editorRowForEmbeddedMode.getByRole('button', { name: 'Actions for PlayCanvas Editor' }).click()
        await page.getByRole('menuitem', { name: 'Settings' }).click()
        const embeddedSettingsDialog = page.getByRole('dialog', { name: 'Package display settings' })
        await expect(page.getByRole('menu')).toHaveCount(0)
        await embeddedSettingsDialog.getByLabel('Display mode').click()
        await page.getByRole('option', { name: 'Embedded' }).click()
        await embeddedSettingsDialog.getByRole('button', { name: 'Save settings' }).click()
        await expect(embeddedSettingsDialog).toHaveCount(0)

        const editorArtifactIndexPattern =
            /\/api\/v1\/metahub\/[^/]+\/packages\/playcanvas-editor\/editor-artifact-token\/[^/]+\/index\.html(?:\?.*)?$/
        let delayedArtifactIndex = false
        await page.route(editorArtifactIndexPattern, async (route) => {
            if (!delayedArtifactIndex) {
                delayedArtifactIndex = true
                await new Promise((resolve) => setTimeout(resolve, 1500))
            }
            const response = await route.fetch()
            await route.fulfill({
                status: response.status(),
                headers: response.headers(),
                body: await response.body()
            })
        })
        await editorRowForEmbeddedMode.getByRole('button', { name: 'Actions for PlayCanvas Editor' }).click()
        const embeddedHostPopupPromise = page.waitForEvent('popup')
        await page.getByRole('menuitem', { name: 'Open editor' }).click()
        const embeddedHostPage = await embeddedHostPopupPromise
        await embeddedHostPage.waitForLoadState('domcontentloaded')
        await applyBrowserPreferences(embeddedHostPage, { language: 'en' })
        await expect(embeddedHostPage).toHaveURL(new RegExp(`/metahub/${metahub.id}/resources/packages/playcanvas-editor/editor$`))
        await expect(embeddedHostPage.getByRole('heading', { name: 'PlayCanvas Editor' })).toBeVisible()
        const hostResponse = await embeddedHostPage.request.get(embeddedHostPage.url())
        expect(hostResponse.ok()).toBeTruthy()
        expect(hostResponse.headers()['content-security-policy']).toContain("frame-src 'self'")
        expect(hostResponse.headers()['content-security-policy']).toContain("child-src 'self'")
        await expectPlayCanvasEditorIframeLoaded(embeddedHostPage)
        const editorFrameSrc = await embeddedHostPage.locator('iframe[title="PlayCanvas Editor"]').getAttribute('src')
        expect(editorFrameSrc).toBeTruthy()
        const anonymousArtifactContext = await browser.newContext()
        try {
            const anonymousArtifactResponse = await anonymousArtifactContext.request.get(
                new URL(editorFrameSrc ?? '', embeddedHostPage.url()).toString()
            )
            expect(anonymousArtifactResponse.ok()).toBeTruthy()
        } finally {
            await anonymousArtifactContext.close()
        }
        await expect(embeddedHostPage.getByText('Editor artifact is ready.')).toBeVisible()
        await page.unroute(editorArtifactIndexPattern)
        await expectPlayCanvasEditorHostKeyboardLoop(embeddedHostPage)
        await expectNoTechnicalLeakage(embeddedHostPage.locator('body'), {
            label: 'PlayCanvas Editor host page',
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(embeddedHostPage, 'PlayCanvas Editor host page desktop')
        await embeddedHostPage.screenshot({ path: testInfo.outputPath('playcanvas-editor-host.png'), fullPage: true })
        await embeddedHostPage.close()

        await page.route(authoringHostEndpointPattern, async (route) => {
            const response = await route.fetch()
            const descriptor = await response.json()
            await route.fulfill({
                status: response.status(),
                headers: response.headers(),
                contentType: 'application/json',
                body: JSON.stringify({
                    ...descriptor,
                    artifactStatus: 'missing',
                    artifactUrl: null
                })
            })
        })
        await page.goto(`/metahub/${metahub.id}/resources/packages/playcanvas-editor/editor`)
        await expect(page.getByRole('heading', { name: 'PlayCanvas Editor' })).toBeVisible()
        await expect(page.getByRole('link', { name: 'Back to packages' })).toBeVisible()
        await expect(page.getByText('The editor artifact is not available yet.')).toBeVisible()
        await expect(page.locator('iframe[title="PlayCanvas Editor"]')).toHaveCount(0)
        await expectNoPageHorizontalOverflow(page, 'PlayCanvas Editor missing artifact host page')
        await page.screenshot({ path: testInfo.outputPath('playcanvas-editor-host-missing-artifact.png'), fullPage: true })
        await page.unroute(authoringHostEndpointPattern)

        for (const artifactStatus of ['blocked', 'misconfigured'] as const) {
            await page.route(authoringHostEndpointPattern, async (route) => {
                const response = await route.fetch()
                const descriptor = await response.json()
                await route.fulfill({
                    status: response.status(),
                    headers: response.headers(),
                    contentType: 'application/json',
                    body: JSON.stringify({
                        ...descriptor,
                        artifactStatus,
                        artifactUrl: null
                    })
                })
            })
            await page.goto(`/metahub/${metahub.id}/resources/packages/playcanvas-editor/editor`)
            await expectPlayCanvasEditorHostWarning(
                page,
                'Editor display settings are incomplete.',
                `PlayCanvas Editor ${artifactStatus} host state`
            )
            await page.unroute(authoringHostEndpointPattern)
        }

        await page.route(editorArtifactIndexPattern, async (route) => {
            await route.fulfill({
                status: 503,
                contentType: 'text/html; charset=utf-8',
                body: '<!doctype html><title>Service unavailable</title>'
            })
        })
        await page.goto(`/metahub/${metahub.id}/resources/packages/playcanvas-editor/editor`)
        await expect(page.getByRole('heading', { name: 'PlayCanvas Editor' })).toBeVisible()
        await expect(page.getByRole('link', { name: 'Back to packages' })).toBeVisible()
        await expect(page.getByText('The editor frame could not be loaded.')).toBeVisible()
        await expect(page.getByText('Editor artifact is ready.')).toHaveCount(0)
        await expect(page.locator('iframe[title="PlayCanvas Editor"]')).toHaveCount(0)
        await expectNoTechnicalLeakage(page.locator('body'), {
            label: 'PlayCanvas Editor iframe failure state',
            checkUuidSubstrings: true
        })
        await expectNoVisibleTextPatterns(
            page.locator('body'),
            [/editor-artifact-token\/[^/]+\/index\.html/i, /Service unavailable/i, /\b503\b/, /\bERR_[A-Z_]+\b/i],
            { label: 'PlayCanvas Editor iframe failure state' }
        )
        await expectNoPageHorizontalOverflow(page, 'PlayCanvas Editor iframe failure state')
        await page.screenshot({ path: testInfo.outputPath('playcanvas-editor-host-iframe-failure.png'), fullPage: true })
        await page.unroute(editorArtifactIndexPattern)

        await expectRuntimeUxViewportMatrix(page, 'PlayCanvas Editor host page', {
            beforeEachViewport: async (viewport) => {
                await page.goto(`/metahub/${metahub.id}/resources/packages/playcanvas-editor/editor`)
                await expect(page.getByRole('heading', { name: 'PlayCanvas Editor' })).toBeVisible()
                await expectPlayCanvasEditorIframeLoaded(page)
                await expect(page.getByText('Editor artifact is ready.')).toBeVisible()
                await page.screenshot({ path: testInfo.outputPath(`playcanvas-editor-host-${viewport.name}.png`), fullPage: true })
            }
        })

        memberContext = await createLoggedInBrowserContext(
            browser,
            {
                email: memberUser.email ?? memberEmail,
                password: memberPassword
            },
            { basePathAfterLogin: `/metahub/${metahub.id}/resources` }
        )
        await applyBrowserPreferences(memberContext.page, { language: 'en' })
        const readOnlyProjectRequests: string[] = []
        await memberContext.page.route(/\/api\/v1\/metahub\/[^/]+\/playcanvas\/projects(?:\/.*)?$/, async (route) => {
            readOnlyProjectRequests.push(route.request().url())
            await route.fulfill({
                status: 403,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'forbidden' })
            })
        })
        await memberContext.page.goto(`/metahub/${metahub.id}/resources`, { waitUntil: 'networkidle' })
        await expect(memberContext.page.getByTestId('metahub-packages-tab')).toBeVisible()
        const readOnlyEditorProjectsPanel = memberContext.page
            .getByTestId('metahub-packages-tab')
            .getByText('PlayCanvas projects')
            .locator('xpath=ancestor::*[contains(@class, "MuiBox-root")][1]')
        await expect(
            readOnlyEditorProjectsPanel.getByText(
                'Project storage is available to metahub managers. You can view connected packages, but cannot change PlayCanvas projects.'
            )
        ).toBeVisible()
        await expect(readOnlyEditorProjectsPanel.getByRole('button', { name: 'Create project' })).toHaveCount(0)
        expect(readOnlyProjectRequests).toEqual([])
        await expectNoPageHorizontalOverflow(memberContext.page, 'Read-only PlayCanvas projects panel')
        await memberContext.page.screenshot({ path: testInfo.outputPath('playcanvas-projects-panel-readonly-member.png'), fullPage: true })
        await memberContext.page.unroute(/\/api\/v1\/metahub\/[^/]+\/playcanvas\/projects(?:\/.*)?$/)
        await memberContext.context.close()
        memberContext = null

        memberContext = await createLoggedInBrowserContext(browser, { email: memberUser.email ?? memberEmail, password: memberPassword })
        await applyBrowserPreferences(memberContext.page, { language: 'en' })
        await memberContext.page.goto(`/metahub/${metahub.id}/resources/packages/playcanvas-editor/editor`)
        await expect(memberContext.page.getByRole('heading', { name: 'PlayCanvas Editor' })).toBeVisible()
        await expect(memberContext.page.getByRole('link', { name: 'Back to packages' })).toBeVisible()
        await expect(memberContext.page.getByText('You do not have permission to open this editor.')).toBeVisible()
        await expect(memberContext.page.getByText('Failed to load editor settings.')).toHaveCount(0)
        await expect(memberContext.page.locator('iframe[title="PlayCanvas Editor"]')).toHaveCount(0)
        await memberContext.context.close()
        memberContext = null

        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByTestId('metahub-packages-tab')).toBeVisible()
        const editorRowAfterHost = page.getByTestId('metahub-packages-tab').getByRole('row', { name: /PlayCanvas Editor/ })
        await editorRowAfterHost.getByRole('button', { name: 'Actions for PlayCanvas Editor' }).click()
        await page.getByRole('menuitem', { name: 'Disconnect package' }).click()
        const editorDetachDialog = page.getByRole('dialog', { name: 'Disconnect package' })
        await expect(editorDetachDialog).toBeVisible()
        await editorDetachDialog.getByRole('button', { name: 'Disconnect package' }).click()
        await expect(editorDetachDialog).toHaveCount(0)
        await expect(editorRowAfterHost.getByText('Available')).toBeVisible()

        await page.getByRole('button', { name: 'Connect PlayCanvas Engine' }).click()
        const attachDialog = page.getByRole('dialog', { name: 'Connect package' })
        await expect(attachDialog).toBeVisible()
        await expect(attachDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        await expect(attachDialog).toContainText('Connect PlayCanvas Engine version 0.1.0')
        await attachDialog.getByRole('button', { name: 'Connect package' }).click()
        const playCanvasRow = packagesTab.getByRole('row', { name: /PlayCanvas Engine/ })
        await expect(playCanvasRow.getByText('Connected')).toBeVisible()

        await page.getByRole('button', { name: 'Disconnect PlayCanvas Engine' }).click()
        const detachDialog = page.getByRole('dialog', { name: 'Disconnect package' })
        await expect(detachDialog).toBeVisible()
        await expect(detachDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        await expect(detachDialog).toContainText('Modules that expect it')
        await detachDialog.getByRole('button', { name: 'Disconnect package' }).click()
        await expect(detachDialog).toHaveCount(0)
        await expect(playCanvasRow.getByText('Available')).toBeVisible()
        await expect(playCanvasRow.getByRole('button', { name: 'Connect PlayCanvas Engine' })).toBeEnabled()

        const colyseusClientRow = packagesTab.getByRole('row', { name: /Colyseus Client/ })
        await colyseusClientRow.getByRole('button', { name: 'Connect Colyseus Client' }).click()
        const colyseusAttachDialog = page.getByRole('dialog', { name: 'Connect package' })
        await expect(colyseusAttachDialog).toBeVisible()
        await colyseusAttachDialog.getByRole('button', { name: 'Connect package' }).click()
        await expect(colyseusAttachDialog).toHaveCount(0)
        await expect(colyseusClientRow.getByText('Connected')).toBeVisible()

        if (!memberContext) {
            memberContext = await createLoggedInBrowserContext(browser, {
                email: memberUser.email ?? memberEmail,
                password: memberPassword
            })
        }
        await applyBrowserPreferences(memberContext.page, { language: 'en' })
        await memberContext.page.goto(`/metahub/${metahub.id}/resources`)
        await expect(memberContext.page.getByRole('heading', { name: 'Resources' })).toBeVisible()
        await expect(memberContext.page.getByText('You can view connected packages, but cannot change them.')).toBeVisible()
        await expect(memberContext.page.getByRole('button', { name: 'Connect PlayCanvas Engine' })).toBeDisabled()
        const readOnlyPackagesTab = memberContext.page.getByTestId('metahub-packages-tab')
        const readOnlyColyseusClientRow = readOnlyPackagesTab.getByRole('row', { name: /Colyseus Client/ })
        await expect(readOnlyColyseusClientRow.getByRole('button', { name: 'Disconnect Colyseus Client' })).toBeDisabled()
        const readOnlyEditorRow = readOnlyPackagesTab.getByRole('row', { name: /PlayCanvas Editor/ })
        await expect(readOnlyEditorRow.getByRole('button', { name: 'Connect PlayCanvas Editor' })).toBeDisabled()
        await expect(readOnlyColyseusClientRow.locator('[aria-label="Package version for Colyseus Client"]')).toHaveClass(/Mui-disabled/)
        await expectNoTechnicalLeakage(readOnlyPackagesTab, {
            label: 'Read-only metahub packages tab',
            checkUuidSubstrings: true
        })
        await expectNoVisibleTextPatterns(readOnlyPackagesTab, rawPackageTextPatterns, { label: 'Read-only metahub packages tab' })

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByRole('heading', { name: 'Ресурсы' })).toBeVisible()
        await expect(page.getByRole('tab', { name: 'Пакеты', selected: true })).toBeVisible()
        await expect(page.getByRole('table', { name: 'Пакеты' })).toBeVisible()
        await expect(page.getByRole('columnheader', { name: '#' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Подключить PlayCanvas Engine' })).toBeVisible()
        await expectNoTechnicalLeakage(page.getByTestId('metahub-packages-tab'), {
            label: 'Metahub packages tab ru',
            checkUuidSubstrings: true
        })
        await expectNoVisibleTextPatterns(page.getByTestId('metahub-packages-tab'), rawPackageTextPatterns, {
            label: 'Metahub packages tab ru'
        })
        await page.screenshot({ path: testInfo.outputPath('metahub-packages-ru.png'), fullPage: true })

        const packagesEndpointPattern = /\/api\/v1\/metahub\/[^/]+\/packages$/
        await page.route(packagesEndpointPattern, async (route) => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Package from metahub snapshot is not registered' })
                })
                return
            }
            await route.continue()
        })
        await page.getByRole('button', { name: 'Подключить PlayCanvas Engine' }).click()
        const failedAttachDialog = page.getByRole('dialog', { name: 'Подключить пакет' })
        await expect(failedAttachDialog).toBeVisible()
        await expect(failedAttachDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        const failedAttachResponse = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                packagesEndpointPattern.test(new URL(response.url()).pathname) &&
                response.status() === 500
        )
        await failedAttachDialog.getByRole('button', { name: 'Подключить пакет' }).click()
        await failedAttachResponse
        await expect(page.getByText('Не удалось выполнить операцию с пакетом. Обновите страницу и попробуйте ещё раз.')).toBeVisible()
        await failedAttachDialog.getByRole('button', { name: 'Отмена' }).click()
        await page.unroute(packagesEndpointPattern)

        await applyBrowserPreferences(page, { language: 'en' })
        await page.setViewportSize({ width: 390, height: 844 })
        await page.goto(`/metahub/${metahub.id}/resources`)
        const mobilePackagesTab = page.getByTestId('metahub-packages-tab')
        await expect(mobilePackagesTab).toBeVisible()
        await expect(page.getByRole('table', { name: 'Packages' })).toBeVisible()
        await scrollPackagesTableActionsIntoViewByGesture(page)
        const mobileEditorRow = mobilePackagesTab.getByRole('row', { name: /PlayCanvas Editor/ })
        await expect(mobileEditorRow.getByRole('button', { name: 'Connect PlayCanvas Editor' })).toBeVisible()
        await mobileEditorRow.getByRole('button', { name: 'Connect PlayCanvas Editor' }).click()
        const mobileEditorAttachDialog = page.getByRole('dialog', { name: 'Connect package' })
        await expect(mobileEditorAttachDialog).toBeVisible()
        await mobileEditorAttachDialog.getByRole('button', { name: 'Connect package' }).click()
        await expect(mobileEditorAttachDialog).toHaveCount(0)
        await scrollPackagesTableActionsIntoViewByGesture(page)
        await expect(mobileEditorRow.getByRole('button', { name: 'Actions for PlayCanvas Editor' })).toBeVisible()
        await mobileEditorRow.getByRole('button', { name: 'Actions for PlayCanvas Editor' }).click()
        await expect(page.getByRole('menuitem', { name: 'Settings' })).toBeVisible()
        await expect(page.getByRole('menuitem', { name: 'Open editor' })).toBeVisible()
        await page.getByRole('menuitem', { name: 'Settings' }).click()
        const mobileSettingsDialog = page.getByRole('dialog', { name: 'Package display settings' })
        await expect(mobileSettingsDialog).toBeVisible()
        await expect(mobileSettingsDialog.getByLabel('Display mode')).toBeVisible()
        await expectNoPageHorizontalOverflow(page, 'PlayCanvas Editor mobile settings action path')
        await page.screenshot({ path: testInfo.outputPath('playcanvas-editor-settings-mobile-action-path.png'), fullPage: true })
        await mobileSettingsDialog.getByRole('button', { name: 'Save settings' }).click()
        await expect(mobileSettingsDialog).toHaveCount(0)
        await scrollPackagesTableActionsIntoViewByGesture(page)
        await mobileEditorRow.getByRole('button', { name: 'Actions for PlayCanvas Editor' }).click()
        const mobileHostPopupPromise = page.waitForEvent('popup')
        await page.getByRole('menuitem', { name: 'Open editor' }).click()
        const mobileHostPage = await mobileHostPopupPromise
        await mobileHostPage.waitForLoadState('domcontentloaded')
        await applyBrowserPreferences(mobileHostPage, { language: 'en' })
        await expect(page).toHaveURL(new RegExp(`/metahub/${metahub.id}/resources$`))
        await expect(mobileHostPage).toHaveURL(new RegExp(`/metahub/${metahub.id}/resources/packages/playcanvas-editor/editor$`))
        await expect(mobileHostPage.getByRole('heading', { name: 'PlayCanvas Editor' })).toBeVisible()
        await expectPlayCanvasEditorIframeLoaded(mobileHostPage)
        await expect(mobileHostPage.getByText('Editor artifact is ready.')).toBeVisible()
        await expectPlayCanvasEditorHostKeyboardLoop(mobileHostPage)
        await expectNoPageHorizontalOverflow(mobileHostPage, 'PlayCanvas Editor mobile host action path')
        await mobileHostPage.screenshot({ path: testInfo.outputPath('playcanvas-editor-host-mobile-action-path.png'), fullPage: true })
        await mobileHostPage.close()

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.setViewportSize({ width: 1280, height: 900 })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await page.route(authoringHostEndpointPattern, async (route) => {
            const response = await route.fetch()
            const descriptor = await response.json()
            await route.fulfill({
                status: response.status(),
                headers: response.headers(),
                contentType: 'application/json',
                body: JSON.stringify({
                    ...descriptor,
                    allowedDisplayModes: ['disabled', 'embeddedIframe', 'openSeparately', 'developmentUrl']
                })
            })
        })
        const ruEditorRow = page.getByTestId('metahub-packages-tab').getByRole('row', { name: /PlayCanvas Editor/ })
        await ruEditorRow.getByRole('button', { name: 'Действия для PlayCanvas Editor' }).click()
        await page.getByRole('menuitem', { name: 'Настройки' }).click()
        const ruSettingsDialog = page.getByRole('dialog', { name: 'Настройки отображения пакета' })
        await expect(ruSettingsDialog).toBeVisible()
        await expect(ruSettingsDialog.getByLabel('Режим отображения')).toBeVisible()
        await expect(ruSettingsDialog.getByRole('button', { name: 'Сохранить настройки' })).toBeVisible()
        await ruSettingsDialog.getByLabel('Режим отображения').click()
        await page.getByRole('option', { name: 'Адрес разработки' }).click()
        await ruSettingsDialog.getByLabel('Адрес разработки').fill('не-url')
        await expect(ruSettingsDialog.getByText('Введите корректный адрес с http или https.')).toBeVisible()
        await expect(ruSettingsDialog.getByRole('button', { name: 'Сохранить настройки' })).toBeDisabled()
        await expectNoPageHorizontalOverflow(page, 'PlayCanvas Editor settings dialog ru')
        await page.screenshot({ path: testInfo.outputPath('playcanvas-editor-settings-ru.png'), fullPage: true })
        await page.keyboard.press('Escape')
        await page.unroute(authoringHostEndpointPattern)
        await page.goto(`/metahub/${metahub.id}/resources/packages/playcanvas-editor/editor`)
        await expect(page.getByRole('heading', { name: 'PlayCanvas Editor' })).toBeVisible()
        await expectPlayCanvasEditorIframeLoaded(page, 'ru')
        await expect(page.getByText('Артефакт редактора готов.')).toBeVisible()
        await expectPlayCanvasEditorHostKeyboardLoop(page, 'ru')
        await expectNoPageHorizontalOverflow(page, 'PlayCanvas Editor host page ru')
        await page.screenshot({ path: testInfo.outputPath('playcanvas-editor-host-ru.png'), fullPage: true })

        await expectRuntimeUxViewportMatrix(page, 'Metahub packages resources page', {
            beforeEachViewport: async () => {
                await page.goto(`/metahub/${metahub.id}/resources`)
                await expect(page.getByTestId('metahub-packages-tab')).toBeVisible()
                await expect(page.getByRole('table', { name: /Packages|Пакеты/ })).toBeVisible()
            }
        })
        await page.setViewportSize({ width: 768, height: 900 })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByTestId('metahub-packages-tab')).toBeVisible()
        await expect(page.getByRole('table', { name: /Packages|Пакеты/ })).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath('metahub-packages-tablet.png'), fullPage: true })
        await page.setViewportSize({ width: 390, height: 844 })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByTestId('metahub-packages-tab')).toBeVisible()
        await expect(page.getByRole('table', { name: /Packages|Пакеты/ })).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath('metahub-packages-mobile.png'), fullPage: true })
    } finally {
        if (memberContext) {
            await memberContext.context.close()
        }
        if (bootstrapApi) {
            await disposeApiContext(bootstrapApi)
        }
        await disposeApiContext(api)
    }
})
