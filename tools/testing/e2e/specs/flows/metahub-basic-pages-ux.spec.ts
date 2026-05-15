import type { Locator, Page, Response as PlaywrightResponse, TestInfo } from '@playwright/test'
import { createLocalizedContent } from '@universo/utils'

import { expect, test } from '../../fixtures/test'
import {
    createLocale,
    createLoggedInApiContext,
    createMetahub,
    disposeApiContext,
    listFixedValues,
    listMetahubEntityTypes,
    listValueGroups
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import { recordCreatedLocale, recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { confirmDeleteSelectors, entityDialogSelectors, toolbarSelectors } from '../../support/selectors/contracts'

function readLocalizedText(value: unknown, locale = 'en'): string | undefined {
    if (typeof value === 'string') {
        return value
    }

    if (!value || typeof value !== 'object') {
        return undefined
    }

    const localized = value as { _primary?: string; locales?: Record<string, { content?: string }> }
    const locales = localized.locales ?? {}
    return locales[locale]?.content ?? (localized._primary ? locales[localized._primary]?.content : undefined)
}

async function captureProofScreenshot(page: Page, testInfo: TestInfo, name: string) {
    await page.screenshot({
        path: testInfo.outputPath(name),
        fullPage: true,
        animations: 'disabled'
    })
}

async function parseJsonResponse<T>(response: PlaywrightResponse, label: string): Promise<T> {
    const bodyText = await response.text()

    if (!response.ok()) {
        throw new Error(`${label} failed with ${response.status()} ${response.statusText()}: ${bodyText}`)
    }

    return JSON.parse(bodyText) as T
}

async function expectMutationOk(response: PlaywrightResponse, label: string) {
    const bodyText = await response.text()

    if (!response.ok()) {
        throw new Error(`${label} failed with ${response.status()} ${response.statusText()}: ${bodyText}`)
    }
}

async function expectMenuItemOrder(page: Page, metahubId: string, orderedKinds: string[]) {
    const positions = await Promise.all(
        orderedKinds.map(async (kind) => {
            const link = page.locator(`a[href$="/metahub/${metahubId}/entities/${kind}/instances"]`).first()
            await expect(link).toBeVisible()
            const box = await link.boundingBox()
            expect(box?.y).toBeGreaterThan(0)
            return box?.y ?? 0
        })
    )

    for (let index = 1; index < positions.length; index += 1) {
        expect(positions[index]).toBeGreaterThan(positions[index - 1])
    }
}

async function expectPaginationFullWidth(page: Page) {
    const paginationFillsContent = await page.getByTestId('entity-instances-pagination').evaluate((element) => {
        const parent = element.parentElement

        if (!parent) {
            return false
        }

        const elementBox = element.getBoundingClientRect()
        const parentBox = parent.getBoundingClientRect()

        return Math.abs(elementBox.width - parentBox.width) <= 2
    })

    expect(paginationFillsContent).toBe(true)
}

async function openRowActionsMenu(page: Page, rowLabel: string) {
    const row = page.getByRole('row').filter({ hasText: rowLabel })
    await expect(row).toBeVisible()
    await expect(row.getByRole('button', { name: /Редактировать|Edit|Копировать|Copy|Удалить|Delete/i })).toHaveCount(0)

    const menuButton = row.getByRole('button', { name: /Опции|Другие действия|More actions/i }).first()
    await expect(menuButton).toBeVisible()
    await menuButton.click()

    return row
}

async function readOpenMenuIconSignatures(page: Page): Promise<string[]> {
    return page.getByRole('menuitem').evaluateAll((items) =>
        items.map((item) =>
            Array.from(item.querySelectorAll('svg path'))
                .map((path) => path.getAttribute('d') ?? '')
                .join('|')
        )
    )
}

async function readTabTypography(tab: Locator) {
    return tab.evaluate((element) => {
        const style = window.getComputedStyle(element)
        return {
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            lineHeight: style.lineHeight,
            textTransform: style.textTransform
        }
    })
}

async function watchMenuTextDuringClose(page: Page, forbiddenText: string) {
    await page.evaluate((text) => {
        const win = window as typeof window & {
            __forbiddenMenuTextHits?: string[]
            __forbiddenMenuTextObserver?: MutationObserver
        }
        win.__forbiddenMenuTextHits = []
        win.__forbiddenMenuTextObserver?.disconnect()
        win.__forbiddenMenuTextObserver = new MutationObserver(() => {
            if (document.body.textContent?.includes(text)) {
                win.__forbiddenMenuTextHits?.push(text)
            }
        })
        win.__forbiddenMenuTextObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        })
    }, forbiddenText)
}

