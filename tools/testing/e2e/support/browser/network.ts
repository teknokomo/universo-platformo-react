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
    const deadline = Date.now() + timeout
    let transientCsrfResponseCount = 0

    for (;;) {
        const remaining = deadline - Date.now()
        if (remaining <= 0) {
            throw new Error(
                transientCsrfResponseCount > 0
                    ? `${label} received ${transientCsrfResponseCount} transient 419 response(s) without a settled follow-up response`
                    : `${label} timed out while waiting for a matching response`
            )
        }

        try {
            const response = await page.waitForResponse(matcher, { timeout: remaining })
            if (response.status() !== 419) {
                return response
            }

            transientCsrfResponseCount += 1
        } catch (error) {
            if (transientCsrfResponseCount > 0) {
                throw new Error(
                    `${label} received ${transientCsrfResponseCount} transient 419 response(s) without a settled follow-up response`
                )
            }

            throw error
        }
    }
}
