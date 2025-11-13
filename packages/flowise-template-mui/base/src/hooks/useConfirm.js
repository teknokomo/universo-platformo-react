import { useContext } from 'react'
import { ConfirmContext, HIDE_CONFIRM, SHOW_CONFIRM } from '@flowise/store'

let resolveCallback

/**
 * Hook for imperative confirmation dialogs
 *
 * Usage:
 * ```jsx
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
export default function useConfirm() {
    const [confirmState, dispatch] = useContext(ConfirmContext)

    const closeConfirm = () => {
        dispatch({ type: HIDE_CONFIRM })
    }

    const onConfirm = () => {
        console.log('[useConfirm] onConfirm called', { hasResolveCallback: !!resolveCallback })
        closeConfirm()
        if (resolveCallback) {
            resolveCallback(true)
        } else {
            console.error('[useConfirm] ❌ resolveCallback is undefined!')
        }
    }

    const onCancel = () => {
        closeConfirm()
        if (resolveCallback) {
            resolveCallback(false)
        }
    }

    const confirm = (confirmPayload) => {
        console.log('[useConfirm] confirm() called, about to create Promise')
        return new Promise((res) => {
            resolveCallback = res
            console.log('[useConfirm] ✅ resolveCallback set BEFORE dispatch')
            dispatch({
                type: SHOW_CONFIRM,
                payload: confirmPayload
            })
            console.log('[useConfirm] dispatch called AFTER setting resolveCallback')
        })
    }

    return { confirm, onConfirm, onCancel, confirmState }
}
