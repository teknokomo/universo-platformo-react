import type { Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import { lockPublicApplicationForGuestAssessment } from '../../persistence/publicGuestApplicationStore'
import { PublicApplicationUnavailableError, resolvePublicApplication } from '../../services/publicApplicationRuntime'
import { resolvePublicRuntimeSchema, type PublicRuntimeSchemaContext } from '../../shared/publicRuntimeAccess'
import { resolvePublicGuestRuntimeConfig, type PublicGuestRuntimeConfig } from '../../services/publicGuestRuntimeConfig'

const runWithDeferredResponse = async <T>(res: Response, work: () => Promise<T>): Promise<T> => {
    const originalJson = res.json
    const originalSend = res.send
    const originalSetHeader = res.setHeader
    const setHeader = originalSetHeader.bind(res)
    const originalRemoveHeader = res.removeHeader
    const removeHeader = originalRemoveHeader.bind(res)
    const originalStatusCode = res.statusCode
    const stagedHeaders = new Map<
        string,
        { kind: 'set'; name: string; value: Parameters<Response['setHeader']>[1] } | { kind: 'remove'; name: string }
    >()
    const stagedWrites: Array<() => void> = []

    const queueWrite = (write: () => void): Response => {
        if (stagedWrites.length > 0) throw new Error('Public runtime work attempted to send more than one response')
        stagedWrites.push(write)
        return res
    }

    res.json = ((...args: Parameters<Response['json']>) =>
        queueWrite(() => {
            originalJson.apply(res, args)
        })) as Response['json']
    res.send = ((...args: Parameters<Response['send']>) =>
        queueWrite(() => {
            originalSend.apply(res, args)
        })) as Response['send']
    res.setHeader = ((...args: Parameters<Response['setHeader']>) => {
        const [name, value] = args
        stagedHeaders.set(name.toLowerCase(), { kind: 'set', name, value })
        return res
    }) as Response['setHeader']
    res.removeHeader = ((name: string) => {
        stagedHeaders.set(name.toLowerCase(), { kind: 'remove', name })
        return res
    }) as Response['removeHeader']

    try {
        const result = await work()
        res.json = originalJson
        res.send = originalSend
        res.setHeader = originalSetHeader
        res.removeHeader = originalRemoveHeader

        if (stagedWrites.length === 0) {
            res.statusCode = originalStatusCode
            return result
        }

        for (const header of stagedHeaders.values()) {
            if (header.kind === 'set') setHeader(header.name, header.value)
            else removeHeader(header.name)
        }
        stagedWrites[0]?.()
        return result
    } catch (error) {
        res.json = originalJson
        res.send = originalSend
        res.setHeader = originalSetHeader
        res.removeHeader = originalRemoveHeader
        res.statusCode = originalStatusCode
        throw error
    }
}

export const createPublicRuntimeContextRunner = (getDbExecutor: () => DbExecutor) => {
    const withPublicRuntimeContext = async (
        applicationId: string,
        res: Response,
        work: (ctx: PublicRuntimeSchemaContext) => Promise<void>,
        options: { beforeTransaction?: (ctx: PublicRuntimeSchemaContext) => Promise<void> } = {}
    ): Promise<void> => {
        const executor = getDbExecutor()
        let publishedApplication: Awaited<ReturnType<typeof resolvePublicApplication>>
        try {
            publishedApplication = await resolvePublicApplication(executor, applicationId)
        } catch (error) {
            if (!(error instanceof PublicApplicationUnavailableError)) throw error
            res.status(404).json({ error: 'Public guest runtime is unavailable' })
            return
        }

        const ctx: PublicRuntimeSchemaContext | null = await resolvePublicRuntimeSchema(() => executor, applicationId)
        if (
            !ctx ||
            publishedApplication.application.id !== applicationId ||
            publishedApplication.application.schemaName !== ctx.schemaName ||
            publishedApplication.application.workspacesEnabled !== ctx.workspacesEnabled
        ) {
            res.status(404).json({ error: 'Public guest runtime is unavailable' })
            return
        }

        if (options.beforeTransaction) {
            await options.beforeTransaction(ctx)
            if (res.headersSent) return
        }

        // Hold the application read lock through every anonymous runtime operation,
        // including apps without workspaces, so publication withdrawal serializes all guest requests.
        await runWithDeferredResponse(res, () =>
            ctx.manager.transaction(async (tx: DbExecutor) => {
                if (!(await lockPublicApplicationForGuestAssessment(tx, applicationId))) {
                    res.status(404).json({ error: 'Public guest runtime is unavailable' })
                    return
                }
                await work({
                    ...ctx,
                    manager: tx
                })
            })
        )
    }

    const requirePublicGuestRuntimeConfig = (
        ctx: PublicRuntimeSchemaContext,
        res: Response,
        options: { allowUnconfigured?: boolean } = {}
    ): PublicGuestRuntimeConfig | null => {
        const runtimeConfig = resolvePublicGuestRuntimeConfig(ctx.settings)
        if (runtimeConfig) {
            return runtimeConfig
        }
        if (options.allowUnconfigured) return null
        res.status(404).json({ error: 'Public guest runtime is not configured for this application' })
        return null
    }

    return { withPublicRuntimeContext, requirePublicGuestRuntimeConfig }
}
