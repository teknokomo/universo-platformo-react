import path from 'node:path'
import type { Locator, Page, Response } from '@playwright/test'
import { expect } from '../fixtures/test'
import { expectNoTechnicalLeakage, expectLocatorFitsViewport, expectRuntimeUxViewportMatrix } from './browser/runtimeUx'
import { switchRuntimeLocale } from './browser/preferences'
import { getApplicationRuntime } from './backend/api-session.mjs'
import { waitForApplicationObjectId, waitForApplicationRuntimeRow, type ApiContext } from './lmsRuntime'

type RuntimeMutationResponse = {
    id?: string
}

const RUNTIME_RECORD_HANDLE_PATTERN = /^rh1\.[A-Za-z0-9_-]+$/u

export async function expectLmsLinkSortOrderDefault(options: { dialog: Locator; label: string }): Promise<void> {
    const { dialog, label } = options
    await expect(
        dialog.getByRole('textbox', { name: 'Sort Order', exact: true }),
        `${label} Sort Order must initially use the 0.00 metadata default`
    ).toHaveValue('0.00')
}

export type LmsRuntimeBuilderHelperDependencies = {
    clickRuntimeNavigationItem: (page: Page, name: string) => Promise<void>
    expectRuntimeNavigationItemSelected: (page: Page, name: string) => Promise<void>
    expectNoRussianLmsFallbackText: (surface: Locator, label: string) => Promise<void>
    activateButtonByKeyboard: (page: Page, button: Locator, label: string) => Promise<void>
    assertNoHorizontalOverflowWithScreenshots: (page: Page, label: string, screenshotPath: string) => Promise<void>
    readLocalizedText: (value: unknown, locale?: string) => string | undefined
    readRuntimeRowValue: (
        row: Record<string, unknown>,
        columns: Array<{ field?: unknown; codename?: unknown }>,
        ...keys: string[]
    ) => unknown
    requireRuntimeRowId: (row: Record<string, unknown>, label: string) => string
    parseJsonResponse: <T>(response: Response, label: string) => Promise<T>
    expectReportCsvExport: (page: Page, reportSurface: Locator, label: string) => Promise<void>
    UUID_SUBSTRING_PATTERN: RegExp
    UUID_V7_PATTERN: RegExp
}

