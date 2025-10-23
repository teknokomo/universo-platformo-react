import PropTypes from 'prop-types'
import { useDispatch } from 'react-redux'
import { useParams } from 'react-router-dom'
import useConfirm from '../../hooks/useConfirm.js'
import useApi from '../../hooks/useApi.js'
import { api } from '@universo/api-client'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@flowise/store'
import BaseEntityMenu from '../menu/BaseEntityMenu'
import { canvasActions } from '../menu/canvasActions'

// Clean adapter version of FlowListMenu after legacy removal.
export default function FlowListMenu({ canvas, isAgentCanvas, setError, updateFlowsApi }) {
    const dispatch = useDispatch()
    const { unikId: routeUnikId } = useParams()
    const { confirm } = useConfirm()
    const updateCanvasApi = useApi(api.canvases.updateCanvas)
    const deleteCanvasApi = useApi(api.canvases.deleteCanvas)

    const resolvedUnikId = canvas?.unikId || canvas?.unik_id || routeUnikId
    const resolvedSpaceId = canvas?.spaceId || canvas?.space_id || null

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
            type: canvas?.type
        },
        runtime: { isDarkMode: false }
    })

    return (
        <BaseEntityMenu
            entity={canvas}
            entityKind={isAgentCanvas ? 'agent' : 'canvas'}
            descriptors={canvasActions}
            createContext={createContext}
        />
    )
}

FlowListMenu.propTypes = {
    canvas: PropTypes.object,
    isAgentCanvas: PropTypes.bool,
    setError: PropTypes.func,
    updateFlowsApi: PropTypes.object
}
