import { useContext } from 'react'
import ConfirmContext from '../contexts/ConfirmContext'
import { HIDE_CONFIRM, SHOW_CONFIRM, ConfirmPayload } from '../store/actions'

const pendingResolvers = new Map<string, (value: boolean) => void>()
const pendingFallbackTimers = new Map<string, number>()
let resolverFallback: ((value: boolean) => void) | null = null
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

    const closeConfirm = () => {
        dispatch({ type: HIDE_CONFIRM })
    }

    const resolveCurrentRequest = (value: boolean) => {
        const requestId = typeof confirmState.requestId === 'string' ? confirmState.requestId : ''
        const resolver = (requestId ? pendingResolvers.get(requestId) : undefined) ?? resolverFallback

        const fallbackTimerId = requestId ? pendingFallbackTimers.get(requestId) : undefined
        if (typeof fallbackTimerId === 'number' && typeof window !== 'undefined') {
            window.clearTimeout(fallbackTimerId)
            pendingFallbackTimers.delete(requestId)
        }

        if (requestId) {
            pendingResolvers.delete(requestId)
        }
        if (resolverFallback === resolver) {
            resolverFallback = null
        }

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
            resolverFallback = resolve

            if (typeof window !== 'undefined') {
                const fallbackTimerId = window.setTimeout(() => {
                    const pendingResolver = pendingResolvers.get(requestId)
                    if (!pendingResolver) {
                        return
                    }

                    const dialogRendered =
                        typeof document !== 'undefined' &&
                        Boolean(document.querySelector(`[data-confirm-dialog-request-id="${requestId}"]`))

                    if (dialogRendered) {
                        pendingFallbackTimers.delete(requestId)
                        return
                    }

                    // eslint-disable-next-line no-console
                    console.error('[useConfirm] custom confirm dialog did not render, auto-cancel confirmation', {
                        requestId,
                        title: confirmPayload.title
                    })

                    dispatch({ type: HIDE_CONFIRM })

                    pendingResolvers.delete(requestId)
                    pendingFallbackTimers.delete(requestId)
                    if (resolverFallback === pendingResolver) {
                        resolverFallback = null
                    }
                    pendingResolver(false)
                }, 2000)

                pendingFallbackTimers.set(requestId, fallbackTimerId)
            }
        })
    }

    return { confirm, onConfirm, onCancel, confirmState }
}

export default useConfirm
