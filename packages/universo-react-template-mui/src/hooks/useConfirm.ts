import { useContext, useEffect, useRef } from 'react'
import ConfirmContext from '../contexts/ConfirmContext'
import { HIDE_CONFIRM, SHOW_CONFIRM, ConfirmPayload } from '../store/actions'

const pendingResolvers = new Map<string, (value: boolean) => void>()
const pendingFallbackTimers = new Map<string, number>()
const INITIAL_RENDER_WAIT_MS = 2000
const RETRY_RENDER_WAIT_MS = 400
const MAX_RENDER_WAIT_RETRIES = 5
let requestCounter = 0

const nextRequestId = () => {
    requestCounter += 1
    return `confirm_request_${Date.now()}_${requestCounter}`
}

/**
 * Hook for imperative confirmation dialogs
 *
 * Usage:
 * ```tsx
 * const { confirm } = useConfirm()
 *
 * const result = await confirm({
 *   title: 'Delete item?',
 *   description: 'This action cannot be undone',
 *   confirmButtonName: 'Delete',
 *   cancelButtonName: 'Cancel'
 * })
 *
 * if (result) {
 *   // User confirmed
 * }
 * ```
 *
 * Requires ConfirmContextProvider in the component tree and <ConfirmDialog /> rendered
 */
export const useConfirm = () => {
    const [confirmState, dispatch] = useContext(ConfirmContext)
    const latestConfirmStateRef = useRef(confirmState)

    useEffect(() => {
        latestConfirmStateRef.current = confirmState
    }, [confirmState])

    const closeConfirm = () => {
        dispatch({ type: HIDE_CONFIRM })
    }

    const clearPendingRequest = (requestId: string): ((value: boolean) => void) | undefined => {
        const fallbackTimerId = pendingFallbackTimers.get(requestId)
        if (typeof fallbackTimerId === 'number' && typeof window !== 'undefined') {
            window.clearTimeout(fallbackTimerId)
        }
        pendingFallbackTimers.delete(requestId)
        const resolver = pendingResolvers.get(requestId)
        pendingResolvers.delete(requestId)
        return resolver
    }

    const cancelPendingRequest = (requestId: string, value: boolean) => {
        const resolver = clearPendingRequest(requestId)
        if (resolver) {
            resolver(value)
        }
    }

    const cancelAllPendingRequests = (value: boolean) => {
        for (const requestId of Array.from(pendingResolvers.keys())) {
            cancelPendingRequest(requestId, value)
        }
    }

    const resolveCurrentRequest = (value: boolean) => {
        const requestId = typeof confirmState.requestId === 'string' ? confirmState.requestId : ''
        if (!requestId) {
            // eslint-disable-next-line no-console
            console.warn('[useConfirm] confirm resolved without requestId', { value })
            return
        }

        const resolver = clearPendingRequest(requestId)
        if (resolver) {
            resolver(value)
            return
        }

        // eslint-disable-next-line no-console
        console.warn('[useConfirm] confirm resolved without pending resolver', { requestId, value })
    }

    const onConfirm = () => {
        closeConfirm()
        resolveCurrentRequest(true)
    }

    const onCancel = () => {
        closeConfirm()
        resolveCurrentRequest(false)
    }

    const confirm = (confirmPayload: ConfirmPayload): Promise<boolean> => {
        // Keep confirmation logic single-flight to avoid cross-request interference.
        cancelAllPendingRequests(false)

        const requestId = nextRequestId()
        dispatch({
            type: SHOW_CONFIRM,
            payload: {
                ...confirmPayload,
                requestId
            }
        })
        return new Promise((resolve) => {
            pendingResolvers.set(requestId, resolve)

            const scheduleFallbackCheck = (retryCount = 0) => {
                if (typeof window === 'undefined') return

                const fallbackTimerId = window.setTimeout(
                    () => {
                        if (!pendingResolvers.has(requestId)) {
                            return
                        }

                        const dialogRendered =
                            typeof document !== 'undefined' &&
                            Boolean(document.querySelector(`[data-confirm-dialog-request-id="${requestId}"]`))

                        if (dialogRendered) {
                            pendingFallbackTimers.delete(requestId)
                            return
                        }

                        const latestConfirmState = latestConfirmStateRef.current
                        const activeStateMatches = latestConfirmState.show && latestConfirmState.requestId === requestId

                        if (activeStateMatches && retryCount < MAX_RENDER_WAIT_RETRIES) {
                            pendingFallbackTimers.delete(requestId)
                            scheduleFallbackCheck(retryCount + 1)
                            return
                        }

                        const activeDialogRequestId =
                            typeof document !== 'undefined'
                                ? document.querySelector<HTMLElement>('[data-confirm-dialog-request-id]')?.dataset.confirmDialogRequestId ??
                                  ''
                                : ''

                        // eslint-disable-next-line no-console
                        console.error('[useConfirm] custom confirm dialog did not render, auto-cancel confirmation', {
                            requestId,
                            title: confirmPayload.title
                        })

                        if (activeDialogRequestId === requestId) {
                            dispatch({ type: HIDE_CONFIRM })
                        }
                        cancelPendingRequest(requestId, false)
                    },
                    retryCount === 0 ? INITIAL_RENDER_WAIT_MS : RETRY_RENDER_WAIT_MS
                )

                pendingFallbackTimers.set(requestId, fallbackTimerId)
            }

            scheduleFallbackCheck()
        })
    }

    return { confirm, onConfirm, onCancel, confirmState }
}

export default useConfirm
