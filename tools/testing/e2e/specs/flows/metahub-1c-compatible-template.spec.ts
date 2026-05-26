import { createLocalizedContent } from '@universo-react/utils'
import type { Page, TestInfo } from '@playwright/test'

import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    disposeApiContext,
    getTemplate,
    listMetahubEntityTypes,
    listMetahubSettings,
    listTemplates,
    sendWithCsrf
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    expectNoDataGridTechnicalLeakage,
    expectLocatorFitsViewport,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectNoVisibleTextPatterns,
    expectSemanticFieldControls,
    expectRuntimeUxViewportMatrix
} from '../../support/browser/runtimeUx'
import {
    buildEntityMenuItemSelector,
    buildEntityMenuTriggerSelector,
    entityDialogSelectors,
    toolbarSelectors
} from '../../support/selectors/contracts'
import { parseJsonResponse, readLocalizedText, waitForEntityAbsence, waitForListEntity } from './entity-runtime-helpers'

const ONE_C_TEMPLATE_PRESETS = [
    'one-c-constant',
    'enumeration',
    'one-c-catalog',
    'one-c-document',
    'one-c-document-journal',
    'one-c-information-register',
    'one-c-accumulation-register',
    'one-c-chart-of-accounts',
    'one-c-chart-of-characteristic-types',
    'one-c-accounting-register',
    'one-c-chart-of-calculation-types',
    'one-c-calculation-register'
]

const ONE_C_PRESET_CODENAMES = ONE_C_TEMPLATE_PRESETS.filter((codename) => codename.startsWith('one-c-'))

const ONE_C_TEMPLATE_KIND_KEYS = [
    'constant',
    'enumeration',
    'catalog',
    'document',
    'document-journal',
    'information-register',
    'accumulation-register',
    'chart-of-accounts',
    'chart-of-characteristic-types',
    'accounting-register',
    'chart-of-calculation-types',
    'calculation-register'
]

type BrowserRuntimeIssue = {
    source: 'console' | 'pageerror' | 'response'
    text: string
    method?: string
    status?: number
    url?: string
}

type EntityRecord = {
    id?: string
    name?: unknown
    description?: unknown
}

type ComponentRecord = {
    id?: string
    name?: unknown
}

type MetahubRecord = {
    id?: string
}

type EntityListPayload = {
    items?: EntityRecord[]
}

type ApiSessionLike = {
    baseURL: string
    cookies: Map<string, string>
}

type RuntimeLifecycleConfig = {
    kindKey: string
    title: string
    dialogNameFragment: string
}

