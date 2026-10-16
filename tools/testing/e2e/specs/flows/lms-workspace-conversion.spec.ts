import type { Page } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import {
    addApplicationMember,
    convertApplicationWorkspaceToShared,
    createAdminUser,
    createLoggedInApiContext,
    createRuntimeRow,
    disposeApiContext,
    getApplicationRuntime,
    getAssignableRoles,
    listApplicationMembers,
    listApplicationWorkspaces,
    sendWithCsrf,
    setApplicationDefaultWorkspace,
    setApplicationPublicEntryWorkspace
} from '../../support/backend/api-session.mjs'
import { withE2eDatabaseClient } from '../../support/backend/e2eDatabase.mjs'
import {
    recordCreatedApplication,
    recordCreatedGlobalUser,
    recordCreatedMetahub,
    recordCreatedPublication
} from '../../support/backend/run-manifest.mjs'
import {
    setupPublishedLmsApplication,
    waitForApplicationObjectId,
    waitForApplicationRuntimeRow,
    waitForMetahubEnumerationId,
    waitForOptionValueId
} from '../../support/lmsRuntime'

function resolveGlobalRoleIds(roles: Array<{ id?: string; codename?: string }>, roleCodenames: string[]) {
    const roleMap = new Map(roles.map((role) => [String(role.codename).toLowerCase(), role.id]))
    const roleIds = roleCodenames.map((codename) => roleMap.get(codename.toLowerCase())).filter(Boolean)

    if (roleIds.length !== roleCodenames.length) {
        const missing = roleCodenames.filter((codename) => !roleMap.has(codename.toLowerCase()))
        throw new Error(`Assignable global role(s) not found: ${missing.join(', ')}`)
    }

    return roleIds
}

async function waitForBrowserLoginReadiness(credentials: { email: string; password: string }) {
    await expect
        .poll(async () => {
            try {
                const api = await createLoggedInApiContext(credentials)
                await disposeApiContext(api)
                return true
            } catch {
                return false
            }
        })
        .toBe(true)
}

function buildBlockContent(text: string) {
    return {
        format: 'editorjs',
        data: {
            time: Date.now(),
            version: '2.30.0',
            blocks: [
                {
                    id: 'workspace-conversion-proof',
                    type: 'paragraph',
                    data: { text }
                }
            ]
        }
    }
}

function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readWorkspaceName(name: unknown): string {
    if (typeof name === 'string') return name
    if (!name || typeof name !== 'object') return ''
    const locales = (name as Record<string, unknown>).locales
    const primary = (name as Record<string, unknown>)._primary
    if (!locales || typeof locales !== 'object') return ''
    if (typeof primary === 'string') {
        const primaryContent = (locales as Record<string, Record<string, unknown>>)[primary]?.content
        if (typeof primaryContent === 'string') return primaryContent
    }
    const englishContent = (locales as Record<string, Record<string, unknown>>).en?.content
    if (typeof englishContent === 'string') return englishContent
    for (const localeValue of Object.values(locales as Record<string, Record<string, unknown>>)) {
        if (typeof localeValue?.content === 'string') return localeValue.content
    }
    return ''
}

function requireWorkspace(
    items: Array<{
        id?: string
        name?: unknown
        workspaceType?: string
        type?: string
        personalUserId?: string | null
        roleCodename?: string
    }>,
    predicate: (workspace: {
        id?: string
        name?: unknown
        workspaceType?: string
        type?: string
        personalUserId?: string | null
        roleCodename?: string
    }) => boolean,
    label: string
): { id: string; name: string; workspaceType: string; personalUserId: string | null | undefined; roleCodename: string | undefined } {
    const workspace = items.find(predicate)
    if (!workspace?.id) {
        throw new Error(`Application workspace not found: ${label}`)
    }
    return {
        id: workspace.id,
        name: readWorkspaceName(workspace.name) || String(workspace.id),
        workspaceType: String(workspace.workspaceType ?? workspace.type ?? ''),
        personalUserId: workspace.personalUserId ?? undefined,
        roleCodename: workspace.roleCodename
    }
}

