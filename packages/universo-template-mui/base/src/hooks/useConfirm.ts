import { useContext } from 'react'
import ConfirmContext from '../contexts/ConfirmContext'
import { HIDE_CONFIRM, SHOW_CONFIRM, ConfirmPayload } from '../store/actions'

let resolveCallback: (value: boolean) => void

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

    const onConfirm = () => {
        closeConfirm()
        resolveCallback(true)
    }

    const onCancel = () => {
        closeConfirm()
        resolveCallback(false)
    }

    const confirm = (confirmPayload: ConfirmPayload): Promise<boolean> => {
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

export default useConfirm
