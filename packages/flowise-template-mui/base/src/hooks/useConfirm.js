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
        closeConfirm()
        resolveCallback(true)
    }

    const onCancel = () => {
        closeConfirm()
        resolveCallback(false)
    }

    const confirm = (confirmPayload) => {
        dispatch({
            type: SHOW_CONFIRM,
            payload: confirmPayload
        })
        return new Promise((res) => {
            resolveCallback = res
        })
    }

    return { confirm, onConfirm, onCancel, confirmState }
}
