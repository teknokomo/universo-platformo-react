import { createLocalizedContent } from '@universo-react/utils'
import { applyBrowserPreferences } from './browser/preferences'
import {
    createApplicationWorkspace,
    createLoggedInApiContext,
    createPublicationLinkedApplication,
    setApplicationPublicEntryWorkspace,
    syncApplicationSchema
} from './backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from './backend/run-manifest.mjs'
import { importLmsSnapshotThroughUi } from './lmsSnapshotImport'
import { LMS_LYCEUM_MARATHON_ACCESS_LINKS, LMS_LYCEUM_MARATHON_QUIZZES } from './lmsMarathonFixtureContract'
import type { LmsMarathonApplicationContext, LmsMarathonBaseContext } from './lmsMarathonGuestShortLinkTypes'

export async function createLmsMarathonApplication(base: LmsMarathonBaseContext): Promise<LmsMarathonApplicationContext> {
    const { page, runManifest, resources } = base
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })
    resources.api = api
    await applyBrowserPreferences(page, { language: 'en' })

    const imported = await importLmsSnapshotThroughUi(page)
    await recordCreatedMetahub({ id: imported.metahubId, name: imported.metahubName })
    await recordCreatedPublication({ id: imported.publicationId, metahubId: imported.metahubId })

    const linkedApplication = await createPublicationLinkedApplication(api, imported.metahubId, imported.publicationId, {
        name: { en: `E2E ${runManifest.runId} LMS Marathon Guest App` },
        namePrimaryLocale: 'en',
        createApplicationSchema: false,
        isPublic: true
    })
    const applicationId = linkedApplication?.application?.id
    if (typeof applicationId !== 'string') {
        throw new Error('LMS Marathon guest flow did not create a linked application')
    }
    await recordCreatedApplication({ id: applicationId })
    await syncApplicationSchema(api, applicationId, {
        schemaOptions: {
            workspaceModeRequested: 'enabled',
            acknowledgeIrreversibleWorkspaceEnablement: true
        }
    })

    const publicWorkspace = await createApplicationWorkspace(api, applicationId, {
        name: createLocalizedContent('en', `E2E ${runManifest.runId} LMS Marathon Guest Workspace`)
    })
    const publicWorkspaceId = publicWorkspace?.id
    if (typeof publicWorkspaceId !== 'string') {
        throw new Error('LMS Marathon guest flow did not create a public workspace')
    }
    await setApplicationPublicEntryWorkspace(api, applicationId, publicWorkspaceId)

    const accessLink = LMS_LYCEUM_MARATHON_ACCESS_LINKS[0]
    if (!accessLink) throw new Error('The LMS Marathon fixture contract has no grade 5 access link')
    const gradeQuiz = LMS_LYCEUM_MARATHON_QUIZZES.find(({ grade }) => grade === 5)
    const gradeTenAccessLink = LMS_LYCEUM_MARATHON_ACCESS_LINKS.find(({ key }) => key === 'lyceum-marathon-grade-10')
    const gradeTenQuiz = LMS_LYCEUM_MARATHON_QUIZZES.find(({ grade }) => grade === 10)
    if (!gradeQuiz) throw new Error('The LMS Marathon fixture contract is missing grade 5 data')
    if (!gradeTenAccessLink || !gradeTenQuiz) throw new Error('The LMS Marathon fixture contract is missing grade 10 data')
    const gradeQuestionCount = gradeQuiz.questions.length

    return {
        ...base,
        api,
        applicationId,
        publicWorkspaceId,
        accessLink,
        gradeQuiz,
        gradeTenAccessLink,
        gradeTenQuiz,
        gradeQuestionCount
    }
}
