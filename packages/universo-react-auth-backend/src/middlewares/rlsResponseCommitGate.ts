import type { Response } from 'express'

export type RlsResponseCleanupMode = 'commit' | 'rollback'

const TRANSACTION_FAILURE_BODY = JSON.stringify({ error: 'Database transaction failed' })
const TRANSACTION_FAILURE_HEADERS = [
    'content-length',
    'content-encoding',
    'content-range',
    'content-disposition',
    'etag',
    'location',
    'set-cookie'
]

/** Finalizes the request transaction before a buffered Express response is sent. */
export function installRlsResponseCommitGate(
    response: Response,
    cleanup: (mode: RlsResponseCleanupMode) => Promise<void>,
    onCleanupError: (error: unknown) => void
): void {
    const originalEnd = response.end.bind(response) as (...args: unknown[]) => Response
    let endRequested = false
    let responseAborted = false

    response.once('close', () => {
        responseAborted = !response.writableFinished
    })

    response.end = ((...args: unknown[]) => {
        if (endRequested) return response
        endRequested = true

        const mode: RlsResponseCleanupMode = response.statusCode >= 400 ? 'rollback' : 'commit'
        void cleanup(mode)
            .then(() => {
                if (!responseAborted) originalEnd(...args)
            })
            .catch((error: unknown) => {
                onCleanupError(error)
                if (responseAborted) return
                if (response.headersSent) {
                    response.destroy(error instanceof Error ? error : undefined)
                    return
                }

                response.statusCode = 500
                for (const header of TRANSACTION_FAILURE_HEADERS) response.removeHeader(header)
                response.setHeader('Content-Type', 'application/json; charset=utf-8')
                originalEnd(TRANSACTION_FAILURE_BODY)
            })

        return response
    }) as Response['end']
}
