import { useEffect, useRef, useState, useCallback, useContext, useMemo } from 'react'
import ReactFlow, { addEdge, Controls, Background, useNodesState, useEdgesState } from 'reactflow'
import 'reactflow/dist/style.css'
import './index.css'
import { useTranslation } from '@universo/i18n'

import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
    REMOVE_DIRTY,
    SET_DIRTY,
    SET_CANVAS,
    enqueueSnackbar as enqueueSnackbarAction,
    closeSnackbar as closeSnackbarAction,
    flowContext
} from '@flowise/store'
import { omit, cloneDeep } from 'lodash'

// material-ui
import { Toolbar, Box, AppBar, Button, Fab } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import CanvasNode from './CanvasNode'
import ButtonEdge from './ButtonEdge'
import StickyNote from './StickyNote'
import CanvasHeader from './CanvasHeader'
import AddNodes from './AddNodes'
import ConfirmDialog from '@flowise/template-mui/ui-components/dialog/ConfirmDialog'
import { ChatPopUp } from '@flowise/chatmessage'
import { VectorStorePopUp } from '@flowise/template-mui'
import CanvasTabs from '../../components/CanvasTabs'
import React, { useCallback as useReactCallback } from 'react'

// API
import { api } from '@universo/api-client' // Replaced: import nodesApi from '../../api/nodes'
// import canvasesApi from '../../api/canvases' // Replaced with shared api import
// import spacesApi from '../../api/spaces' // Replaced with shared api import

// Hooks
import useApi from '../../hooks/useApi'
import useConfirm from '../../hooks/useConfirm'
import useCanvases from '../../hooks/useCanvases'

// icons
import { IconX, IconRefreshAlert } from '@tabler/icons-react'

// utils
import {
    getUniqueNodeId,
    initNode,
    rearrangeToolsOrdering,
    getUpsertDetails,
    updateOutdatedNodeData,
    updateOutdatedNodeEdge
} from '../../utils/genericHelper'
import useNotifier from '@flowise/template-mui/hooks/useNotifier'
import { usePrompt } from '@universo/utils/ui-utils/usePrompt'

// const
import { FLOWISE_CREDENTIAL_ID, uiBaseURL } from '@flowise/store'
// Space Builder i18n and FAB
import { SpaceBuilderFab, registerSpaceBuilderI18n } from '@universo/space-builder-frt'
import { getInstance } from '@universo/i18n/instance'
const i18n = getInstance()


const nodeTypes = { customNode: CanvasNode, stickyNote: StickyNote }
const edgeTypes = { buttonedge: ButtonEdge }

const normalizeIdentifier = (value) => {
    if (value === null || value === undefined) return null
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed.length ? trimmed : null
    }
    if (typeof value === 'number') return String(value)
    if (typeof value === 'object') {
        if (value === null) return null
        if ('id' in value) return normalizeIdentifier(value.id)
        if ('value' in value) return normalizeIdentifier(value.value)
    }
    return null
}

const buildCanvasAsChatflow = (canvas, context) => {
    if (!canvas) return null

    const resolvedUnikId =
        normalizeIdentifier(context?.unikId) ||
        normalizeIdentifier(canvas.unikId) ||
        normalizeIdentifier(canvas.unik_id)

    const resolvedSpaceId =
        normalizeIdentifier(context?.spaceId) ||
        normalizeIdentifier(canvas.spaceId) ||
        normalizeIdentifier(canvas.space_id) ||
        normalizeIdentifier(canvas.space?.id)

    const resolvedSpaceName =
        context?.spaceName ||
        canvas.spaceName ||
        canvas.space_name ||
        (typeof canvas.space === 'object' && canvas.space !== null ? canvas.space.name : null)

    return {
        id: canvas.id,
        name: canvas.name,
        flowData: canvas.flowData,
        deployed: canvas.deployed || false,
        isPublic: canvas.isPublic || false,
        type: canvas.type || (context?.isAgentCanvas ? 'MULTIAGENT' : 'CHATFLOW'),
        unik_id: resolvedUnikId || null,
        unikId: resolvedUnikId || null,
        spaceId: resolvedSpaceId || null,
        space_id: resolvedSpaceId || null,
        ...(resolvedSpaceName ? { spaceName: resolvedSpaceName } : {})
    }
}

// ==============================|| CANVAS ||============================== //

