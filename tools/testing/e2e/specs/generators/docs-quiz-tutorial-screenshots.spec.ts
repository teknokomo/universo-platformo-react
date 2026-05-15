import fs from 'fs'
import path from 'path'
import { expect, test } from '../../fixtures/test'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    disposeApiContext,
    getLayout,
    listLayoutZoneWidgets,
    listLayouts,
    listObjectCollections,
    sendWithCsrf,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'
import { buildEntityMenuItemSelector, buildEntityMenuTriggerSelector, entityDialogSelectors } from '../../support/selectors/contracts'
import {
    QUIZ_CENTERED_LAYOUT_CONFIG,
    QUIZ_REMOVED_LAYOUT_WIDGET_KEYS,
    QUIZ_SCRIPT_CODENAME,
    QUIZ_WIDGET_SOURCE
} from '../../support/quizFixtureContract'
import { createLocalizedContent } from '@universo/utils'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

const SCREENSHOT_DIRECTORIES = [
    path.resolve(repoRoot, 'docs', 'en', '.gitbook', 'assets', 'quiz-tutorial'),
    path.resolve(repoRoot, 'docs', 'ru', '.gitbook', 'assets', 'quiz-tutorial'),
    path.resolve(repoRoot, 'docs', 'en', '.gitbook', 'assets', 'platform'),
    path.resolve(repoRoot, 'docs', 'ru', '.gitbook', 'assets', 'platform')
] as const
const LOCALE_COPY = {
    en: {
        applications: 'Applications',
        connectors: 'Connectors',
        scriptsTab: 'Scripts',
        dragHint: 'Drag widgets between zones to change runtime composition.',
        quizWidget: 'Quiz widget',
        publications: 'Publications',
        versions: 'Versions',
        applicationViewSettings: 'Application View Settings',
        applicationSettings: 'Application Settings',
        submitLabel: 'Check answer'
    },
    ru: {
        applications: 'Приложения',
        connectors: 'Коннекторы',
        scriptsTab: 'Скрипты',
        dragHint: 'Перетаскивайте виджеты между зонами, чтобы изменить состав рантайм-интерфейса.',
        quizWidget: 'Виджет квиза',
        publications: 'Публикации',
        versions: 'Версии',
        applicationViewSettings: 'Настройки отображения приложения',
        applicationSettings: 'Настройки приложения',
        submitLabel: 'Проверить ответ'
    }
} as const

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function ensureScreenshotDirectories() {
    for (const screenshotsDir of SCREENSHOT_DIRECTORIES) {
        fs.mkdirSync(screenshotsDir, { recursive: true })
    }
}

async function expectJsonResponse(response: Response, label: string) {
    const text = await response.text()
    const payload = text ? JSON.parse(text) : null

    if (!response.ok) {
        throw new Error(`${label} failed with ${response.status} ${response.statusText}: ${text}`)
    }

    return payload
}

async function waitForObjectId(api: ApiContext, metahubId: string) {
    let objectId: string | undefined

    await expect
        .poll(async () => {
            const response = await listObjectCollections(api, metahubId, { limit: 100, offset: 0 })
            objectId = response?.items?.[0]?.id
            return typeof objectId === 'string'
        })
        .toBe(true)

    if (!objectId) {
        throw new Error(`No object was returned for metahub ${metahubId}`)
    }

    return objectId
}

async function waitForLayoutId(api: ApiContext, metahubId: string) {
    let layoutId: string | undefined

    await expect
        .poll(async () => {
            const response = await listLayouts(api, metahubId, { limit: 20, offset: 0 })
            layoutId = response?.items?.find((layout) => layout?.isDefault)?.id ?? response?.items?.[0]?.id
            return typeof layoutId === 'string'
        })
        .toBe(true)

    if (!layoutId) {
        throw new Error(`No layout was returned for metahub ${metahubId}`)
    }

    return layoutId
}