// Runtime row authoring cannot create a quiz AccessLink: `TargetType` and
// `TargetId` are server-owned access-link columns (the API accepts only
// content links with `ContentNodeIdRef`). The platform contract persists
// quiz links through the published snapshot; the test therefore inserts one
// row through the same database seam production snapshot installs rely on.
async function seedQuizAccessLinkRowForTest(
    applicationId: string,
    workspaceId: string,
    slug: string,
    quizRecordId: string
): Promise<string> {
    if (!/^[0-9a-f-]{36}$/iu.test(applicationId) || !/^[0-9a-f-]{36}$/iu.test(workspaceId)) {
        throw new Error('E2E requires UUID application/workspace identities to seed a quiz AccessLink')
    }
    if (!/^[0-9a-f-]{36}$/iu.test(quizRecordId)) {
        throw new Error('E2E requires a UUID quiz identity to seed a quiz AccessLink')
    }

    return withE2eDatabaseClient(async (client) => {
        const applicationResult = await client.query(
            `SELECT schema_name AS "schemaName"
             FROM applications.obj_applications
             WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false`,
            [applicationId]
        )
        const schemaName = applicationResult.rows[0]?.schemaName
        if (typeof schemaName !== 'string') throw new Error('E2E could not resolve the application schema for the quiz AccessLink seed')
        const schemaSql = `"${schemaName}"`

        const objectsResult = await client.query(
            `SELECT id, table_name AS "tableName", codename
             FROM ${schemaSql}."_app_objects"
             WHERE _upl_deleted = false AND _app_deleted = false`,
            []
        )
        const readAccessLinkCodename = (value: unknown): string => {
            if (typeof value === 'string' && value.length > 0) return value
            if (!value || typeof value !== 'object') return ''
            const localized = value as Record<string, unknown>
            const locales = (localized.locales ?? localized) as Record<string, unknown>
            for (const locale of Object.values(locales)) {
                if (locale && typeof locale === 'object') {
                    const content = (locale as Record<string, unknown>).content
                    if (typeof content === 'string') return content
                }
                if (typeof locale === 'string') return locale
            }
            return ''
        }
        const accessLinkObject = objectsResult.rows.find(
            (row: { codename?: unknown }) => readAccessLinkCodename(row.codename).replace(/\s+/gu, '').toLowerCase() === 'accesslinks'
        )
        if (!accessLinkObject) throw new Error('E2E could not resolve the AccessLinks object for the quiz AccessLink seed')

        const accessLinkTable = `"${schemaName}"."${accessLinkObject.tableName}"`
        const componentsResult = await client.query(
            `SELECT codename, column_name AS "columnName"
             FROM ${schemaSql}."_app_components"
             WHERE object_id = $1
               AND parent_component_id IS NULL
               AND _upl_deleted = false
               AND _app_deleted = false`,
            [accessLinkObject.id]
        )
        const currentComponentLabels = componentsResult.rows.map((row: { columnName?: unknown; codename?: unknown }) =>
            readAccessLinkCodename(row.codename)
        )
        const columnFor = (codename: string, label: string): string => {
            const needle = codename.toLowerCase()
            const component = componentsResult.rows.find((row: { columnName?: unknown }) => {
                const candidate = readAccessLinkCodename(row.codename).replace(/\s+/gu, '').toLowerCase()
                return candidate === needle || candidate === `${needle}s`
            })
            if (typeof component?.columnName !== 'string' || component.columnName.length === 0) {
                throw new Error(
                    `E2E could not resolve the ${label} AccessLink column (labels seen: ${currentComponentLabels.join(', ') || 'none'})`
                )
            }
            return `"${component.columnName}"`
        }
        const slugColumn = columnFor('Slug', 'Slug')
        const targetTypeColumn = columnFor('TargetType', 'TargetType')
        const targetIdColumn = columnFor('TargetId', 'TargetId')
        const isActiveColumn = columnFor('IsActive', 'IsActive')
        const maxUsesColumn = columnFor('MaxUses', 'MaxUses')
        const useCountColumn = columnFor('UseCount', 'UseCount')
        const linkTitleColumn = columnFor('LinkTitle', 'LinkTitle')
        const showFirstNameColumn = columnFor('ShowFirstName', 'ShowFirstName')
        const requireFirstNameColumn = columnFor('RequireFirstName', 'RequireFirstName')
        const showLastNameColumn = columnFor('ShowLastName', 'ShowLastName')
        const requireLastNameColumn = columnFor('RequireLastName', 'RequireLastName')
        const showEmailColumn = columnFor('ShowEmail', 'ShowEmail')
        const requireEmailColumn = columnFor('RequireEmail', 'RequireEmail')
        const showPhoneColumn = columnFor('ShowPhone', 'ShowPhone')
        const requirePhoneColumn = columnFor('RequirePhone', 'RequirePhone')
        const captchaEnabledColumn = columnFor('CaptchaEnabled', 'CaptchaEnabled')
        const expiresAtColumnString = (() => {
            try {
                return columnFor('ExpiresAt', 'ExpiresAt')
            } catch {
                return null
            }
        })()
        const sortOrderColumn = columnFor('SortOrder', 'SortOrder')
        const firstAttempt = await client
            .query(
                `INSERT INTO ${accessLinkTable} (id, ${slugColumn}, ${targetTypeColumn}, ${targetIdColumn}, ${isActiveColumn},
                 ${maxUsesColumn}, ${useCountColumn}, ${linkTitleColumn},
                 ${showFirstNameColumn}, ${requireFirstNameColumn}, ${showLastNameColumn}, ${requireLastNameColumn},
                 ${showEmailColumn}, ${requireEmailColumn}, ${showPhoneColumn}, ${requirePhoneColumn}, ${captchaEnabledColumn},
                 ${sortOrderColumn}, ${expiresAtColumnString ? `${expiresAtColumnString},` : ''} workspace_id,
                 _upl_created_at, _upl_updated_at, _upl_created_by, _upl_updated_by, _upl_version)
             VALUES (public.uuid_generate_v7(), $1, 'quiz', $2, true, 10, 0, $4::jsonb,
                 true, false, false, false, false, false, false, false, false, 0, ${
                     expiresAtColumnString ? 'NULL,' : ''
                 } $3, NOW(), NOW(), NULL, NULL, 1)
             RETURNING id`,
                [slug, quizRecordId, workspaceId, JSON.stringify({ en: 'Converted workspace quiz access link' })]
            )
            .catch(async (error: { code?: string; message?: string } = {}) => {
                // Diagnostics seam: surface the NOT NULL column's codename before
                // this E2E seed stabilizes its completion across template revisions.
                if (error?.code === '23502') {
                    const messageColumn = /column "(\w+)"/u.exec(error.message ?? '')?.[1]
                    if (messageColumn) {
                        const codename = await client.query(`SELECT codename FROM ${schemaSql}."_app_components" WHERE column_name = $1`, [
                            messageColumn
                        ])
                        console.error(
                            `E2E AccessLink seed: NOT NULL column ${messageColumn} codename ${JSON.stringify(codename.rows?.[0]?.codename)}`
                        )
                    }
                }
                throw error
            })
        const insertResult = firstAttempt
        const insertedId = insertResult.rows[0]?.id
        if (typeof insertedId !== 'string') throw new Error('E2E quiz AccessLink seed inserted no row')
        return insertedId
    })
}

