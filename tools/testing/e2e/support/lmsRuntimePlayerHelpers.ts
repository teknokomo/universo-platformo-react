import type { Page, Response } from '@playwright/test'
import { expect } from '../fixtures/test'
import { expectNoTechnicalLeakage } from './browser/runtimeUx'
import { switchRuntimeLocale } from './browser/preferences'
import { getApplicationRuntime } from './backend/api-session.mjs'
import { type ApiContext } from './lmsRuntime'

const RUNTIME_RECORD_HANDLE_PATTERN = /^rh1\.[A-Za-z0-9_-]+$/u
const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

export type PublishedLearnerPlayerOptions = {
    page: Page
    api: ApiContext
    applicationId: string
    contentProgressObjectId: string
    workspaceId: string
    navigationItem: string
    label: string
    targetObjectCodename: 'CourseItems' | 'TrackSteps'
    locale: 'en' | 'ru'
    screenshotPath: string
}

export type LmsRuntimePlayerHelperDependencies = {
    clickRuntimeNavigationItem: (page: Page, name: string) => Promise<void>
    expectRuntimeNavigationItemSelected: (page: Page, name: string) => Promise<void>
    readRuntimeRowValue: (
        row: Record<string, unknown>,
        columns: Array<{ field?: unknown; codename?: unknown }>,
        ...keys: string[]
    ) => unknown
    assertNoHorizontalOverflowWithScreenshots: (page: Page, label: string, screenshotPath: string) => Promise<void>
}