async function applyCenteredQuizLayout(api: ApiContext, metahubId: string, layoutId: string) {
    const layout = await getLayout(api, metahubId, layoutId)
    const currentConfig = layout?.config && typeof layout.config === 'object' ? layout.config : {}
    const removableWidgetKeys = new Set<string>(QUIZ_REMOVED_LAYOUT_WIDGET_KEYS)

    await expectJsonResponse(
        await sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahubId}/layout/${layoutId}`, {
            name: layout?.name,
            namePrimaryLocale: layout?.name?._primary ?? 'en',
            description: layout?.description,
            descriptionPrimaryLocale: layout?.description?._primary ?? 'en',
            config: {
                ...currentConfig,
                ...QUIZ_CENTERED_LAYOUT_CONFIG
            }
        }),
        'Applying centered quiz layout config'
    )

    const zoneWidgets = await listLayoutZoneWidgets(api, metahubId, layoutId)
    for (const widget of zoneWidgets?.items?.filter((item) => removableWidgetKeys.has(String(item?.widgetKey ?? ''))) ?? []) {
        const removeResponse = await sendWithCsrf(api, 'DELETE', `/api/v1/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widget.id}`)
        expect(removeResponse.status).toBe(204)
    }
}

async function openMetahubScriptsDialog(
    page: Parameters<typeof test>[0]['page'],
    metahubId: string,
    metahubName: string,
    labels: (typeof LOCALE_COPY)[keyof typeof LOCALE_COPY]
) {
    await page.goto('/metahubs')
    await expect(page.getByText(metahubName, { exact: true })).toBeVisible({ timeout: 30_000 })

    const menuTrigger = page.getByTestId(buildEntityMenuTriggerSelector('metahub', metahubId))

    if ((await menuTrigger.count()) === 0) {
        await page.reload()
    }

    await expect(menuTrigger).toBeVisible({ timeout: 30_000 })
    await menuTrigger.click()
    await page.getByTestId(buildEntityMenuItemSelector('metahub', 'edit', metahubId)).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('tab', { name: labels.scriptsTab, exact: true }).click()
    await expect(dialog.getByTestId('entity-scripts-layout')).toBeVisible({ timeout: 30_000 })

    return dialog
}

test.describe('Docs Quiz Tutorial Screenshots', () => {
    let api: ApiContext

    test.afterEach(async () => {
        if (api) {
            await disposeApiContext(api)
        }
    })

    test('@generator capture quiz tutorial screenshots for docs', async ({ page, runManifest }) => {
        test.setTimeout(600_000)

        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })

        await page.setViewportSize({ width: 1440, height: 900 })
        ensureScreenshotDirectories()

        const metahubName = `Docs Quiz Tutorial ${runManifest.runId}`
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', `docs-quiz-${String(runManifest.runId).toLowerCase()}`),
            description: { en: 'Quiz tutorial screenshots metahub' },
            descriptionPrimaryLocale: 'en'
        })

        if (!metahub?.id) {
            throw new Error('Quiz tutorial screenshot generator did not receive a metahub id')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: `docs-quiz-${String(runManifest.runId).toLowerCase()}`
        })

        const objectCollectionId = await waitForObjectId(api, metahub.id)
        const layoutId = await waitForLayoutId(api, metahub.id)

        await applyCenteredQuizLayout(api, metahub.id, layoutId)

        await expectJsonResponse(
            await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahub.id}/scripts`, {
                codename: QUIZ_SCRIPT_CODENAME,
                name: 'Space quiz widget',
                description: 'Quiz widget script used by the GitBook tutorial screenshots',
                attachedToKind: 'metahub',
                attachedToId: null,
                moduleRole: 'widget',
                sourceKind: 'embedded',
                capabilities: ['rpc.client'],
                sourceCode: QUIZ_WIDGET_SOURCE,
                isActive: true
            }),
            'Creating quiz widget script'
        )

        await expectJsonResponse(
            await sendWithCsrf(api, 'PUT', `/api/v1/metahub/${metahub.id}/layout/${layoutId}/zone-widget`, {
                zone: 'center',
                widgetKey: 'quizWidget',
                config: {
                    attachedToKind: 'metahub',
                    scriptCodename: QUIZ_SCRIPT_CODENAME
                }
            }),
            'Assigning quiz widget to layout'
        )

        const publication = await createPublication(api, metahub.id, {
            name: { en: `Docs Quiz Tutorial Publication ${runManifest.runId}` },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })

        if (!publication?.id) {
            throw new Error('Publication creation did not return an id for quiz tutorial screenshots')
        }

        await recordCreatedPublication({
            id: publication.id,
            metahubId: metahub.id,
            schemaName: publication.schemaName
        })

        await createPublicationVersion(api, metahub.id, publication.id, {
            name: { en: `Docs Quiz Tutorial Version ${runManifest.runId}` },
            namePrimaryLocale: 'en'
        })

        await syncPublication(api, metahub.id, publication.id)
        await waitForPublicationReady(api, metahub.id, publication.id)

        const linkedApplication = await createPublicationLinkedApplication(api, metahub.id, publication.id, {
            name: { en: `Docs Quiz Tutorial App ${runManifest.runId}` },
            namePrimaryLocale: 'en',
            createApplicationSchema: false
        })

        const applicationId = linkedApplication?.application?.id
        if (typeof applicationId !== 'string') {
            throw new Error('Linked application creation did not return an application id for quiz tutorial screenshots')
        }

        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.application.slug
        })

        await syncApplicationSchema(api, applicationId, {
            schemaOptions: {
                workspaceModeRequested: 'enabled',
                acknowledgeIrreversibleWorkspaceEnablement: true
            }
        })

        for (const locale of ['en', 'ru'] as const) {
            const labels = LOCALE_COPY[locale]
            const screenshotsDir = path.resolve(repoRoot, 'docs', locale, '.gitbook', 'assets', 'quiz-tutorial')
            const platformScreenshotsDir = path.resolve(repoRoot, 'docs', locale, '.gitbook', 'assets', 'platform')

            await applyBrowserPreferences(page, { language: locale, isDarkMode: false })

            await page.goto(`/metahub/${metahub.id}/publications`)
            await expect(page.getByRole('heading', { name: labels.publications })).toBeVisible({ timeout: 30_000 })
            await page.screenshot({ path: path.join(platformScreenshotsDir, 'publications-list.png') })

            await page.goto(`/metahub/${metahub.id}/publication/${publication.id}/versions`)
            await expect(page.getByRole('heading', { name: labels.versions })).toBeVisible({ timeout: 30_000 })
            await page.screenshot({ path: path.join(platformScreenshotsDir, 'publication-versions.png') })

            await page.goto(`/metahub/${metahub.id}/publication/${publication.id}/applications`)
            await expect(page.getByRole('heading', { name: labels.applications })).toBeVisible({ timeout: 30_000 })
            await page.screenshot({ path: path.join(platformScreenshotsDir, 'publication-applications.png') })

            await page.goto('/applications')
            await expect(page.getByRole('heading', { name: labels.applications })).toBeVisible({ timeout: 30_000 })
            await page.screenshot({ path: path.join(platformScreenshotsDir, 'applications-list.png') })

            await page.goto(`/a/${applicationId}/admin/connectors`)
            await expect(page.getByRole('heading', { name: labels.connectors })).toBeVisible({ timeout: 30_000 })
            await page.screenshot({ path: path.join(platformScreenshotsDir, 'application-connectors.png') })

            const scriptsDialog = await openMetahubScriptsDialog(page, metahub.id, metahubName, labels)
            await scriptsDialog.screenshot({ path: path.join(screenshotsDir, 'metahub-scripts.png') })
            await scriptsDialog.getByTestId(entityDialogSelectors.cancelButton).click()
            await expect(scriptsDialog).toHaveCount(0)

            await page.goto(`/metahub/${metahub.id}/resources/layouts/${layoutId}`)
            await expect(page.getByText(labels.dragHint)).toBeVisible({ timeout: 30_000 })
            await expect(page.getByText(labels.applicationViewSettings)).toBeVisible({ timeout: 30_000 })
            await page.screenshot({ path: path.join(screenshotsDir, 'layout-quiz-widget.png') })

            await page.goto(`/a/${applicationId}/admin/settings`)
            await expect(page.getByText(labels.applicationSettings, { exact: true })).toBeVisible({ timeout: 30_000 })
            await expect(page.getByTestId('application-setting-dialogSizePreset')).toBeVisible({ timeout: 30_000 })
            await page.screenshot({ path: path.join(screenshotsDir, 'application-settings-general.png') })

            await page.goto(`/a/${applicationId}`)
            await expect(page.getByRole('button', { name: labels.submitLabel })).toBeVisible({ timeout: 60_000 })
            await page.screenshot({ path: path.join(screenshotsDir, 'runtime-quiz.png') })

            for (const screenshotName of [
                'metahub-scripts.png',
                'layout-quiz-widget.png',
                'application-settings-general.png',
                'runtime-quiz.png',
                '../platform/publications-list.png',
                '../platform/publication-versions.png',
                '../platform/publication-applications.png',
                '../platform/applications-list.png',
                '../platform/application-connectors.png'
            ]) {
                const screenshotPath = path.join(screenshotsDir, screenshotName)
                expect(fs.existsSync(screenshotPath)).toBe(true)
                expect(fs.statSync(screenshotPath).size).toBeGreaterThan(0)
            }
        }
    })
})
