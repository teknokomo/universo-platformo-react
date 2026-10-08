import type { Locator, Page } from '@playwright/test'
import { expect } from '../fixtures/test'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from './browser/runtimeUx'

export async function expectPublishedLearnerHomeAssignments(options: {
    page: Page
    locale: 'en' | 'ru'
    screenshotPaths: { course: string; track: string }
}): Promise<void> {
    const { page, locale, screenshotPaths } = options
    const expectedTabs =
        locale === 'ru'
            ? [
                  { label: 'Мои курсы', title: 'Курс обновления требований', screenshotPath: screenshotPaths.course },
                  { label: 'Мои треки', title: 'Трек повторения требований', screenshotPath: screenshotPaths.track }
              ]
            : [
                  { label: 'My Courses', title: 'Compliance Refresh Course', screenshotPath: screenshotPaths.course },
                  { label: 'My Tracks', title: 'Compliance refresh track', screenshotPath: screenshotPaths.track }
              ]
    const assignmentsSurface = page
        .getByTestId('runtime-details-tabs')
        .filter({ has: page.getByRole('tab', { name: expectedTabs[0].label, exact: true }) })
    await expect(assignmentsSurface, 'Learner Home must render the first-class assignment tabs').toHaveCount(1)
    await expect(assignmentsSurface.getByRole('tab'), 'Learner Home must expose exactly two assignment tabs').toHaveCount(2)

    for (const expected of expectedTabs) {
        const tab = assignmentsSurface.getByRole('tab', { name: expected.label, exact: true })
        await expect(tab, `Learner Home tab ${expected.label} must be visible`).toBeVisible({ timeout: 30_000 })
        await tab.click()
        await expect(tab).toHaveAttribute('aria-selected', 'true')
        const table = assignmentsSurface.getByTestId('dashboard-entity-table')
        await expect(table, `Learner Home ${expected.label} must render its Entity-backed assignment table`).toBeVisible({
            timeout: 30_000
        })
        await expect(
            table.getByText(expected.title, { exact: true }),
            `Learner Home ${expected.label} must show its assigned content`
        ).toBeVisible()
        await expectNoTechnicalLeakage(table, { label: `Learner Home ${expected.label}`, checkUuidSubstrings: true })
        await expectNoPageHorizontalOverflow(page, `LMS ${expected.label} table`)
        await page.screenshot({ path: expected.screenshotPath, fullPage: true })
    }
}

export async function expectPublishedLearnerHomeLibraryTabs(options: {
    page: Page
    locale: 'en' | 'ru'
    screenshotPath: string
}): Promise<void> {
    const { page, locale, screenshotPath } = options
    const tabNames = locale === 'ru' ? ['Недавние', 'Избранное', 'Доступные мне'] : ['Recent', 'Starred', 'Shared with me']
    const tabsSurface = page.getByTestId('runtime-details-tabs').filter({ has: page.getByRole('tab', { name: tabNames[0], exact: true }) })
    await expect(tabsSurface, 'Learner Home must render the first-class Learning Content tabs').toBeVisible({ timeout: 30_000 })
    await expect(tabsSurface.getByRole('tab'), 'Learner Home must expose exactly three first-class library tabs').toHaveCount(3)

    for (const tabName of tabNames) {
        const tab = tabsSurface.getByRole('tab', { name: tabName, exact: true })
        await expect(tab, `Learner Home tab ${tabName} must be visible`).toBeVisible({ timeout: 30_000 })
        await tab.click()
        await expect(tab).toHaveAttribute('aria-selected', 'true')
        const library = tabsSurface.getByTestId('library-details-table').first()
        await expect(library, `Learner Home ${tabName} must render its first-class bound library table`).toBeVisible({ timeout: 30_000 })
        await expectNoTechnicalLeakage(library, { label: `Learner Home ${tabName}`, checkUuidSubstrings: true })
    }

    await expectNoPageHorizontalOverflow(page, 'LMS Learner Home Learning Content tabs')
    await page.screenshot({ path: screenshotPath, fullPage: true })
}

export async function expectNoVisibleLearningContentTechnicalText(surface: Locator, label: string): Promise<void> {
    const text = await surface.evaluate((node) => {
        const element = node as HTMLElement
        return element.innerText || element.textContent || ''
    })
    expect(text, `${label} must not expose hidden Learning Content technical columns`).not.toMatch(
        /\b(ProjectId|CreatedBy|OwnerUserId|TargetRecordId|__runtime|SourceJson)\b/
    )
}
