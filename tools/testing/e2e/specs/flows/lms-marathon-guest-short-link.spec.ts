import { test } from '../../fixtures/test'
import { createLmsMarathonApplication } from '../../support/lmsMarathonGuestShortLinkApplication'
import { cleanupLmsMarathonGuestFlow } from '../../support/lmsMarathonGuestShortLinkCleanup'
import { createLmsMarathonGlobalShortLinks } from '../../support/lmsMarathonGuestShortLinkLinks'
import { verifyLmsMarathonQuizAuthoring, verifyLmsMarathonUsedAccessLinkCopy } from '../../support/lmsMarathonQuizAuthoring'
import { runLmsMarathonAuthoredQuizGuestFlow } from '../../support/lmsMarathonAuthoredQuizGuestFlow'
import { runLmsMarathonAllGradesGuestSmoke } from '../../support/lmsMarathonGuestShortLinkAllGrades'
import { runLmsMarathonAccessLinkRevocationScenario } from '../../support/lmsMarathonGuestShortLinkAccessLinkRevocation'
import { runLmsMarathonAccessLinkDeleteScenario } from '../../support/lmsMarathonGuestShortLinkAccessLinkDelete'
import { runLmsMarathonEnglishGuestQuiz } from '../../support/lmsMarathonGuestShortLinkEnglish'
import { runLmsMarathonGradeTenGuestCheck } from '../../support/lmsMarathonGuestShortLinkGradeTen'
import { verifyLmsMarathonAuthorizedReport } from '../../support/lmsMarathonGuestShortLinkReport'
import { verifyLmsMarathonReportWorkspaceIsolation } from '../../support/lmsMarathonReportWorkspaceIsolation'
import { runLmsMarathonRussianGuestQuiz } from '../../support/lmsMarathonGuestShortLinkRussian'
import { runLmsMarathonTimeoutScenario } from '../../support/lmsMarathonGuestShortLinkTimeout'
import { runLmsMarathonWithdrawalScenario } from '../../support/lmsMarathonGuestShortLinkWithdrawal'
import { runLmsMarathonWorkspaceDeletionScenario } from '../../support/lmsMarathonGuestShortLinkWorkspaceDeletion'
import type { LmsMarathonFlowResources } from '../../support/lmsMarathonGuestShortLinkTypes'

test('@flow LMS Marathon quiz is reachable through a global guest short link and appears in authorized reports', async ({
    browser,
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(1_800_000)

    const resources: LmsMarathonFlowResources = {
        cleanupErrors: []
    }
    const base = { browser, page, testInfo, runManifest, resources }
    try {
        const application = await createLmsMarathonApplication(base)
        const authoredQuiz = await verifyLmsMarathonQuizAuthoring(application)
        const flow = await createLmsMarathonGlobalShortLinks(application, authoredQuiz)
        await runLmsMarathonAllGradesGuestSmoke(flow)
        await runLmsMarathonAuthoredQuizGuestFlow(flow)
        await verifyLmsMarathonUsedAccessLinkCopy(flow, authoredQuiz)
        await runLmsMarathonAccessLinkRevocationScenario(flow)
        await runLmsMarathonGradeTenGuestCheck(flow)
        const submittedParticipant = await runLmsMarathonEnglishGuestQuiz(flow)
        await runLmsMarathonRussianGuestQuiz(flow)
        const timedOutParticipant = await runLmsMarathonTimeoutScenario(flow)
        await verifyLmsMarathonAuthorizedReport(flow, submittedParticipant, timedOutParticipant)
        await verifyLmsMarathonReportWorkspaceIsolation(application, [
            submittedParticipant.participantName,
            timedOutParticipant.participantName
        ])
        await runLmsMarathonAccessLinkDeleteScenario(flow)
        await runLmsMarathonWithdrawalScenario(flow)
        await runLmsMarathonWorkspaceDeletionScenario(flow)
    } finally {
        await cleanupLmsMarathonGuestFlow(resources)
    }

    if (resources.cleanupErrors.length > 0) {
        throw new AggregateError(resources.cleanupErrors, 'Cleaning up the LMS Marathon E2E flow failed')
    }
})