export function createLmsRuntimePlayerHelpers(dependencies: LmsRuntimePlayerHelperDependencies) {
    const {
        clickRuntimeNavigationItem,
        expectRuntimeNavigationItemSelected,
        readRuntimeRowValue,
        assertNoHorizontalOverflowWithScreenshots
    } = dependencies

    async function waitForLearnerPlayerCompletionResponse(
        page: Page,
        applicationId: string,
        targetObjectCodename: 'CourseItems' | 'TrackSteps',
        workspaceId: string
    ): Promise<Response> {
        return page.waitForResponse(
            async (response) => {
                const responseUrl = new URL(response.url())
                if (
                    response.request().method() !== 'POST' ||
                    responseUrl.pathname !== `/api/v1/applications/${applicationId}/runtime/progress/content` ||
                    responseUrl.searchParams.get('workspaceId') !== workspaceId ||
                    !response.ok()
                ) {
                    return false
                }

                const payload = await response.json().catch(() => null)
                return (
                    payload?.persisted === true &&
                    payload?.targetObjectCodename === targetObjectCodename &&
                    payload?.progressPercent === 100 &&
                    payload?.status === 'completed' &&
                    typeof payload?.targetRecordId === 'string'
                )
            },
            { timeout: 30_000 }
        )
    }

    async function expectPublishedLearnerPlayer(options: PublishedLearnerPlayerOptions): Promise<void> {
        const {
            page,
            api,
            applicationId,
            contentProgressObjectId,
            workspaceId,
            navigationItem,
            label,
            targetObjectCodename,
            locale,
            screenshotPath
        } = options

        await page.goto(`/a/${applicationId}?workspaceId=${encodeURIComponent(workspaceId)}&locale=${locale}&themeVariant=light`)
        await clickRuntimeNavigationItem(page, navigationItem)
        await expectRuntimeNavigationItemSelected(page, navigationItem)
        if (locale === 'ru') await switchRuntimeLocale(page, locale)

        const playerTabName = locale === 'ru' ? 'Проигрыватель' : 'Player'
        const tabsSurface = page.getByTestId('runtime-details-tabs').first()
        const playerTab = tabsSurface.getByRole('tab', { name: playerTabName, exact: true })
        await expect(playerTab, `${label} must expose its localized learnerPlayer tab`).toBeVisible({ timeout: 30_000 })
        await playerTab.click()
        await expect(playerTab).toHaveAttribute('aria-selected', 'true')

        const player = page.getByTestId('runtime-learner-player')
        await expect(player, `${label} must render the registry-bound learnerPlayer`).toBeVisible({ timeout: 30_000 })
        const parentTabListName = locale === 'ru' ? 'Контент' : 'Content'
        const parentTabList = player.getByRole('tablist', { name: parentTabListName })
        await expect(parentTabList, `${label} must expose the localized parent selector`).toBeVisible({ timeout: 30_000 })
        const parentTabs = parentTabList.getByRole('tab')
        expect(await parentTabs.count(), `${label} must offer multiple parent records`).toBeGreaterThan(1)

        const alternateParent = parentTabs.nth(1)
        await alternateParent.click()
        await expect(alternateParent).toHaveAttribute('aria-selected', 'true')

        const learningItemsLabel = locale === 'ru' ? 'Учебные материалы' : 'Learning items'
        const learningItems = player.getByRole('tablist', { name: learningItemsLabel })
        await expect(learningItems, `${label} must expose localized learning items for the alternate parent`).toBeVisible()
        const alternateItemTabs = learningItems.getByRole('tab')
        await expect(alternateItemTabs, `${label} alternate parent must expose only its own item`).toHaveCount(1)
        await expect(alternateItemTabs.first()).toHaveAttribute('aria-selected', 'true')

        const selectedParent = parentTabs.first()
        const selectedParentName = (await selectedParent.innerText()).trim()
        await selectedParent.click()
        await expect(selectedParent).toHaveAttribute('aria-selected', 'true')

        await expect(learningItems, `${label} must expose localized learning-item tabs`).toBeVisible({ timeout: 30_000 })
        const itemTabs = learningItems.getByRole('tab')
        await expect(itemTabs).toHaveCount(2)
        const firstItemTab = itemTabs.first()
        const nextItemTab = itemTabs.nth(1)
        const firstItemLabel = (await firstItemTab.innerText()).trim()
        const nextItemLabel = (await nextItemTab.innerText()).trim()
        expect(firstItemLabel, `${label} first sequence item must have a readable localized name`).toBeTruthy()
        expect(nextItemLabel, `${label} next sequence item must have a readable localized name`).toBeTruthy()
        expect(nextItemLabel, `${label} sequence items must have distinct names`).not.toBe(firstItemLabel)
        await expect(firstItemTab).toHaveAttribute('aria-selected', 'true')
        await expect(itemTabs.nth(1), `${label} must keep the next item locked before completion`).toBeDisabled()

        const completionButton = player.getByRole('button', { name: locale === 'ru' ? /заверш|отметить/i : /complete/i }).first()
        await expect(completionButton, `${label} must provide a localized completion action`).toBeVisible({ timeout: 30_000 })
        await expect(completionButton).toBeEnabled()

        const runtimeIndex = await getApplicationRuntime(api, applicationId, { workspaceId })
        const objectCollections = Array.isArray(runtimeIndex.objectCollections)
            ? runtimeIndex.objectCollections
            : Array.isArray(runtimeIndex.objects)
            ? runtimeIndex.objects
            : []
        const targetObjectCollection = objectCollections.find(
            (objectCollection: Record<string, unknown>) => objectCollection.codename === targetObjectCodename
        ) as Record<string, unknown> | undefined
        const targetObjectCollectionId = targetObjectCollection?.id
        expect(targetObjectCollectionId, `${label} must resolve its physical target Entity collection`).toMatch(UUID_V7_PATTERN)

        const targetRuntime = await getApplicationRuntime(api, applicationId, {
            objectId: String(targetObjectCollectionId),
            workspaceId
        })
        const physicalTargetRecordIds = new Set(
            (Array.isArray(targetRuntime.rows) ? targetRuntime.rows : [])
                .map((row: Record<string, unknown>) => row.id)
                .filter((rowId: unknown): rowId is string => typeof rowId === 'string' && UUID_V7_PATTERN.test(rowId))
        )
        expect(
            physicalTargetRecordIds.size,
            `${label} must expose physical target Entity rows through the raw runtime collection`
        ).toBeGreaterThan(0)

        const readProgressRows = async () => {
            const runtime = await getApplicationRuntime(api, applicationId, {
                objectId: contentProgressObjectId,
                workspaceId
            })
            const columns = Array.isArray(runtime.columns) ? runtime.columns : []
            const rows = Array.isArray(runtime.rows) ? runtime.rows : []
            return rows
                .map((row: Record<string, unknown>) => ({
                    targetObjectCodename: readRuntimeRowValue(row, columns, 'TargetObjectCodename', 'target_object_codename'),
                    targetRecordId: readRuntimeRowValue(row, columns, 'TargetRecordId', 'target_record_id'),
                    status: String(readRuntimeRowValue(row, columns, 'ProgressStatus', 'progress_status')).toLowerCase(),
                    progressPercent: Number(readRuntimeRowValue(row, columns, 'ProgressPercent', 'progress_percent'))
                }))
                .filter((row) => row.targetObjectCodename === targetObjectCodename && typeof row.targetRecordId === 'string')
        }
        const progressBeforeCompletion = new Map(
            (await readProgressRows()).map((row) => [
                String(row.targetRecordId),
                { status: row.status, progressPercent: row.progressPercent }
            ])
        )

        const progressResponsePromise = waitForLearnerPlayerCompletionResponse(page, applicationId, targetObjectCodename, workspaceId)
        await completionButton.click()
        const progressResponse = await progressResponsePromise
        expect(progressResponse.ok(), `${label} completion must persist through the shared runtime progress endpoint`).toBe(true)
        const progressPayload = (await progressResponse.json()) as Record<string, unknown>
        expect(progressPayload).toMatchObject({
            persisted: true,
            targetObjectCodename,
            progressPercent: 100,
            status: 'completed'
        })
        const targetRecordId = progressPayload.targetRecordId
        expect(targetRecordId, `${label} progress response must identify its Entity record`).toMatch(RUNTIME_RECORD_HANDLE_PATTERN)

        const readPersistedProgress = async () => {
            const transitionedRows = (await readProgressRows()).filter((row) => {
                const physicalRecordId = String(row.targetRecordId)
                const previous = progressBeforeCompletion.get(physicalRecordId)
                return (
                    UUID_V7_PATTERN.test(physicalRecordId) &&
                    physicalTargetRecordIds.has(physicalRecordId) &&
                    row.status === 'completed' &&
                    row.progressPercent === 100 &&
                    (previous?.status !== 'completed' || previous.progressPercent !== 100)
                )
            })
            if (transitionedRows.length !== 1) return null
            return transitionedRows[0]
        }
        await expect.poll(readPersistedProgress, { timeout: 30_000, intervals: [500, 1_000, 2_000] }).not.toBeNull()
        const persistedProgress = await readPersistedProgress()
        expect(persistedProgress?.targetRecordId, `${label} progress storage must use the physical Entity UUID v7`).toMatch(UUID_V7_PATTERN)
        expect(persistedProgress?.targetRecordId, `${label} progress storage must not persist the public runtime record handle`).not.toBe(
            targetRecordId
        )
        expect(persistedProgress).toMatchObject({ status: 'completed', progressPercent: 100 })

        await page.reload()
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
        const reloadedTabsSurface = page.getByTestId('runtime-details-tabs').first()
        const reloadedPlayerTab = reloadedTabsSurface.getByRole('tab', { name: playerTabName, exact: true })
        await expect(reloadedPlayerTab, `${label} player tab must survive a page reload`).toBeVisible({ timeout: 30_000 })
        await reloadedPlayerTab.click()
        const reloadedPlayer = page.getByTestId('runtime-learner-player')
        const reloadedParentTabList = reloadedPlayer.getByRole('tablist', { name: parentTabListName })
        const reloadedParent = reloadedParentTabList.getByRole('tab', { name: selectedParentName, exact: true })
        await expect(reloadedParent).toBeVisible({ timeout: 30_000 })
        await reloadedParent.click()
        await expect(reloadedParent).toHaveAttribute('aria-selected', 'true')

        const reloadedItems = reloadedPlayer.getByRole('tablist', { name: learningItemsLabel })
        await expect(reloadedPlayer.getByText(locale === 'ru' ? 'Завершено' : 'Completed', { exact: true })).toBeVisible({
            timeout: 30_000
        })
        await expect(
            reloadedItems.getByRole('tab').nth(1),
            `${label} persisted completion must unlock the next item after reload`
        ).toBeEnabled()
        await reloadedItems.getByRole('tab').nth(1).click()
        await expect(
            reloadedItems.getByRole('tab').nth(1),
            `${label} learner must be able to continue to the next sequence item`
        ).toHaveAttribute('aria-selected', 'true')
        await expectNoTechnicalLeakage(reloadedPlayer, { label: `${label} after reload`, checkUuidSubstrings: true })
        await assertNoHorizontalOverflowWithScreenshots(page, `${label} learner player`, screenshotPath)
        await page.screenshot({ path: screenshotPath, fullPage: true })
    }

    async function expectPublishedTrackLearnerPlayer(options: Omit<PublishedLearnerPlayerOptions, 'targetObjectCodename'>): Promise<void> {
        await expectPublishedLearnerPlayer({ ...options, targetObjectCodename: 'TrackSteps' })
    }

    return {
        expectPublishedLearnerPlayer,
        expectPublishedTrackLearnerPlayer
    }
}
