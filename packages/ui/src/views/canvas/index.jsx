import { useEffect, useRef, useState, useCallback, useContext } from 'react'
import ReactFlow, { addEdge, Controls, Background, useNodesState, useEdgesState } from 'reactflow'
import 'reactflow/dist/style.css'
import { useTranslation } from 'react-i18next'

import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
    REMOVE_DIRTY,
    SET_DIRTY,
    SET_CHATFLOW,
    enqueueSnackbar as enqueueSnackbarAction,
    closeSnackbar as closeSnackbarAction
} from '@/store/actions'
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
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'
import { ChatPopUp } from '@/views/chatmessage/ChatPopUp'
import { VectorStorePopUp } from '@/views/vectorstore/VectorStorePopUp'
import { flowContext } from '@/store/context/ReactFlowContext'

// API
import nodesApi from '@/api/nodes'
import chatflowsApi from '@/api/chatflows'

// Hooks
import useApi from '@/hooks/useApi'
import useConfirm from '@/hooks/useConfirm'

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
} from '@/utils/genericHelper'
import useNotifier from '@/utils/useNotifier'
import { usePrompt } from '@/utils/usePrompt'

// const
import { FLOWISE_CREDENTIAL_ID } from '@/store/constant'
// Space Builder i18n and FAB
import { SpaceBuilderFab, registerSpaceBuilderI18n } from '@universo/space-builder-frt'
import credentialsApi from '@/api/credentials'
import i18n from '@/i18n'
import client from '@/api/client'

const SUPPORTED_CREDENTIALS = [
  'openAIApi',
  'azureOpenAIApi',
  'groqApi',
  'groqWhisper'
]

const TEST_MODE_MODEL = {
  key: 'groq_test:llama-3.3-70b-versatile:test',
  label: 'groq • llama-3.3-70b-versatile (Test mode)',
  provider: 'groq_test',
  modelName: 'llama-3.3-70b-versatile',
  credentialId: 'test'
}

const nodeTypes = { customNode: CanvasNode, stickyNote: StickyNote }
const edgeTypes = { buttonedge: ButtonEdge }

// ==============================|| CANVAS ||============================== //

