import fs from 'node:fs/promises'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    createLoggedInApiContext,
    createPublicationLinkedApplication,
    disposeApiContext,
    listLayouts,
    listApplicationWorkspaces,
    listLayoutZoneWidgets
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { toolbarSelectors } from '../../support/selectors/contracts'
import {
    assertLmsFixtureEnvelopeContract,
    LMS_DEMO_MODULE,
    LMS_DEMO_MODULE_PROGRESS,
    LMS_DEMO_MODULES,
    LMS_DEMO_QUIZ,
    LMS_DEMO_QUIZZES,
    LMS_DEMO_QUIZ_RESPONSES,
    LMS_DEMO_STUDENTS,
    LMS_FIXTURE_FILENAME,
    LMS_PUBLICATION,
    LMS_SAMPLE_LINK,
    LMS_SECONDARY_LINK,
    LMS_WELCOME_PAGE
} from '../../support/lmsFixtureContract'
import { waitForApplicationCatalogId, waitForApplicationRuntimeRowCount, type ApiContext } from '../../support/lmsRuntime'

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

async function checkQuizOption(page: Page, value: unknown, locale: string): Promise<void> {
    const primaryLabel = readLocalizedText(value, locale)
    if (primaryLabel) {
        const primaryLocator = page.getByLabel(primaryLabel)
        if (await primaryLocator.count()) {
            await primaryLocator.check()
            return
        }
    }

    const fallbackLabel = readLocalizedText(value, 'en')
    if (fallbackLabel) {
        await page.getByLabel(fallbackLabel).check()
        return
    }

    throw new Error(`Quiz option label is missing for locale ${locale}`)
}

async function clickRuntimeNavigationItem(page: Page, name: string): Promise<void> {
    const directLink = page.getByRole('link', { name })
    await expect(directLink.first()).toBeVisible({ timeout: 30_000 })
    await directLink.first().click()
}

async function loadLmsFixture(): Promise<{ fixturePath: string; metahubName: string }> {
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
        throw new Error(`No layout was returned for imported metahub ${metahubId}`)
    }

    return layoutId
}