async function assertNoHorizontalOverflow(page: { evaluate: (script: () => number) => Promise<number> }, label: string): Promise<void> {
    const overflowPx = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth))
    expect(overflowPx, `${label} must not create horizontal page overflow`).toBeLessThanOrEqual(1)
}

type WorkspaceTarget = {
    id: string
    name: string
}

async function switchWorkspace(page: Page, workspace: WorkspaceTarget | string) {
    const workspaceId = typeof workspace === 'string' ? null : workspace.id
    const workspaceName = typeof workspace === 'string' ? workspace : workspace.name
    const switcher = page.getByTestId('runtime-workspace-switcher').first()
    await expect(switcher).toBeVisible({ timeout: 30_000 })

    if (workspaceId) {
        const currentWorkspaceId = await switcher
            .locator('input')
            .first()
            .inputValue()
            .catch(() => '')
        if (currentWorkspaceId === workspaceId) {
            await expect.poll(() => new URL(page.url()).searchParams.get('workspaceId')).toBe(workspaceId)
            return
        }
    } else {
        const currentWorkspaceName = (await switcher.textContent())?.trim()
        if (currentWorkspaceName === workspaceName) {
            return
        }
    }

    await switcher.getByRole('combobox').click()
    if (workspaceId) {
        await page.locator(`[role="option"][data-value="${workspaceId}"]`).click()
        await expect(switcher.locator('input').first()).toHaveValue(workspaceId, { timeout: 30_000 })
        await expect.poll(() => new URL(page.url()).searchParams.get('workspaceId')).toBe(workspaceId)
        return
    }

    await page
        .getByRole('option', { name: new RegExp(`^${escapeRegex(workspaceName)}(?:\\s|$)`) })
        .first()
        .click()
    await expect(switcher).toContainText(workspaceName, { timeout: 30_000 })
}