const buildApiCookieHeader = (api: ApiSessionLike): string =>
    Array.from(api.cookies.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ')

async function listEntitiesViaApi(api: ApiSessionLike, metahubId: string, kindKey: string): Promise<EntityListPayload> {
    const response = await fetch(new URL(`/api/v1/metahub/${metahubId}/entities?kind=${encodeURIComponent(kindKey)}`, api.baseURL), {
        headers: {
            Accept: 'application/json',
            Cookie: buildApiCookieHeader(api)
        }
    })

    if (!response.ok) {
        throw new Error(`Listing entities for ${kindKey} failed with ${response.status} ${response.statusText}: ${await response.text()}`)
    }

    return (await response.json()) as EntityListPayload
}

const isCatalogRequisiteRoute = (url: string, metahubId: string, catalogEntityId: string, suffix: string): boolean =>
    url.endsWith(`/api/v1/metahub/${metahubId}/entities/catalog/instance/${catalogEntityId}/${suffix}`) ||
    url.endsWith(`/api/v1/metahub/${metahubId}/entities/object/instance/${catalogEntityId}/${suffix}`)

function watchBrowserRuntimeIssues(page: Page): BrowserRuntimeIssue[] {
    const issues: BrowserRuntimeIssue[] = []

    page.on('console', (message) => {
        if (message.type() !== 'error') return
        if (message.text().startsWith('Failed to load resource:')) return

        issues.push({
            source: 'console',
            text: message.text()
        })
    })

    page.on('pageerror', (error) => {
        issues.push({
            source: 'pageerror',
            text: error.message
        })
    })

    page.on('response', (response) => {
        const status = response.status()
        const responseUrl = response.url()
        if (!responseUrl.includes('/api/')) return

        const method = response.request().method()
        if (status < 400) {
            const transientCsrfIndex = issues.findIndex(
                (issue) => issue.source === 'response' && issue.status === 419 && issue.method === method && issue.url === responseUrl
            )
            if (transientCsrfIndex >= 0) {
                issues.splice(transientCsrfIndex, 1)
            }
            return
        }

        issues.push({
            source: 'response',
            text: `HTTP ${status} ${method} ${responseUrl}`,
            method,
            status,
            url: responseUrl
        })
    })

    return issues
}

function expectNoBrowserRuntimeIssues(issues: BrowserRuntimeIssue[], label: string): void {
    expect(
        issues,
        `${label} produced browser runtime issues:\n${issues.map((issue) => `[${issue.source}] ${issue.text}`).join('\n')}`
    ).toEqual([])
}

async function ensureMetahubVisible(page: Page, expectedName: string) {
    const metahubName = page.getByText(expectedName, { exact: true }).first()

    if ((await metahubName.count()) === 0) {
        await page.reload()
    }

    await expect(metahubName).toBeVisible()
}

const unwrapApiData = <T extends Record<string, unknown>>(payload: unknown): T => {
    if (payload && typeof payload === 'object' && 'data' in payload) {
        return (payload as { data: T }).data
    }

    return payload as T
}

async function openEntityRowActionsByVisibleName(page: Page, entityName: string) {
    const row = page.getByRole('row').filter({ hasText: entityName }).first()
    await expect(row, `Row for ${entityName} should be discoverable by visible text`).toBeVisible()

    const actionButton = row.getByRole('button').last()
    await expect(actionButton, `Actions button for ${entityName} should be reachable from the visible row`).toBeVisible()
    const accessibleName = await actionButton.getAttribute('aria-label')
    expect(accessibleName ?? '', `Actions button for ${entityName} should not expose raw ids`).not.toMatch(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    )
    await actionButton.click()
}

async function expectCreatedOneCMetahubEntityTypeUi(
    page: Page,
    api: ApiSessionLike,
    metahubId: string,
    entityTypes: Array<{ id?: string; kindKey?: string }>,
    testInfo: TestInfo
) {
    await page.goto(`/metahub/${metahubId}/entities`)
    await expect(page.getByRole('heading', { name: 'Сущности' })).toBeVisible()

    for (const label of [
        'Константы',
        'Справочники',
        'Документы',
        'Журналы документов',
        'Регистры сведений',
        'Регистры накопления',
        'Планы счетов',
        'Планы видов характеристик',
        'Регистры бухгалтерии',
        'Планы видов расчета',
        'Регистры расчета'
    ]) {
        await expect(page.getByText(label, { exact: true }).first(), `Created 1C-Compatible metahub should show ${label}`).toBeVisible()
    }

    const body = page.locator('body')
    await expectNoTechnicalLeakage(body, {
        label: 'Created 1C-Compatible entity type workspace',
        checkUuidSubstrings: true
    })
    await expectNoVisibleTextPatterns(body, [/\bone-c-[a-z-]+\b/, /\[object Object\]/, /Пресет шаблона|Template preset/i], {
        label: 'Created 1C-Compatible entity type workspace'
    })
    await expectNoVisibleTextPatterns(
        body,
        [/\b(dataSchema|treeAssignment|recordLifecycle|ledgerSchema)\b/, /\b(custom|constant|catalog|document)-[a-z-]+\b/],
        {
            label: 'Created 1C-Compatible entity type constructor list'
        }
    )
    await expectNoPageHorizontalOverflow(page, 'Created 1C-Compatible entity type workspace')

    await page.screenshot({
        path: testInfo.outputPath('1c-compatible-created-entity-types.png'),
        fullPage: true,
        animations: 'disabled'
    })

    const catalogType = entityTypes.find((item) => item.kindKey === 'catalog' && typeof item.id === 'string')
    if (!catalogType?.id) {
        throw new Error('Created 1C-Compatible metahub did not expose a catalog entity type id for browser navigation')
    }

    const catalogMenuTrigger = page.getByTestId(buildEntityMenuTriggerSelector('entity-type', catalogType.id))
    await expect(catalogMenuTrigger).toBeVisible()
    await catalogMenuTrigger.focus()
    await expect(catalogMenuTrigger).toBeFocused()
    await page.keyboard.press('Enter')
    const instancesAction = page.getByTestId(buildEntityMenuItemSelector('entity-type', 'instances', catalogType.id))
    await expect(instancesAction).toBeVisible()
    await instancesAction.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(`/metahub/${metahubId}/entities/catalog/instances`)
    await expect(page.getByRole('heading', { name: /Справочники|Catalogs/i })).toBeVisible()

    const runtimePages = [
        { kindKey: 'constant', title: 'Константы', dialogTitle: /Создать.*констант/i },
        { kindKey: 'catalog', title: 'Справочники', dialogTitle: /Создать.*справочник/i },
        { kindKey: 'document', title: 'Документы', dialogTitle: /Создать.*документ/i },
        { kindKey: 'document-journal', title: 'Журналы документов', dialogTitle: /Создать.*журнал документов/i },
        { kindKey: 'information-register', title: 'Регистры сведений', dialogTitle: /Создать.*регистр сведений/i },
        { kindKey: 'accumulation-register', title: 'Регистры накопления', dialogTitle: /Создать.*регистр накопления/i },
        { kindKey: 'chart-of-accounts', title: 'Планы счетов', dialogTitle: /Создать.*план счетов/i },
        {
            kindKey: 'chart-of-characteristic-types',
            title: 'Планы видов характеристик',
            dialogTitle: /Создать.*план видов характеристик/i
        },
        { kindKey: 'accounting-register', title: 'Регистры бухгалтерии', dialogTitle: /Создать.*регистр бухгалтерии/i },
        { kindKey: 'chart-of-calculation-types', title: 'Планы видов расчета', dialogTitle: /Создать.*план видов расчета/i },
        { kindKey: 'calculation-register', title: 'Регистры расчета', dialogTitle: /Создать.*регистр расчета/i }
    ]

    for (const runtimePage of runtimePages) {
        await page.goto(`/metahub/${metahubId}/entities/${encodeURIComponent(runtimePage.kindKey)}/instances`)
        await expect(page.getByRole('heading', { name: runtimePage.title })).toBeVisible()
        await expect(page.getByText(/Экземпляры .*metahubs:/i)).toHaveCount(0)
        await expect(page.getByText(/entity-owned|унифицированном/i)).toHaveCount(0)
        await expect(page.getByText(/Создать сущность/i)).toHaveCount(0)
        await expect(page.getByText(/1С-Совместимые|1C-Compatible (Constants|Catalogs|Documents|Registers|Journals|Charts)/i)).toHaveCount(
            0
        )

        const createButton = page.getByTestId(toolbarSelectors.primaryAction)
        await expect(createButton).toBeVisible()
        await expect(createButton).toContainText(/^Создать$/)
        await createButton.click()

        const dialog = page.getByRole('dialog')
        await expect(dialog.getByRole('heading', { name: runtimePage.dialogTitle })).toBeVisible()
        await expect(dialog.getByText(/metahubs:|Create metahubs:|Создать сущность|entity-owned/i)).toHaveCount(0)
        await dialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(dialog).toHaveCount(0)

        await expectNoTechnicalLeakage(page.locator('body'), {
            label: `Created 1C-Compatible ${runtimePage.kindKey} instances page`,
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(page, `Created 1C-Compatible ${runtimePage.kindKey} instances page`)
    }

    await page.goto(`/metahub/${metahubId}/resources`)
    await expect(page.getByRole('heading', { name: 'Ресурсы' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Реквизиты' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Общие реквизиты' })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'Компоненты' })).toHaveCount(0)
    await expect(page.getByText('Общий контейнер недоступен.')).toHaveCount(0)
    await expectNoTechnicalLeakage(page.locator('body'), {
        label: 'Created 1C-Compatible shared resources',
        checkUuidSubstrings: true
    })
    await expectNoPageHorizontalOverflow(page, 'Created 1C-Compatible shared resources')
    await expectRuntimeUxViewportMatrix(page, 'Created 1C-Compatible shared resources', {
        beforeEachViewport: async (viewport) => {
            await expect(page.getByRole('tab', { name: 'Реквизиты' })).toBeVisible()
            await expectLocatorFitsViewport(page.locator('body'), `1C-Compatible shared resources ${viewport.name}`)
        }
    })

    await page.goto(`/metahub/${metahubId}/settings`)
    await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible()
    for (const tabName of [
        'Константы',
        'Справочники',
        'Документы',
        'Журналы документов',
        'Регистры сведений',
        'Регистры накопления',
        'Планы счетов',
        'Планы видов характеристик',
        'Регистры бухгалтерии',
        'Планы видов расчета',
        'Регистры расчета'
    ]) {
        await expect(page.getByRole('tab', { name: tabName }), `Settings should expose ${tabName}`).toBeVisible()
    }
    const settingsResponse = await listMetahubSettings(api, metahubId)
    const settingKeys = new Set((settingsResponse.settings ?? []).map((setting: { key?: string }) => setting.key))
    for (const key of [
        'entity.constant.allowCopy',
        'entity.catalog.allowCopy',
        'entity.catalog.componentCodenameScope',
        'entity.catalog.allowComponentDelete',
        'entity.document.allowCopy',
        'entity.document.componentCodenameScope',
        'entity.document.allowComponentDelete',
        'entity.document-journal.allowCopy',
        'entity.information-register.componentCodenameScope',
        'entity.accumulation-register.allowComponentDelete',
        'entity.chart-of-accounts.allowCopy',
        'entity.chart-of-characteristic-types.componentCodenameScope',
        'entity.accounting-register.allowComponentDelete',
        'entity.chart-of-calculation-types.allowCopy',
        'entity.calculation-register.componentCodenameScope'
    ]) {
        expect(settingKeys.has(key), `Created 1C-Compatible metahub should seed ${key}`).toBe(true)
    }
    await page.getByRole('tab', { name: 'Справочники' }).click()
    await expect(page.getByText('Допустимые типы реквизитов')).toBeVisible()
    await expect(page.getByText(/Допустимые типы компонентов/)).toHaveCount(0)
    await expectNoVisibleTextPatterns(page.locator('body'), [/\bentity\.[a-z-]+\./, /\bone-c-[a-z-]+\b/, /\[object Object\]/], {
        label: 'Created 1C-Compatible settings'
    })
    await expectNoPageHorizontalOverflow(page, 'Created 1C-Compatible settings')
    await expectRuntimeUxViewportMatrix(page, 'Created 1C-Compatible settings', {
        beforeEachViewport: async (viewport) => {
            await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible()
            await expectLocatorFitsViewport(page.locator('body'), `1C-Compatible settings ${viewport.name}`)
        }
    })
}

async function expectOneCRuntimeTypeLifecycle(
    page: Page,
    api: ApiSessionLike,
    metahubId: string,
    config: RuntimeLifecycleConfig,
    testInfo: TestInfo
) {
    const uniqueSuffix = `${Date.now()}-${config.kindKey.replace(/[^a-z0-9]+/g, '-')}`
    const entityName = `QA ${config.title} ${uniqueSuffix}`
    const entityCodename = `qa-${config.kindKey.replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`
    const editedDescription = `Описание ${config.title.toLowerCase()} ${uniqueSuffix}`
    const copiedName = `${entityName} копия`
    const copiedCodename = `qa-${config.kindKey.replace(/[^a-z0-9]+/g, '-')}-copy-${Date.now()}`
    const createDialogName = new RegExp(`Создать.*${config.dialogNameFragment}`, 'i')
    const editDialogName = new RegExp(`Редактировать.*${config.dialogNameFragment}`, 'i')
    const copyDialogName = new RegExp(`Копировать.*${config.dialogNameFragment}`, 'i')
    const deleteDialogName = new RegExp(`Удалить.*${config.dialogNameFragment}`, 'i')

    await page.goto(`/metahub/${metahubId}/entities/${encodeURIComponent(config.kindKey)}/instances`)
    await expect(page.getByRole('heading', { name: config.title })).toBeVisible()

    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const validationDialog = page.getByRole('dialog', { name: createDialogName })
    await expect(validationDialog).toBeVisible()
    await expect(validationDialog.getByTestId(entityDialogSelectors.submitButton)).toBeDisabled()
    await expectSemanticFieldControls(validationDialog, { longTextLabels: ['Описание'] })
    await expectNoVisibleTextPatterns(validationDialog, [/\bentity\.[a-z-]+\./, /\bone-c-[a-z-]+\b/, /\[object Object\]/], {
        label: `1C-Compatible ${config.kindKey} empty create dialog`
    })
    await validationDialog.getByTestId(entityDialogSelectors.cancelButton).click()
    await expect(validationDialog).toHaveCount(0)

    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const createDialog = page.getByRole('dialog', { name: createDialogName })
    await expect(createDialog).toBeVisible()
    await createDialog.getByLabel('Название').first().fill(entityName)
    await createDialog.getByLabel('Кодовое имя').first().fill(entityCodename)
    await expect(createDialog.getByTestId(entityDialogSelectors.submitButton)).toBeEnabled()

    const createResponse = waitForSettledMutationResponse(
        page,
        (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahubId}/entities`),
        { label: `Creating 1C-Compatible ${config.kindKey}` }
    )
    await createDialog.getByTestId(entityDialogSelectors.submitButton).click()
    const createdEntity = await parseJsonResponse<EntityRecord>(await createResponse, `Creating 1C-Compatible ${config.kindKey}`)
    if (!createdEntity.id) {
        throw new Error(`Create ${config.kindKey} response did not contain an id`)
    }

    await waitForListEntity(() => listEntitiesViaApi(api, metahubId, config.kindKey), createdEntity.id, `1C-Compatible ${config.kindKey}`)
    await page.goto(`/metahub/${metahubId}/entities/${encodeURIComponent(config.kindKey)}/instances`)
    await expect(page.getByRole('heading', { name: config.title })).toBeVisible()
    await expect(page.getByText(entityName, { exact: true })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /Контейнеры|Containers|Хабы|Hubs/i })).toHaveCount(0)
    await expectNoDataGridTechnicalLeakage(page.locator('body'), { label: `Created 1C-Compatible ${config.kindKey} list` })
    await expectNoPageHorizontalOverflow(page, `Created 1C-Compatible ${config.kindKey} list`)

    await openEntityRowActionsByVisibleName(page, entityName)
    await page.getByRole('menuitem', { name: /Редактировать|Edit/i }).click()
    const editDialog = page.getByRole('dialog', { name: editDialogName })
    await expect(editDialog).toBeVisible()
    await expectSemanticFieldControls(editDialog, { longTextLabels: ['Описание'] })
    await editDialog.getByRole('tabpanel', { name: 'Основное' }).locator('textarea:not([readonly])').fill(editedDescription)

    const editResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'PATCH' && response.url().endsWith(`/api/v1/metahub/${metahubId}/entity/${createdEntity.id}`),
        { label: `Updating 1C-Compatible ${config.kindKey}` }
    )
    await editDialog.getByTestId(entityDialogSelectors.submitButton).click()
    expect((await editResponse).ok()).toBe(true)

    await expect
        .poll(
            async () => {
                const payload = await listEntitiesViaApi(api, metahubId, config.kindKey)
                return readLocalizedText(payload.items?.find((item) => item.id === createdEntity.id)?.description, 'ru')
            },
            { message: `Waiting for edited ${config.kindKey} description` }
        )
        .toBe(editedDescription)

    await openEntityRowActionsByVisibleName(page, entityName)
    await page.getByRole('menuitem', { name: /Копировать|Copy/i }).click()
    const copyDialog = page.getByRole('dialog', { name: copyDialogName })
    await expect(copyDialog).toBeVisible()
    await copyDialog.getByLabel('Название').first().fill(copiedName)
    await copyDialog.getByLabel('Кодовое имя').first().fill(copiedCodename)

    const copyResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(`/api/v1/metahub/${metahubId}/entity/${createdEntity.id}/copy`),
        { label: `Copying 1C-Compatible ${config.kindKey}` }
    )
    await copyDialog.getByTestId(entityDialogSelectors.submitButton).click()
    const copiedEntity = await parseJsonResponse<EntityRecord>(await copyResponse, `Copying 1C-Compatible ${config.kindKey}`)
    if (!copiedEntity.id) {
        throw new Error(`Copy ${config.kindKey} response did not contain an id`)
    }
    await waitForListEntity(
        () => listEntitiesViaApi(api, metahubId, config.kindKey),
        copiedEntity.id,
        `copied 1C-Compatible ${config.kindKey}`
    )
    await expect(page.getByText(copiedName, { exact: true })).toBeVisible()

    await openEntityRowActionsByVisibleName(page, copiedName)
    await page.getByRole('menuitem', { name: /Удалить|Delete/i }).click()
    const deleteDialog = page.getByRole('dialog', { name: deleteDialogName })
    await expect(deleteDialog).toBeVisible()

    const deleteResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'DELETE' && response.url().endsWith(`/api/v1/metahub/${metahubId}/entity/${copiedEntity.id}`),
        { label: `Deleting copied 1C-Compatible ${config.kindKey}` }
    )
    await deleteDialog.getByRole('button', { name: 'Удалить' }).click()
    expect((await deleteResponse).ok()).toBe(true)
    await waitForEntityAbsence(
        () => listEntitiesViaApi(api, metahubId, config.kindKey),
        copiedEntity.id,
        `copied 1C-Compatible ${config.kindKey}`
    )

    await page.screenshot({
        path: testInfo.outputPath(`1c-compatible-${config.kindKey}-lifecycle.png`),
        fullPage: true,
        animations: 'disabled'
    })
}

async function expectOneCRequisitesSurface(
    page: Page,
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    metahubId: string,
    entityTypes: Array<{ id?: string; kindKey?: string }>,
    testInfo: TestInfo
) {
    if (!entityTypes.some((item) => item.kindKey === 'catalog')) {
        throw new Error('Created 1C-Compatible metahub did not expose the catalog kind for requisites coverage')
    }

    const catalogName = `QA справочник ${Date.now()}`
    const catalogCodename = `qa-catalog-${Date.now()}`
    await page.goto(`/metahub/${metahubId}/entities/catalog/instances`)
    await expect(page.getByRole('heading', { name: 'Справочники' })).toBeVisible()
    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const catalogCreateDialog = page.getByRole('dialog', { name: /Создать.*справочник/i })
    await expect(catalogCreateDialog).toBeVisible()
    await catalogCreateDialog.getByLabel('Название').first().fill(catalogName)
    await catalogCreateDialog.getByLabel('Кодовое имя').first().fill(catalogCodename)
    const catalogCreateResponse = waitForSettledMutationResponse(
        page,
        (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahubId}/entities`),
        { label: 'Creating 1C-Compatible catalog through visible UI' }
    )
    await expect(catalogCreateDialog.getByTestId(entityDialogSelectors.submitButton)).toBeEnabled()
    await catalogCreateDialog.getByTestId(entityDialogSelectors.submitButton).click()
    const catalogEntity = await parseJsonResponse<EntityRecord>(
        await catalogCreateResponse,
        'Creating 1C-Compatible catalog through visible UI'
    )
    if (!catalogEntity?.id) {
        throw new Error('Catalog creation did not return an id for requisites coverage')
    }
    await waitForListEntity(() => listEntitiesViaApi(api, metahubId, 'catalog'), catalogEntity.id, 'UI-created 1C-Compatible catalog')

    const requisiteName = `QA реквизит ${Date.now()}`
    const requisiteCodename = `qa-requisite-${Date.now()}`
    const editedRequisiteName = `${requisiteName} изменён`
    const copiedRequisiteName = `${requisiteName} копия`
    const copiedRequisiteCodename = `qa-requisite-copy-${Date.now()}`
    const technicalPatterns = [/PostgreSQL|JSONB|VLC|\bSTRING\b|\bTABLE\b|OptionListEntity|System key/i]

    await page.goto(`/metahub/${metahubId}/entities/catalog/instances`)
    await expect(page.getByText(catalogName, { exact: true })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /Контейнеры|Containers|Хабы|Hubs/i })).toHaveCount(0)
    await openEntityRowActionsByVisibleName(page, catalogName)
    await page.getByRole('menuitem', { name: /Открыть реквизиты|Open requisites/i }).click()
    await expect(page.getByRole('heading', { name: 'Реквизиты' })).toBeVisible()
    await expect(page.getByPlaceholder(/Поиск реквизитов|Search requisites/i)).toBeVisible()
    await expect(page.getByText(/Компоненты|Components/)).toHaveCount(0)
    await expectNoVisibleTextPatterns(page.locator('body'), technicalPatterns, {
        label: '1C-Compatible catalog requisites page'
    })
    await expectNoPageHorizontalOverflow(page, '1C-Compatible catalog requisites page')

    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const createDialog = page.getByRole('dialog', { name: /Создать реквизит|Create requisite/i })
    await expect(createDialog).toBeVisible()
    await expect(createDialog.getByLabel('Название').first()).toBeVisible()
    await expect(createDialog.getByLabel('Код реквизита').first()).toBeVisible()
    await expect(createDialog.getByLabel('Тип реквизита').first()).toBeVisible()
    await expect(createDialog.getByText(/PostgreSQL|JSONB|VLC|OptionListEntity|System key/i)).toHaveCount(0)
    await expectNoVisibleTextPatterns(createDialog, technicalPatterns, {
        label: '1C-Compatible catalog requisite create dialog'
    })

    const typeSelect = createDialog.getByLabel('Тип реквизита').first()
    await typeSelect.click()
    const typeListbox = page.getByRole('listbox').first()
    await expect(typeListbox).toBeVisible()
    await expect(typeListbox.getByRole('option', { name: /Строка|String/i })).toBeVisible()
    await expectNoVisibleTextPatterns(typeListbox, technicalPatterns, {
        label: '1C-Compatible requisite type listbox'
    })
    await page.keyboard.press('Escape')

    await createDialog.getByLabel('Название').first().fill(requisiteName)
    await createDialog.getByLabel('Код реквизита').first().fill(requisiteCodename)

    const createResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' &&
            (response.url().endsWith(`/api/v1/metahub/${metahubId}/entities/catalog/instance/${catalogEntity.id}/components`) ||
                response.url().endsWith(`/api/v1/metahub/${metahubId}/entities/object/instance/${catalogEntity.id}/components`)),
        { label: 'Creating 1C-Compatible catalog requisite' }
    )
    await expect(createDialog.getByTestId(entityDialogSelectors.submitButton)).toBeEnabled()
    await createDialog.getByTestId(entityDialogSelectors.submitButton).click()
    const createdRequisite = unwrapApiData<ComponentRecord>(
        await parseJsonResponse(await createResponse, 'Creating 1C-Compatible catalog requisite')
    )
    if (!createdRequisite.id) {
        throw new Error('Created requisite response did not contain an id')
    }

    await expect(page.getByText(requisiteName, { exact: true })).toBeVisible()
    await expectNoDataGridTechnicalLeakage(page.locator('body'), { label: 'Created 1C-Compatible catalog requisite list' })
    await expectNoVisibleTextPatterns(page.locator('body'), technicalPatterns, {
        label: 'Created 1C-Compatible catalog requisite list'
    })
    await expectNoPageHorizontalOverflow(page, 'Created 1C-Compatible catalog requisite list')
    await expectRuntimeUxViewportMatrix(page, 'Created 1C-Compatible catalog requisite list', {
        beforeEachViewport: async (viewport) => {
            await expect(page.getByRole('heading', { name: 'Реквизиты' })).toBeVisible()
            await expectLocatorFitsViewport(page.locator('body'), `1C-Compatible catalog requisites ${viewport.name}`)
        }
    })

    await openEntityRowActionsByVisibleName(page, requisiteName)
    const editMenuItem = page.getByRole('menuitem', { name: /Редактировать|Edit/i })
    await expect(editMenuItem).toBeVisible()
    await editMenuItem.focus()
    await page.keyboard.press('Enter')
    const editDialog = page.getByRole('dialog', { name: /Редактировать реквизит|Edit requisite/i })
    await expect(editDialog).toBeVisible()
    await expect(editDialog.getByText(/Компонент|Component|Field Definition/i)).toHaveCount(0)
    await expect(editDialog.getByLabel(/Код реквизита|Requisite code/i).first()).toBeVisible()
    await expect(editDialog.getByLabel(/Тип реквизита|Requisite type/i).first()).toBeVisible()
    await expectSemanticFieldControls(editDialog, { longTextLabels: [] })
    await editDialog.getByLabel('Название').first().fill(editedRequisiteName)
    const editResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'PATCH' &&
            isCatalogRequisiteRoute(response.url(), metahubId, catalogEntity.id, `component/${createdRequisite.id}`),
        { label: 'Updating 1C-Compatible catalog requisite' }
    )
    await editDialog.getByTestId(entityDialogSelectors.submitButton).click()
    expect((await editResponse).ok()).toBe(true)
    await expect(page.getByText(editedRequisiteName, { exact: true })).toBeVisible()

    await openEntityRowActionsByVisibleName(page, editedRequisiteName)
    await page.getByRole('menuitem', { name: /Копировать|Copy/i }).click()
    const copyDialog = page.getByRole('dialog', { name: /Копирование реквизита|Copy requisite/i })
    await expect(copyDialog).toBeVisible()
    await expect(copyDialog.getByText(/Компонент|Component|Field Definition/i)).toHaveCount(0)
    await expect(copyDialog.getByLabel(/Код реквизита|Requisite code/i).first()).toBeVisible()
    await expect(copyDialog.getByLabel(/Тип реквизита|Requisite type/i).first()).toBeVisible()
    await copyDialog.getByLabel('Название').first().fill(copiedRequisiteName)
    await copyDialog
        .getByLabel(/Код реквизита|Кодовое имя|Codename/i)
        .first()
        .fill(copiedRequisiteCodename)
    const copyResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' &&
            isCatalogRequisiteRoute(response.url(), metahubId, catalogEntity.id, `component/${createdRequisite.id}/copy`),
        { label: 'Copying 1C-Compatible catalog requisite' }
    )
    await copyDialog.getByTestId(entityDialogSelectors.submitButton).click()
    const copiedRequisite = unwrapApiData<ComponentRecord>(
        await parseJsonResponse(await copyResponse, 'Copying 1C-Compatible catalog requisite')
    )
    if (!copiedRequisite.id) {
        throw new Error('Copied requisite response did not contain an id')
    }
    await expect(page.getByText(copiedRequisiteName, { exact: true })).toBeVisible()

    await openEntityRowActionsByVisibleName(page, copiedRequisiteName)
    await page.getByRole('menuitem', { name: /Удалить|Delete/i }).click()
    const deleteDialog = page.getByRole('dialog', { name: /Удалить реквизит|Delete requisite/i })
    await expect(deleteDialog).toBeVisible()
    await expect(deleteDialog.getByText(/Компонент|Component|Field Definition/i)).toHaveCount(0)
    const deleteResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'DELETE' &&
            isCatalogRequisiteRoute(response.url(), metahubId, catalogEntity.id, `component/${copiedRequisite.id}`),
        { label: 'Deleting copied 1C-Compatible catalog requisite' }
    )
    await deleteDialog.getByRole('button', { name: /Удалить|Delete/i }).click()
    expect((await deleteResponse).ok()).toBe(true)
    await expect(page.getByText(copiedRequisiteName, { exact: true })).toHaveCount(0)

    const tamperedCreateResponse = await sendWithCsrf(
        api,
        'POST',
        `/api/v1/metahub/${metahubId}/entities/document/instance/${catalogEntity.id}/components`,
        {
            name: { ru: 'Некорректный реквизит' },
            namePrimaryLocale: 'ru',
            codename: createLocalizedContent('en', `qa-route-tamper-${Date.now()}`),
            dataType: 'STRING'
        }
    )
    expect(tamperedCreateResponse.status).toBe(404)

    await page.screenshot({
        path: testInfo.outputPath('1c-compatible-catalog-requisites.png'),
        fullPage: true,
        animations: 'disabled'
    })
}

