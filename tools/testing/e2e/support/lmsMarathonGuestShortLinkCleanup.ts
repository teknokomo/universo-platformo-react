import { disposeApiContext, sendWithCsrf } from './backend/api-session.mjs'
import { collectCleanupFailure } from './lmsMarathonGuestShortLinkAssertions'
import type { LmsMarathonFlowResources } from './lmsMarathonGuestShortLinkTypes'

export async function cleanupLmsMarathonGuestFlow(resources: LmsMarathonFlowResources): Promise<void> {
    const { api, guestContext, russianContext, timeoutContext, gradeTenContext, createdGlobalShortLinkIds, cleanupErrors } = resources

    if (api) {
        for (const shortLinkId of [...(createdGlobalShortLinkIds ?? [])].reverse()) {
            if (!shortLinkId) continue
            await collectCleanupFailure(cleanupErrors, async () => {
                const releaseResponse = await sendWithCsrf(api, 'POST', `/api/v1/global-short-links/${shortLinkId}/release`, {})
                if (!releaseResponse.ok && releaseResponse.status !== 404) {
                    throw new Error(`Releasing the temporary LMS global short link failed with ${releaseResponse.status}`)
                }
            })
        }
    }
    if (guestContext) await collectCleanupFailure(cleanupErrors, () => guestContext.close())
    if (russianContext) await collectCleanupFailure(cleanupErrors, () => russianContext.close())
    if (timeoutContext) await collectCleanupFailure(cleanupErrors, () => timeoutContext.close())
    if (gradeTenContext) await collectCleanupFailure(cleanupErrors, () => gradeTenContext.close())
    if (api) await collectCleanupFailure(cleanupErrors, () => disposeApiContext(api))
}
