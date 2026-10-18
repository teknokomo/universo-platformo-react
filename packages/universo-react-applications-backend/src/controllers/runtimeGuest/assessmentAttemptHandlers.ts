import type { GuestAssessmentAttemptHandlerDependencies } from './assessmentAttemptSupport'
import { createGuestAssessmentAttemptSupport } from './assessmentAttemptSupport'
import { createStartGuestAssessmentAttemptHandler } from './assessmentAttemptStartHandler'
import { createGetGuestAssessmentAttemptHandler } from './assessmentAttemptGetHandler'
import { createSaveGuestAssessmentAnswerHandler } from './assessmentAttemptAnswerHandler'
import { createFinalizeGuestAssessmentAttemptHandler } from './assessmentAttemptFinalizeHandler'
import { createContinueGuestAssessmentAttemptHandler } from './assessmentAttemptContinueHandler'

export type { GuestAssessmentAccessLink } from './accessLinkTypes'

export const createGuestAssessmentAttemptHandlers = (dependencies: GuestAssessmentAttemptHandlerDependencies) => {
    const support = createGuestAssessmentAttemptSupport(dependencies)
    return {
        startGuestAssessmentAttempt: createStartGuestAssessmentAttemptHandler(dependencies, support),
        getGuestAssessmentAttempt: createGetGuestAssessmentAttemptHandler(dependencies, support),
        saveGuestAssessmentAnswer: createSaveGuestAssessmentAnswerHandler(dependencies, support),
        continueGuestAssessmentAttempt: createContinueGuestAssessmentAttemptHandler(dependencies, support),
        finalizeGuestAssessmentAttempt: createFinalizeGuestAssessmentAttemptHandler(dependencies, support)
    }
}