test('@flow lms workspace conversion moves Main to shared in place and keeps ids, records, member access, and guest links', async ({
    browser,
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(600_000)

    const bootstrapApi = await createBootstrapApiContext()
    const ownerApi = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const memberEmail = `e2e+${runManifest.runId}.lms-convert@${process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'}`
    const memberPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
    const defaultRoleCodenames = String(process.env.E2E_TEST_USER_ROLE_CODENAMES || 'User')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)

    const accessSlug = `convert-${runManifest.runId}`
    const shortLinkSlug = `e2e-${runManifest.runId
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-|-$/gu, '')
        .slice(0, 30)}-convert`

    try {
        const lms = await setupPublishedLmsApplication(ownerApi, {
            runId: runManifest.runId,
            label: 'Conversion',
            isPublic: true,
            workspacesEnabled: true
        })

        await recordCreatedMetahub({
            id: lms.metahub.id,
            name: `E2E ${runManifest.runId} Conversion LMS`,
            codename: `${runManifest.runId}-conversion-lms`
        })
        await recordCreatedPublication({
            id: lms.publication.id,
            metahubId: lms.metahub.id,
            schemaName: lms.publication.schemaName
        })
        await recordCreatedApplication({
            id: lms.applicationId
        })

        const assignableRoles = await getAssignableRoles(bootstrapApi)
        const defaultRoleIds = resolveGlobalRoleIds(assignableRoles, defaultRoleCodenames)

        const createdUser = await createAdminUser(bootstrapApi, {
            email: memberEmail,
            password: memberPassword,
            roleIds: defaultRoleIds,
            comment: `Created for LMS workspace conversion flow ${runManifest.runId}`
        })
        if (!createdUser?.userId) {
            throw new Error(`Created user ${memberEmail} did not return a user id`)
        }
        await recordCreatedGlobalUser({ userId: createdUser.userId, email: memberEmail })
        await waitForBrowserLoginReadiness({ email: memberEmail, password: memberPassword })

        await addApplicationMember(ownerApi, lms.applicationId, { email: memberEmail, role: 'member' })
        await expect
            .poll(async () => {
                const payload = await listApplicationMembers(ownerApi, lms.applicationId)
                const members = Array.isArray(payload?.items) ? payload.items : []
                return members.some((member: { userId?: string }) => member.userId === createdUser.userId)
            })
            .toBe(true)

        // Owner owns exactly one personal workspace and no shared one yet.
        const initialOwnerWorkspacesPayload = await listApplicationWorkspaces(ownerApi, lms.applicationId)
        const initialOwnerWorkspaces = Array.isArray(initialOwnerWorkspacesPayload?.items) ? initialOwnerWorkspacesPayload.items : []
        const ownerPersonalWorkspace = requireWorkspace(
            initialOwnerWorkspaces,
            (workspace) => (workspace.workspaceType ?? workspace.type) === 'personal' && workspace.roleCodename === 'owner',
            'owner personal workspace'
        )
        expect(initialOwnerWorkspaces.filter((workspace) => (workspace.workspaceType ?? workspace.type) === 'shared')).toHaveLength(0)

        const learningResourcesObjectId = await waitForApplicationObjectId(ownerApi, lms.applicationId, 'Learning Resources')
        const accessLinksObjectId = await waitForApplicationObjectId(ownerApi, lms.applicationId, 'Access Links')
        const quizzesObjectId = await waitForApplicationObjectId(ownerApi, lms.applicationId, 'Quizzes')
        const resourceTypeEnumerationId = await waitForMetahubEnumerationId(ownerApi, lms.metahub.id, 'Resource Type')
        const publicationStatusEnumerationId = await waitForMetahubEnumerationId(ownerApi, lms.metahub.id, 'Publication Status')
        const questionTypeEnumerationId = await waitForMetahubEnumerationId(ownerApi, lms.metahub.id, 'Question Type')
        const pageResourceTypeValueId = await waitForOptionValueId(ownerApi, lms.metahub.id, resourceTypeEnumerationId, 'Page')
        const publishedPublicationStatusValueId = await waitForOptionValueId(
            ownerApi,
            lms.metahub.id,
            publicationStatusEnumerationId,
            'Published'
        )
        const singleChoiceValueId = await waitForOptionValueId(ownerApi, lms.metahub.id, questionTypeEnumerationId, 'SingleChoice')
        const resourceTitle = `Converted workspace learning resource ${runManifest.runId}`
        const seededResourceRow = await createRuntimeRow(ownerApi, lms.applicationId, {
            workspaceId: ownerPersonalWorkspace.id,
            objectCollectionId: learningResourcesObjectId,
            data: {
                Title: resourceTitle,
                ResourceType: pageResourceTypeValueId,
                Source: { type: 'page', pageCodename: 'LearnerHome' },
                PublicationStatus: publishedPublicationStatusValueId,
                EstimatedTimeMinutes: 5,
                SortOrder: 0,
                Language: 'en',
                Version: '1.0'
            }
        })
        await waitForApplicationRuntimeRow(ownerApi, lms.applicationId, learningResourcesObjectId, seededResourceRow.id, {
            workspaceId: ownerPersonalWorkspace.id
        })

        await applyBrowserPreferences(page, { language: 'en' })
        await page.setViewportSize({ width: 1920, height: 1080 })
        await page.goto(`/a/${lms.applicationId}/workspaces`)
        await expect(page.getByTestId('runtime-workspaces-page')).toBeVisible({ timeout: 30_000 })
        const workspacePage = page.getByTestId('runtime-workspaces-page')
        const ownerPersonalCard = workspacePage.getByTestId('runtime-workspace-card').filter({ hasText: 'Main' }).first()
        await expect(ownerPersonalCard.getByLabel('Workspace actions')).toBeVisible({ timeout: 30_000 })

        await ownerPersonalCard.getByLabel('Workspace actions').click()
        const makeSharedItem = page.getByRole('menuitem', { name: 'Make shared' })
        await expect(makeSharedItem).toBeEnabled({ timeout: 30_000 })
        await makeSharedItem.click()

        const convertDialog = page.getByRole('dialog', { name: 'Convert to shared workspace?' })
        await expect(convertDialog).toBeVisible({ timeout: 30_000 })
        await expect(
            convertDialog.getByText(
                'Every application member sees this workspace with baseline member rights; existing owner roles are kept.'
            )
        ).toBeVisible()
        await expect(convertDialog.getByText('This change is permanent and cannot be undone.')).toBeVisible()
        await expect(
            convertDialog.getByText(
                'Existing guest links in this workspace become eligible when configured. Anonymous public access is not enabled automatically.'
            )
        ).toBeVisible()
        await expect(convertDialog.getByText('The workspace, its records and links are preserved.')).toBeVisible()
        await expect(page.getByRole('menuitem', { name: 'Make shared' })).toHaveCount(0)
        await expect(convertDialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
        await page.screenshot({ path: testInfo.outputPath('runtime-convert-dialog-en-1920.png'), fullPage: true })
        await assertNoHorizontalOverflow(page, 'conversion dialog 1920x1080')
        await page.setViewportSize({ width: 768, height: 1024 })
        await page.screenshot({ path: testInfo.outputPath('runtime-convert-dialog-en-768.png'), fullPage: true })
        await assertNoHorizontalOverflow(page, 'conversion dialog 768x1024')
        await page.setViewportSize({ width: 390, height: 844 })
        await page.screenshot({ path: testInfo.outputPath('runtime-convert-dialog-en-390.png'), fullPage: true })
        await assertNoHorizontalOverflow(page, 'conversion dialog 390x844')
        await page.setViewportSize({ width: 1920, height: 1080 })

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/a/${lms.applicationId}/workspaces`)
        await expect(page.getByTestId('runtime-workspaces-page')).toBeVisible({ timeout: 30_000 })
        const ruPersonalCard = workspacePage.getByTestId('runtime-workspace-card').filter({ hasText: 'Основное' }).first()
        // The actions menu aria-label is localized through the apps namespace.
        // getByLabel (aria-label attribution) is required: getByRole('button', …
        // computed-name) would also match the outer card container.
        await ruPersonalCard.getByLabel('Действия рабочего пространства').click()
        await expect(page.getByRole('menu')).toBeVisible({ timeout: 10_000 })
        const ruMakeSharedItem = page.getByRole('menuitem', { name: 'Сделать общим' })
        await expect(ruMakeSharedItem).toBeEnabled({ timeout: 30_000 })
        await ruMakeSharedItem.click()
        const ruConvertDialog = page.getByRole('dialog', { name: 'Перевести рабочее пространство в общее?' })
        await expect(ruConvertDialog).toBeVisible({ timeout: 30_000 })
        await expect(ruConvertDialog.getByText('Это изменение необратимо.')).toBeVisible()
        await expect(
            ruConvertDialog.getByText(
                'Все участники приложения увидят это рабочее пространство с базовыми правами участника; существующие роли владельца сохраняются.'
            )
        ).toBeVisible()
        await expect(ruConvertDialog.getByRole('button', { name: 'Перевести в общее' })).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath('runtime-convert-dialog-ru-1920.png'), fullPage: true })

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/a/${lms.applicationId}/workspaces`)
        await expect(page.getByTestId('runtime-workspaces-page')).toBeVisible({ timeout: 30_000 })

        // Positive conversion through the confirmation dialog.
        const enPersonalCard = workspacePage.getByTestId('runtime-workspace-card').filter({ hasText: 'Main' }).first()
        await enPersonalCard.getByLabel('Workspace actions').click()
        await page.getByRole('menuitem', { name: 'Make shared' }).click()
        const confirmDialog = page.getByRole('dialog', { name: 'Convert to shared workspace?' })
        await confirmDialog.getByRole('button', { name: 'Convert to shared' }).click()
        await expect(confirmDialog).toHaveCount(0, { timeout: 30_000 })

        // The workspace keeps its id; the server now reports it as active shared.
        await expect
            .poll(
                async () => {
                    const payload = await listApplicationWorkspaces(ownerApi, lms.applicationId)
                    const converted = payload.items.find((workspace) => workspace.id === ownerPersonalWorkspace.id)
                    return (converted as { workspaceType?: string } | undefined)?.workspaceType
                },
                { timeout: 30_000 }
            )
            .toBe('shared')

        // The owner still sees the pre-conversion row in the converted
        // workspace's content library (in-place preservation proof).
        await page.goto(
            `/a/${lms.applicationId}?targetKind=object&entityTypeCodename=ContentProjects&locale=en&workspaceId=${ownerPersonalWorkspace.id}`
        )
        await expect(page.getByRole('tab', { name: 'Library', exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(resourceTitle).first()).toBeVisible({ timeout: 30_000, intervals: [1_000, 2_000, 5_000] })
        // The owner holds zero personal workspaces after the conversion. The
        // admin-visibility listing also exposes other members' personal work
        // spaces, so the invariant is scoped by `personalUserId`.
        await expect
            .poll(
                async () => {
                    const payload = await listApplicationWorkspaces(ownerApi, lms.applicationId)
                    return payload.items.filter(
                        (workspace) =>
                            (workspace.workspaceType ?? workspace.type) === 'personal' &&
                            workspace.personalUserId === runManifest.testUser.userId
                    ).length
                },
                { timeout: 30_000 }
            )
            .toBe(0)

        // No duplicate `Main` appears even after extra runtime reads settle.
        await expect
            .poll(
                async () => {
                    const payload = await listApplicationWorkspaces(ownerApi, lms.applicationId)
                    const duplicateOwnerPersonal = payload.items.filter(
                        (workspace) =>
                            (workspace.workspaceType ?? workspace.type) === 'personal' &&
                            workspace.personalUserId === runManifest.testUser.userId
                    ).length
                    const stillShared = payload.items.some(
                        (workspace) =>
                            workspace.id === ownerPersonalWorkspace.id && (workspace.workspaceType ?? workspace.type) === 'shared'
                    )
                    return duplicateOwnerPersonal === 0 && stillShared
                },
                { timeout: 30_000, intervals: [1_000, 2_000, 5_000, 7_000] }
            )
            .toBe(true)

        // Re-converting an already shared workspace must fail closed with the typed code.
        const reconversionResponse = await convertApplicationWorkspaceToShared(ownerApi, lms.applicationId, ownerPersonalWorkspace.id)
        expect(reconversionResponse.status, 're-converting must be rejected').toBe(409)
        const reconversionBody = await reconversionResponse.json()
        expect(reconversionBody?.code).toBe('WORKSPACE_CONVERSION_BLOCKED')

        // Member access comes from baseline application membership (no invite).

        const memberApi = await createLoggedInApiContext({
            email: memberEmail,
            password: memberPassword
        })
        await expect
            .poll(
                async () => {
                    const payload = await listApplicationWorkspaces(memberApi, lms.applicationId)
                    const convertedForMember = payload.items.find((workspace) => workspace.id === ownerPersonalWorkspace.id)
                    return (convertedForMember as { roleCodename?: string } | undefined)?.roleCodename
                },
                { timeout: 30_000 }
            )
            .toBe('member')

        // Server-side permissions: a baseline member cannot convert at all.
        const memberConversionResponse = await convertApplicationWorkspaceToShared(memberApi, lms.applicationId, ownerPersonalWorkspace.id)
        expect(memberConversionResponse.status, 'baseline member must not convert').toBe(403)
        const memberDenialBody = await memberConversionResponse.json()
        expect(memberDenialBody?.code ?? memberDenialBody?.error).toBeDefined()

        // After the negatives, the owner still owns exactly zero personal work
        // spaces (the admin-visibility listing also exposes other members'
        // personal spaces, so filter by `personalUserId`).
        expect(
            (await listApplicationWorkspaces(ownerApi, lms.applicationId)).items.filter(
                (workspace) =>
                    (workspace.workspaceType ?? workspace.type) === 'personal' && workspace.personalUserId === runManifest.testUser.userId
            )
        ).toHaveLength(0)

        // Guest links exist only inside shared workspaces (upstream contract:
        // AccessLink authoring is locked to non-personal rows), so the
        // in-place proof targets the post-conversion workspace: both a
        // content and a quiz AccessLink live in the SAME workspace — its id,
        // rows and slug survive without creating a second workspace.
        const anonContext = await browser.newContext({ storageState: { cookies: [], origins: [] } })
        const anon = anonContext.request
        try {
            const contentAccessLinkRow = await createRuntimeRow(ownerApi, lms.applicationId, {
                workspaceId: ownerPersonalWorkspace.id,
                objectCollectionId: accessLinksObjectId,
                data: {
                    Slug: accessSlug,
                    ContentNodeIdRef: seededResourceRow.id,
                    IsActive: true,
                    MaxUses: 10,
                    LinkTitle: 'Converted workspace content access link',
                    ShowFirstName: true,
                    RequireFirstName: true
                }
            })
            await waitForApplicationRuntimeRow(ownerApi, lms.applicationId, accessLinksObjectId, contentAccessLinkRow.id, {
                workspaceId: ownerPersonalWorkspace.id
            })

            await expect
                .poll(
                    async () => {
                        const response = await anon.get(`/api/v1/public/a/${lms.applicationId}/links/${accessSlug}`)
                        if (response.status() !== 200) return `${response.status()}`
                        const payload = await response.json()
                        return typeof payload?.id === 'string' ? payload.id : 'missing'
                    },
                    { timeout: 30_000, intervals: [500, 1_000, 2_000] }
                )
                .toBe(contentAccessLinkRow.id)

            // Short-link proof uses a real `lms-access-link` target: a quiz
            // AccessLink lives inside the converted workspace, so the public
            // `/l/<slug>` resolver must keep working in place.
            const quizRow = await createRuntimeRow(ownerApi, lms.applicationId, {
                workspaceId: ownerPersonalWorkspace.id,
                objectCollectionId: quizzesObjectId,
                data: {
                    Title: `Converted workspace quiz ${runManifest.runId}`,
                    // `SortOrder` of Quizzes is server-owned (defaults to 1).
                    Description: `Quiz guest intake link inside the converted workspace ${runManifest.runId}`,
                    PassingScorePercent: 50,
                    MaxAttempts: 3,
                    TimeLimitSeconds: 0,
                    ConfirmAnswerBeforeNext: false,
                    Questions: [
                        {
                            Prompt: 'Was this guest link created inside the converted workspace?',
                            Description: null,
                            QuestionType: singleChoiceValueId,
                            Explanation: null,
                            SortOrder: 1,
                            Options: [
                                { id: 'opt-yes-1', label: { en: 'Yes' }, isCorrect: true },
                                { id: 'opt-no-2', label: { en: 'No' }, isCorrect: false }
                            ]
                        }
                    ]
                }
            })
            await waitForApplicationRuntimeRow(ownerApi, lms.applicationId, quizzesObjectId, quizRow.id, {
                workspaceId: ownerPersonalWorkspace.id
            })

            const quizSlug = `convert-quiz-${runManifest.runId}`
            const quizAccessLinkId = await seedQuizAccessLinkRowForTest(lms.applicationId, ownerPersonalWorkspace.id, quizSlug, quizRow.id)
            await waitForApplicationRuntimeRow(ownerApi, lms.applicationId, accessLinksObjectId, quizAccessLinkId, {
                workspaceId: ownerPersonalWorkspace.id
            })

            // `TargetId` is server-owned and defaults to no target, so the
            // quiz reference is bound by the test database seam (the public
            // quiz eligibility requires a real quiz target like production
            // flows do).

            // A short link pointing at the real AccessLink in the converted
            // workspace must be creatable and anonymously resolvable.
            const shortLinkResponse = await sendWithCsrf(ownerApi, 'POST', '/api/v1/global-short-links', {
                slug: shortLinkSlug,
                target: {
                    kind: 'lms-access-link',
                    applicationId: lms.applicationId,
                    accessLinkId: quizAccessLinkId,
                    accessLinkSlug: quizSlug,
                    workspaceId: ownerPersonalWorkspace.id
                }
            })
            expect(shortLinkResponse.ok, 'The converted workspace must keep short-link eligibility').toBe(true)
            const shortLinkPayload = await shortLinkResponse.json()
            if (typeof shortLinkPayload?.id !== 'string') throw new Error('Short link response has no record id')

            const anonymousResolve = await anon.get(`/api/v1/public/l/${shortLinkSlug}`)
            expect(anonymousResolve.status()).toBe(200)
            expect(await anonymousResolve.json()).toEqual({
                target: {
                    kind: 'lms-access-link',
                    applicationId: lms.applicationId,
                    accessLinkId: quizAccessLinkId,
                    accessLinkSlug: quizSlug,
                    workspaceId: ownerPersonalWorkspace.id
                }
            })

            const anonymousQuizLink = await anon.get(`/api/v1/public/a/${lms.applicationId}/links/${quizSlug}`)
            expect(anonymousQuizLink.status()).toBe(200)
            const anonymousQuizLinkPayload = await anonymousQuizLink.json()
            expect(anonymousQuizLinkPayload?.id).toBe(quizAccessLinkId)
            expect(anonymousQuizLinkPayload?.slug).toBe(quizSlug)

            // The converted shared workspace becomes a valid public entry candidate.
            await setApplicationPublicEntryWorkspace(ownerApi, lms.applicationId, ownerPersonalWorkspace.id)
            await expect
                .poll(
                    async () => {
                        const runtimePayload = await getApplicationRuntime(ownerApi, lms.applicationId, {
                            objectCollectionId: learningResourcesObjectId,
                            workspaceId: ownerPersonalWorkspace.id
                        })
                        return runtimePayload?.rows?.find((row: { id?: string }) => row.id === seededResourceRow.id)?.id
                    },
                    { timeout: 30_000 }
                )
                .toBe(seededResourceRow.id)
        } finally {
            await anonContext.close().catch(() => undefined)
        }

        // Real-user proof, full path: the baseline member finds the converted
        // workspace in the switcher, navigates through it (no direct URL), and
        // the converted dashboard renders rows plus the metric cards.
        const memberSession = await createLoggedInBrowserContext(browser, {
            email: memberEmail,
            password: memberPassword
        })
        const memberPage = memberSession.page
        try {
            await applyBrowserPreferences(memberPage, { language: 'en' })
            await memberPage.goto(`/a/${lms.applicationId}/workspaces`)
            const page = memberPage
            const workspacePage = page.getByTestId('runtime-workspaces-page')
            await expect(workspacePage).toBeVisible({ timeout: 30_000 })

            // The member never receives the `Make shared` affordance: the row
            // menu actions must not expose owner-only conversion for their
            // baseline membership. The shared card is addressed by its stable
            // `data-workspace-id` attribute instead of display-name filters.
            const convertedSharedCard = page
                .locator(`[data-testid="runtime-workspace-card"][data-workspace-id="${ownerPersonalWorkspace.id}"]`)
                .first()
            await expect(convertedSharedCard).toBeVisible({ timeout: 30_000 })
            await convertedSharedCard.getByLabel('Workspace actions').click()
            const memberMenu = page.getByRole('menu')
            await expect(memberMenu).toBeVisible({ timeout: 30_000 })
            // The conversion affordance is owner-gated together with member
            // management, so a baseline member sees no `Make shared` item at
            // all — stronger than a disabled entry.
            await expect(memberMenu.getByRole('menuitem', { name: 'Make shared' })).toHaveCount(0, { timeout: 10_000 })
            await page.keyboard.press('Escape')

            // Open the converted workspace through the switcher like a real
            // user (options are addressed by the deterministic workspace id),
            // then open the workspace card like the workspace list does.
            await switchWorkspace(memberPage, ownerPersonalWorkspace)
            await expect(memberPage).toHaveURL(new RegExp(`/a/${lms.applicationId}.*workspaceId=${ownerPersonalWorkspace.id}`), {
                timeout: 30_000
            })
            await convertedSharedCard.click()
            await expect(memberPage).toHaveURL(new RegExp(`/a/${lms.applicationId}/workspaces/${ownerPersonalWorkspace.id}$`), {
                timeout: 30_000
            })
            await expect(memberPage.getByTestId('runtime-workspace-metric-card')).toHaveCount(3, { timeout: 60_000 })

            // LearningResources rows follow the ownerOrShared runtime record
            // surface: baseline membership grants workspace-level access, not
            // automatic row reads for other users' rows (the member role is
            // read-only in this template and cannot author resources). The
            // converted workspace stays readable through the member runtime
            // context (HTTP 200) with the owner's private rows excluded, and
            // the library tab stays available in the UI.
            const memberRuntimePayload = await getApplicationRuntime(memberApi, lms.applicationId, {
                objectCollectionId: learningResourcesObjectId,
                workspaceId: ownerPersonalWorkspace.id
            }).then(
                (payload: unknown) => payload,
                (readError: unknown) => {
                    throw new Error(`Member runtime read failed: ${readError instanceof Error ? readError.message : String(readError)}`)
                }
            )
            expect(memberRuntimePayload?.currentWorkspaceId).toBe(ownerPersonalWorkspace.id)
            expect(Array.isArray(memberRuntimePayload?.rows)).toBe(true)

            await memberPage.goto(
                `/a/${lms.applicationId}?targetKind=object&entityTypeCodename=ContentProjects&locale=en&workspaceId=${ownerPersonalWorkspace.id}`
            )
            await expect(memberPage.getByRole('tab', { name: 'Library', exact: true })).toBeVisible({ timeout: 30_000 })

            // Snapshot matrix keeps the runtime leakage oracle and layout contract.
            await memberPage.setViewportSize({ width: 1920, height: 1080 })
            await assertNoHorizontalOverflow(memberPage, 'member converted workspace 1920x1080')
            const memberPagesText = (await memberPage.locator('body').innerText()).replace(/https?:\/\/\S+/gu, '')
            expect(memberPagesText).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/iu)
            await memberPage.setViewportSize({ width: 390, height: 844 })
            await assertNoHorizontalOverflow(memberPage, 'member converted workspace 390x844')
            await memberPage.screenshot({ path: testInfo.outputPath('runtime-converted-workspace-member-390.png'), fullPage: true })
        } finally {
            await memberSession.context.close().catch(() => undefined)
        }
    } finally {
        await disposeApiContext(ownerApi)
        await disposeBootstrapApiContext(bootstrapApi)
    }
})

test('@flow lms workspace conversion works inside closed applications without leaking public access', async ({ browser, runManifest }) => {
    test.setTimeout(480_000)

    const bootstrapApi = await createBootstrapApiContext()
    const ownerApi = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const memberEmail = `e2e+${runManifest.runId}.lms-convert-closed@${process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'}`
    const memberPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
    const defaultRoleCodenames = String(process.env.E2E_TEST_USER_ROLE_CODENAMES || 'User')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)

    try {
        const lms = await setupPublishedLmsApplication(ownerApi, {
            runId: runManifest.runId,
            label: 'ConvertClosed',
            isPublic: false,
            workspacesEnabled: true
        })

        await recordCreatedMetahub({
            id: lms.metahub.id,
            name: `E2E ${runManifest.runId}ConvertClosed LMS`,
            codename: `${runManifest.runId}-convertclosed-lms`
        })
        await recordCreatedPublication({
            id: lms.publication.id,
            metahubId: lms.metahub.id,
            schemaName: lms.publication.schemaName
        })
        await recordCreatedApplication({
            id: lms.applicationId
        })

        const assignableRoles = await getAssignableRoles(bootstrapApi)
        const defaultRoleIds = resolveGlobalRoleIds(assignableRoles, defaultRoleCodenames)
        const createdUser = await createAdminUser(bootstrapApi, {
            email: memberEmail,
            password: memberPassword,
            roleIds: defaultRoleIds,
            comment: `Created for closed LMS conversion flow ${runManifest.runId}`
        })
        if (!createdUser?.userId) {
            throw new Error(`Created user ${memberEmail} did not return a user id`)
        }
        await recordCreatedGlobalUser({ userId: createdUser.userId, email: memberEmail })
        await waitForBrowserLoginReadiness({ email: memberEmail, password: memberPassword })

        await addApplicationMember(ownerApi, lms.applicationId, { email: memberEmail, role: 'member' })
        await expect
            .poll(async () => {
                const payload = await listApplicationMembers(ownerApi, lms.applicationId)
                const members = Array.isArray(payload?.items) ? payload.items : []
                return members.some((member: { userId?: string }) => member.userId === createdUser.userId)
            })
            .toBe(true)

        const initialOwnerWorkspacesPayload = await listApplicationWorkspaces(ownerApi, lms.applicationId)
        const initialOwnerWorkspaces = Array.isArray(initialOwnerWorkspacesPayload?.items) ? initialOwnerWorkspacesPayload.items : []
        const ownerPersonalWorkspace = requireWorkspace(
            initialOwnerWorkspaces,
            (workspace) => (workspace.workspaceType ?? workspace.type) === 'personal' && workspace.roleCodename === 'owner',
            'closed app owner personal workspace'
        )

        const conversionResponse = await convertApplicationWorkspaceToShared(ownerApi, lms.applicationId, ownerPersonalWorkspace.id)
        expect(conversionResponse.status).toBe(200)
        const conversionBody = await conversionResponse.json()
        expect(conversionBody?.id).toBe(ownerPersonalWorkspace.id)

        // The conversion commits asynchronously with the request middleware; poll
        // the dataset instead of trusting a single immediate read.
        await expect
            .poll(
                async () => {
                    const payload = await listApplicationWorkspaces(ownerApi, lms.applicationId)
                    const converted = payload.items.find((workspace) => workspace.id === ownerPersonalWorkspace.id)
                    return (converted as { workspaceType?: string } | undefined)?.workspaceType
                },
                { timeout: 30_000 }
            )
            .toBe('shared')
        await expect
            .poll(
                async () => {
                    const payload = await listApplicationWorkspaces(ownerApi, lms.applicationId)
                    // Admin visibility also lists other members' personal work
                    // spaces; scope the no-duplicate invariant by `personalUserId`.
                    return payload.items.filter(
                        (workspace) =>
                            (workspace.workspaceType ?? workspace.type) === 'personal' &&
                            workspace.personalUserId === runManifest.testUser.userId
                    ).length
                },
                { timeout: 30_000 }
            )
            .toBe(0)

        // Closed application still shares the workspace with application members.
        const memberApi = await createLoggedInApiContext({
            email: memberEmail,
            password: memberPassword
        })
        await expect
            .poll(
                async () => {
                    const payload = await listApplicationWorkspaces(memberApi, lms.applicationId)
                    return payload.items.some((workspace) => workspace.id === ownerPersonalWorkspace.id)
                },
                { timeout: 30_000 }
            )
            .toBe(true)

        // Anonymous guests must stay fully denied on the closed application:
        // public bootstrap, the converted workspace list, access links, and all
        // public short-link resolution reject unauthenticated traffic.
        const anonClosedContext = await browser.newContext({ storageState: { cookies: [], origins: [] } })
        const anonClosed = anonClosedContext.request
        try {
            const runtimeProbeResponse = await anonClosed.get(
                `/api/v1/public/applications/${lms.applicationId}/runtime?targetKind=page&locale=en`
            )
            expect(runtimeProbeResponse.status(), 'closed application public runtime stays denied').not.toBe(200)

            const linkListResponse = await anonClosed.get(`/api/v1/public/a/${lms.applicationId}/links/${runManifest.runId}-closed`)
            expect(linkListResponse.status(), 'closed application access links stay denied').not.toBe(200)

            const shortResolveResponse = await anonClosed.get(`/api/v1/public/l/e2e-${runManifest.runId}-closed-short`)
            expect(shortResolveResponse.status(), 'closed application stays unresolvable via public short links').not.toBe(200)
        } finally {
            await anonClosedContext.close().catch(() => undefined)
        }
    } finally {
        await disposeApiContext(ownerApi)
        await disposeBootstrapApiContext(bootstrapApi)
    }
})