const Canvas = () => {
    const theme = useTheme()
    const navigate = useNavigate()
    const { unikId, id } = useParams()
    const chatflowId = id === 'new' ? undefined : id
    const location = useLocation()
    const templateFlowData = location.state ? location.state.templateFlowData : ''
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
    const canvasTitle = isAgentCanvas ? 'Agent' : 'Chatflow'

    const { confirm } = useConfirm()

    const dispatch = useDispatch()
    const canvas = useSelector((state) => state.canvas)
    const [canvasDataStore, setCanvasDataStore] = useState(canvas)
    const [chatflow, setChatflow] = useState(null)
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
    const [availableChatModels, setAvailableChatModels] = useState([])

    const reactFlowWrapper = useRef(null)

    // Flag to prevent immediate refetch after update
    const [skipRefetch, setSkipRefetch] = useState(false)

    // ==============================|| Chatflow API ||============================== //

    const getNodesApi = useApi(nodesApi.getAllNodes)
    const createNewChatflowApi = useApi(chatflowsApi.createNewChatflow)
    const updateChatflowApi = useApi(chatflowsApi.updateChatflow)
    const getSpecificChatflowApi = useApi(() => chatflowsApi.getSpecificChatflow(parentUnikId, chatflowId))

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
        const componentNodes = canvas.componentNodes || []
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

    const handleAppendGeneratedGraph = (graph) => {
        try {
            const hydrated = hydrateGeneratedGraph(graph)
            const nodesNew = Array.isArray(hydrated?.nodes) ? hydrated.nodes : []
            const edgesNew = Array.isArray(hydrated?.edges) ? hydrated.edges : []
            const existingIds = new Set((reactFlowInstance?.getNodes() || []).map((n) => n.id))
            const { nodes: remappedNodes, edges: remappedEdges } = remapIds(nodesNew, edgesNew, existingIds)
            const offset = { x: 300, y: 80 }
            const shifted = remappedNodes.map((n) => ({
                ...n,
                position: n.position ? { x: Number(n.position.x || 0) + offset.x, y: Number(n.position.y || 0) + offset.y } : { x: offset.x, y: offset.y }
            }))
            setNodes((curr) => [...curr, ...shifted])
            setEdges((curr) => [...curr, ...remappedEdges])
            setTimeout(() => setDirty(), 0)
        } catch (e) {
            console.error(e)
        }
    }

    const handleDeleteFlow = async () => {
        if (!chatflow?.id) return
        const confirmPayload = {
            title: t('canvas.confirmDelete'),
            description: t('canvas.confirmDeleteDescription') + ' ' + canvasTitle + ' ' + chatflow.name + '?',
            confirmButtonName: t('canvas.confirmDelete'),
            cancelButtonName: t('canvas.cancel')
        }
        const isConfirmed = await confirm(confirmPayload)

        if (isConfirmed) {
            try {
                await chatflowsApi.deleteChatflow(parentUnikId, chatflow.id)
                localStorage.removeItem(`${chatflow.id}_INTERNAL`)
                
                // Consider the type of canvas when redirecting after deletion
                const redirectPath = isAgentCanvas
                    ? `/uniks/${parentUnikId}/agentflows`
                    : `/uniks/${parentUnikId}/chatflows`;
                navigate(redirectPath)
            } catch (error) {
                enqueueSnackbar({
                    message: typeof error.response?.data === 'object' ? error.response.data.message : error.message,
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
    }

    const handleSaveFlow = (chatflowName) => {
        if (reactFlowInstance) {
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
            const flowData = JSON.stringify(rfInstanceObject)

            if (!chatflow?.id) {
                const newChatflowBody = {
                    name: chatflowName,
                    deployed: false,
                    isPublic: false,
                    flowData,
                    type: isAgentCanvas ? 'MULTIAGENT' : 'CHATFLOW',
                    unik_id: parentUnikId
                }
                createNewChatflowApi.request(parentUnikId, newChatflowBody)
            } else {
                const updateBody = {
                    name: chatflowName,
                    flowData
                }
                updateChatflowApi.request(parentUnikId, chatflow.id, updateBody)
            }
        }
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
        const componentNodes = canvas.componentNodes

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
        enqueueSnackbar({
            message: t('canvas.messages.saveSuccess') + ' ' + canvasTitle,
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
        const componentNodes = canvas.componentNodes

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

    // Get specific chatflow successful
    useEffect(() => {
        if (getSpecificChatflowApi.data) {
            const chatflow = getSpecificChatflowApi.data
            const initialFlow = chatflow.flowData ? JSON.parse(chatflow.flowData) : []
            setNodes(initialFlow.nodes || [])
            setEdges(initialFlow.edges || [])
            dispatch({ type: SET_CHATFLOW, chatflow })
        } else if (getSpecificChatflowApi.error) {
            errorFailed(
                `Failed to retrieve ${canvasTitle}: ${
                    getSpecificChatflowApi.error.response?.data?.message || getSpecificChatflowApi.error.message
                }`
            )
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getSpecificChatflowApi.data, getSpecificChatflowApi.error])

    // Create new chatflow successful
    useEffect(() => {
        if (createNewChatflowApi.data) {
            const chatflow = createNewChatflowApi.data
            dispatch({ type: SET_CHATFLOW, chatflow })
            saveChatflowSuccess()
            // Consider the type of canvas when redirecting
            const redirectPath = isAgentCanvas 
                ? `/uniks/${parentUnikId}/agentcanvas/${chatflow.id}` 
                : `/uniks/${parentUnikId}/chatflows/${chatflow.id}`;
            navigate(redirectPath, { replace: true })
        } else if (createNewChatflowApi.error) {
            errorFailed(
                `Failed to save ${canvasTitle}: ${createNewChatflowApi.error.response?.data?.message || createNewChatflowApi.error.message}`
            )
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createNewChatflowApi.data, createNewChatflowApi.error])

    // Update chatflow successful
    useEffect(() => {
        if (updateChatflowApi.data) {
            dispatch({ type: SET_CHATFLOW, chatflow: updateChatflowApi.data })
            saveChatflowSuccess()
            // Prevent immediate refetch
            setSkipRefetch(true)
            setTimeout(() => setSkipRefetch(false), 1000)
        } else if (updateChatflowApi.error) {
            errorFailed(
                `Failed to save ${canvasTitle}: ${updateChatflowApi.error.response?.data?.message || updateChatflowApi.error.message}`
            )
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [updateChatflowApi.data, updateChatflowApi.error])

    // Effect to fetch chatflow when id or location changes
    useEffect(() => {
        if (chatflowId && parentUnikId && !skipRefetch) {
            getSpecificChatflowApi.request(parentUnikId, chatflowId)
        }
    }, [chatflowId, parentUnikId, location.key, skipRefetch])

    useEffect(() => {
        setChatflow(canvasDataStore.chatflow)
        if (canvasDataStore.chatflow) {
            const flowData = canvasDataStore.chatflow.flowData ? JSON.parse(canvasDataStore.chatflow.flowData) : []
            checkIfUpsertAvailable(flowData.nodes || [], flowData.edges || [])
            checkIfSyncNodesAvailable(flowData.nodes || [])
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canvasDataStore.chatflow])

    // Initialization
    useEffect(() => {
        setIsSyncNodesButtonEnabled(false)
        setIsUpsertButtonEnabled(false)
        if (chatflowId) {
            getSpecificChatflowApi.request(parentUnikId, chatflowId)
        } else {
            if (localStorage.getItem('duplicatedFlowData')) {
                handleLoadFlow(localStorage.getItem('duplicatedFlowData'))
                setTimeout(() => localStorage.removeItem('duplicatedFlowData'), 0)
            } else {
                setNodes([])
                setEdges([])
            }
            dispatch({
                type: SET_CHATFLOW,
                chatflow: {
                    name: `Untitled ${canvasTitle}`
                }
            })
        }

        getNodesApi.request()

        // load available chat models from credentials
        ;(async () => {
            try {
                if (!parentUnikId) return
                const res = await credentialsApi.getAllCredentials(parentUnikId)
                const creds = res?.data || []
                const mapProvider = (credName = '') => {
                    const n = String(credName).toLowerCase()
                    if (n.includes('groq')) return 'groq'
                    if (n.includes('azureopenai')) return 'openai'
                    if (n.includes('openai')) return 'openai'
                    return 'unsupported'
                }
                const defaultsByProvider = {
                    openai: ['gpt-4o-mini'],
                    groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
                }
                const models = creds
                    .filter((c) => SUPPORTED_CREDENTIALS.includes(c.credentialName))
                    .map((c) => {
                        const provider = mapProvider(c.credentialName)
                        if (provider === 'unsupported') return null
                        const modelName = defaultsByProvider[provider][0]
                        return {
                            key: `${provider}:${modelName}:${c.id}`,
                            label: `${provider} • ${modelName}`,
                            provider,
                            modelName,
                            credentialId: c.id
                        }
                    })
                    .filter(Boolean)
                //  Request Space Builder configuration from the server
                let testModeEnabled = false
                try {
                    const resp = await client.get('/space-builder/config')
                    testModeEnabled = !!resp?.data?.testMode
                } catch (e) {
                    // ignore config fetch errors
                }
                if (testModeEnabled) models.push(TEST_MODE_MODEL)
                setAvailableChatModels(models)
            } catch (e) {
                console.error('[SpaceBuilder] load models failed', e)
            }
        })()

        // Clear dirty state before leaving and remove any ongoing test triggers and webhooks
        return () => {
            setTimeout(() => dispatch({ type: REMOVE_DIRTY }), 0)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        setCanvasDataStore(canvas)
    }, [canvas])

    useEffect(() => {
        function handlePaste(e) {
            const pasteData = e.clipboardData.getData('text')
            //TODO: prevent paste event when input focused, temporary fix: catch chatflow syntax
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

    usePrompt(t('canvas.dirty'), canvas.isDirty)

    // Register space-builder translations once
    useEffect(() => {
        try { registerSpaceBuilderI18n(i18n) } catch {/* no-op */}
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

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
                            chatflow={chatflow}
                            handleSaveFlow={handleSaveFlow}
                            handleDeleteFlow={handleDeleteFlow}
                            handleLoadFlow={handleLoadFlow}
                            isAgentCanvas={isAgentCanvas}
                        />
                    </Toolbar>
                </AppBar>
                <Box sx={{ pt: '70px', height: '100vh', width: '100%' }}>
                    <div className='reactflow-parent-wrapper'>
                        <div className='reactflow-wrapper' ref={reactFlowWrapper}>
                            <ReactFlow
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
                                deleteKeyCode={canvas.canvasDialogShow ? null : ['Delete']}
                                minZoom={0.1}
                                className='chatflow-canvas'
                            >
                                <Controls
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'row',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)'
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
                                    models={availableChatModels}
                                    onApply={(graph, mode) => {
                                        if (mode === 'append') return handleAppendGeneratedGraph(graph)
                                        handleApplyGeneratedGraph(graph)
                                    }}
                                    onError={(message) => enqueueSnackbar({
                                        message,
                                        options: {
                                            key: new Date().getTime() + Math.random(),
                                            variant: 'error'
                                        }
                                    })}
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
                                        <IconRefreshAlert style={{ marginRight: 8 }} /> {t('canvas.syncNodes')}
                                    </Fab>
                                )}
                                {isUpsertButtonEnabled && <VectorStorePopUp chatflowid={chatflowId} />}
                                <ChatPopUp isAgentCanvas={isAgentCanvas} chatflowid={chatflowId} />
                            </ReactFlow>
                        </div>
                    </div>
                </Box>
                <ConfirmDialog />
            </Box>
        </>
    )
}

export default Canvas
