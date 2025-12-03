import { useContext } from 'react'
import { ConfirmContext, HIDE_CONFIRM, SHOW_CONFIRM } from '@flowise/store'

let resolveCallback
const useConfirm = () => {
    const [confirmState, dispatch] = useContext(ConfirmContext)

    const closeConfirm = () => {
        dispatch({
            type: HIDE_CONFIRM
        })
    }

    const onConfirm = () => {
        console.log('[useConfirm:spaces-frontend] onConfirm called', { hasResolveCallback: !!resolveCallback })
        closeConfirm()
        if (resolveCallback) {
            resolveCallback(true)
        } else {
            console.error('[useConfirm:spaces-frontend] ❌ resolveCallback is undefined!')
        }
    }

    const onCancel = () => {
        closeConfirm()
        if (resolveCallback) {
            resolveCallback(false)
        }
    }
    
    const confirm = (confirmPayload) => {
        console.log('[useConfirm:spaces-frontend] confirm() called, about to create Promise')
        return new Promise((res) => {
            resolveCallback = res
            console.log('[useConfirm:spaces-frontend] ✅ resolveCallback set BEFORE dispatch')
            dispatch({
                type: SHOW_CONFIRM,
                payload: confirmPayload
            })
            console.log('[useConfirm:spaces-frontend] dispatch called AFTER setting resolveCallback')
        })
    }

    return { confirm, onConfirm, onCancel, confirmState }
}

export default useConfirm