const Canvas = () => {
    const theme = useTheme()
    const navigate = useNavigate()
    const params = useParams()
    const { unikId, spaceId: routeSpaceId, canvasId: routeCanvasId, id: legacyId } = params
    console.log('[Canvas] URL params:', { unikId, routeSpaceId, routeCanvasId, legacyId, fullParams: params })
    
    const location = useLocation()
    const locationState =
        location.state && typeof location.state === 'object' && location.state !== null ? location.state : {}
    const templateFlowData =
        typeof locationState.templateFlowData === 'string' ? locationState.templateFlowData : ''
    const stateSpaceId = typeof locationState.spaceId === 'string' ? locationState.spaceId : null
    const stateCanvasId = typeof locationState.canvasId === 'string' ? locationState.canvasId : null
    const { t } = useTranslation('canvas')

    // Get unikId from URL params or state
    let parentUnikId = location.state?.unikId || unikId || localStorage.getItem('parentUnikId') || ''
    if (typeof parentUnikId === 'object' && parentUnikId !== null) {
        parentUnikId = parentUnikId.id
    }

    // Store unikId in localStorage for reuse
    if (parentUnikId) {
        localStorage.setItem('parentUnikId', parentUnikId)
    }

    const URLpath = document.location.pathname.toString().split('/')
    const isAgentCanvas = URLpath.includes('agentcanvas')
    
    // CRITICAL: Recalculate spaceId on every render to reflect URL changes after navigation
    const normalizedSpaceId = routeSpaceId && routeSpaceId !== 'new' ? routeSpaceId : null
    const legacySpaceId = !isAgentCanvas && legacyId && legacyId !== 'new' ? legacyId : null
    const spaceId = normalizedSpaceId || legacySpaceId || stateSpaceId || null
    
    const normalizedCanvasId = routeSpaceId && routeCanvasId === 'new' ? null : routeCanvasId
    const routeResolvedCanvasId =
        normalizedCanvasId && normalizedCanvasId !== 'new' ? normalizedCanvasId : null
    const legacyCanvasId = isAgentCanvas && legacyId && legacyId !== 'new' ? legacyId : null
    const initialCanvasId = routeResolvedCanvasId || legacyCanvasId || stateCanvasId || null
    const canvasTitle = isAgentCanvas ? t('agent', 'Agent') : t('space', 'Space')

    const { confirm } = useConfirm()

    const dispatch = useDispatch()
    const canvasState = useSelector((state) => state.canvas)
    const [activeCanvas, setActiveCanvas] = useState(null)
    const { reactFlowInstance, setReactFlowInstance } = useContext(flowContext)

    // ==============================|| Snackbar ||============================== //

    useNotifier()
    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    // ==============================|| ReactFlow ||============================== //

    const [nodes, setNodes, onNodesChange] = useNodesState([])
    const [edges, setEdges, onEdgesChange] = useEdgesState([])
    const [selectedNode, setSelectedNode] = useState(null)
    const [isUpsertButtonEnabled, setIsUpsertButtonEnabled] = useState(false)
    const [isSyncNodesButtonEnabled, setIsSyncNodesButtonEnabled] = useState(false)
    // Space Builder now fetches providers/models itself; local state no longer needed

    const reactFlowWrapper = useRef(null)
    const [tabsHeight, setTabsHeight] = useState(56)

    // State to show tabs for new spaces before they are saved
    const [showTabsForNewSpace, setShowTabsForNewSpace] = useState(false)

    // State for Space data
    const [spaceData, setSpaceData] = useState(null)

    const localizedDefaultCanvasName = t('mainCanvas', 'Main Canvas')
    const [tempCanvas, setTempCanvas] = useState(() => ({
        id: 'temp',
        name: localizedDefaultCanvasName,
        isDirty: canvasState.isDirty,
        isCustom: false
    }))

    // ==============================|| Canvases Management ||============================== //

    // Use canvases hook for managing multiple canvases
    const {
        canvases,
        activeCanvasId,
        loading: canvasesLoading,
        selectCanvas,
        createCanvas,
        renameCanvas,
        deleteCanvas,
        duplicateCanvas,
        reorderCanvas,
        updateCanvasData,
        markCanvasDirty,
        getActiveCanvas,
        refresh: refreshCanvases
    } = useCanvases(spaceId)

    const activeCanvasIdentifier = spaceId ? activeCanvasId : initialCanvasId
    const canvasId = activeCanvas?.id || activeCanvasIdentifier || undefined
    const normalizedParentUnikId =
        parentUnikId && String(parentUnikId).trim().length > 0 ? String(parentUnikId) : null
    const activeCanvasSpaceIdentifier = activeCanvas?.spaceId ?? activeCanvas?.space_id ?? activeCanvas?.spaceID ?? null
    const activeCanvasUnikIdentifier = activeCanvas?.unik_id ?? activeCanvas?.unikId ?? activeCanvas?.unikID ?? null
    const chatPopUpUnikId = normalizedParentUnikId || activeCanvasUnikIdentifier || undefined
    const chatPopUpSpaceId = spaceId || activeCanvasSpaceIdentifier || undefined

    const newSpaceCanvases = useMemo(() => [tempCanvas], [tempCanvas])

    // ==============================|| Chatflow API ||============================== //

    const getNodesApi = useApi(async () => {
        const result = await api.nodes.getAll()
        console.log('[Canvas] getNodesApi result:', { hasResult: !!result, isArray: Array.isArray(result), length: result?.length })
        return { data: result }
    })
    const mergeSpaceOptions = useCallback(
        (options = {}) => {
            const { spaceId: overrideSpaceId, ...restOptions } = options || {}
            const resolvedSpaceId =
                overrideSpaceId !== undefined ? overrideSpaceId : spaceId

            return { ...restOptions, spaceId: resolvedSpaceId }
        },
        [spaceId]
    )

    const getCanvasApi = useApi((unik, canvasId, options = {}) =>
        api.canvases.getCanvas(unik, canvasId, mergeSpaceOptions(options))
    )
    // Wrap API calls to match useApi's expected signature: Promise<{ data: T }>
    const updateCanvasApi = useApi(async (unik, canvasId, body, options = {}) => {
        const result = await api.canvases.updateCanvas(unik, canvasId, body, mergeSpaceOptions(options))
        return { data: result }
    })
    const deleteCanvasApi = useApi(async (unik, canvasId, options = {}) => {
        const result = await api.canvases.deleteCanvas(unik, canvasId, mergeSpaceOptions(options))
        return { data: result }
    })
    const getSpaceApi = useApi(async () => {
        if (!spaceId) return { data: null }
        const result = await api.spaces.getById(parentUnikId, spaceId)
        return { data: result }
    })
    // Wrap API calls to match useApi's expected signature: Promise<{ data: T }>
    const createSpaceApi = useApi(async (unikId, payload) => {
        const result = await api.spaces.create(unikId, payload)
        return { data: result }
    })
    const updateSpaceApi = useApi(async (unikId, spaceId, payload) => {
        const result = await api.spaces.update(unikId, spaceId, payload)
        return { data: result }
    })

    // ==============================|| Events & Actions ||============================== //

    const onConnect = (params) => {
        const newEdge = {
            ...params,
            type: 'buttonedge',
            id: `${params.source}-${params.sourceHandle}-${params.target}-${params.targetHandle}`
        }

        const targetNodeId = params.targetHandle.split('-')[0]
        const sourceNodeId = params.sourceHandle.split('-')[0]
        const targetInput = params.targetHandle.split('-')[2]

        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === targetNodeId) {
                    setTimeout(() => setDirty(), 0)
                    let value
                    const inputAnchor = node.data.inputAnchors.find((ancr) => ancr.name === targetInput)
                    const inputParam = node.data.inputParams.find((param) => param.name === targetInput)

                    if (inputAnchor && inputAnchor.list) {
                        const newValues = node.data.inputs[targetInput] || []
                        if (targetInput === 'tools') {
                            rearrangeToolsOrdering(newValues, sourceNodeId)
                        } else {
                            newValues.push(`{{${sourceNodeId}.data.instance}}`)
                        }
                        value = newValues
                    } else if (inputParam && inputParam.acceptVariable) {
                        value = node.data.inputs[targetInput] || ''
                    } else {
                        value = `{{${sourceNodeId}.data.instance}}`
                    }
                    node.data = {
                        ...node.data,
                        inputs: {
                            ...node.data.inputs,
                            [targetInput]: value
                        }
                    }
                }
                return node
            })
        )

        setEdges((eds) => addEdge(newEdge, eds))
    }

    const handleLoadFlow = (file) => {
        try {
            const flowData = JSON.parse(file)
            const nodes = flowData.nodes || []

            setNodes(nodes)
            setEdges(flowData.edges || [])
            setTimeout(() => setDirty(), 0)
        } catch (e) {
            console.error(e)
        }
    }

    // Hydrate minimal nodes/edges coming from Space Builder into full Canvas nodes with anchors/handles
    const hydrateGeneratedGraph = (graph) => {
        const rawNodes = Array.isArray(graph?.nodes) ? graph.nodes : []
        const rawEdges = Array.isArray(graph?.edges) ? graph.edges : []
        const componentNodes = canvasState.componentNodes || []
        const byName = new Map(componentNodes.map((c) => [c.name, c]))

        const nodesHydrated = rawNodes.map((n) => {
            const name = n?.data?.name
            const def = byName.get(name)
            if (!def) return n
            const defClone = cloneDeep(def)
            const nodeId = n.id || getUniqueNodeId(defClone, reactFlowInstance?.getNodes?.() || [])
            const initData = initNode(defClone, nodeId)
            const mergedInputs = { ...initData.inputs, ...(n?.data?.inputs || {}) }
            const data = {
                ...initData,
                inputs: mergedInputs,
                label: initData.label || name,
                category: initData.category || 'UPDL',
                selected: false
            }
            return {
                id: nodeId,
                type: 'customNode',
                position: n.position || { x: 0, y: 0 },
                data
            }
        })

        const idToNode = new Map(nodesHydrated.map((n) => [n.id, n]))

        const getDefaultSourceHandle = (node) => {
            const oa = node?.data?.outputAnchors?.[0]
            if (!oa) return undefined
            if (Array.isArray(oa.options) && oa.options.length > 0) return oa.options[0].id
            return oa.id
        }

        const resolveTargetHandle = (targetNode, preferredName) => {
            if (!targetNode) return undefined
            const anchors = targetNode.data?.inputAnchors || []
            const byName = anchors.find((a) => a.name === preferredName)
            return (byName || anchors[0])?.id
        }

        const preferredTargetByPair = (srcName, tgtName) => {
            const pair = `${srcName}->${tgtName}`
            switch (pair) {
                case 'Data->Space':
                    return 'data'
                case 'Data->Data':
                    return 'datas'
                case 'Component->Entity':
                    return 'components'
                case 'Entity->Space':
                    return 'entities'
                case 'Light->Space':
                    return 'lights'
                case 'Camera->Space':
                    return 'cameras'
                case 'Object->Space':
                    return 'objects'
                case 'Space->Space':
                    return 'spaces'
                default:
                    return undefined
            }
        }

        const edgesHydrated = rawEdges.map((e) => {
            if (e.sourceHandle && e.targetHandle) return { ...e, type: e.type || 'buttonedge' }
            const src = idToNode.get(e.source)
            const tgt = idToNode.get(e.target)
            const srcName = src?.data?.name
            const tgtName = tgt?.data?.name
            const preferred = preferredTargetByPair(srcName, tgtName)
            const sourceHandle = getDefaultSourceHandle(src)
            const targetHandle = resolveTargetHandle(tgt, preferred)
            const id = sourceHandle && targetHandle ? `${e.source}-${sourceHandle}-${e.target}-${targetHandle}` : `${e.source}-${e.target}`
            return { ...e, sourceHandle, targetHandle, id, type: e.type || 'buttonedge' }
        })

        return { nodes: nodesHydrated, edges: edgesHydrated }
    }

    // Apply a generated graph directly without requiring stringified JSON
    const handleApplyGeneratedGraph = (graph) => {
        try {
            const { nodes, edges } = hydrateGeneratedGraph(graph)
            setNodes(nodes)
            setEdges(edges)
            setTimeout(() => setDirty(), 0)
        } catch (e) {
            console.error(e)
        }
    }

    // Append new graph below the lowest existing nodes with safe vertical margin
    const handleAppendGeneratedGraphBelow = (graph) => {
        try {
            const hydrated = hydrateGeneratedGraph(graph)
            const nodesNew = Array.isArray(hydrated?.nodes) ? hydrated.nodes : []
            const edgesNew = Array.isArray(hydrated?.edges) ? hydrated.edges : []

            const existing = reactFlowInstance?.getNodes?.() || []
            if (!existing.length) return handleApplyGeneratedGraph(graph)

            // Use measured node height when available; fall back to a conservative estimate
            const DEFAULT_NODE_HEIGHT = 500
            const MARGIN_Y = 260
            const readHeight = (n) => {
                const h = Number(n?.height || n?.measured?.height || n?.dimensions?.height || 0)
                return Number.isFinite(h) && h > 0 ? h : DEFAULT_NODE_HEIGHT
            }

            const existingBottom = Math.max(
                ...existing.map((n) => Number(n?.position?.y || 0) + readHeight(n))
            )
            const minNewY = nodesNew.length ? Math.min(...nodesNew.map((n) => Number(n?.position?.y || 0))) : 0
            const shiftY = Math.max(existingBottom + MARGIN_Y - minNewY, 0)

            const existingIds = new Set(existing.map((n) => n.id))
            const { nodes: remappedNodes, edges: remappedEdges } = remapIds(nodesNew, edgesNew, existingIds)

            const shifted = remappedNodes.map((n) => ({
                ...n,
                position: { x: Number(n.position?.x || 0), y: Number(n.position?.y || 0) + shiftY }
            }))

            setNodes((curr) => [...curr, ...shifted])
            setEdges((curr) => [...curr, ...remappedEdges])
            setTimeout(() => setDirty(), 0)
        } catch (e) {
            console.error(e)
        }
    }

    // Open a new canvas tab and hand off generated graph using existing duplication channel
    const handleNewSpaceFromGeneratedGraph = (graph) => {
        try {
            const existing = reactFlowInstance?.getNodes?.() || []
            if (!existing.length) return handleApplyGeneratedGraph(graph)

            const { nodes, edges } = hydrateGeneratedGraph(graph)
            const payload = JSON.stringify({ nodes, edges })

            // Reuse duplication storage key consumed by /spaces/new
            localStorage.setItem('duplicatedFlowData', payload)

            const parentId = localStorage.getItem('parentUnikId') || unikId
            if (parentId) {
                window.open(`${uiBaseURL}/unik/${parentId}/spaces/new`, '_blank', 'noopener')
            } else {
                // Fallback: open generic new; consumer will still try to read duplicatedFlowData
                window.open(`${uiBaseURL}/spaces/new`, '_blank', 'noopener')
            }
        } catch (e) {
            console.error('[SpaceBuilder] open new space failed', e)
        }
    }

    const handleNewCanvasFromGeneratedGraph = async (graph) => {
        if (!spaceId) return handleNewSpaceFromGeneratedGraph(graph)
        try {
            const { nodes, edges } = hydrateGeneratedGraph(graph)
            const payload = { nodes, edges }
            const created = await createCanvas(t('newCanvas', 'New Canvas'), { flowData: payload })
            if (created?.id) {
                selectCanvas(created.id)
                markCanvasDirty(created.id, false)
            }
            dispatch({ type: REMOVE_DIRTY })
        } catch (error) {
            console.error('[SpaceBuilder] create canvas from generated graph failed', error)
            enqueueSnackbar({
                message: t(
                    'spaceBuilder.newCanvasError',
                    'Failed to create canvas for generated graph'
                ),
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error'
                }
            })
        }
    }

    const remapIds = (nodes, edges, existingIds) => {
        const map = new Map()
        const uniq = (base) => {
            let i = 1
            let id = String(base || 'N')
            while (existingIds.has(id)) id = `${base}_${i++}`
            existingIds.add(id)
            return id
        }
        const n2 = (nodes || []).map((n) => {
            const old = String(n?.id || 'N')
            const id = uniq(old)
            map.set(old, id)
            return { ...n, id, data: { ...n.data } }
        })
        const e2 = (edges || []).map((e) => {
            const newSource = map.get(e.source) || e.source
            const newTarget = map.get(e.target) || e.target
            const newSourceHandle = e.sourceHandle ? e.sourceHandle.replace(e.source, newSource) : e.sourceHandle
            const newTargetHandle = e.targetHandle ? e.targetHandle.replace(e.target, newTarget) : e.targetHandle
            const newId = newSourceHandle && newTargetHandle ? `${newSource}-${newSourceHandle}-${newTarget}-${newTargetHandle}` : `${newSource}-${newTarget}`
            return {
                ...e,
                id: newId,
                source: newSource,
                target: newTarget,
                sourceHandle: newSourceHandle,
                targetHandle: newTargetHandle,
                type: e.type || 'buttonedge'
            }
        })
        return { nodes: n2, edges: e2 }
    }

    const handleDeleteFlow = async () => {
        if (!activeCanvas?.id) return
        const confirmPayload = {
            title: t('confirmDelete'),
            description: t('confirmDeleteDescription') + ' ' + canvasTitle + ' ' + activeCanvas.name + '?',
            confirmButtonName: t('confirmDelete'),
            cancelButtonName: t('cancel')
        }
        const isConfirmed = await confirm(confirmPayload)

        if (!isConfirmed) return

        try {
            if (spaceId) {
                const deleted = await deleteCanvas(activeCanvas.id)
                if (!deleted) {
                    enqueueSnackbar({
                        message: t('deleteLastCanvasError', 'Cannot delete the last canvas in a space'),
                        options: { key: new Date().getTime() + Math.random(), variant: 'error' }
                    })
                    return
                }
                await refreshCanvases()
            } else {
                await deleteCanvasApi.request(parentUnikId, activeCanvas.id)
            }

            localStorage.removeItem(`${activeCanvas.id}_INTERNAL`)

            const redirectPath = isAgentCanvas
                ? `/unik/${parentUnikId}/agentflows`
                : `/unik/${parentUnikId}/spaces`
            navigate(redirectPath)
        } catch (error) {
            const serverMessage =
                typeof error?.response?.data === 'object'
                    ? error.response.data.message
                    : error?.response?.data || error?.message
            enqueueSnackbar({
                message: serverMessage || t('deleteError', 'Failed to delete canvas'),
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    persist: true,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
        }
    }

    const serializeFlowData = () => {
        if (!reactFlowInstance) return null
        const nodes = reactFlowInstance.getNodes().map((node) => {
            const nodeData = cloneDeep(node.data)
            if (Object.prototype.hasOwnProperty.call(nodeData.inputs, FLOWISE_CREDENTIAL_ID)) {
                nodeData.credential = nodeData.inputs[FLOWISE_CREDENTIAL_ID]
                nodeData.inputs = omit(nodeData.inputs, [FLOWISE_CREDENTIAL_ID])
            }
            node.data = {
                ...nodeData,
                selected: false
            }
            return node
        })

        const rfInstanceObject = reactFlowInstance.toObject()
        rfInstanceObject.nodes = nodes
        return JSON.stringify(rfInstanceObject)
    }

    const saveCanvasInExistingSpace = async (flowData) => {
        if (!spaceId || !activeCanvasId) return
        try {
            await updateCanvasData(activeCanvasId, { flowData })
            saveChatflowSuccess()
            dispatch({ type: REMOVE_DIRTY })
        } catch (error) {
            console.error('Failed to save canvas:', error)
            errorFailed(`Failed to save canvas: ${error.message}`)
        }
    }

    const createNewSpaceWithCanvas = async (sanitizedName, flowData) => {
        try {
            console.log('[Canvas] createNewSpaceWithCanvas called', {
                sanitizedName,
                parentUnikId,
                tempCanvasName: tempCanvas.name,
                flowDataKeys: Object.keys(flowData || {}),
                createSpaceApiExists: !!createSpaceApi,
                createSpaceApiRequestExists: !!createSpaceApi?.request
            })
            const response = await createSpaceApi.request(parentUnikId, {
                name: sanitizedName,
                defaultCanvasName: tempCanvas.name,
                defaultCanvasFlowData: flowData
            })
            console.log('[Canvas] createSpaceApi.request response:', response)
            console.log('[Canvas] response structure:', {
                hasData: !!response?.data,
                dataKeys: response?.data ? Object.keys(response.data) : null,
                responseKeys: Object.keys(response || {}),
                fullResponse: JSON.stringify(response, null, 2)
            })
            const payload = response?.data || response
            console.log('[Canvas] payload:', {
                hasPayload: !!payload,
                payloadKeys: payload ? Object.keys(payload) : null,
                hasDefaultCanvas: !!payload?.defaultCanvas,
                defaultCanvasKeys: payload?.defaultCanvas ? Object.keys(payload.defaultCanvas) : null,
                payloadId: payload?.id,
                payloadSpaceId: payload?.spaceId || payload?.space_id
            })
            const defaultCanvas = payload?.defaultCanvas
            const createdSpaceId =
                defaultCanvas?.spaceId ||
                defaultCanvas?.space_id ||
                payload?.id ||
                payload?.spaceId ||
                payload?.space_id ||
                null

            console.log('[Canvas] createdSpaceId extraction:', {
                createdSpaceId,
                hasDefaultCanvas: !!defaultCanvas,
                defaultCanvasId: defaultCanvas?.id,
                defaultCanvasSpaceId: defaultCanvas?.spaceId || defaultCanvas?.space_id
            })

            if (defaultCanvas?.id) {
                console.log('[Canvas] defaultCanvas exists, proceeding with setup:', {
                    canvasId: defaultCanvas.id,
                    isAgentCanvas,
                    createdSpaceId
                })
                if (isAgentCanvas) {
                    console.log('[Canvas] Updating canvas type to MULTIAGENT')
                    await updateCanvasApi.request(
                        parentUnikId,
                        defaultCanvas.id,
                        {
                            type: 'MULTIAGENT'
                        },
                        { spaceId: createdSpaceId }
                    )
                }

                const canvasViewModel = buildCanvasAsChatflow(defaultCanvas, {
                    unikId: parentUnikId,
                    spaceId: createdSpaceId,
                    spaceName: payload?.name || sanitizedName,
                    isAgentCanvas
                })
                console.log('[Canvas] Built canvas view model:', {
                    hasViewModel: !!canvasViewModel,
                    viewModelId: canvasViewModel?.id,
                    viewModelSpaceId: canvasViewModel?.spaceId || canvasViewModel?.space_id
                })
                dispatch({ type: SET_CANVAS, canvas: canvasViewModel })
                setActiveCanvas(canvasViewModel)
            } else {
                console.warn('[Canvas] No defaultCanvas.id in response!', { payload })
            }

            saveChatflowSuccess()
            console.log('[Canvas] Attempting navigation:', {
                hasPayloadId: !!payload?.id,
                payloadId: payload?.id,
                defaultCanvasId: defaultCanvas?.id,
                isAgentCanvas
            })
            if (payload?.id) {
                const redirectPath = isAgentCanvas
                    ? `/unik/${parentUnikId}/agentcanvas/${defaultCanvas?.id || payload.id}`
                    : `/unik/${parentUnikId}/space/${payload.id}`
                console.log('[Canvas] Navigating to:', redirectPath)
                navigate(redirectPath, { replace: true })
            } else {
                console.error('[Canvas] Cannot navigate: no payload.id!', { payload })
            }
        } catch (error) {
            const serverMessage = error?.response?.data?.error || error?.response?.data?.message || error?.message
            errorFailed(`Failed to save ${canvasTitle}: ${serverMessage}`)
        }
    }

    const updateLegacyCanvas = async (sanitizedName, flowData) => {
        try {
            const updateBody = {
                name: sanitizedName,
                flowData,
                type: isAgentCanvas ? 'MULTIAGENT' : 'CHATFLOW'
            }
            const updated = await updateCanvasApi.request(parentUnikId, activeCanvas.id, updateBody)
            const payload = updated?.data || updated
            if (payload) {
                const canvasViewModel = buildCanvasAsChatflow(payload, {
                    unikId: parentUnikId,
                    spaceId: spaceId || payload.spaceId || payload.space_id || null,
                    spaceName: spaceData?.name,
                    isAgentCanvas
                })
                dispatch({ type: SET_CANVAS, canvas: canvasViewModel })
                setActiveCanvas(canvasViewModel)
            }
            saveChatflowSuccess()
        } catch (error) {
            const serverMessage = error?.response?.data?.error || error?.response?.data?.message || error?.message
            errorFailed(`Failed to save ${canvasTitle}: ${serverMessage}`)
        }
    }

    const handleSaveFlow = async (canvasName) => {
        console.log('[Canvas] handleSaveFlow called', {
            canvasName,
            spaceId,
            activeCanvasId,
            activeCanvasExists: !!activeCanvas?.id,
            parentUnikId
        })
        const flowData = serializeFlowData()
        console.log('[Canvas] serializeFlowData result:', {
            flowDataExists: !!flowData,
            flowDataKeys: flowData ? Object.keys(flowData) : null
        })
        if (!flowData) return

        if (spaceId && activeCanvasId) {
            await saveCanvasInExistingSpace(flowData)
            return
        }

        const sanitizedName = canvasName?.trim() || t('untitledSpace', 'Untitled Space')

        if (!activeCanvas?.id) {
            await createNewSpaceWithCanvas(sanitizedName, flowData)
            return
        }

        await updateLegacyCanvas(sanitizedName, flowData)
    }

    // eslint-disable-next-line
    const onNodeClick = useCallback((event, clickedNode) => {
        setSelectedNode(clickedNode)
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === clickedNode.id) {
                    node.data = {
                        ...node.data,
                        selected: true
                    }
                } else {
                    node.data = {
                        ...node.data,
                        selected: false
                    }
                }

                return node
            })
        )
    }, [])

    const onDragOver = useCallback((event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
    }, [])

    const onDrop = useCallback(
        (event) => {
            event.preventDefault()
            const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect()
            let nodeData = event.dataTransfer.getData('application/reactflow')

            // check if the dropped element is valid
            if (typeof nodeData === 'undefined' || !nodeData) {
                return
            }

            nodeData = JSON.parse(nodeData)

            const position = reactFlowInstance.project({
                x: event.clientX - reactFlowBounds.left - 100,
                y: event.clientY - reactFlowBounds.top - 50
            })

            const newNodeId = getUniqueNodeId(nodeData, reactFlowInstance.getNodes())

            const newNode = {
                id: newNodeId,
                position,
                type: nodeData.type !== 'StickyNote' ? 'customNode' : 'stickyNote',
                data: initNode(nodeData, newNodeId)
            }

            setSelectedNode(newNode)
            setNodes((nds) =>
                nds.concat(newNode).map((node) => {
                    if (node.id === newNode.id) {
                        node.data = {
                            ...node.data,
                            selected: true
                        }
                    } else {
                        node.data = {
                            ...node.data,
                            selected: false
                        }
                    }

                    return node
                })
            )
            setTimeout(() => setDirty(), 0)
        },

        // eslint-disable-next-line
        [reactFlowInstance]
    )

    const syncNodes = () => {
        const componentNodes = canvasState.componentNodes

        const cloneNodes = cloneDeep(nodes)
        const cloneEdges = cloneDeep(edges)
        let toBeRemovedEdges = []

        for (let i = 0; i < cloneNodes.length; i++) {
            const node = cloneNodes[i]
            const componentNode = componentNodes.find((cn) => cn.name === node.data.name)
            if (componentNode && componentNode.version > node.data.version) {
                const clonedComponentNode = cloneDeep(componentNode)
                cloneNodes[i].data = updateOutdatedNodeData(clonedComponentNode, node.data)
                toBeRemovedEdges.push(...updateOutdatedNodeEdge(cloneNodes[i].data, cloneEdges))
            }
        }

        setNodes(cloneNodes)
        setEdges(cloneEdges.filter((edge) => !toBeRemovedEdges.includes(edge)))
        setDirty()
        setIsSyncNodesButtonEnabled(false)
    }

    const saveChatflowSuccess = () => {
        dispatch({ type: REMOVE_DIRTY })
        const successKey = isAgentCanvas ? 'messages.agentSaved' : 'messages.spaceSaved'
        enqueueSnackbar({
            message: t(successKey, isAgentCanvas ? 'Agent canvas saved successfully.' : 'Space saved successfully.'),
            options: {
                key: new Date().getTime() + Math.random(),
                variant: 'success',
                action: (key) => (
                    <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                        <IconX />
                    </Button>
                )
            }
        })

        // Show tabs for new spaces after first save
        if (!spaceId && !showTabsForNewSpace) {
            setShowTabsForNewSpace(true)
        }
    }

    const errorFailed = (message) => {
        enqueueSnackbar({
            message,
            options: {
                key: new Date().getTime() + Math.random(),
                variant: 'error',
                persist: true,
                action: (key) => (
                    <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                        <IconX />
                    </Button>
                )
            }
        })
    }

    const setDirty = () => {
        dispatch({ type: SET_DIRTY })
    }

    const checkIfUpsertAvailable = (nodes, edges) => {
        const upsertNodeDetails = getUpsertDetails(nodes, edges)
        if (upsertNodeDetails.length) setIsUpsertButtonEnabled(true)
        else setIsUpsertButtonEnabled(false)
    }

    const checkIfSyncNodesAvailable = (nodes) => {
        const componentNodes = canvasState.componentNodes

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i]
            const componentNode = componentNodes.find((cn) => cn.name === node.data.name)
            if (componentNode && componentNode.version > node.data.version) {
                setIsSyncNodesButtonEnabled(true)
                return
            }
        }

        setIsSyncNodesButtonEnabled(false)
    }

    // ==============================|| useEffect ||============================== //

    useEffect(() => {
        if (spaceId) return
        if (!initialCanvasId || !parentUnikId) return
        getCanvasApi
            .request(parentUnikId, initialCanvasId)
            .catch((error) => {
                const serverMessage =
                    error?.response?.data?.error || error?.response?.data?.message || error?.message
                errorFailed(`Failed to retrieve ${canvasTitle}: ${serverMessage}`)
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spaceId, initialCanvasId, parentUnikId])

    useEffect(() => {
        if (spaceId) return
        if (!getCanvasApi.data) return
        const response = getCanvasApi.data?.data || getCanvasApi.data
        if (!response) return
        try {
            const parsed = response.flowData ? JSON.parse(response.flowData) : { nodes: [], edges: [] }
            setNodes(parsed.nodes || [])
            setEdges(parsed.edges || [])
        } catch (error) {
            setNodes([])
            setEdges([])
        }

        const canvasViewModel = buildCanvasAsChatflow(response, {
            unikId: parentUnikId,
            spaceId: response.spaceId || response.space_id || null,
            spaceName: response.spaceName || response.space_name,
            isAgentCanvas
        })
        dispatch({ type: SET_CANVAS, canvas: canvasViewModel })
        setActiveCanvas(canvasViewModel)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spaceId, getCanvasApi.data])

    useEffect(() => {
        if (!getCanvasApi.error || spaceId) return
        const serverMessage =
            getCanvasApi.error?.response?.data?.error ||
            getCanvasApi.error?.response?.data?.message ||
            getCanvasApi.error?.message
        if (serverMessage) errorFailed(`Failed to retrieve ${canvasTitle}: ${serverMessage}`)
    }, [getCanvasApi.error, spaceId])

    useEffect(() => {
        if (!canvasState?.currentCanvas) {
            setActiveCanvas(null)
            checkIfUpsertAvailable([], [])
            checkIfSyncNodesAvailable([])
            return
        }

        setActiveCanvas(canvasState.currentCanvas)
        try {
            const parsed = canvasState.currentCanvas.flowData
                ? JSON.parse(canvasState.currentCanvas.flowData)
                : { nodes: [], edges: [] }
            checkIfUpsertAvailable(parsed.nodes || [], parsed.edges || [])
            checkIfSyncNodesAvailable(parsed.nodes || [])
        } catch (error) {
            checkIfUpsertAvailable([], [])
            checkIfSyncNodesAvailable([])
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canvasState.currentCanvas])

    useEffect(() => {
        if (!spaceId || !initialCanvasId) return
        if (!canvases?.length) return
        if (activeCanvasId === initialCanvasId) return
        const exists = canvases.some((canvasItem) => canvasItem.id === initialCanvasId)
        if (exists) selectCanvas(initialCanvasId)
    }, [spaceId, initialCanvasId, canvases, activeCanvasId, selectCanvas])
    // Load Space data when spaceId is available
    useEffect(() => {
        if (spaceId && parentUnikId) {
            getSpaceApi.request()
        }
    }, [spaceId, parentUnikId])

    // Handle Space data response
    useEffect(() => {
        if (getSpaceApi.data) {
            const space = getSpaceApi.data?.data || getSpaceApi.data
            setSpaceData(space)
        }
    }, [getSpaceApi.data])

    // Load active Canvas flowData from useCanvases when activeCanvasId changes
    useEffect(() => {
        console.log('[Canvas] useEffect flowData loader triggered:', { 
            spaceId, 
            activeCanvasId, 
            canvasesLength: canvases?.length 
        })
        
        if (!spaceId) {
            console.log('[Canvas] useEffect flowData loader: no spaceId, exiting')
            return
        }
        if (!activeCanvasId) {
            console.log('[Canvas] useEffect flowData loader: no activeCanvasId, exiting')
            return
        }
        if (!canvases?.length) {
            console.log('[Canvas] useEffect flowData loader: no canvases, exiting')
            return
        }

        const activeCanvasFromList = canvases.find((c) => c.id === activeCanvasId)
        if (!activeCanvasFromList) {
            console.log('[Canvas] useEffect flowData loader: activeCanvas not found in list, exiting')
            return
        }

        console.log('[Canvas] Loading flowData for active canvas:', {
            activeCanvasId,
            hasFlowData: !!activeCanvasFromList.flowData,
            flowDataLength: activeCanvasFromList.flowData?.length || 0
        })

        try {
            const parsed = activeCanvasFromList.flowData
                ? JSON.parse(activeCanvasFromList.flowData)
                : { nodes: [], edges: [] }
            setNodes(parsed.nodes || [])
            setEdges(parsed.edges || [])
        } catch (error) {
            console.error('[Canvas] Failed to parse flowData:', error)
            setNodes([])
            setEdges([])
        }

        const canvasViewModel = buildCanvasAsChatflow(activeCanvasFromList, {
            unikId: parentUnikId,
            spaceId: activeCanvasFromList.spaceId || activeCanvasFromList.space_id || spaceId,
            spaceName: activeCanvasFromList.spaceName || activeCanvasFromList.space_name,
            isAgentCanvas
        })
        dispatch({ type: SET_CANVAS, canvas: canvasViewModel })
        setActiveCanvas(canvasViewModel)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spaceId, activeCanvasId, canvases])

    // Initialization
    useEffect(() => {
        setIsSyncNodesButtonEnabled(false)
        setIsUpsertButtonEnabled(false)
        if (!spaceId) {
            if (localStorage.getItem('duplicatedFlowData')) {
                handleLoadFlow(localStorage.getItem('duplicatedFlowData'))
                setTimeout(() => localStorage.removeItem('duplicatedFlowData'), 0)
            } else {
                setNodes([])
                setEdges([])
            }
            dispatch({
                type: SET_CANVAS,
                canvas: {
                    name: `Untitled ${canvasTitle}`
                }
            })
        }

        getNodesApi.request()

            // Space Builder providers/models are now loaded inside SpaceBuilderDialog

        // Clear dirty state before leaving and remove any ongoing test triggers and webhooks
        return () => {
            setTimeout(() => dispatch({ type: REMOVE_DIRTY }), 0)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (spaceId) return
        setTempCanvas((prev) => {
            if (prev.isCustom) return prev
            if (prev.name === localizedDefaultCanvasName) return prev
            return { ...prev, name: localizedDefaultCanvasName }
        })
    }, [localizedDefaultCanvasName, spaceId])

    useEffect(() => {
        if (spaceId) return
        setTempCanvas((prev) => ({ ...prev, isDirty: canvasState.isDirty }))
    }, [canvasState.isDirty, spaceId])

    useEffect(() => {
        function handlePaste(e) {
            const pasteData = e.clipboardData.getData('text')
            //TODO: prevent paste event when input focused, temporary fix: catch legacy canvas syntax
            if (pasteData.includes('{"nodes":[') && pasteData.includes('],"edges":[')) {
                handleLoadFlow(pasteData)
            }
        }

        window.addEventListener('paste', handlePaste)

        return () => {
            window.removeEventListener('paste', handlePaste)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (templateFlowData && templateFlowData.includes('"nodes":[') && templateFlowData.includes('],"edges":[')) {
            handleLoadFlow(templateFlowData)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [templateFlowData])

    // Load active canvas data when activeCanvasId changes
    useEffect(() => {
        if (!spaceId || !activeCanvasId) return
        const selectedCanvas = getActiveCanvas()
        if (selectedCanvas?.flowData) {
            try {
                const flowData = JSON.parse(selectedCanvas.flowData)
                setNodes(flowData.nodes || [])
                setEdges(flowData.edges || [])
            } catch (error) {
                setNodes([])
                setEdges([])
            }
        } else {
            setNodes([])
            setEdges([])
        }

        if (selectedCanvas) {
            const canvasViewModel = buildCanvasAsChatflow(selectedCanvas, {
                unikId,
                spaceId,
                spaceName: spaceData?.name,
                isAgentCanvas
            })
            dispatch({ type: SET_CANVAS, canvas: canvasViewModel })
            setActiveCanvas(canvasViewModel)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCanvasId, spaceId, getActiveCanvas, spaceData])

    usePrompt(t('dirty'), canvasState.isDirty)

    // Register space-builder translations once
    useEffect(() => {
        try { registerSpaceBuilderI18n(i18n) } catch {/* no-op */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleRenameSpace = async (newName) => {
        if (!spaceId) return
        try {
            await updateSpaceApi.request(parentUnikId, spaceId, { name: newName })
            setSpaceData((prev) => ({ ...(prev || {}), name: newName }))
            enqueueSnackbar({
                message: t('spaceRenameSuccess', 'Space renamed successfully'),
                options: { key: new Date().getTime() + Math.random(), variant: 'success' }
            })
        } catch (error) {
            enqueueSnackbar({
                message: t('spaceRenameError', 'Failed to rename space'),
                options: { key: new Date().getTime() + Math.random(), variant: 'error' }
            })
        }
    }

    // ==============================|| Memoized Tab Handlers ||============================== //
    const handleCanvasCreate = useReactCallback(async () => {
        try {
            await createCanvas(t('newCanvas', 'New Canvas'))
            enqueueSnackbar({
                message: t('createSuccess', 'Canvas created successfully'),
                options: { key: new Date().getTime() + Math.random(), variant: 'success' }
            })
        } catch (error) {
            enqueueSnackbar({
                message: t('createError', 'Failed to create canvas'),
                options: { key: new Date().getTime() + Math.random(), variant: 'error' }
            })
        }
    }, [createCanvas, enqueueSnackbar, t])

    const handleCanvasRename = useReactCallback(async (canvasId, newName) => {
        const trimmedName = (newName || '').trim()
        if (!trimmedName) {
            enqueueSnackbar({
                message: t('renameError', 'Failed to rename canvas'),
                options: { key: new Date().getTime() + Math.random(), variant: 'error' }
            })
            return
        }

        if (!spaceId && canvasId === 'temp') {
            setTempCanvas((prev) => ({
                ...prev,
                name: trimmedName,
                isDirty: true,
                isCustom: trimmedName !== localizedDefaultCanvasName
            }))
            setDirty()
            enqueueSnackbar({
                message: t('renameSuccess', 'Canvas renamed successfully'),
                options: { key: new Date().getTime() + Math.random(), variant: 'success' }
            })
            return
        }

        try {
            await renameCanvas(canvasId, trimmedName)
            enqueueSnackbar({
                message: t('renameSuccess', 'Canvas renamed successfully'),
                options: { key: new Date().getTime() + Math.random(), variant: 'success' }
            })
        } catch (error) {
            enqueueSnackbar({
                message: t('renameError', 'Failed to rename canvas'),
                options: { key: new Date().getTime() + Math.random(), variant: 'error' }
            })
        }
    }, [renameCanvas, enqueueSnackbar, t, spaceId, localizedDefaultCanvasName])

    const handleCanvasDelete = useReactCallback(async (canvasId) => {
        const confirmed = await confirm({
            title: t('confirmDelete', 'Delete Canvas'),
            description: t('confirmDeleteDescription', 'Are you sure you want to delete this canvas? This action cannot be undone.')
        })
        if (!confirmed) return
        try {
            await deleteCanvas(canvasId)
            enqueueSnackbar({
                message: t('deleteSuccess', 'Canvas deleted successfully'),
                options: { key: new Date().getTime() + Math.random(), variant: 'success' }
            })
        } catch (error) {
            const serverMsg = error?.response?.data?.error || error?.message
            const isLastCanvas = typeof serverMsg === 'string' && serverMsg.toLowerCase().includes('last canvas')
            enqueueSnackbar({
                message: isLastCanvas ? t('deleteLastCanvasError', 'Cannot delete the last canvas in a space') : t('deleteError', 'Failed to delete canvas'),
                options: { key: new Date().getTime() + Math.random(), variant: 'error' }
            })
        }
    }, [confirm, deleteCanvas, enqueueSnackbar, t])

    const handleCanvasDuplicate = useReactCallback(async (canvasId) => {
        try {
            await duplicateCanvas(canvasId)
            enqueueSnackbar({
                message: t('duplicateSuccess', 'Canvas duplicated successfully'),
                options: { key: new Date().getTime() + Math.random(), variant: 'success' }
            })
        } catch (error) {
            enqueueSnackbar({
                message: t('duplicateError', 'Failed to duplicate canvas'),
                options: { key: new Date().getTime() + Math.random(), variant: 'error' }
            })
        }
    }, [duplicateCanvas, enqueueSnackbar, t])

    const handleCanvasReorder = useReactCallback(async (canvasId, newIndex) => {
        try {
            await reorderCanvas(canvasId, newIndex)
        } catch (error) {
            enqueueSnackbar({
                message: t('canvas.reorderError', 'Failed to reorder canvas'),
                options: { key: new Date().getTime() + Math.random(), variant: 'error' }
            })
        }
    }, [reorderCanvas, enqueueSnackbar, t])

    // CanvasTabs already exported as memoized component; avoid re-memoizing per render

    return (
        <>
            <Box>
                <AppBar
                    enableColorOnDark
                    position='fixed'
                    color='inherit'
                    elevation={1}
                    sx={{
                        bgcolor: theme.palette.background.default
                    }}
                >
                    <Toolbar>
                        <CanvasHeader
                            canvas={activeCanvas}
                            handleSaveFlow={handleSaveFlow}
                            handleDeleteFlow={handleDeleteFlow}
                            handleLoadFlow={handleLoadFlow}
                            isAgentCanvas={isAgentCanvas}
                            spaceId={spaceId}
                            activeCanvasId={activeCanvasId}
                            spaceName={spaceData?.name}
                            spaceLoading={!!spaceId && !!getSpaceApi.loading}
                            onRenameSpace={handleRenameSpace}
                            onRefreshCanvases={refreshCanvases}
                            onSelectCanvas={selectCanvas}
                        />
                    </Toolbar>
                </AppBar>
                <Box sx={{ pt: '70px', height: '100vh', width: '100%' }}>
                    <div className='reactflow-parent-wrapper'>
                        <div className='reactflow-wrapper' ref={reactFlowWrapper}>
                            <ReactFlow
                                key={spaceId ? activeCanvasId || 'new' : 'temp'}
                                nodes={nodes}
                                edges={edges}
                                onNodesChange={onNodesChange}
                                onNodeClick={onNodeClick}
                                onEdgesChange={onEdgesChange}
                                onDrop={onDrop}
                                onDragOver={onDragOver}
                                onNodeDragStop={setDirty}
                                nodeTypes={nodeTypes}
                                edgeTypes={edgeTypes}
                                onConnect={onConnect}
                                onInit={setReactFlowInstance}
                                fitView
                                deleteKeyCode={canvasState.canvasDialogShow ? null : ['Delete']}
                                minZoom={0.1}
                                className='canvas-editor'
                            >
                                <Controls
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'row',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        bottom: Math.max(8, (tabsHeight || 56) + 8)
                                    }}
                                />
                                <Background color='#aaa' gap={16} />
                                <AddNodes
                                    isAgentCanvas={isAgentCanvas}
                                    nodesData={getNodesApi.data}
                                    node={selectedNode}
                                    onApplyGraph={handleApplyGeneratedGraph}
                                />
                                <SpaceBuilderFab
                                    sx={{ position: 'absolute', left: 76, top: 20, zIndex: 1100 }}

                                    onApply={(graph, mode) => {
                                        if (mode === 'append') return handleAppendGeneratedGraphBelow(graph)
                                        if (mode === 'newSpace') return handleNewSpaceFromGeneratedGraph(graph)
                                        if (mode === 'newCanvas') return handleNewCanvasFromGeneratedGraph(graph)
                                        handleApplyGeneratedGraph(graph)
                                    }}
                                    onError={(message) => enqueueSnackbar({
                                        message,
                                        options: {
                                            key: new Date().getTime() + Math.random(),
                                            variant: 'error'
                                        }
                                    })}
                                    allowNewCanvas={Boolean(spaceId)}
                                />
                                {isSyncNodesButtonEnabled && (
                                    <Fab
                                        sx={{
                                            left: 40,
                                            top: 20,
                                            color: 'white',
                                            background: 'orange',
                                            '&:hover': {
                                                background: 'orange',
                                                backgroundImage: `linear-gradient(rgb(0 0 0/10%) 0 0)`
                                            }
                                        }}
                                        size='small'
                                        aria-label='sync'
                                        title='Sync Nodes'
                                        onClick={() => syncNodes()}
                                    >
                                        <IconRefreshAlert style={{ marginRight: 8 }} /> {t('syncNodes')}
                                    </Fab>
                                )}
                                {isUpsertButtonEnabled && <VectorStorePopUp canvasId={canvasId} />}
                                <ChatPopUp
                                    isAgentCanvas={isAgentCanvas}
                                    canvasId={canvasId}
                                    unikId={chatPopUpUnikId}
                                    spaceId={chatPopUpSpaceId}
                                />
                            </ReactFlow>
                        </div>
                    </div>
                </Box>
                <ConfirmDialog />

                {/* Canvas Tabs - show for saved spaces or new spaces after first interaction */}
                {true && (
                    <CanvasTabs
                        canvases={spaceId ? canvases : newSpaceCanvases}
                        activeCanvasId={spaceId ? activeCanvasId : 'temp'}
                        onCanvasSelect={spaceId ? selectCanvas : undefined}
                        onCanvasCreate={spaceId ? handleCanvasCreate : undefined}
                        onCanvasRename={handleCanvasRename}
                        onCanvasDelete={handleCanvasDelete}
                        onCanvasDuplicate={handleCanvasDuplicate}
                        onCanvasReorder={handleCanvasReorder}
                        disabled={canvasesLoading || !spaceId}
                        onHeightChange={setTabsHeight}
                    />
                )}
            </Box>
        </>
    )
}

export default Canvas