test.describe('LMS Snapshot Import Runtime Flow', () => {
    let api: ApiContext

    test.afterEach(async () => {
        if (api) {
            await disposeApiContext(api)
        }
    })

    test('@flow lms snapshot fixture imports through the browser UI and is immediately usable after linked app creation', async ({
        page,
        runManifest
    }, testInfo) => {
        test.setTimeout(480_000)

        const fixture = await loadLmsFixture()
        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })

        await page.goto('/metahubs')

        const primaryActionBtn = page.getByTestId(toolbarSelectors.primaryAction)
        await expect(primaryActionBtn).toBeVisible({ timeout: 15_000 })

        const dropdownArrow = page.getByTestId(`${toolbarSelectors.primaryAction}-menu-trigger`)
        await dropdownArrow.click()

        const importOption = page.getByRole('menuitem', { name: /import/i })
        await expect(importOption).toBeVisible()
        await importOption.click()

        const dialog = page.getByRole('dialog', { name: /import/i })
        await expect(dialog).toBeVisible()

        await dialog.locator('input[type="file"]').setInputFiles(fixture.fixturePath)
        await expect(dialog.getByText(LMS_FIXTURE_FILENAME)).toBeVisible()

        const importResponsePromise = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' && response.url().endsWith('/api/v1/metahubs/import') && response.status() === 201,
            { timeout: 180_000 }
        )

        await dialog
            .getByRole('button', { name: /import/i })
            .last()
            .click()

        const importResponse = await importResponsePromise
        expect(importResponse.status()).toBe(201)

        const importBody = await importResponse.json()
        const importedId = importBody?.metahub?.id
        const importedPublicationId = importBody?.publication?.id
        expect(typeof importedId).toBe('string')
        expect(typeof importedPublicationId).toBe('string')

        await recordCreatedMetahub({
            id: importedId,
            name: fixture.metahubName,
            codename: 'learning-portal-lms-imported'
        })
        await recordCreatedPublication({
            id: importedPublicationId,
            metahubId: importedId
        })

        await expect(dialog).toHaveCount(0)
        await expect(page.getByText(fixture.metahubName, { exact: true }).first()).toBeVisible({ timeout: 15_000 })

        const layoutId = await waitForLayoutId(api, importedId)
        const layoutWidgets = await listLayoutZoneWidgets(api, importedId, layoutId)
        const widgetKeys = new Set((layoutWidgets.items ?? []).map((item: Record<string, any>) => item?.widgetKey))
        expect(widgetKeys.has('moduleViewerWidget')).toBe(false)
        expect(widgetKeys.has('statsViewerWidget')).toBe(false)
        expect(widgetKeys.has('qrCodeWidget')).toBe(false)

        const menuWidget = (layoutWidgets.items ?? []).find((item: Record<string, any>) => item?.widgetKey === 'menuWidget')
        expect(menuWidget?.config?.autoShowAllCatalogs).toBe(false)
        expect(menuWidget?.config?.maxPrimaryItems).toBe(6)
        expect(menuWidget?.config?.startPage).toBe('LearnerHome')

        const linkedApplication = await createPublicationLinkedApplication(api, importedId, importedPublicationId, {
            name: LMS_PUBLICATION.applicationName,
            namePrimaryLocale: 'en',
            createApplicationSchema: false,
            isPublic: true
        })

        const applicationId = linkedApplication?.application?.id
        if (typeof applicationId !== 'string') {
            throw new Error('Import flow did not create an application id from the imported LMS publication')
        }
        const connectorId = linkedApplication?.connector?.id
        if (typeof connectorId !== 'string') {
            throw new Error('Import flow did not create a connector id from the imported LMS publication')
        }

        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.application.slug
        })

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/a/${applicationId}/admin/connector/${connectorId}`)
        await expect(page.getByTestId('application-connector-board-schema-card')).toBeVisible({ timeout: 30_000 })

        const diffResponsePromise = page.waitForResponse(
            (response) => response.request().method() === 'GET' && response.url().endsWith(`/api/v1/application/${applicationId}/diff`),
            { timeout: 60_000 }
        )
        await page.getByTestId('application-connector-board-sync-button').click()
        const diffResponse = await diffResponsePromise
        expect(diffResponse.status()).toBe(200)

        const diffDialog = page.getByRole('dialog', { name: 'Schema Changes' })
        await expect(diffDialog).toBeVisible({ timeout: 30_000 })
        await expect(diffDialog.getByText('Workspaces', { exact: true })).toBeVisible()
        await diffDialog.getByLabel('Create application workspaces').check()
        await diffDialog.getByLabel('I understand that workspaces cannot be turned off after they are enabled for this application.').check()

        const syncResponsePromise = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/application/${applicationId}/sync`) &&
                response.status() === 200,
            { timeout: 180_000 }
        )
        await diffDialog.getByRole('button', { name: 'Create Schema' }).click()
        const syncResponse = await syncResponsePromise
        expect(syncResponse.status()).toBe(200)
        expect(syncResponse.request().postDataJSON()).toMatchObject({
            schemaOptions: {
                workspaceModeRequested: 'enabled',
                acknowledgeIrreversibleWorkspaceEnablement: true
            }
        })
        await expect(diffDialog).toHaveCount(0)

        const [studentsCatalogId, quizResponsesCatalogId, moduleProgressCatalogId] = await Promise.all([
            waitForApplicationCatalogId(api, applicationId, 'Students'),
            waitForApplicationCatalogId(api, applicationId, 'Quiz Responses'),
            waitForApplicationCatalogId(api, applicationId, 'Module Progress')
        ])

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/a/${applicationId}`)

        await expect(page.getByText('Access Links', { exact: true })).toHaveCount(0)
        await expect(page.getByText('Ссылки доступа', { exact: true })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Learning' })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'More' })).toHaveCount(0)
        await expect(page.getByTestId('runtime-page-blocks')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(LMS_WELCOME_PAGE.title.en, { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(LMS_WELCOME_PAGE.intro.en)).toBeVisible({
            timeout: 30_000
        })
        await expect(page.getByText(LMS_WELCOME_PAGE.howToStartTitle.en, { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(LMS_WELCOME_PAGE.workspaceGuidance.en)).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Catalog', { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('link', { name: 'Workspaces' })).toHaveCount(1)
        await expect(page.getByText('Module access QR')).toHaveCount(0)
        await expect(page.getByText('Learning portal stats')).toHaveCount(0)
        await expect(page.getByText('Dashboard preview of the canonical learning lesson')).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Copy link' })).toHaveCount(0)
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
        await page.screenshot({ path: testInfo.outputPath('lms-dashboard-en.png'), fullPage: true })

        await clickRuntimeNavigationItem(page, 'Knowledge')
        await expect(page.getByText('Quizzes', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
        await clickRuntimeNavigationItem(page, 'Development')
        await expect(page.getByText('Classes', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
        await clickRuntimeNavigationItem(page, 'Reports')
        await expect(page.getByText('Reports', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/a/${applicationId}`)

        await expect(page.getByText('Access Links', { exact: true })).toHaveCount(0)
        await expect(page.getByText('Ссылки доступа', { exact: true })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Обучение' })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'More' })).toHaveCount(0)
        await expect(page.getByTestId('runtime-page-blocks')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(LMS_WELCOME_PAGE.title.ru, { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(LMS_WELCOME_PAGE.intro.ru)).toBeVisible({
            timeout: 30_000
        })
        await expect(page.getByText(LMS_WELCOME_PAGE.howToStartTitle.ru, { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(LMS_WELCOME_PAGE.workspaceGuidance.ru)).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Каталог', { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('link', { name: 'Рабочие пространства' })).toHaveCount(1)
        await expect(page.getByText('Module access QR')).toHaveCount(0)
        await expect(page.getByText('Статистика учебного портала')).toHaveCount(0)
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
        await page.screenshot({ path: testInfo.outputPath('lms-dashboard-ru.png'), fullPage: true })

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/public/a/${applicationId}/links/${LMS_SAMPLE_LINK.slug}`)

        await expect(page.getByLabel('Your name')).toBeVisible({ timeout: 30_000 })
        await page.getByLabel('Your name').fill('Learning guest learner')
        await page.getByRole('button', { name: 'Start learning' }).click()

        await expect(page.getByText(LMS_DEMO_MODULE.title.en)).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(LMS_DEMO_MODULE.contentItems.en[0].itemContent)).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Next' }).click()
        await expect(page.getByText(LMS_DEMO_MODULE.contentItems.en[1].itemTitle)).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Open quiz' }).click()

        await expect(page.getByText(LMS_DEMO_QUIZ.questions.en[0].prompt)).toBeVisible({ timeout: 30_000 })
        await checkQuizOption(page, LMS_DEMO_QUIZ.questions.en[0].options[0].label, 'en')
        await checkQuizOption(page, LMS_DEMO_QUIZ.questions.en[1].options[0].label, 'en')
        await page.getByRole('button', { name: 'Submit quiz' }).click()
        await expect(page.getByText('Score 2 / 2')).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Back to module' }).click()
        await page.getByRole('button', { name: 'Complete module' }).click()
        await expect(page.getByText('Module complete. Progress has been recorded for this session.')).toBeVisible({ timeout: 30_000 })
        await page.screenshot({ path: testInfo.outputPath('lms-guest-journey.png'), fullPage: true })

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/public/a/${applicationId}/links/${LMS_SECONDARY_LINK.slug}?locale=ru`)

        await expect(page.getByLabel('Ваше имя')).toBeVisible({ timeout: 30_000 })
        await page.getByLabel('Ваше имя').fill('Русский гость')
        await page.getByRole('button', { name: 'Начать обучение' }).click()

        const secondaryModule = LMS_DEMO_MODULES.find((module) => module.accessLinkSlug === LMS_SECONDARY_LINK.slug)
        if (!secondaryModule) {
            throw new Error('LMS fixture contract is missing the secondary public module definition')
        }

        await expect(page.getByText(secondaryModule.title.ru)).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(secondaryModule.contentItems.ru[0].itemContent ?? '')).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Далее' }).click()
        await expect(page.getByText(secondaryModule.contentItems.ru[1].itemTitle)).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Открыть тест' }).click()

        const secondaryQuiz = LMS_DEMO_QUIZZES.find((quiz) => quiz.key === 'docking-corridor')
        if (!secondaryQuiz) {
            throw new Error('LMS fixture contract is missing the secondary public quiz definition')
        }

        await expect(page.getByText(secondaryQuiz.questions.ru[0].prompt)).toBeVisible({ timeout: 30_000 })
        await checkQuizOption(page, secondaryQuiz.questions.ru[0].options[0].label, 'ru')
        await checkQuizOption(page, secondaryQuiz.questions.ru[1].options[0].label, 'ru')
        await page.getByRole('button', { name: 'Отправить тест' }).click()
        await expect(page.getByText('Результат 2 / 2')).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Назад к модулю' }).click()
        await expect(page.getByRole('button', { name: 'Завершить модуль' })).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Завершить модуль' }).click()
        await expect(page.getByText('Модуль завершён. Прогресс записан для этой сессии.')).toBeVisible({ timeout: 30_000 })
        await page.screenshot({ path: testInfo.outputPath('lms-guest-journey-ru.png'), fullPage: true })

        const workspaces = await listApplicationWorkspaces(api, applicationId)
        const workspaceItems = Array.isArray(workspaces?.items) ? workspaces.items : []
        expect(workspaceItems.filter((workspace) => workspace?.workspaceType === 'shared' || workspace?.type === 'shared')).toHaveLength(0)
        const mainWorkspaceId = workspaceItems.find(
            (workspace) => workspace?.isDefault === true || workspace?.workspaceType === 'personal' || workspace?.type === 'personal'
        )?.id
        if (typeof mainWorkspaceId !== 'string' || mainWorkspaceId.length === 0) {
            throw new Error('Main application workspace was not found for final runtime verification')
        }

        const [studentRows, quizResponseRows, moduleProgressRows] = await Promise.all([
            waitForApplicationRuntimeRowCount(api, applicationId, studentsCatalogId, LMS_DEMO_STUDENTS.length + 2, {
                workspaceId: mainWorkspaceId
            }),
            waitForApplicationRuntimeRowCount(api, applicationId, quizResponsesCatalogId, LMS_DEMO_QUIZ_RESPONSES.length + 4, {
                workspaceId: mainWorkspaceId
            }),
            waitForApplicationRuntimeRowCount(api, applicationId, moduleProgressCatalogId, LMS_DEMO_MODULE_PROGRESS.length + 2, {
                workspaceId: mainWorkspaceId
            })
        ])

        expect(studentRows).toHaveLength(LMS_DEMO_STUDENTS.length + 2)
        expect(quizResponseRows).toHaveLength(LMS_DEMO_QUIZ_RESPONSES.length + 4)
        expect(moduleProgressRows).toHaveLength(LMS_DEMO_MODULE_PROGRESS.length + 2)
    })
})