export function createLmsRuntimeBuilderHelpers(dependencies: LmsRuntimeBuilderHelperDependencies) {
    const {
        clickRuntimeNavigationItem,
        expectRuntimeNavigationItemSelected,
        expectNoRussianLmsFallbackText,
        activateButtonByKeyboard,
        assertNoHorizontalOverflowWithScreenshots,
        readLocalizedText,
        readRuntimeRowValue,
        requireRuntimeRowId,
        parseJsonResponse,
        expectReportCsvExport,
        UUID_SUBSTRING_PATTERN,
        UUID_V7_PATTERN
    } = dependencies

    async function readVisibleSortableRuntimeLabels(surface: Locator): Promise<string[]> {
        return surface
            .locator('tbody tr')
            .evaluateAll((rows) => rows.map((row) => ((row as HTMLTableRowElement).cells.item(1)?.innerText ?? '').trim()).filter(Boolean))
    }

    async function expectPublishedRelationBuilderReorder(options: {
        page: Page
        api: ApiContext
        applicationId: string
        workspaceId: string
        objectCodename: 'CourseItems' | 'TrackSteps'
        navigationItem: string
        builderTab: string
        parentFieldCodename: string
        label: string
        screenshotPath: string
    }): Promise<void> {
        const {
            page,
            api,
            applicationId,
            workspaceId,
            objectCodename,
            navigationItem,
            builderTab,
            parentFieldCodename,
            label,
            screenshotPath
        } = options
        await clickRuntimeNavigationItem(page, navigationItem)
        await expectRuntimeNavigationItemSelected(page, navigationItem)
        const tabsSurface = page.getByTestId('runtime-details-tabs').first()
        await expect(tabsSurface, `${label} must render the generic builder tabs`).toBeVisible({ timeout: 30_000 })
        const builderTabLocator = tabsSurface.getByRole('tab', { name: builderTab, exact: true })
        await expect(builderTabLocator, `${label} relation tab must be visible`).toBeVisible({ timeout: 30_000 })
        await builderTabLocator.click()
        await expect(builderTabLocator).toHaveAttribute('aria-selected', 'true')

        const relation = tabsSurface.getByTestId('runtime-relation-builder').first()
        await expect(relation, `${label} must render the entity-backed relation builder`).toBeVisible({ timeout: 30_000 })
        const parentTabs = relation.getByRole('tablist').first().getByRole('tab')
        await expect(parentTabs.nth(1), `${label} must expose a second accessible parent choice`).toBeVisible({ timeout: 30_000 })
        const surface = relation.getByTestId('runtime-list-surface').first()
        await expect(surface, `${label} relation must use the shared runtime list surface`).toBeVisible({ timeout: 30_000 })
        let sortableParentIndex = -1
        let beforeLabels: string[] = []
        for (let index = 0; index < (await parentTabs.count()); index += 1) {
            const candidateParent = parentTabs.nth(index)
            await candidateParent.click()
            await expect(candidateParent, `${label} must select each parent through its accessible tab`).toHaveAttribute(
                'aria-selected',
                'true'
            )
            const candidateLabels = await readVisibleSortableRuntimeLabels(surface)
            if (candidateLabels.length >= 2) {
                sortableParentIndex = index
                beforeLabels = candidateLabels
                break
            }
        }
        expect(sortableParentIndex, `${label} must find a parent with enough children to prove reordering`).toBeGreaterThanOrEqual(0)
        expect(beforeLabels.length, `${label} must show at least two readable relation row labels`).toBeGreaterThanOrEqual(2)
        const selectedParentLabel = (await parentTabs.nth(sortableParentIndex).innerText()).trim()
        expect(selectedParentLabel, `${label} selected parent must have a readable label`).toBeTruthy()
        await expectNoTechnicalLeakage(relation, { label, checkUuidSubstrings: true })

        const isReorderResponse = (response: Response) =>
            response.request().method() === 'POST' && response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows/reorder`)
        const firstRow = surface.locator('tbody tr').first()
        const moveDownButton = firstRow.getByRole('button', { name: /^Move .* down$/u }).first()
        await expect(moveDownButton, `${label} first row move-down action must be visible`).toBeVisible({ timeout: 30_000 })
        await expect(moveDownButton, `${label} first row move-down action must be enabled`).toBeEnabled({ timeout: 30_000 })

        await moveDownButton.scrollIntoViewIfNeeded()
        const reorderResponsePromise = page.waitForResponse(isReorderResponse, { timeout: 30_000 })
        await moveDownButton.click()
        const reorderResponse = await reorderResponsePromise
        expect(reorderResponse.ok(), `${label} row reorder must succeed from the published app`).toBe(true)
        const reorderBody = reorderResponse.request().postDataJSON() as {
            parentScope?: { fieldCodename?: string; parentRecordId?: string }
            orderedRowIds: string[]
            expectedVersionsByRowId?: Record<string, number>
        }
        expect(reorderBody.parentScope?.fieldCodename, `${label} must scope ordering by its semantic parent field`).toBe(
            parentFieldCodename
        )
        expect(reorderBody.parentScope?.parentRecordId, `${label} must submit the opaque parent runtime handle`).toMatch(
            RUNTIME_RECORD_HANDLE_PATTERN
        )
        expect(reorderBody.orderedRowIds, `${label} must submit the complete visible relation order`).toHaveLength(beforeLabels.length)
        expect(new Set(reorderBody.orderedRowIds).size, `${label} reorder payload must not duplicate record identities`).toBe(
            beforeLabels.length
        )
        for (const rowId of reorderBody.orderedRowIds) {
            expect(rowId, `${label} reorder payload must use opaque runtime record handles`).toMatch(RUNTIME_RECORD_HANDLE_PATTERN)
        }
        expect(
            Object.keys(reorderBody.expectedVersionsByRowId ?? {}).sort(),
            `${label} expected-version map must cover exactly the persistent rows being reordered`
        ).toEqual([...reorderBody.orderedRowIds].sort())
        const expectedLabels = [beforeLabels[1], beforeLabels[0], ...beforeLabels.slice(2)]
        const parentRecordHandle = reorderBody.parentScope?.parentRecordId
        if (typeof parentRecordHandle !== 'string') {
            throw new Error(`${label} reorder payload did not include the selected parent record id`)
        }
        const parentObjectCodename = objectCodename === 'CourseItems' ? 'Courses' : 'LearningTracks'
        const parentObjectCollectionId = await waitForApplicationObjectId(api, applicationId, parentObjectCodename)
        const parentRuntime = await getApplicationRuntime(api, applicationId, {
            objectId: parentObjectCollectionId,
            workspaceId,
            limit: 100,
            offset: 0
        })
        const parentRows = Array.isArray(parentRuntime.rows) ? (parentRuntime.rows as Array<Record<string, unknown>>) : []
        const parentColumns = Array.isArray(parentRuntime.columns)
            ? (parentRuntime.columns as Array<{ field?: unknown; codename?: unknown }>)
            : []
        const matchingParentRows = parentRows.filter(
            (row) => readLocalizedText(readRuntimeRowValue(row, parentColumns, 'Title', 'title'), 'en') === selectedParentLabel
        )
        expect(matchingParentRows, `${label} selected parent label must resolve to exactly one physical Entity row`).toHaveLength(1)
        const physicalParentRecordId = requireRuntimeRowId(matchingParentRows[0]!, `${label} selected parent`)
        expect(physicalParentRecordId, `${label} selected parent storage identity must be UUID v7`).toMatch(UUID_V7_PATTERN)
        expect(physicalParentRecordId, `${label} must not persist the opaque parent runtime handle as a foreign key`).not.toBe(
            parentRecordHandle
        )
        const objectCollectionId = await waitForApplicationObjectId(api, applicationId, objectCodename)
        const parentFieldSnakeCase = parentFieldCodename.replace(/([a-z0-9])([A-Z])/gu, '$1_$2').toLowerCase()
        const readPersistedRelationRows = async () => {
            const runtime = await getApplicationRuntime(api, applicationId, {
                objectId: objectCollectionId,
                workspaceId,
                limit: 100,
                offset: 0,
                sort: JSON.stringify([{ field: 'SortOrder', direction: 'asc' }])
            })
            const rows = Array.isArray(runtime.rows) ? (runtime.rows as Array<Record<string, unknown>>) : []
            const columns = Array.isArray(runtime.columns) ? (runtime.columns as Array<{ field?: unknown; codename?: unknown }>) : []
            return rows
                .filter((row) => readRuntimeRowValue(row, columns, parentFieldCodename, parentFieldSnakeCase) === physicalParentRecordId)
                .map((row, index) => ({
                    id: requireRuntimeRowId(row, `${label} persisted relation row ${index + 1}`),
                    label: readLocalizedText(readRuntimeRowValue(row, columns, 'Title', 'title'), 'en')
                }))
        }
        await expect
            .poll(async () => (await readPersistedRelationRows()).map(({ id }) => id), {
                message: `${label} must persist the reordered rows in the raw runtime collection`,
                timeout: 30_000,
                intervals: [500, 1_000, 2_000]
            })
            .toHaveLength(beforeLabels.length)
        await expect
            .poll(async () => (await readPersistedRelationRows()).map(({ label: rowLabel }) => rowLabel), {
                message: `${label} must persist the first two visible relation rows in swapped order`,
                timeout: 30_000,
                intervals: [500, 1_000, 2_000]
            })
            .toEqual(expectedLabels)
        for (const persistedRow of await readPersistedRelationRows()) {
            expect(persistedRow.id, `${label} raw runtime storage identity must remain UUID v7`).toMatch(UUID_V7_PATTERN)
        }
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })

        await expect
            .poll(() => readVisibleSortableRuntimeLabels(surface), { timeout: 30_000, intervals: [500, 1_000, 2_000] })
            .toEqual(expectedLabels)
        await expectNoTechnicalLeakage(relation, { label, checkUuidSubstrings: true })

        await page.screenshot({ path: screenshotPath, fullPage: true })
    }

    async function expectPublishedBuilderRelationScope(options: {
        page: Page
        navigationItem: string
        builderTab: string
        label: string
        locale: 'en' | 'ru'
        screenshotPath: string
    }): Promise<void> {
        const { page, navigationItem, builderTab, label, locale, screenshotPath } = options
        await clickRuntimeNavigationItem(page, navigationItem)
        await expectRuntimeNavigationItemSelected(page, navigationItem)
        if (locale === 'ru') await switchRuntimeLocale(page, locale)

        const tabsSurface = page.getByTestId('runtime-details-tabs').first()
        const relationTab = tabsSurface.getByRole('tab', { name: builderTab, exact: true })
        await expect(relationTab, `${label} relation tab must be visible in ${locale}`).toBeVisible({ timeout: 30_000 })
        await relationTab.click()
        await expect(relationTab).toHaveAttribute('aria-selected', 'true')

        const relation = tabsSurface.getByTestId('runtime-relation-builder').first()
        await expect(relation, `${label} must render the registry-bound relationBuilder`).toBeVisible({ timeout: 30_000 })
        const parents = relation.getByRole('tablist').first().getByRole('tab')
        await expect(parents.nth(0), `${label} must expose the initial parent as an accessible tab`).toBeVisible({ timeout: 30_000 })
        await expect(parents.nth(1), `${label} must expose a second parent as an accessible tab`).toBeVisible({ timeout: 30_000 })

        const firstParent = parents.nth(0)
        const nextParent = parents.nth(1)
        const firstParentName = (await firstParent.innerText()).trim()
        const nextParentName = (await nextParent.innerText()).trim()
        expect(firstParentName, `${label} parent choices must have distinct localized labels`).not.toBe(nextParentName)
        await firstParent.click()
        await expect(firstParent).toHaveAttribute('aria-selected', 'true')
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })

        const surface = relation.getByTestId('runtime-list-surface').first()
        await expect(surface, `${label} must render the shared list surface`).toBeVisible({ timeout: 30_000 })
        await expect
            .poll(async () => readVisibleSortableRuntimeLabels(surface), {
                message: `${label} first parent rows must load before comparison`,
                timeout: 30_000,
                intervals: [500, 1_000, 2_000]
            })
            .not.toHaveLength(0)
        const firstParentRows = await readVisibleSortableRuntimeLabels(surface)

        await nextParent.click()
        await expect(nextParent, `${label} must select the next parent through its accessible tab`).toHaveAttribute('aria-selected', 'true')
        await expect(firstParent).toHaveAttribute('aria-selected', 'false')
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
        await expect
            .poll(async () => readVisibleSortableRuntimeLabels(surface), {
                message: `${label} must replace first-parent rows after selecting the next parent`,
                timeout: 30_000,
                intervals: [500, 1_000, 2_000]
            })
            .not.toEqual(firstParentRows)
        const nextParentRows = await readVisibleSortableRuntimeLabels(surface)
        expect(nextParentRows, `${label} parent selection must switch the bound child records`).not.toEqual(firstParentRows)

        await expectNoTechnicalLeakage(relation, { label: `${label} relation builder`, checkUuidSubstrings: true })
        await assertNoHorizontalOverflowWithScreenshots(page, `${label} relation builder`, screenshotPath)
        await page.screenshot({ path: screenshotPath, fullPage: true })
    }

    async function expectPublishedCourseItemCreateWizard(options: {
        page: Page
        navigationItem: string
        builderTab: string
        locale: 'en' | 'ru'
        label: string
        screenshotPath: string
    }): Promise<void> {
        const { page, navigationItem, builderTab, locale, label, screenshotPath } = options
        const isRussian = locale === 'ru'
        const labels = isRussian
            ? {
                  create: 'Создать',
                  dialog: 'Создать элемент',
                  contentStep: 'Учебный контент',
                  contentHelper: 'Назовите элемент курса и выберите ресурс или тест, который откроют учащиеся.',
                  title: 'Заголовок',
                  targetObject: 'Целевой объект',
                  targetObjectOption: 'Учебные ресурсы',
                  targetRecord: 'Целевая запись',
                  targetRecordHelper: 'Сначала выберите целевой объект.',
                  sequenceStep: 'Раздел курса и завершение',
                  sequenceHelper: 'Выберите раздел курса, задайте правила завершения и при необходимости укажите время на прохождение.',
                  section: 'Раздел',
                  itemType: 'Тип элемента',
                  required: 'Обязательно',
                  completionWeight: 'Вес завершения',
                  estimatedTime: 'Оценочное время, мин',
                  back: 'Назад',
                  cancel: 'Отмена'
              }
            : {
                  create: 'Create',
                  dialog: 'Create element',
                  contentStep: 'Learning content',
                  contentHelper: 'Name this course item, then choose the resource or quiz learners will open.',
                  title: 'Title',
                  targetObject: 'Target Object',
                  targetObjectOption: 'Learning Resources',
                  targetRecord: 'Target Record',
                  targetRecordHelper: 'Select the target object first.',
                  sequenceStep: 'Course section and completion',
                  sequenceHelper: 'Choose the course section, set completion rules, and optionally estimate the time required.',
                  section: 'Section',
                  itemType: 'Item Type',
                  required: 'Required',
                  completionWeight: 'Completion Weight',
                  estimatedTime: 'Estimated Time, min',
                  back: 'Back',
                  cancel: 'Cancel'
              }

        await clickRuntimeNavigationItem(page, navigationItem)
        await expectRuntimeNavigationItemSelected(page, navigationItem)

        const tabsSurface = page.getByTestId('runtime-details-tabs').first()
        const builderTabLocator = tabsSurface.getByRole('tab', { name: builderTab, exact: true })
        await expect(builderTabLocator, `${label} must show the localized Course items tab`).toBeVisible({ timeout: 30_000 })
        await builderTabLocator.click()
        await expect(builderTabLocator).toHaveAttribute('aria-selected', 'true')

        const relation = tabsSurface.getByTestId('runtime-relation-builder').first()
        await expect(relation, `${label} must render the current entity-backed CourseItems panel`).toBeVisible({ timeout: 30_000 })
        const parentTabs = relation.getByRole('tablist').first().getByRole('tab')
        await expect(parentTabs.nth(1), `${label} must expose a second accessible Course parent`).toBeVisible({ timeout: 30_000 })
        await parentTabs.nth(1).click()
        await expect(parentTabs.nth(1), `${label} must create in the selected parent scope`).toHaveAttribute('aria-selected', 'true')

        const createButton = relation.getByRole('button', { name: labels.create, exact: true })
        await expect(createButton, `${label} must expose the localized related-record action`).toBeEnabled({ timeout: 30_000 })
        await createButton.click()

        const dialog = page.getByRole('dialog', { name: labels.dialog, exact: true })
        await expect(dialog, `${label} must open the accessible relation create dialog`).toBeVisible({ timeout: 30_000 })
        await expect(dialog).toHaveAttribute('aria-modal', 'true')
        await expect(dialog.getByText(labels.contentStep, { exact: true })).toBeVisible()
        await expect(dialog.getByText(labels.contentHelper, { exact: true })).toBeVisible()

        const titleField = dialog.getByRole('textbox', { name: labels.title, exact: true })
        await expect(titleField, `${label} must label the localized item title`).toBeVisible({ timeout: 30_000 })
        await titleField.fill(isRussian ? 'Проверка мастера курса' : 'Course item wizard preview')

        const targetObjectField = dialog.getByRole('combobox', { name: labels.targetObject, exact: true })
        const targetRecordField = dialog.getByRole('combobox', { name: labels.targetRecord, exact: true })
        await expect(targetRecordField, `${label} target record must wait for a resource type`).toBeDisabled()
        await expect(dialog.getByText(labels.targetRecordHelper, { exact: true })).toBeVisible()
        await targetObjectField.click()
        await page.getByRole('option', { name: labels.targetObjectOption, exact: true }).click()
        await expect(targetRecordField, `${label} target record must become available after choosing its object`).toBeEnabled({
            timeout: 30_000
        })
        await targetRecordField.click()
        const targetRecordOption = page.getByRole('option').first()
        await expect(targetRecordOption, `${label} must offer seeded records by readable name`).toBeVisible({ timeout: 30_000 })
        const targetRecordLabel = (await targetRecordOption.innerText()).trim()
        expect(targetRecordLabel, `${label} record picker must display a human-readable record label`).not.toBe('')
        expect(targetRecordLabel, `${label} record picker must not display a raw identifier`).not.toMatch(UUID_SUBSTRING_PATTERN)
        expect(targetRecordLabel, `${label} record picker must not display an internal codename`).not.toMatch(
            /\b(?:LearningResources|TargetRecordId|TargetObjectCodename)\b/u
        )
        await targetRecordOption.click()
        await expect(targetRecordField).toContainText(targetRecordLabel)
        await expectNoTechnicalLeakage(dialog, { label: `${label} create form`, checkUuidSubstrings: true })
        if (isRussian) await expectNoRussianLmsFallbackText(dialog, `${label} create form`)

        const captureWizardStep = async (stepId: string) => {
            const parsedPath = path.parse(screenshotPath)
            await expectRuntimeUxViewportMatrix(page, `${label} ${stepId} step`, {
                beforeEachViewport: async (viewport) => {
                    await expect(dialog, `${label} dialog must stay open at ${viewport.name}`).toBeVisible()
                    await expectLocatorFitsViewport(dialog, `${label} ${stepId} dialog at ${viewport.name}`)
                    await page.screenshot({
                        path: path.join(parsedPath.dir, `${parsedPath.name}-${locale}-${stepId}-${viewport.name}${parsedPath.ext}`),
                        fullPage: true
                    })
                }
            })
        }

        const nextButton = dialog.getByRole('button', { name: isRussian ? 'Далее' : 'Next', exact: true })
        await expect(nextButton, `${label} must expose an accessible next-step action`).toBeEnabled()
        await expect(nextButton).toHaveAttribute('data-testid', 'entity-form-next')
        await captureWizardStep('content')
        await activateButtonByKeyboard(page, nextButton, `${label} next step`)

        await expect(dialog.getByText(labels.sequenceStep, { exact: true })).toBeVisible()
        await expect(dialog.getByText(labels.sequenceHelper, { exact: true })).toBeVisible()
        await expect(dialog.getByRole('combobox', { name: labels.section, exact: true })).toBeVisible()
        await expect(dialog.getByRole('textbox', { name: labels.itemType, exact: true })).toBeVisible()
        await expect(dialog.getByRole('checkbox', { name: labels.required, exact: true })).toBeVisible()
        const completionWeightField = dialog.getByRole('textbox', { name: labels.completionWeight, exact: true })
        const estimatedTimeField = dialog.getByRole('textbox', { name: labels.estimatedTime, exact: true })
        await expect(completionWeightField).toBeVisible()
        await expect(completionWeightField).toHaveAttribute('inputmode', 'decimal')
        await expect(estimatedTimeField).toBeVisible()
        await expect(estimatedTimeField).toHaveAttribute('inputmode', 'decimal')
        await expectNoTechnicalLeakage(dialog, { label: `${label} sequence step`, checkUuidSubstrings: true })
        if (isRussian) await expectNoRussianLmsFallbackText(dialog, `${label} sequence step`)

        const backButton = dialog.getByRole('button', { name: labels.back, exact: true })
        await expect(backButton, `${label} must provide an accessible way back`).toBeVisible()
        await expect(backButton).toHaveAttribute('data-testid', 'entity-form-back')
        await captureWizardStep('sequence')
        await activateButtonByKeyboard(page, backButton, `${label} previous step`)
        await expect(dialog.getByText(labels.contentStep, { exact: true })).toBeVisible()
        await expect(titleField).toBeVisible()
        await expect(dialog.getByRole('textbox', { name: labels.itemType, exact: true })).toHaveCount(0)

        const cancelButton = dialog.getByRole('button', { name: labels.cancel, exact: true })
        await activateButtonByKeyboard(page, cancelButton, `${label} cancel draft`)
        await expect(dialog).toBeHidden()
    }

    async function expectPublishedCourseItemCreateSucceeds(options: {
        page: Page
        api: ApiContext
        applicationId: string
        workspaceId: string
        screenshotPath: string
    }): Promise<void> {
        const { page, api, applicationId, workspaceId, screenshotPath } = options
        const courseItemTitle = {
            en: 'Published course item proof',
            ru: 'Проверка элемента курса'
        }

        await clickRuntimeNavigationItem(page, 'Courses')
        await expectRuntimeNavigationItemSelected(page, 'Courses')
        const tabsSurface = page.getByTestId('runtime-details-tabs').first()
        const courseItemsTab = tabsSurface.getByRole('tab', { name: 'Course items', exact: true })
        await expect(courseItemsTab, 'Published CourseItems create must use the current Course Builder tab').toBeVisible({
            timeout: 30_000
        })
        await courseItemsTab.click()
        await expect(courseItemsTab).toHaveAttribute('aria-selected', 'true')

        const relation = tabsSurface.getByTestId('runtime-relation-builder').first()
        await expect(relation, 'Published CourseItems create must use the current relationBuilder panel').toBeVisible({ timeout: 30_000 })
        const parentTabs = relation.getByRole('tablist').first().getByRole('tab')
        const firstParent = parentTabs.nth(0)
        const selectedParent = parentTabs.nth(1)
        await expect(firstParent, 'CourseItems create must offer another parent to verify isolation').toBeVisible({ timeout: 30_000 })
        await expect(selectedParent, 'CourseItems create must offer the selected second parent').toBeVisible({ timeout: 30_000 })

        const firstParentLabel = (await firstParent.innerText()).trim()
        const selectedParentLabel = (await selectedParent.innerText()).trim()
        expect(firstParentLabel).not.toBe('')
        expect(selectedParentLabel).not.toBe('')
        expect(firstParentLabel).not.toBe(selectedParentLabel)

        await firstParent.click()
        await expect(firstParent).toHaveAttribute('aria-selected', 'true')
        const relationRows = relation.getByTestId('runtime-list-surface').first()
        await expect(relationRows, 'The other Course parent must render its child rows').toBeVisible({ timeout: 30_000 })
        const otherParentLabelsBeforeCreate = await readVisibleSortableRuntimeLabels(relationRows)
        expect(otherParentLabelsBeforeCreate.length, 'The other Course parent must have a stable relation list').toBeGreaterThan(0)

        const coursesObjectId = await waitForApplicationObjectId(api, applicationId, 'Courses')
        const coursesRuntime = await getApplicationRuntime(api, applicationId, {
            objectId: coursesObjectId,
            workspaceId
        })
        const courseColumns = Array.isArray(coursesRuntime.columns)
            ? (coursesRuntime.columns as Array<{ field?: unknown; codename?: unknown }>)
            : []
        const courseRows = Array.isArray(coursesRuntime.rows) ? (coursesRuntime.rows as Array<Record<string, unknown>>) : []
        const findParentIdByLabel = (parentLabel: string): string => {
            const matches = courseRows.filter(
                (row) => readLocalizedText(readRuntimeRowValue(row, courseColumns, 'Title', 'title'), 'en') === parentLabel
            )
            expect(matches, `Course parent ${parentLabel} must resolve to exactly one Entity record`).toHaveLength(1)
            return requireRuntimeRowId(matches[0]!, `Course parent ${parentLabel}`)
        }
        const otherParentId = findParentIdByLabel(firstParentLabel)
        const selectedParentId = findParentIdByLabel(selectedParentLabel)
        expect(selectedParentId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
        expect(otherParentId).not.toBe(selectedParentId)

        await selectedParent.click()
        await expect(selectedParent, 'CourseItems create must follow the selected second parent').toHaveAttribute('aria-selected', 'true')
        await expect(firstParent).toHaveAttribute('aria-selected', 'false')
        const createButton = relation.getByRole('button', { name: 'Create', exact: true })
        await expect(createButton).toBeEnabled({ timeout: 30_000 })
        await createButton.click()

        const dialog = page.getByRole('dialog', { name: 'Create element', exact: true })
        await expect(dialog, 'Published CourseItems create must open the configured create wizard').toBeVisible({ timeout: 30_000 })
        const titleField = dialog.getByRole('textbox', { name: 'Title', exact: true }).first()
        await titleField.fill(courseItemTitle.en)
        await dialog.getByRole('button', { name: 'EN', exact: true }).click()
        await page.getByRole('menuitem', { name: 'Add language', exact: true }).click()
        await page.getByRole('menuitem', { name: 'Русский', exact: true }).click()
        const localizedTitleFields = dialog.getByRole('textbox', { name: 'Title', exact: true })
        await expect(localizedTitleFields).toHaveCount(2)
        await localizedTitleFields.nth(1).fill(courseItemTitle.ru)

        const targetObjectField = dialog.getByRole('combobox', { name: 'Target Object', exact: true })
        const targetRecordField = dialog.getByRole('combobox', { name: 'Target Record', exact: true })
        await expect(targetRecordField).toBeDisabled()
        await targetObjectField.click()
        await page.getByRole('option', { name: 'Learning Resources', exact: true }).click()
        await expect(targetRecordField).toBeEnabled({ timeout: 30_000 })
        await targetRecordField.click()
        const targetRecordOption = page.getByRole('option').first()
        await expect(targetRecordOption, 'Published CourseItems create must choose a readable resource record').toBeVisible({
            timeout: 30_000
        })
        const selectedTargetLabel = (await targetRecordOption.innerText()).trim()
        expect(selectedTargetLabel).not.toBe('')
        expect(selectedTargetLabel).not.toMatch(UUID_SUBSTRING_PATTERN)
        const selectedTargetRecordId = await targetRecordOption.getAttribute('data-value')
        if (!selectedTargetRecordId) {
            throw new Error('Published CourseItems target record option did not expose its persisted record identity')
        }
        expect(selectedTargetRecordId, 'Published CourseItems target record option must use UUID v7 identity').toMatch(UUID_V7_PATTERN)
        const learningResourcesObjectId = await waitForApplicationObjectId(api, applicationId, 'LearningResources')
        const targetRecordsRuntime = await getApplicationRuntime(api, applicationId, {
            objectId: learningResourcesObjectId,
            workspaceId,
            limit: 100,
            offset: 0
        })
        const targetRows = Array.isArray(targetRecordsRuntime.rows) ? (targetRecordsRuntime.rows as Array<Record<string, unknown>>) : []
        const targetColumns = Array.isArray(targetRecordsRuntime.columns)
            ? (targetRecordsRuntime.columns as Array<{ field?: unknown; codename?: unknown }>)
            : []
        const matchingTargetRows = targetRows.filter(
            (row) => requireRuntimeRowId(row, 'Learning Resource option') === selectedTargetRecordId
        )
        expect(matchingTargetRows, 'Selected target record identity must resolve to one LearningResources Object row').toHaveLength(1)
        expect(
            readLocalizedText(readRuntimeRowValue(matchingTargetRows[0]!, targetColumns, 'Title', 'title'), 'en'),
            'Selected target record label must resolve to the same persisted Entity identity'
        ).toBe(selectedTargetLabel)
        await targetRecordOption.click()
        await expect(targetRecordField).toContainText(selectedTargetLabel)

        const nextButton = dialog.getByRole('button', { name: 'Next', exact: true })
        await expect(nextButton).toBeEnabled()
        await nextButton.click()
        await expect(dialog.getByText('Course section and completion', { exact: true })).toBeVisible()
        await expect(dialog.getByRole('combobox', { name: 'Section', exact: true })).toBeVisible()
        await expect(dialog.getByRole('textbox', { name: 'Item Type', exact: true })).toBeVisible()
        await expect(dialog.getByRole('checkbox', { name: 'Required', exact: true })).toBeVisible()
        await expect(dialog.getByRole('textbox', { name: 'Completion Weight', exact: true })).toHaveAttribute('inputmode', 'decimal')
        await expect(dialog.getByRole('textbox', { name: 'Estimated Time, min', exact: true })).toHaveAttribute('inputmode', 'decimal')
        await dialog.getByRole('textbox', { name: 'Item Type', exact: true }).fill('Page')

        const submitButton = dialog.getByTestId('entity-form-submit')
        await expect(submitButton, 'The CourseItems draft must be valid before it is submitted').toBeEnabled()
        const createRequestPromise = page.waitForRequest(
            (request) =>
                request.method() === 'POST' && new URL(request.url()).pathname === `/api/v1/applications/${applicationId}/runtime/rows`,
            { timeout: 30_000 }
        )
        const createResponsePromise = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                new URL(response.url()).pathname === `/api/v1/applications/${applicationId}/runtime/rows`,
            { timeout: 30_000 }
        )
        await submitButton.click()
        const createRequest = await createRequestPromise
        const createResponse = await createResponsePromise
        expect(createResponse.request()).toBe(createRequest)
        const requestPayload = createRequest.postDataJSON() as Record<string, unknown>
        expect(requestPayload.relationScope, 'The published create request must send the selected parent relation scope').toMatchObject({
            fieldCodename: 'CourseId',
            parentRecordId: expect.stringMatching(/^rh1\./u)
        })
        const requestRelationScope = requestPayload.relationScope as { parentRecordId?: unknown }
        expect(requestRelationScope.parentRecordId, 'The public relation scope must not expose the physical parent UUID').not.toBe(
            selectedParentId
        )
        expect(createResponse.ok(), 'Published CourseItems create must succeed through the runtime API').toBe(true)
        await expect(dialog).toBeHidden()
        const createResponsePayload = await parseJsonResponse<RuntimeMutationResponse>(createResponse, 'Creating published CourseItem')
        if (!createResponsePayload.id) {
            throw new Error('Published CourseItems create did not return the new Entity record id')
        }
        expect(createResponsePayload.id, 'Published CourseItems create must return a persistent UUID v7').toMatch(UUID_V7_PATTERN)

        const courseItemsObjectId = await waitForApplicationObjectId(api, applicationId, 'CourseItems')
        const createdCourseItem = await waitForApplicationRuntimeRow(api, applicationId, courseItemsObjectId, createResponsePayload.id, {
            workspaceId
        })
        expect(readLocalizedText(createdCourseItem?.Title, 'en')).toBe(courseItemTitle.en)
        expect(readLocalizedText(createdCourseItem?.Title, 'ru')).toBe(courseItemTitle.ru)
        expect(readRuntimeRowValue(createdCourseItem ?? {}, [], 'CourseId', 'course_id')).toBe(selectedParentId)
        expect(readRuntimeRowValue(createdCourseItem ?? {}, [], 'ItemType', 'item_type')).toBe('Page')
        expect(readRuntimeRowValue(createdCourseItem ?? {}, [], 'TargetObjectCodename', 'target_object_codename')).toBe('LearningResources')
        expect(readRuntimeRowValue(createdCourseItem ?? {}, [], 'TargetRecordId', 'target_record_id')).toBe(selectedTargetRecordId)

        await courseItemsTab.click()
        await expect(courseItemsTab, 'CourseItems create must return to the configured relation tab for verification').toHaveAttribute(
            'aria-selected',
            'true'
        )
        const refreshedRelation = tabsSurface.getByTestId('runtime-relation-builder').first()
        await expect(refreshedRelation, 'CourseItems create must expose the saved Entity relation again').toBeVisible({ timeout: 30_000 })
        const refreshedParentTabs = refreshedRelation.getByRole('tablist').first()
        const refreshedFirstParent = refreshedParentTabs.getByRole('tab', { name: firstParentLabel, exact: true })
        const refreshedSelectedParent = refreshedParentTabs.getByRole('tab', { name: selectedParentLabel, exact: true })
        await refreshedSelectedParent.click()
        await expect(refreshedSelectedParent).toHaveAttribute('aria-selected', 'true')
        const createdRelationRows = refreshedRelation.getByTestId('runtime-list-surface').first()

        await expect
            .poll(async () => readVisibleSortableRuntimeLabels(createdRelationRows), {
                message: 'The created localized CourseItem must appear under the selected parent',
                timeout: 30_000,
                intervals: [500, 1_000, 2_000]
            })
            .toContain(courseItemTitle.en)
        const selectedParentLabelsAfterCreate = await readVisibleSortableRuntimeLabels(createdRelationRows)
        expect(selectedParentLabelsAfterCreate.filter((name) => name === courseItemTitle.en)).toHaveLength(1)
        await page.screenshot({ path: screenshotPath, fullPage: true })

        await refreshedFirstParent.click()
        await expect(refreshedFirstParent, 'The created CourseItem absence check must select another parent').toHaveAttribute(
            'aria-selected',
            'true'
        )
        await expect(refreshedSelectedParent).toHaveAttribute('aria-selected', 'false')
        await expect
            .poll(async () => readVisibleSortableRuntimeLabels(createdRelationRows), {
                message: 'Switching parents must restore the other CourseItems list',
                timeout: 30_000,
                intervals: [500, 1_000, 2_000]
            })
            .toEqual(otherParentLabelsBeforeCreate)
        const otherParentLabelsAfterCreate = await readVisibleSortableRuntimeLabels(createdRelationRows)
        expect(otherParentLabelsAfterCreate).not.toContain(courseItemTitle.en)
        await expect(createdRelationRows.getByText(courseItemTitle.en, { exact: true })).toHaveCount(0)
    }

    async function expectPublishedBuilderTabs(options: {
        page: Page
        navigationItem: string
        label: string
        screenshotPath: string
        tabs: Array<
            | { name: string; kind: 'relation'; expectedColumnHeader: string }
            | { name: string; kind: 'learner-player' }
            | { name: string; kind: 'reports' }
        >
    }): Promise<void> {
        const { page, navigationItem, label, screenshotPath, tabs: expectedTabs } = options
        await clickRuntimeNavigationItem(page, navigationItem)
        await expectRuntimeNavigationItemSelected(page, navigationItem)

        const tabsSurface = page.getByTestId('runtime-details-tabs').first()
        await expect(tabsSurface, `${label} must render the generic detailsTabs surface`).toBeVisible({ timeout: 30_000 })
        const renderedTabs = tabsSurface.getByRole('tablist').first().getByRole('tab')
        await expect(renderedTabs, `${label} must expose only the configured first-class tabs`).toHaveCount(expectedTabs.length)

        for (const expectedTab of expectedTabs) {
            const tab = tabsSurface.getByRole('tab', { name: expectedTab.name, exact: true })
            await expect(tab, `${label} tab ${expectedTab.name} must be visible`).toBeVisible({ timeout: 30_000 })
            await tab.click()
            await expect(tab).toHaveAttribute('aria-selected', 'true')

            if (expectedTab.kind === 'relation') {
                const relation = tabsSurface.getByTestId('runtime-relation-builder').first()
                await expect(relation, `${label} ${expectedTab.name} must render a bound relationBuilder`).toBeVisible({ timeout: 30_000 })
                await expect(
                    relation
                        .getByTestId('runtime-list-surface')
                        .getByRole('columnheader', { name: expectedTab.expectedColumnHeader, exact: true }),
                    `${label} ${expectedTab.name} must resolve the expected Entity-backed relation`
                ).toBeVisible({ timeout: 30_000 })
                await expectNoTechnicalLeakage(relation, { label: `${label} ${expectedTab.name} relation`, checkUuidSubstrings: true })
                continue
            }

            if (expectedTab.kind === 'learner-player') {
                const player = tabsSurface.getByTestId('runtime-learner-player')
                await expect(player, `${label} ${expectedTab.name} must render the registry-bound learner player`).toBeVisible({
                    timeout: 30_000
                })
                await expectNoTechnicalLeakage(player, { label: `${label} ${expectedTab.name}`, checkUuidSubstrings: true })
                continue
            }

            const reportSurfaces = tabsSurface.getByTestId('runtime-report-details-table')
            await expect(reportSurfaces, `${label} Reports must render both first-class report placements`).toHaveCount(2)
            const reportSurface = reportSurfaces.first()
            await expect(reportSurface, `${label} Reports must render a generic report surface`).toBeVisible({ timeout: 30_000 })
            await expectNoTechnicalLeakage(reportSurface, { label: `${label} Reports`, checkUuidSubstrings: true })
            await expectReportCsvExport(page, reportSurface, `${label} Reports`)
        }
        await page.screenshot({ path: screenshotPath, fullPage: true })
    }

    return {
        expectPublishedRelationBuilderReorder,
        expectPublishedBuilderRelationScope,
        expectPublishedCourseItemCreateWizard,
        expectPublishedCourseItemCreateSucceeds,
        expectPublishedBuilderTabs
    }
}