test('@flow @1c-compatible lists 1C-Compatible as an opt-in template with preview core presets', async ({ runManifest }) => {
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const templates = await listTemplates(api, { definitionType: 'metahub_template' })
        const items = Array.isArray(templates?.data) ? templates.data : []
        const oneC = items.find((template: { codename?: string }) => template.codename === '1c-compatible')

        expect(oneC, '1C-Compatible template should be registered').toBeTruthy()
        expect(items[0]?.codename, 'Basic remains the first/default system template').toBe('basic')

        const detail = await getTemplate(api, oneC.id)
        const manifest = detail.activeVersionManifest
        expect(manifest?.codename).toBe('1c-compatible')
        expect(manifest?.presets?.map((preset: { presetCodename: string }) => preset.presetCodename)).toEqual(ONE_C_TEMPLATE_PRESETS)
        const serializedManifest = JSON.stringify(manifest)
        expect(serializedManifest).toMatch(/not an official 1c product/i)
        expect(serializedManifest).toMatch(/not certified by 1c/i)
        expect(serializedManifest).not.toMatch(/officially certified|partnered with 1c|endorsed by 1c/i)

        const presetTemplates = await listTemplates(api, { definitionType: 'entity_type_preset' })
        const presetCodenames = (Array.isArray(presetTemplates?.data) ? presetTemplates.data : []).map(
            (preset: { codename?: string }) => preset.codename
        )
        expect(presetCodenames.filter((codename?: string) => codename?.startsWith('one-c-')).sort()).toEqual(
            [...ONE_C_PRESET_CODENAMES].sort()
        )
        expect(presetCodenames).toContain('enumeration')
    } finally {
        await disposeApiContext(api)
    }
})

