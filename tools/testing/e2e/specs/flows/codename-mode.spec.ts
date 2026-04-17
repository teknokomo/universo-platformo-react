import { createLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    deleteAdminSetting,
    disposeApiContext,
    getMetahub,
    listAdminSettings,
    listMetahubs,
    listMetahubSettings,
    updateAdminSetting,
    updateMetahubSettings
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { entityDialogSelectors, toolbarSelectors } from '../../support/selectors/contracts'

const METAHUB_MIGRATION_GUARD_LOADING_TEXT = 'Checking metahub migration status...'

function extractWrappedValue(setting: { value?: Record<string, unknown> } | undefined): unknown {
    if (!setting?.value || typeof setting.value !== 'object') {
        return undefined
    }

    return '_value' in setting.value ? setting.value._value : setting.value
}

function resolveSettingValue(settings: Array<{ key?: string; value?: Record<string, unknown> }>, key: string): unknown {
    return extractWrappedValue(settings.find((setting) => setting.key === key))
}

function assertVlcCodenameShape(value: unknown, expectedPrimaryLocale: string, expectedContent: string) {
    expect(value).toBeTruthy()
    expect(typeof value).toBe('object')

    const codename = value as {
        _primary?: unknown
        locales?: Record<string, { content?: unknown }>
    }

    expect(codename._primary).toBe(expectedPrimaryLocale)
    expect(codename.locales?.[expectedPrimaryLocale]?.content).toBe(expectedContent)
}

async function openCreateDialog(page: import('@playwright/test').Page) {
    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    return dialog
}

async function waitForMetahubWorkspaceHeading(page: import('@playwright/test').Page, headingName: string) {
    const heading = page.getByRole('heading', { name: headingName })
    const guardLoading = page.getByText(METAHUB_MIGRATION_GUARD_LOADING_TEXT)

    await Promise.race([
        heading.waitFor({ state: 'visible', timeout: 15_000 }),
        guardLoading.waitFor({ state: 'visible', timeout: 15_000 })
    ])

    if (await guardLoading.isVisible()) {
        await expect(guardLoading).toHaveCount(0, { timeout: 30_000 })
    }

    await expect(heading).toBeVisible()
}

async function waitForPlatformCodenameDefaults(page: import('@playwright/test').Page, expectedLocalizedEnabled: boolean) {
    const defaultsResponsePromise = page.waitForResponse(
        (response) => response.request().method() === 'GET' && /\/api\/v1\/metahubs\/codename-defaults$/.test(response.url())
    )

    await page.goto('/metahubs')
    await waitForMetahubWorkspaceHeading(page, 'Metahubs')

    const defaultsResponse = await defaultsResponsePromise
    expect(defaultsResponse.ok()).toBe(true)

    const defaultsPayload = (await defaultsResponse.json()) as {
        data?: {
            localizedEnabled?: boolean
        }
    }

    expect(defaultsPayload.data?.localizedEnabled).toBe(expectedLocalizedEnabled)
}

test('@flow codename platform defaults switch metahub create dialog UI mode while persisted codename remains VLC', async ({
    page,
    runManifest
}) => {
    const bootstrapApi = await createBootstrapApiContext()
    const userApi = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })
    const originalSettings = await listAdminSettings(bootstrapApi, 'metahubs')
    const originalLocalizedEnabled = resolveSettingValue(originalSettings, 'codenameLocalizedEnabled')
    const metahubName = `E2E ${runManifest.runId} codename platform`
    const metahubCodename = `E2e${runManifest.runId.replace(/[^a-zA-Z0-9]/g, '')}CodenamePlatform`

    try {
        await updateAdminSetting(bootstrapApi, 'metahubs', 'codenameLocalizedEnabled', false)
        await expect
            .poll(async () => resolveSettingValue(await listAdminSettings(bootstrapApi, 'metahubs'), 'codenameLocalizedEnabled'))
            .toBe(false)

        await waitForPlatformCodenameDefaults(page, false)

        const createDialog = await openCreateDialog(page)
        const codenameField = createDialog.getByTestId('codename-field')

        await expect(codenameField).toHaveAttribute('data-codename-mode', 'versioned')
        await expect(codenameField.getByRole('button', { name: 'EN' })).toHaveCount(0)

        await createDialog.getByLabel('Name').first().fill(metahubName)
        await createDialog.getByLabel('Codename').first().fill(metahubCodename)
        await createDialog.getByTestId(entityDialogSelectors.submitButton).click()

        await expect(createDialog).toHaveCount(0)

        let createdMetahubId
        await expect
            .poll(
                async () => {
                    const response = await listMetahubs(userApi, { limit: 100, offset: 0, sortBy: 'updated', sortOrder: 'desc' })
                    const items = Array.isArray(response?.items) ? response.items : []
                    const created = items.find(
                        (item) => item.name?.locales?.en?.content === metahubName || item.codename?.locales?.en?.content === metahubCodename
                    )
                    createdMetahubId = created?.id
                    return typeof createdMetahubId === 'string'
                },
                { timeout: 20_000 }
            )
            .toBe(true)

        if (typeof createdMetahubId !== 'string') {
            throw new Error('Create metahub flow did not expose a persisted id for codename platform coverage')
        }

        await page.reload()
        await expect(page.getByText(metahubName)).toBeVisible()

        await recordCreatedMetahub({
            id: createdMetahubId,
            name: metahubName,
            codename: metahubCodename
        })

        const persistedMetahub = await getMetahub(userApi, createdMetahubId)
        assertVlcCodenameShape(persistedMetahub.codename, 'en', metahubCodename)

        await updateAdminSetting(bootstrapApi, 'metahubs', 'codenameLocalizedEnabled', true)
        await expect
            .poll(async () => resolveSettingValue(await listAdminSettings(bootstrapApi, 'metahubs'), 'codenameLocalizedEnabled'))
            .toBe(true)

        await waitForPlatformCodenameDefaults(page, true)
        const localizedDialog = await openCreateDialog(page)
        const localizedCodenameField = localizedDialog.getByTestId('codename-field')

        await expect(localizedCodenameField).toHaveAttribute('data-codename-mode', 'localized')
        await expect(localizedCodenameField.getByRole('button', { name: 'EN' })).toBeVisible()

        await localizedCodenameField.getByRole('button', { name: 'EN' }).click()
        await expect(page.getByRole('menuitem', { name: 'Add language' })).toBeVisible()
        await page.getByRole('menuitem', { name: 'Add language' }).click()
        const russianLocaleOption = page.getByRole('menuitem', { name: 'Русский' })
        await expect(russianLocaleOption).toBeVisible()
        await russianLocaleOption.click()
        await expect(russianLocaleOption).not.toBeVisible()

        await localizedDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(localizedDialog).toHaveCount(0)
    } finally {
        if (originalLocalizedEnabled === undefined) {
            await deleteAdminSetting(bootstrapApi, 'metahubs', 'codenameLocalizedEnabled').catch(() => undefined)
        } else {
            await updateAdminSetting(bootstrapApi, 'metahubs', 'codenameLocalizedEnabled', originalLocalizedEnabled).catch(() => undefined)
        }

        await disposeApiContext(userApi)
        await disposeBootstrapApiContext(bootstrapApi)
    }
})

