import { expect } from '../../fixtures/test'
import type { Locator, Page } from '@playwright/test'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { expectNoTechnicalLeakage } from '../../support/browser/runtimeUx'
import { INTERPRETATION_NETWORK_FIXTURE_FILENAME } from '../../support/interpretationNetworkFixtureContract'
import { importInterpretationNetworkSnapshot } from '../../support/interpretationNetworkSnapshotImport'
import {
    ensureSystemStructure,
    resolveRuntimeIds,
    setInterpretationNetworkWidgetConfig,
    type InterpretationNetworkApi,
    type InterpretationNetworkRuntimeIds
} from '../../support/interpretationNetworkFocused'

export const DESKTOP_VIEWPORT = { width: 1280, height: 900 }

export const uuidV7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type PreparedSingleSystem = {
    applicationId: string
    runtimeIds: InterpretationNetworkRuntimeIds
    system: { structureId: string; interpretationId: string; rootCellId: string }
}

export const getMatrixCell = (page: Page, title: string) =>
    page.getByTestId('interpretation-network-matrix-workspace').getByRole('button').filter({ hasText: title }).first()

export const prepareSingleSystem = async (
    api: InterpretationNetworkApi,
    runId: string,
    scenario: string
): Promise<PreparedSingleSystem> => {
    const imported = await importInterpretationNetworkSnapshot(api, {
        snapshotFilename: INTERPRETATION_NETWORK_FIXTURE_FILENAME,
        label: `browser-gaps-${scenario}-${runId}`
    })
    await recordCreatedMetahub({
        id: imported.metahub.id,
        name: `Interpretation Network browser gap ${scenario}`,
        codename: `interpretation-network-browser-gap-${scenario}-${runId}`
    })
    await setInterpretationNetworkWidgetConfig(api, imported.applicationId, { structureMode: 'singleSystem' })
    const runtimeIds = await resolveRuntimeIds(api, imported.applicationId)
    const system = await ensureSystemStructure(api, imported.applicationId, runtimeIds.workspaceId)

    return { applicationId: imported.applicationId, runtimeIds, system }
}

export const openMatrixInTreeView = async (
    page: Page,
    applicationId: string,
    locale: 'en' | 'ru' = 'en',
    expectedCellTitle = 'Universe'
): Promise<void> => {
    await page.setViewportSize(DESKTOP_VIEWPORT)
    await page.goto(`/a/${applicationId}?locale=${locale}`)
    await expect(page.getByTestId('runtime-side-menu-docked').getByTestId('runtime-workspace-switcher')).toBeVisible({
        timeout: 30_000
    })
    const structuresLabel = locale === 'ru' ? 'Структуры' : 'Structures'
    const navigation = page
        .getByRole('navigation')
        .filter({
            has: page
                .getByRole('link', { name: structuresLabel, exact: true })
                .or(page.getByRole('button', { name: structuresLabel, exact: true }))
        })
        .filter({ visible: true })
        .first()
    await expect(navigation).toBeVisible({ timeout: 30_000 })
    await navigation
        .getByRole('link', { name: structuresLabel, exact: true })
        .or(navigation.getByRole('button', { name: structuresLabel, exact: true }))
        .first()
        .click()

    const matrix = page.getByTestId('interpretation-network-matrix-workspace')
    await expect(matrix).toBeVisible({ timeout: 30_000 })
    const workspaceTabs = matrix.getByRole('tablist', {
        name: locale === 'ru' ? 'Разделы рабочего пространства' : 'Workspace sections',
        exact: true
    })
    for (const label of locale === 'ru' ? ['Матрица', 'Избранное', 'Шаблоны'] : ['Matrix', 'Favorites', 'Templates']) {
        await expect(workspaceTabs.getByRole('tab', { name: label, exact: true })).toBeVisible()
    }
    await expect(workspaceTabs.getByRole('tab')).toHaveCount(3)

    const treeView = matrix.getByRole('button', { name: locale === 'ru' ? 'Вертикальное дерево' : 'Vertical tree', exact: true })
    await expect(treeView).toBeVisible()
    if ((await treeView.getAttribute('aria-pressed')) !== 'true') await treeView.click()
    await expect(treeView).toHaveAttribute('aria-pressed', 'true')
    await expect(getMatrixCell(page, expectedCellTitle)).toBeVisible({ timeout: 30_000 })
}

export const expectNoRuntimeLeakage = async (surface: Locator, label: string): Promise<void> => {
    await expectNoTechnicalLeakage(surface, {
        label,
        checkUuidSubstrings: true,
        checkOpaqueRuntimeHandles: true,
        forbiddenVisibleTextPatterns: [/\[object Object\]/i]
    })
}