async function expectNoWatchedMenuText(page: Page) {
    const hits = await page.evaluate(() => {
        const win = window as typeof window & {
            __forbiddenMenuTextHits?: string[]
            __forbiddenMenuTextObserver?: MutationObserver
        }
        win.__forbiddenMenuTextObserver?.disconnect()
        const values = win.__forbiddenMenuTextHits ?? []
        win.__forbiddenMenuTextHits = []
        return values
    })

    expect(hits).toEqual([])
}

test('@flow basic metahub exposes clean Pages UX and Sets-backed shared constants', async ({ page, runManifest }, testInfo) => {
    test.setTimeout(180_000)

    const bootstrapApi = await createBootstrapApiContext()
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} basic pages ux`
    const metahubCodename = `${runManifest.runId}-basic-pages-ux`

    try {
        const germanLocale = await createLocale(bootstrapApi, {
            code: 'de',
            name: createLocalizedContent('en', 'German'),
            nativeName: 'Deutsch',
            isEnabledContent: true,
            isEnabledUi: false,
            sortOrder: 30
        })
        await recordCreatedLocale({ id: germanLocale.id, code: 'de' })

        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename),
            templateCodename: 'basic'
        })

        if (!metahub?.id) {
            throw new Error('Basic metahub creation did not return an id for Pages UX coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        const entityTypes = await listMetahubEntityTypes(api, metahub.id, { limit: 1000, offset: 0 })
        const orderedObjectKinds = (entityTypes.items ?? [])
            .filter((item: { ui?: { sidebarSection?: string }; kindKey?: string }) => (item.ui?.sidebarSection ?? 'objects') === 'objects')
            .sort(
                (
                    left: { ui?: { sidebarOrder?: number | null }; kindKey?: string },
                    right: { ui?: { sidebarOrder?: number | null }; kindKey?: string }
                ) => Number(left.ui?.sidebarOrder ?? Number.MAX_SAFE_INTEGER) - Number(right.ui?.sidebarOrder ?? Number.MAX_SAFE_INTEGER)
            )
            .map((item: { kindKey?: string }) => item.kindKey)

        expect(orderedObjectKinds.slice(0, 5)).toEqual(['hub', 'page', 'object', 'set', 'enumeration'])

        const sets = await listValueGroups(api, metahub.id, { limit: 100, offset: 0 })
        const mainSet = (sets.items ?? []).find(
            (item: { codename?: unknown; name?: unknown }) =>
                readLocalizedText(item.codename, 'en') === 'Main' || readLocalizedText(item.name, 'en') === 'Main'
        )
        expect(mainSet?.id).toBeTruthy()

        const constants = await listFixedValues(api, metahub.id, mainSet.id, { limit: 100, offset: 0 })
        expect((constants.items ?? []).some((item: { codename?: unknown }) => readLocalizedText(item.codename, 'en') === 'AppName')).toBe(
            true
        )

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.addInitScript(() => {
            window.localStorage.setItem('metahubsEntityInstanceDisplayStyle', 'list')
        })
        await page.goto(`/metahub/${metahub.id}/entities/page/instances`)

        await expect(page.getByRole('heading', { name: 'Страницы' })).toBeVisible({ timeout: 60_000 })
        const breadcrumbs = page.getByRole('navigation', { name: 'breadcrumb' })
        await expect(breadcrumbs.getByText('Страницы', { exact: true })).toBeVisible()
        await expect(breadcrumbs.getByText('pages', { exact: true })).toHaveCount(0)
        await expect(breadcrumbs.getByText('metahubs:pages.title', { exact: true })).toHaveCount(0)
        await expect(page.getByPlaceholder('Поиск страниц...')).toBeVisible()
        await expect(page.getByText('Добро пожаловать').first()).toBeVisible()
        await expect(page.getByText('Экземпляров сущностей пока нет')).toHaveCount(0)
        await expect(page.getByText('metahubs:pages.title')).toHaveCount(0)
        await expect(page.getByText(/унифицированном entity-owned маршруте/i)).toHaveCount(0)
        await expect(page.getByText('Показать удалённые')).toHaveCount(0)

        const createButton = page.getByTestId(toolbarSelectors.primaryAction)
        await expect(createButton).toBeVisible()
        await expect(createButton).toContainText('Создать')
        await expect(createButton).not.toContainText('Создать сущность')

        await expectMenuItemOrder(page, metahub.id, ['hub', 'page', 'object', 'set', 'enumeration'])
        await captureProofScreenshot(page, testInfo, 'basic-pages-list-ru.png')

        const pageContentText = `Intro text from browser lifecycle coverage ${runManifest.runId}`

        await page.getByRole('row').filter({ hasText: 'Добро пожаловать' }).getByText('Добро пожаловать').click()
        await expect(page).toHaveURL(new RegExp(`/metahub/${metahub.id}/entities/page/instance/.+/content$`))
        await expect(page.getByRole('heading', { name: 'Добро пожаловать', level: 1 })).toBeVisible()
        await expect(page.getByText(/Контент типа/i)).toHaveCount(0)
        await expect(page.getByRole('button', { name: /^Назад$/ })).toHaveCount(0)
        await expect(page.getByRole('tab').first()).toContainText('English')
        await expect(page.getByRole('tab', { name: /Русский/ })).toBeVisible()
        await expect(page.getByRole('tab', { name: /English/ })).toBeVisible()
        await expect(page.locator('[data-content-locale-tab="en"] svg')).toHaveCount(1)
        const pageActiveTabTypography = await readTabTypography(page.locator('[data-content-locale-tab="en"]'))
        const pageInactiveTabTypography = await readTabTypography(page.locator('[data-content-locale-tab="ru"]'))
        await expect(page.getByText('Use this page to publish structured application content.')).toBeVisible()
        await expect(page.getByText('Используйте эту страницу для публикации структурированного контента приложения.')).toHaveCount(0)
        await captureProofScreenshot(page, testInfo, 'basic-pages-default-content-ru.png')

        const russianLanguageActions = page.getByRole('button', { name: 'Действия языка Русский' })
        await russianLanguageActions.click()
        await expect(page.getByRole('menuitem', { name: 'Поменять язык' })).toBeEnabled()
        await expect(page.getByRole('menuitem', { name: 'Сделать главным' })).toBeVisible()
        await page.getByRole('menuitem', { name: 'Сделать главным' }).click()
        await russianLanguageActions.click()
        await expect(page.getByRole('menuitem', { name: 'Главный вариант' })).toBeDisabled()
        await watchMenuTextDuringClose(page, 'Сделать главным')
        await page.locator('body').click({ position: { x: 10, y: 10 } })
        await page.waitForTimeout(350)
        await expectNoWatchedMenuText(page)
        await russianLanguageActions.click()
        await expect(page.getByRole('menuitem', { name: 'Главный вариант' })).toBeDisabled()
        await page.keyboard.press('Escape')

        const defaultEditorRoot = page.getByTestId('editorjs-block-editor')
        const localizedParagraph = defaultEditorRoot
            .locator('.ce-block')
            .filter({ hasText: 'Используйте эту страницу для публикации структурированного контента приложения.' })
            .first()
        await localizedParagraph.click()
        await page.keyboard.press('End')
        await page.keyboard.type(` ${pageContentText}`)
        await expect(defaultEditorRoot.getByText(pageContentText)).toBeVisible()
        await page.waitForTimeout(600)

        const defaultTextBox = await localizedParagraph.getByText(pageContentText).boundingBox()
        const defaultEditorRootBox = await defaultEditorRoot.boundingBox()
        expect(defaultTextBox).toBeTruthy()
        expect(defaultEditorRootBox).toBeTruthy()
        const defaultPlusButton = page.locator('.ce-toolbar__plus').first()
        if (await defaultPlusButton.isVisible()) {
            const defaultPlusButtonBox = await defaultPlusButton.boundingBox()
            expect(defaultPlusButtonBox).toBeTruthy()
            expect(defaultPlusButtonBox!.x).toBeGreaterThanOrEqual(defaultEditorRootBox!.x + 4)
            expect(defaultPlusButtonBox!.x + defaultPlusButtonBox!.width).toBeLessThanOrEqual(defaultTextBox!.x - 2)
        }
        const defaultBlockTuneButton = page.locator('.ce-toolbar__settings-btn').first()
        if (await defaultBlockTuneButton.isVisible()) {
            const defaultTuneButtonBox = await defaultBlockTuneButton.boundingBox()
            expect(defaultTuneButtonBox).toBeTruthy()
            expect(defaultTuneButtonBox!.x + defaultTuneButtonBox!.width).toBeLessThanOrEqual(defaultTextBox!.x - 2)
            await defaultBlockTuneButton.click()
        } else {
            await page.keyboard.press('Control+/')
        }
        const defaultDeleteMenuItem = page.getByText('Удалить', { exact: true })
        await expect(defaultDeleteMenuItem).toBeVisible()
        await expect(page.getByText('Delete', { exact: true })).toHaveCount(0)
        const defaultMenuBox = await defaultDeleteMenuItem.boundingBox()
        expect(defaultMenuBox).toBeTruthy()
        expect(defaultTextBox!.x - defaultEditorRootBox!.x).toBeGreaterThanOrEqual(32)
        expect(defaultTextBox!.x - defaultEditorRootBox!.x).toBeLessThanOrEqual(72)
        expect(defaultMenuBox!.x).toBeGreaterThanOrEqual(defaultEditorRootBox!.x - 1)
        await page.keyboard.press('Escape')
        await expect(page.getByRole('button', { name: /Сохранить|Save/i })).toBeEnabled({ timeout: 10_000 })

        const saveDefaultContentResponse = waitForSettledMutationResponse(
            page,
            (response) => response.request().method() === 'PATCH' && response.url().includes(`/api/v1/metahub/${metahub.id}/entity/`),
            { label: 'Saving default Page content through the visual Editor.js route' }
        )
        await page.getByRole('button', { name: /Сохранить|Save/i }).click()
        const savedDefaultContentPage = await parseJsonResponse<{ config?: { blockContent?: unknown } }>(
            await saveDefaultContentResponse,
            'Saving default Page content through the visual Editor.js route'
        )
        expect(JSON.stringify(savedDefaultContentPage.config?.blockContent ?? {})).toContain(pageContentText)
        expect(JSON.stringify(savedDefaultContentPage.config?.blockContent ?? {})).toContain('"ru"')

        await page.reload()
        await expect(page.getByRole('heading', { name: 'Добро пожаловать', level: 1 })).toBeVisible()
        await expect(page.getByRole('tab').first()).toContainText('Русский')
        await expect(page.locator('[data-content-locale-tab="ru"] svg')).toHaveCount(1)

        await page.goto(`/metahub/${metahub.id}/entities/page/instances`)
        await expect(page.getByRole('heading', { name: 'Страницы' })).toBeVisible()

        await createButton.click()
        const dialog = page.getByRole('dialog')
        await expect(dialog.getByRole('heading', { name: 'Создать страницу' })).toBeVisible()
        await expect(dialog.getByRole('heading', { name: 'Создать сущность' })).toHaveCount(0)
        await expect(dialog.getByRole('tab', { name: 'Хабы' })).toBeVisible()
        await expect(dialog.getByRole('tab', { name: 'Макеты' })).toBeVisible()
        await expect(dialog.getByRole('tab', { name: 'Контент' })).toHaveCount(0)
        await expect(dialog.getByText('Page content')).toHaveCount(0)
        await dialog.getByRole('tab', { name: 'Хабы' }).click()
        await dialog.getByTestId('entity-selection-add-button').click()
        await expect(page.getByTestId('entity-selection-search')).toBeVisible()
        await expect(page.getByText(/Main|Основ/i).first()).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(page.getByTestId('entity-selection-search')).toHaveCount(0)
        await captureProofScreenshot(page, testInfo, 'basic-pages-create-dialog-ru.png')

        await dialog.getByRole('button', { name: 'Отмена' }).click()
        await expect(dialog).toHaveCount(0)

        const pageTitle = `Учебная страница ${runManifest.runId}`
        const pageCodename = `${runManifest.runId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-learning-page`
        const editedDescription = `Описание страницы ${runManifest.runId}`
        const copiedPageTitle = `${pageTitle} копия`
        const copiedPageCodename = `${pageCodename}-copy`

        await createButton.click()
        const createPageDialog = page.getByRole('dialog')
        await expect(createPageDialog).toBeVisible()
        await createPageDialog
            .getByLabel(/Название|Name/i)
            .first()
            .fill(pageTitle)
        await createPageDialog
            .getByLabel(/Кодовое имя|Codename/i)
            .first()
            .fill(pageCodename)
        await expect(createPageDialog.getByRole('tab', { name: 'Контент' })).toHaveCount(0)

        const createPageResponse = waitForSettledMutationResponse(
            page,
            (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities`),
            { label: 'Creating Page through the browser' }
        )
        await createPageDialog.getByTestId(entityDialogSelectors.submitButton).click()
        const createdPage = await parseJsonResponse<{ id?: string }>(await createPageResponse, 'Creating Page through the browser')

        if (!createdPage.id) {
            throw new Error('Create Page response did not contain an id')
        }

        await expect(page).toHaveURL(new RegExp(`/metahub/${metahub.id}/entities/page/instance/${createdPage.id}/content$`))
        await expect(page.getByRole('heading', { name: pageTitle, level: 1 })).toBeVisible()
        await expect(page.getByText(/Контент типа/i)).toHaveCount(0)
        await expect(page.getByRole('button', { name: /^Назад$/ })).toHaveCount(0)
        await expect(page.getByRole('tab', { name: /Русский/ })).toBeVisible()
        await expect(page.getByRole('tab', { name: /English/ })).toHaveCount(0)
        await page.getByRole('button', { name: 'Добавить язык контента' }).click()
        await watchMenuTextDuringClose(page, 'Поменять язык')
        await page.locator('body').click({ position: { x: 10, y: 10 } })
        await page.waitForTimeout(350)
        await expectNoWatchedMenuText(page)
        await page.getByRole('button', { name: 'Добавить язык контента' }).click()
        await page.getByRole('menuitem', { name: 'English' }).click()
        await expect(page.getByRole('tab', { name: /English/ })).toBeVisible()
        await page.getByRole('button', { name: 'Действия языка English' }).click()
        await page.getByRole('menuitem', { name: 'Поменять язык' }).click()
        await page.getByRole('menuitem', { name: 'Deutsch' }).click()
        await expect(page.getByRole('tab', { name: /Deutsch/ })).toBeVisible()
        await expect(page.getByRole('tab', { name: /English/ })).toHaveCount(0)
        await page.getByRole('button', { name: 'Действия языка Deutsch' }).click()
        await page.getByRole('menuitem', { name: 'Удалить' }).click()
        await expect(page.getByRole('tab', { name: /Deutsch/ })).toHaveCount(0)
        await expect(page.getByRole('tab', { name: /Русский/ })).toBeVisible()
        const russianTabBox = await page.getByRole('tab', { name: /Русский/ }).boundingBox()
        const russianActionBox = await page.getByRole('button', { name: 'Действия языка Русский' }).boundingBox()
        const addLanguageBox = await page.getByRole('button', { name: 'Добавить язык контента' }).boundingBox()
        expect(russianTabBox).toBeTruthy()
        expect(russianActionBox).toBeTruthy()
        expect(addLanguageBox).toBeTruthy()
        expect(russianActionBox!.height).toBeLessThanOrEqual(34)
        expect(addLanguageBox!.height).toBeLessThanOrEqual(34)
        expect(
            Math.abs(russianActionBox!.y + russianActionBox!.height / 2 - (addLanguageBox!.y + addLanguageBox!.height / 2))
        ).toBeLessThanOrEqual(1)
        await expect(page.locator('[data-content-locale-tab="ru"] svg')).toHaveCount(1)
        await page.getByRole('button', { name: 'Действия языка Русский' }).click()
        await expect(page.getByRole('menuitem', { name: 'Главный вариант' })).toBeDisabled()
        await expect(page.getByRole('menuitem', { name: 'Удалить' })).toHaveCount(0)
        await page.keyboard.press('Escape')
        await page.getByRole('tab', { name: /Русский/ }).click()
        await expect(page.getByTestId('editorjs-block-editor')).toBeVisible()
        await expect(page.getByTestId('editorjs-block-editor-loading')).toHaveCount(0, { timeout: 20_000 })
        await expect(page.getByLabel('Editor.js blocks JSON')).toHaveCount(0)
        const emptyEditorRoot = page.getByTestId('editorjs-block-editor')
        await emptyEditorRoot.click()
        await emptyEditorRoot.locator('.ce-block').first().hover()
        const emptyEditorPlusButton = page.locator('.ce-toolbar__plus').first()
        await expect(emptyEditorPlusButton).toBeVisible()
        await emptyEditorPlusButton.click()
        const textBlockMenuItem = page.getByText('Текст', { exact: true }).last()
        await expect(textBlockMenuItem).toBeVisible()
        const blockToolboxBox = await textBlockMenuItem.evaluate((element) => {
            const visibleElement = element.closest('.ce-popover') ?? element.closest('[class*="ce-popover"]') ?? element.parentElement
            if (!visibleElement) return null
            const rect = visibleElement.getBoundingClientRect()
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        })
        const viewport = page.viewportSize()
        expect(blockToolboxBox).toBeTruthy()
        expect(viewport).toBeTruthy()
        expect(blockToolboxBox!.y + blockToolboxBox!.height).toBeLessThanOrEqual(viewport!.height + 1)
        await page.keyboard.press('Escape')
        await captureProofScreenshot(page, testInfo, 'basic-pages-content-editor-ru.png')

        await page.goto(`/metahub/${metahub.id}/entities/page/instances`)
        await expect(page.getByRole('row').filter({ hasText: pageTitle })).toBeVisible()
        await expect(page.getByRole('columnheader', { name: 'Хабы' })).toBeVisible()
        await expect(page.getByRole('columnheader', { name: 'Контейнеры' })).toHaveCount(0)

        await openRowActionsMenu(page, pageTitle)
        const pageMenuItems = page.getByRole('menuitem')
        await expect(pageMenuItems).toHaveText([/Редактировать|Edit/i, /Копировать|Copy/i, /Удалить|Delete/i])
        const pageActionIconSignatures = await readOpenMenuIconSignatures(page)
        await expect(page.getByRole('menuitem', { name: /Открыть контент|Open content/i })).toHaveCount(0)
        await expect(page.getByRole('menuitem', { name: /Редактировать свойства|Edit properties/i })).toHaveCount(0)
        await page.keyboard.press('Escape')

        await page.goto(`/metahub/${metahub.id}/entities/object/instances`)
        await expect(page.getByRole('heading', { name: 'Объекты' })).toBeVisible()
        await expect(page.getByText('Основной объект для хранения записей')).toBeVisible()
        const catalogMenuButton = page.getByRole('button', { name: /menu\.button|Опции|Другие действия|More actions/i }).first()
        await catalogMenuButton.click()
        const catalogActionIconSignatures = await readOpenMenuIconSignatures(page)
        expect(pageActionIconSignatures).toEqual(catalogActionIconSignatures)
        await page.keyboard.press('Escape')
        await page.getByText('Основной объект для хранения записей').click()
        await expect(page.getByRole('heading', { name: 'Компоненты' })).toBeVisible()
        expect(await readTabTypography(page.getByRole('tab', { name: 'Компоненты' }))).toEqual(pageActiveTabTypography)
        expect(await readTabTypography(page.getByRole('tab', { name: 'Системные' }))).toEqual(pageInactiveTabTypography)

        await page.goto(`/metahub/${metahub.id}/entities/page/instances`)
        await expect(page.getByRole('row').filter({ hasText: pageTitle })).toBeVisible()
        await openRowActionsMenu(page, pageTitle)
        await page.getByRole('menuitem', { name: /Редактировать|Edit/i }).click()
        const editPageDialog = page.getByRole('dialog')
        await expect(editPageDialog).toBeVisible()
        await expect(editPageDialog.getByRole('tab', { name: 'Хабы' })).toBeVisible()
        await expect(editPageDialog.getByRole('tab', { name: 'Макеты' })).toBeVisible()
        await expect(editPageDialog.getByRole('tab', { name: 'Контент' })).toHaveCount(0)

        const editDescriptionField = editPageDialog.locator('textarea:not([readonly])').first()
        await editDescriptionField.fill(editedDescription)
        await expect(editDescriptionField).toHaveValue(editedDescription)

        const editPageResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/entity/${createdPage.id}`),
            { label: 'Updating Page through the browser' }
        )
        await editPageDialog.getByTestId(entityDialogSelectors.submitButton).click()
        const editedPage = await parseJsonResponse<{ id?: string; description?: unknown }>(
            await editPageResponse,
            'Updating Page through the browser'
        )
        expect(editedPage.id).toBe(createdPage.id)
        expect(readLocalizedText(editedPage.description, 'en')).toBe(editedDescription)
        await expect(editPageDialog).toHaveCount(0)

        await openRowActionsMenu(page, pageTitle)
        await page.getByRole('menuitem', { name: /Копировать|Copy/i }).click()
        const copyPageDialog = page.getByRole('dialog')
        await expect(copyPageDialog).toBeVisible()
        await copyPageDialog
            .getByLabel(/Название|Name/i)
            .first()
            .fill(copiedPageTitle)
        await copyPageDialog
            .getByLabel(/Кодовое имя|Codename/i)
            .first()
            .fill(copiedPageCodename)

        const copyPageResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/entity/${createdPage.id}/copy`),
            { label: 'Copying Page through the browser' }
        )
        await copyPageDialog.getByTestId(entityDialogSelectors.submitButton).click()
        const copiedPage = await parseJsonResponse<{ id?: string }>(await copyPageResponse, 'Copying Page through the browser')

        if (!copiedPage.id || copiedPage.id === createdPage.id) {
            throw new Error('Copy Page response did not contain a distinct id')
        }

        await expect(page.getByRole('row').filter({ hasText: copiedPageTitle })).toBeVisible()

        await openRowActionsMenu(page, copiedPageTitle)
        await page.getByRole('menuitem', { name: /Удалить|Delete/i }).click()
        const deletePageDialog = page.getByRole('dialog')
        await expect(deletePageDialog).toBeVisible()

        const deletePageResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'DELETE' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/entity/${copiedPage.id}`),
            { label: 'Deleting copied Page through the browser' }
        )
        await deletePageDialog.getByTestId(confirmDeleteSelectors.confirmButton).click()
        await expectMutationOk(await deletePageResponse, 'Deleting copied Page through the browser')
        await expect(deletePageDialog).toHaveCount(0)
        await expect(page.getByRole('row').filter({ hasText: copiedPageTitle })).toHaveCount(0)

        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByRole('tab', { name: 'Константы' })).toBeVisible()

        await page.goto(`/metahub/${metahub.id}/settings`)
        await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible()
        await expect(page.getByText('settings.tabs.page')).toHaveCount(0)
        await page.getByRole('tab', { name: 'Страницы' }).click()
        await expect(page.getByRole('heading', { name: 'Разрешить копирование' })).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Разрешить удаление' })).toBeVisible()
        await captureProofScreenshot(page, testInfo, 'basic-pages-settings-ru.png')
    } finally {
        await disposeApiContext(api)
        await disposeBootstrapApiContext(bootstrapApi)
    }
})
