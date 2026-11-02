import type { Page, Response } from '@playwright/test'

type WaitForSettledMutationResponseOptions = {
    timeout?: number
    label?: string
}

export async function waitForSettledMutationResponse(
    page: Page,
    matcher: (response: Response) => boolean,
    options: WaitForSettledMutationResponseOptions = {}
): Promise<Response> {
    const timeout = options.timeout ?? 30_000
    const label = options.label ?? 'Mutation response'
    return new Promise<Response>((resolve, reject) => {
        let transientCsrfResponseCount = 0
        let settled = false
        const timeoutId = setTimeout(() => {
            finish(
                new Error(
                    transientCsrfResponseCount > 0
                        ? `${label} received ${transientCsrfResponseCount} transient 419 response(s) without a settled follow-up response`
                        : `${label} timed out while waiting for a matching response`
                )
            )
        }, timeout)

        const cleanup = () => {
            clearTimeout(timeoutId)
            page.off('response', onResponse)
            page.off('close', onClose)
        }

        const finish = (error?: Error, response?: Response) => {
            if (settled) return
            settled = true
            cleanup()
            if (error) {
                reject(error)
                return
            }
            if (!response) {
                reject(new Error(`${label} settled without a response`))
                return
            }
            resolve(response)
        }

        const onResponse = (response: Response) => {
            let matches: boolean
            try {
                matches = matcher(response)
            } catch (error) {
                finish(error instanceof Error ? error : new Error(String(error)))
                return
            }
            if (!matches) return
            if (response.status() === 419) {
                transientCsrfResponseCount += 1
                return
            }
            finish(undefined, response)
        }

        const onClose = () => finish(new Error(`${label} stopped because the page closed`))

        if (page.isClosed()) {
            finish(new Error(`${label} cannot wait on a closed page`))
            return
        }
        page.on('response', onResponse)
        page.once('close', onClose)
    })
}

export type PageResponseSnapshot = {
    status: number
    body: string
}

export async function readPageResponseSnapshot(response: Response): Promise<PageResponseSnapshot> {
    return {
        status: response.status(),
        body: await response.text()
    }
}

export function waitForPageResponseSnapshot(
    page: Page,
    matcher: (response: Response) => boolean,
    options: { timeout?: number } = {}
): Promise<PageResponseSnapshot> {
    return page.waitForResponse(matcher, options).then(readPageResponseSnapshot)
}
