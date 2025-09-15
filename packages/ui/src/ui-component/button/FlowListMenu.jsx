import PropTypes from 'prop-types'
import { useDispatch } from 'react-redux'
import useConfirm from '@/hooks/useConfirm'
import useApi from '@/hooks/useApi'
import chatflowsApi from '@/api/chatflows'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'
import BaseEntityMenu from '@/ui-component/menu/BaseEntityMenu'
import { chatflowActions } from '@/ui-component/menu/chatflowActions'

// Clean adapter version of FlowListMenu after legacy removal.
export default function FlowListMenu({ chatflow, isAgentCanvas, setError, updateFlowsApi }) {
    const dispatch = useDispatch()
    const { confirm } = useConfirm()
    const updateChatflowApi = useApi(chatflowsApi.updateChatflow)

    const createContext = (base) => ({
        ...base,
        api: {
            updateEntity: async (id, patch) => {
                try {
                    await updateChatflowApi.request(id, patch)
                } catch (error) {
                    if (setError) setError(error)
                    throw error
                }
            },
            deleteEntity: async (id) => {
                try {
                    await chatflowsApi.deleteChatflow(id)
                } catch (error) {
                    if (setError) setError(error)
                    throw error
                }
            }
        },
        helpers: {
            enqueueSnackbar: (payload) => dispatch(enqueueSnackbarAction(payload)),
            confirm,
            openWindow: (url) => window.open(url, '_blank'),
            refreshList: async () => {
                if (updateFlowsApi?.request) await updateFlowsApi.request()
            },
            closeSnackbar: (key) => dispatch(closeSnackbarAction(key))
        },
        runtime: { isDarkMode: false }
    })

    return (
        <BaseEntityMenu
            entity={chatflow}
            entityKind={isAgentCanvas ? 'agent' : 'chatflow'}
            descriptors={chatflowActions}
            createContext={createContext}
        />
    )
}

FlowListMenu.propTypes = {
    chatflow: PropTypes.object,
    isAgentCanvas: PropTypes.bool,
    setError: PropTypes.func,
    updateFlowsApi: PropTypes.object
}

