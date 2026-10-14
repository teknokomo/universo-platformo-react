import { expect } from '../fixtures/test'
import { createLocalizedContent } from '@universo-react/utils'
import { randomBytes } from 'node:crypto'
import { createGlobalRolePersona } from './backend/personas.mjs'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from './browser/runtimeUx'
import {
    addApplicationMember,
    createApplicationWorkspace,
    createLoggedInApiContext,
    disposeApiContext,
    getApplicationRuntime,
    listApplicationMembers,
    sendWithCsrf
} from './backend/api-session.mjs'
import type { LmsMarathonApplicationContext } from './lmsMarathonGuestShortLinkTypes'

/** Confirms report execution cannot read assessment data from a different workspace. */
export async function verifyLmsMarathonReportWorkspaceIsolation(
    flow: LmsMarathonApplicationContext,
    participantNames: string[]
): Promise<void> {
    const isolatedWorkspace = await createApplicationWorkspace(flow.api, flow.applicationId, {
        name: createLocalizedContent('en', `E2E ${flow.runManifest.runId} isolated report workspace`)
    })
    if (typeof isolatedWorkspace?.id !== 'string') {
        throw new Error('The LMS report workspace-isolation test did not create a workspace')
    }

    const response = await sendWithCsrf(
        flow.api,
        'POST',
        `/api/v1/applications/${flow.applicationId}/runtime/reports/run?workspaceId=${encodeURIComponent(isolatedWorkspace.id)}`,
        { reportCodename: 'QuizAttemptResults', limit: 100, offset: 0 }
    )
    expect(response.status, 'The authorized owner may run reports in an accessible workspace').toBe(200)
    const payload = await response.json()
    expect(payload.definition?.codename).toBe('QuizAttemptResults')
    expect(payload.rows, 'Quiz attempts from another workspace must remain invisible').toEqual([])
    expect(Number(payload.total)).toBe(0)
    expect(JSON.stringify(payload.rows)).not.toMatch(/E2E Marathon|Learner/iu)

    const { page, testInfo, applicationId, publicWorkspaceId } = flow
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/a/${applicationId}?locale=en&workspaceId=${encodeURIComponent(isolatedWorkspace.id)}`)
    const isolatedReportsNavigation = page
        .getByRole('link', { name: 'Reports', exact: true })
        .or(page.getByRole('button', { name: 'Reports', exact: true }))
        .first()
    await expect(isolatedReportsNavigation, 'The authorized owner can open reports in another workspace').toBeVisible({ timeout: 30_000 })
    await isolatedReportsNavigation.click()
    const quizAttemptReportTable = () =>
        page
            .getByTestId('runtime-report-details-table')
            .filter({ has: page.getByRole('columnheader', { name: 'Student name', exact: true }) })
    const isolatedReportTable = quizAttemptReportTable()
    await expect(isolatedReportTable, 'The empty workspace must render the quiz-attempt report table').toHaveCount(1)
    await expect(isolatedReportTable).toBeVisible({ timeout: 60_000 })
    for (const participantName of participantNames) {
        await expect(
            isolatedReportTable.getByText(participantName, { exact: false }),
            'Switching workspaces must hide guest results from the previous workspace'
        ).toHaveCount(0)
    }
    await expectNoPageHorizontalOverflow(page, 'LMS report workspace with no guest attempts')
    await expectNoTechnicalLeakage(isolatedReportTable, { label: 'Empty isolated LMS report workspace', checkUuidSubstrings: true })
    await page.screenshot({
        path: testInfo.outputPath('lms-marathon-report-isolated-workspace-empty.png'),
        fullPage: true,
        animations: 'disabled'
    })

    await page.goto(`/a/${applicationId}?locale=en&workspaceId=${encodeURIComponent(publicWorkspaceId)}`)
    const publicReportsNavigation = page
        .getByRole('link', { name: 'Reports', exact: true })
        .or(page.getByRole('button', { name: 'Reports', exact: true }))
        .first()
    await expect(publicReportsNavigation).toBeVisible({ timeout: 30_000 })
    await publicReportsNavigation.click()
    const publicReportTable = quizAttemptReportTable()
    await expect(publicReportTable, 'The results workspace must render the same quiz-attempt report table').toHaveCount(1)
    await expect(publicReportTable.getByText(participantNames[0] ?? '', { exact: false })).toBeVisible({ timeout: 60_000 })
    await expectNoPageHorizontalOverflow(page, 'LMS report after switching back to the results workspace')

    const editorSuffix = randomBytes(6).toString('hex')
    const editorEmail = `lms-report-editor-${editorSuffix}@example.test`
    const editorPassword = randomBytes(32).toString('base64url')
    const editorPersona = await createGlobalRolePersona({
        runId: flow.runManifest.runId,
        roleCodename: `LmsMarathonReportEditor${editorSuffix}`,
        roleName: `LMS Marathon report editor ${flow.runManifest.runId}`,
        permissions: [],
        userEmail: editorEmail,
        password: editorPassword
    })
    await addApplicationMember(flow.api, flow.applicationId, { email: editorPersona.user.email, role: 'editor' })
    const editorApi = await createLoggedInApiContext({ email: editorPersona.user.email, password: editorPersona.user.password })
    try {
        const editorRuntime = (await getApplicationRuntime(editorApi, flow.applicationId)) as {
            permissions?: Record<string, boolean>
        }
        expect(editorRuntime.permissions?.readReports, 'An application editor should have report capability').toBe(true)
        expect(editorRuntime.permissions?.manageApplication, 'An application editor must not bypass workspace membership').toBe(false)

        const applicationMembers = (await listApplicationMembers(flow.api, flow.applicationId)) as {
            items?: Array<Record<string, unknown>>
        }
        expect(
            applicationMembers.items?.some((member) => member.userId === editorPersona.user.userId && member.role === 'editor'),
            'The report reader must be an application editor'
        ).toBe(true)
        const editorDeniedResponse = await sendWithCsrf(
            editorApi,
            'POST',
            `/api/v1/applications/${flow.applicationId}/runtime/reports/run?workspaceId=${encodeURIComponent(isolatedWorkspace.id)}`,
            { reportCodename: 'QuizAttemptResults', limit: 100, offset: 0 }
        )
        expect(
            editorDeniedResponse.status,
            'An application editor with readReports but no membership in the requested workspace must receive forbidden'
        ).toBe(403)
        const editorDeniedBody = await editorDeniedResponse.text()
        expect(editorDeniedBody).not.toContain('E2E Marathon')
        expect(editorDeniedBody).not.toContain('Learner')
    } finally {
        await disposeApiContext(editorApi)
    }

    const personaSuffix = randomBytes(6).toString('hex')
    const email = `lms-report-no-membership-${personaSuffix}@example.test`
    const password = randomBytes(32).toString('base64url')
    const persona = await createGlobalRolePersona({
        runId: flow.runManifest.runId,
        roleCodename: `LmsMarathonNoMembership${personaSuffix}`,
        roleName: `LMS Marathon no application access ${flow.runManifest.runId}`,
        permissions: [],
        userEmail: email,
        password
    })
    const unrelatedUserApi = await createLoggedInApiContext({ email: persona.user.email, password: persona.user.password })
    try {
        const applicationMembers = (await listApplicationMembers(flow.api, flow.applicationId)) as {
            items?: Array<Record<string, unknown>>
        }
        expect(applicationMembers.items, 'The owner must be able to inspect the application membership list').toBeDefined()
        expect(
            applicationMembers.items?.some((member) => member.userId === persona.user.userId),
            'The denied user must not have application membership'
        ).toBe(false)

        const deniedResponse = await sendWithCsrf(
            unrelatedUserApi,
            'POST',
            `/api/v1/applications/${flow.applicationId}/runtime/reports/run?workspaceId=${encodeURIComponent(flow.publicWorkspaceId)}`,
            { reportCodename: 'QuizAttemptResults', limit: 100, offset: 0 }
        )
        expect(deniedResponse.status, 'An authenticated user without application/workspace membership must receive forbidden').toBe(403)
        const deniedBody = await deniedResponse.text()
        expect(deniedBody).not.toContain('E2E Marathon')
        expect(deniedBody).not.toContain('Learner')
    } finally {
        await disposeApiContext(unrelatedUserApi)
    }
}
