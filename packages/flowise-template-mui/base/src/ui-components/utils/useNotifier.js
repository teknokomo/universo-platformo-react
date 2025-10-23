import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSnackbar } from 'notistack'
import { removeSnackbar } from '@flowise/store'

let displayed = []

const useNotifier = () => {
    const dispatch = useDispatch()
    const notifier = useSelector((state) => state.notifier)
    const { notifications } = notifier

    const { enqueueSnackbar, closeSnackbar } = useSnackbar()

    const storeDisplayed = (id) => {
        displayed = [...displayed, id]
    }

    const removeDisplayed = (id) => {
        displayed = [...displayed.filter((key) => id !== key)]
    }

    React.useEffect(() => {
        notifications.forEach(({ key, message, options = {}, dismissed = false }) => {
            if (dismissed) {
                closeSnackbar(key)
                return
            }

            if (displayed.includes(key)) return

            enqueueSnackbar(message, {
                key,
                ...options,
                onClose: (event, reason, myKey) => {
                    if (options.onClose) {
                        options.onClose(event, reason, myKey)
                    }
                },
                onExited: (event, myKey) => {
                    dispatch(removeSnackbar(myKey))
                    removeDisplayed(myKey)
                }
            })

            storeDisplayed(key)
        })
    }, [notifications, closeSnackbar, enqueueSnackbar, dispatch])
}

export default useNotifier