test('@flow metahub codename settings switch child entity forms between versioned and localized UI modes', async ({
    page,
    runManifest
}) => {
    const userApi = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} codename metahub`
    const metahubCodename = `${runManifest.runId}-codename-metahub`

    try {
        const metahub = await createMetahub(userApi, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for codename mode coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        await updateMetahubSettings(userApi, metahub.id, [
            {
                key: 'general.codenameLocalizedEnabled',
                value: { _value: false }
            }
        ])

        await page.goto(`/metahub/${metahub.id}/entities/hub/instances`)
        await expect(page.getByRole('heading', { name: 'Tree entities instances' })).toBeVisible()

        const versionedDialog = await openCreateDialog(page)
        const versionedCodenameField = versionedDialog.getByTestId('codename-field')

        await expect(versionedCodenameField).toHaveAttribute('data-codename-mode', 'versioned')
        await expect(versionedCodenameField.getByRole('button', { name: 'EN' })).toHaveCount(0)

        await versionedDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(versionedDialog).toHaveCount(0)

        await updateMetahubSettings(userApi, metahub.id, [
            {
                key: 'general.codenameLocalizedEnabled',
                value: { _value: true }
            }
        ])

        await page.goto(`/metahub/${metahub.id}/entities/hub/instances`)
        const localizedDialog = await openCreateDialog(page)
        const localizedCodenameField = localizedDialog.getByTestId('codename-field')

        await expect(localizedCodenameField).toHaveAttribute('data-codename-mode', 'localized')
        await expect(localizedCodenameField.getByRole('button', { name: 'EN' })).toBeVisible()

        await localizedCodenameField.getByRole('button', { name: 'EN' }).click()
        await expect(page.getByRole('menuitem', { name: 'Add language' })).toBeVisible()
        await page.getByRole('menuitem', { name: 'Add language' }).click()
        const russianLocaleOption = page.getByRole('menuitem', { name: 'Русский' })
        await expect(russianLocaleOption).toBeVisible()
        await russianLocaleOption.click()
        await expect(russianLocaleOption).not.toBeVisible()

        const settingsResponse = await listMetahubSettings(userApi, metahub.id)
        expect(resolveSettingValue(settingsResponse.settings ?? [], 'general.codenameLocalizedEnabled')).toBe(true)

        await localizedDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(localizedDialog).toHaveCount(0)
    } finally {
        await disposeApiContext(userApi)
    }
})