test('@flow @1c-compatible creates a metahub from 1C-Compatible without making it the default', async ({ runManifest }) => {
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const defaultMetahub = await createMetahub(api, {
            name: { en: `E2E ${runManifest.runId} default template control` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', `${runManifest.runId}-default-template-control`)
        })
        if (!defaultMetahub?.id) {
            throw new Error('Default metahub creation did not return an id')
        }
        await recordCreatedMetahub({
            id: defaultMetahub.id,
            name: `E2E ${runManifest.runId} default template control`,
            codename: `${runManifest.runId}-default-template-control`
        })
        const defaultEntityTypes = await listMetahubEntityTypes(api, defaultMetahub.id, { limit: 100, offset: 0 })
        const defaultKindKeys = (defaultEntityTypes.items ?? []).map((item: { kindKey?: string }) => item.kindKey)
        expect(defaultKindKeys).toEqual(expect.arrayContaining(['hub', 'page', 'object', 'set', 'enumeration']))
        expect(defaultKindKeys).not.toEqual(expect.arrayContaining(['constant', 'catalog', 'document', 'document-journal']))

        const oneCMetahub = await createMetahub(api, {
            name: { en: `E2E ${runManifest.runId} 1C-Compatible` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', `${runManifest.runId}-1c-compatible`),
            templateCodename: '1c-compatible'
        })

        if (!oneCMetahub?.id) {
            throw new Error('1C-Compatible metahub creation did not return an id')
        }

        await recordCreatedMetahub({
            id: oneCMetahub.id,
            name: `E2E ${runManifest.runId} 1C-Compatible`,
            codename: `${runManifest.runId}-1c-compatible`
        })

        const entityTypes = await listMetahubEntityTypes(api, oneCMetahub.id, { limit: 100, offset: 0 })
        const kindKeys = (entityTypes.items ?? []).map((item: { kindKey?: string }) => item.kindKey)
        expect(kindKeys).toEqual(expect.arrayContaining(ONE_C_TEMPLATE_KIND_KEYS))
    } finally {
        await disposeApiContext(api)
    }
})

test('@flow @1c-compatible @runtime-ux-canary validates the 1C-Compatible picker and requisites UX without technical leakage', async ({
    page,
    runManifest
}, testInfo) => {
    const runtimeIssues = watchBrowserRuntimeIssues(page)
    const metahubName = `E2E ${runManifest.runId} 1C UI`
    const metahubCodename = `${runManifest.runId}-1c-ui`

    await applyBrowserPreferences(page, { language: 'ru' })
    await page.goto('/metahubs')
    const createButton = page.getByTestId(toolbarSelectors.primaryAction)
    await createButton.focus()
    await expect(createButton).toBeFocused()
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Выберите шаблон')).toBeVisible()
    await dialog.getByLabel('Название').first().fill(metahubName)
    await dialog.getByLabel('Кодовое имя').first().fill(metahubCodename)

    const templateSelect = dialog.getByLabel('Выберите шаблон')
    await templateSelect.focus()
    await page.keyboard.press('Enter')
    const oneCOption = page.getByRole('option', { name: /1C-Compatible|1С-Совместимый/i })
    await expect(oneCOption).toBeVisible()
    await expect(page.getByText(/Шаблон с использованием типов сущностей, совместимых с 1С:Предприятие 8\.х/i)).toBeVisible()
    await expect(page.getByText(/Не является официальным продуктом 1С и не сертифицирован компанией 1С/i)).toBeVisible()
    await expect(page.getByText(/Каталог пресетов в предпросмотре/i)).toHaveCount(0)
    await expect(page.getByText(/Опциональный шаблон транзакционного учета/i)).toHaveCount(0)
    await expectLocatorFitsViewport(page.getByRole('listbox').first(), '1C-Compatible template select listbox')
    await expectNoTechnicalLeakage(page.locator('body'), {
        label: '1C-Compatible template select listbox',
        checkUuidSubstrings: true
    })
    await expectNoVisibleTextPatterns(page.locator('body'), [/\bone-c-[a-z-]+\b/], {
        label: '1C-Compatible template select listbox'
    })
    await oneCOption.click()
    await expect(templateSelect).toContainText(/1C-Compatible|1С-Совместимый/i)
    await expectRuntimeUxViewportMatrix(page, '1C-Compatible template picker dialog', {
        beforeEachViewport: async (viewport) => {
            await expect(page.getByRole('dialog').getByLabel('Выберите шаблон')).toBeVisible()
            await expectLocatorFitsViewport(page.locator('body'), `1C-Compatible template picker ${viewport.name}`)
        }
    })

    await page.screenshot({
        path: testInfo.outputPath('1c-compatible-template-picker.png'),
        fullPage: true,
        animations: 'disabled'
    })

    await expectNoTechnicalLeakage(dialog, {
        label: '1C-Compatible metahub template picker',
        checkUuidSubstrings: true
    })

    await expect(dialog.getByTestId(entityDialogSelectors.submitButton)).toBeEnabled()
    const createMetahubResponse = waitForSettledMutationResponse(
        page,
        (response) => response.request().method() === 'POST' && response.url().endsWith('/api/v1/metahubs'),
        { label: 'Creating 1C-Compatible metahub through the browser dialog' }
    )
    await dialog.getByTestId(entityDialogSelectors.submitButton).click()
    const persistedMetahub = unwrapApiData<MetahubRecord>(
        await parseJsonResponse(await createMetahubResponse, 'Creating 1C-Compatible metahub through the browser dialog')
    )
    if (!persistedMetahub?.id) {
        throw new Error('1C-Compatible metahub browser creation did not return an id')
    }
    await recordCreatedMetahub({
        id: persistedMetahub.id,
        name: metahubName,
        codename: metahubCodename
    })
    await expect(dialog).toHaveCount(0)
    await ensureMetahubVisible(page, metahubName)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const entityTypes = await listMetahubEntityTypes(api, persistedMetahub.id, { limit: 100, offset: 0 })
        const kindKeys = (entityTypes.items ?? []).map((item: { kindKey?: string }) => item.kindKey)
        expect(kindKeys).toEqual(expect.arrayContaining(ONE_C_TEMPLATE_KIND_KEYS))

        await ensureMetahubVisible(page, metahubName)
        await expectCreatedOneCMetahubEntityTypeUi(page, api, persistedMetahub.id, entityTypes.items ?? [], testInfo)
        await expectOneCRequisitesSurface(page, api, persistedMetahub.id, entityTypes.items ?? [], testInfo)

        for (const lifecycleConfig of [
            { kindKey: 'constant', title: 'Константы', dialogNameFragment: 'констант' },
            { kindKey: 'catalog', title: 'Справочники', dialogNameFragment: 'справочник' },
            { kindKey: 'document', title: 'Документы', dialogNameFragment: 'документ' },
            { kindKey: 'document-journal', title: 'Журналы документов', dialogNameFragment: 'журнал документов' },
            { kindKey: 'information-register', title: 'Регистры сведений', dialogNameFragment: 'регистр сведений' },
            { kindKey: 'accumulation-register', title: 'Регистры накопления', dialogNameFragment: 'регистр накопления' }
        ] satisfies RuntimeLifecycleConfig[]) {
            await expectOneCRuntimeTypeLifecycle(page, api, persistedMetahub.id, lifecycleConfig, testInfo)
        }

        const defaultMetahub = await createMetahub(api, {
            name: { en: `E2E ${runManifest.runId} browser hub instances control` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', `${runManifest.runId}-browser-hub-instances-control`)
        })
        if (!defaultMetahub?.id) {
            throw new Error('Default browser hub instances control metahub did not return an id')
        }
        await recordCreatedMetahub({
            id: defaultMetahub.id,
            name: `E2E ${runManifest.runId} browser hub instances control`,
            codename: `${runManifest.runId}-browser-hub-instances-control`
        })
        await page.goto(`/metahub/${defaultMetahub.id}/entities/hub/instances`)
        await expect(page.getByRole('heading', { name: 'Хабы' })).toBeVisible()
        await expectNoPageHorizontalOverflow(page, 'Default hub instances page')

        expectNoBrowserRuntimeIssues(runtimeIssues, '1C-Compatible metahub browser flow')
    } finally {
        await disposeApiContext(api)
    }
})
