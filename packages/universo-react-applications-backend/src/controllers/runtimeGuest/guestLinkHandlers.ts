import type { Request, Response } from 'express'
import { globalShortLinkUuidV7Schema } from '@universo-react/types'
import { resolveLocalizedContent } from '../../shared/runtimeHelpers'
import { readGuestRuntimeSessionRequest, resolveGuestRuntimeLocale } from './shared'
import type { RuntimeGuestServices } from './services'

export const createResolveGuestLinkHandler = (services: RuntimeGuestServices) => {
    const {
        withPublicRuntimeContext,
        requirePublicGuestRuntimeConfig,
        loadAccessLinkRecord,
        loadAccessLinkRecordById,
        assertAccessLinkAvailable,
        setPublicWorkspaceContext,
        validateGuestSession
    } = services
    const resolveLink = async (req: Request, res: Response) => {
        res.setHeader('Cache-Control', 'no-store')
        const { applicationId, slug } = req.params
        const localeResult = resolveGuestRuntimeLocale(req.query.locale)
        if (!localeResult.valid) {
            res.status(400).json({ error: 'Invalid locale' })
            return
        }
        const requestedWorkspaceId = req.query.workspaceId
        if (
            requestedWorkspaceId !== undefined &&
            (typeof requestedWorkspaceId !== 'string' || !globalShortLinkUuidV7Schema.safeParse(requestedWorkspaceId).success)
        ) {
            res.status(400).json({ error: 'Invalid workspace scope' })
            return
        }
        const requestedAccessLinkId = req.query.accessLinkId
        if (
            requestedAccessLinkId !== undefined &&
            (typeof requestedAccessLinkId !== 'string' || !globalShortLinkUuidV7Schema.safeParse(requestedAccessLinkId).success)
        ) {
            res.status(400).json({ error: 'Invalid access link identity' })
            return
        }
        const locale = localeResult.locale
        const guestSessionRequest = readGuestRuntimeSessionRequest(req)
        if (guestSessionRequest && 'error' in guestSessionRequest) {
            res.status(400).json({ error: guestSessionRequest.error })
            return
        }
        await withPublicRuntimeContext(applicationId, res, async (ctx) => {
            const runtimeConfig = requirePublicGuestRuntimeConfig(ctx, res)
            if (!runtimeConfig) return
            const link =
                typeof requestedAccessLinkId === 'string'
                    ? await loadAccessLinkRecordById(
                          ctx.manager,
                          ctx.schemaName,
                          runtimeConfig,
                          ctx.workspacesEnabled,
                          requestedAccessLinkId,
                          true,
                          requestedWorkspaceId
                      )
                    : await loadAccessLinkRecord(
                          ctx.manager,
                          ctx.schemaName,
                          runtimeConfig,
                          ctx.workspacesEnabled,
                          slug,
                          true,
                          requestedWorkspaceId
                      )
            if (!link) {
                res.status(404).json({ error: 'Access link not found' })
                return
            }
            if (link.slug !== slug) {
                res.status(404).json({ error: 'Access link not found' })
                return
            }
            if (ctx.workspacesEnabled) {
                const hasWorkspace = await setPublicWorkspaceContext(ctx.manager, ctx.schemaName, link.workspaceId)
                if (!hasWorkspace) {
                    res.status(404).json({ error: 'Access link not found' })
                    return
                }
            }

            if (guestSessionRequest) {
                const session = await validateGuestSession(
                    ctx.manager,
                    ctx.schemaName,
                    ctx.workspacesEnabled,
                    runtimeConfig,
                    guestSessionRequest.participantId,
                    guestSessionRequest.sessionToken
                )
                if (!session.isValid || session.accessLinkId !== link.id || (session.workspaceId ?? null) !== (link.workspaceId ?? null)) {
                    res.status(403).json({ error: 'Guest session is invalid or does not match this access link' })
                    return
                }
            }

            const availability = assertAccessLinkAvailable(link, { enforceQuota: true })
            if (!availability.ok && !guestSessionRequest) {
                res.status(availability.status).json({ error: availability.error })
                return
            }

            res.json({
                id: link.id,
                slug: link.slug,
                title: resolveLocalizedContent(link.title, locale, ''),
                targetType: link.targetType,
                targetId: link.targetType === 'content' && link.contentNodeIdRef ? link.contentNodeIdRef : link.targetId,
                classId: link.classId,
                intake: link.intake
            })
        })
    }

    return resolveLink
}
