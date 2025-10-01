import PropTypes from 'prop-types'
import { useDispatch } from 'react-redux'
import { useParams } from 'react-router-dom'
import useConfirm from '@/hooks/useConfirm'
import useApi from '@/hooks/useApi'
import canvasesApi from '@/api/canvases'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'
import BaseEntityMenu from '@/ui-component/menu/BaseEntityMenu'
import { chatflowActions } from '@/ui-component/menu/chatflowActions'

// Clean adapter version of FlowListMenu after legacy removal.
export default function FlowListMenu({ chatflow, isAgentCanvas, setError, updateFlowsApi }) {
    const dispatch = useDispatch()
    const { unikId: routeUnikId } = useParams()
    const { confirm } = useConfirm()
    const updateCanvasApi = useApi(canvasesApi.updateCanvas)
    const deleteCanvasApi = useApi(canvasesApi.deleteCanvas)

    const resolvedUnikId = chatflow?.unikId || chatflow?.unik_id || routeUnikId
    const resolvedSpaceId = chatflow?.spaceId || chatflow?.space_id || null

    const ensureUnikId = () => {
        if (!resolvedUnikId) {
            throw new Error('Missing unikId for canvas operation')
        }
        return resolvedUnikId
    }

    const createContext = (base) => ({
        ...base,
        api: {
            updateEntity: async (id, patch) => {
                try {
                    await updateCanvasApi.request(ensureUnikId(), id, patch, { spaceId: resolvedSpaceId })
                } catch (error) {
                    if (setError) setError(error)
                    throw error
                }
            },
            deleteEntity: async (id) => {
                try {
                    await deleteCanvasApi.request(ensureUnikId(), id, { spaceId: resolvedSpaceId })
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
        meta: {
            unikId: resolvedUnikId,
            spaceId: resolvedSpaceId,
            type: chatflow?.type
        },
        runtime: { isDarkMode: false }
    })

    return (
        <BaseEntityMenu
            entity={chatflow}
            entityKind={isAgentCanvas ? 'agent' : 'canvas'}
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

