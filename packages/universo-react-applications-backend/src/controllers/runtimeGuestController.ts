import type { DbExecutor } from '@universo-react/utils'
import { resolveGuestAssessmentRuntimeTables } from '../services/guestAssessmentRuntimeTables'
import { lockPublicApplicationForGuestAssessment } from '../persistence/publicGuestApplicationStore'
import { createPublicRuntimeModuleHandlers } from './runtimeGuest/publicRuntimeModuleHandlers'
import { createGuestAssessmentAttemptHandlers } from './runtimeGuest/assessmentAttemptHandlers'
import {
    GUEST_PARTICIPANT_ID_HEADER,
    GUEST_SESSION_TOKEN_HEADER,
    LEGACY_GUEST_STUDENT_ID_HEADER,
    MAX_GUEST_SESSION_TOKEN_LENGTH,
    lockPublicGuestRuntimeKey,
    normalizeAccessLinkDate,
    normalizeAccessLinkNumber,
    resolveGuestRuntimeLocale
} from './runtimeGuest/shared'
import { createResolveGuestLinkHandler } from './runtimeGuest/guestLinkHandlers'
import { createGuestSessionHandler } from './runtimeGuest/guestSessionHandler'
import { createGuestProgressHandler } from './runtimeGuest/guestProgressHandler'
import {
    createGuestRuntimeHandler,
    createPublicQuizAccessLinkAvailabilityCheck,
    createPublicQuizAccessLinkLockCheck
} from './runtimeGuest/quizRuntimeHandlers'
import { createEligiblePublicQuizAccessLinksHandler } from './runtimeGuest/eligibleQuizAccessLinksHandler'
import { createRuntimeGuestServices } from './runtimeGuest/services'

export function createRuntimeGuestController(getDbExecutor: () => DbExecutor) {
    const services = createRuntimeGuestServices(getDbExecutor)
    const { withPublicRuntimeContext, requirePublicGuestRuntimeConfig, validateGuestSession, setPublicWorkspaceContext } = services
    const { listPublicModules, getPublicClientBundle } = createPublicRuntimeModuleHandlers({
        withPublicRuntimeContext,
        modulesService: services.modulesService
    })
    const assessmentAttempts = createGuestAssessmentAttemptHandlers({
        withPublicRuntimeContext,
        requirePublicGuestRuntimeConfig,
        validateGuestSession,
        setPublicWorkspaceContext,
        loadAccessLinkRecordBy: services.loadAccessLinkRecordBy,
        resolveAllowedRuntimeTarget: services.resolveAllowedRuntimeTarget,
        buildQuizPayload: services.buildQuizPayload,
        resolveGuestAssessmentRuntimeTables,
        lockPublicApplicationForGuestAssessment,
        loadCurrentAccessLinkRecordForUpdate: services.loadCurrentAccessLinkRecordForUpdate,
        lockPublicGuestRuntimeKey,
        createUuidV7: services.createUuidV7,
        assertAccessLinkAvailable: services.assertAccessLinkAvailable,
        resolveGuestRuntimeLocale,
        normalizeAccessLinkDate,
        normalizeAccessLinkNumber,
        guestParticipantIdHeader: GUEST_PARTICIPANT_ID_HEADER,
        legacyGuestStudentIdHeader: LEGACY_GUEST_STUDENT_ID_HEADER,
        guestSessionTokenHeader: GUEST_SESSION_TOKEN_HEADER,
        maxGuestSessionTokenLength: MAX_GUEST_SESSION_TOKEN_LENGTH
    })

    return {
        resolveLink: createResolveGuestLinkHandler(services),
        isPublicQuizAccessLinkAvailable: createPublicQuizAccessLinkAvailabilityCheck(services),
        lockPublicQuizAccessLink: createPublicQuizAccessLinkLockCheck(services),
        createGuestSession: createGuestSessionHandler(services),
        getRuntime: createGuestRuntimeHandler(services),
        ...assessmentAttempts,
        listEligiblePublicQuizAccessLinks: createEligiblePublicQuizAccessLinksHandler(services),
        updateGuestProgress: createGuestProgressHandler(services),
        listPublicModules,
        getPublicClientBundle
    }
}
