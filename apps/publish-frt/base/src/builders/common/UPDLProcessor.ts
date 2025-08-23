// Universo Platformo | UPDL Processor
// REFACTORED: Now uses independent publication types module

import {
    IUPDLPosition,
    IUPDLRotation,
    IUPDLObject,
    IUPDLCamera,
    IUPDLLight,
    IUPDLData,
    IUPDLSpace,
    IUPDLScene,
    IUPDLMultiScene
} from '@universo/publish-srv'

// Local types only for flow processing (not UPDL structure types)
interface IReactFlowNode {
    id: string
    data: {
        name?: string
        label?: string
        category?: string
        inputs?: any
    }
}

/**
 * UPDL Processor for handling UPDL node processing on the frontend
 * All logic moved from packages/server/src/utils/buildUPDLflow.ts
 */
export class UPDLProcessor {
    /**
     * Check if the node is a UPDL node
     * Moved from buildUPDLflow.ts
     */
    static isUPDLNode(node: IReactFlowNode): boolean {
        const nodeData = node.data || {}
        // Check for UPDL node indicators
        return (
            nodeData.category === 'UPDL' ||
            ['space', 'object', 'camera', 'light', 'data', 'entity', 'component', 'event', 'action', 'universo'].includes(
                (nodeData.name || '').toLowerCase()
            )
        )
    }

    /**
     * Get the ending nodes of the UPDL chain
     * Moved from buildUPDLflow.ts
     */
    static getUPDLEndingNodes(nodeDependencies: any, graph: any, allNodes: IReactFlowNode[]): IReactFlowNode[] {
        // Get all possible ending node IDs
        const endingNodeIds: string[] = []
        Object.keys(graph).forEach((nodeId) => {
            if (Object.keys(nodeDependencies).length === 1) {
                endingNodeIds.push(nodeId)
            } else if (!graph[nodeId].length && nodeDependencies[nodeId] > 0) {
                endingNodeIds.push(nodeId)
            }
        })

        // Filter only UPDL nodes
        let endingNodes = allNodes.filter((nd) => endingNodeIds.includes(nd.id) && this.isUPDLNode(nd))

        // If no UPDL ending nodes are found, return an empty array
        if (endingNodes.length === 0) {
            return []
        }

        // Check for Space nodes (priority)
        const spaceNodes = endingNodes.filter((node) => node.data?.name?.toLowerCase() === 'space')

        // Prefer Space nodes if available
        if (spaceNodes.length > 0) {
            return spaceNodes
        }

        return endingNodes
    }

    /**
     * Analyze Space connections and build scene chain
     * Moved from buildUPDLflow.ts
     */
    static analyzeSpaceChain(nodes: IReactFlowNode[], edges: any[]): IUPDLMultiScene | null {
        // Find all Space nodes
        const spaceNodes = nodes.filter((node) => node.data?.name?.toLowerCase() === 'space')

        // If only one Space, return null (use legacy single space processing)
        if (spaceNodes.length <= 1) {
            console.log('[UPDLProcessor] Single space detected, using legacy processing')
            return null
        }

        console.log(`[UPDLProcessor] Found ${spaceNodes.length} space nodes, analyzing connections`)

        // Build edge map for Space connections
        const spaceEdgeMap = new Map<string, string>()
        const incomingConnections = new Set<string>()

        edges.forEach((edge) => {
            const sourceNode = nodes.find((n) => n.id === edge.source)
            const targetNode = nodes.find((n) => n.id === edge.target)

            if (sourceNode?.data?.name?.toLowerCase() === 'space' && targetNode?.data?.name?.toLowerCase() === 'space') {
                spaceEdgeMap.set(edge.source, edge.target)
                incomingConnections.add(edge.target)
                console.log(`[UPDLProcessor] Space connection: ${edge.source} → ${edge.target}`)
            }
        })

        // Find starting Space (no incoming connections from other Spaces)
        const startingSpaces = spaceNodes.filter((space) => !incomingConnections.has(space.id))

        if (startingSpaces.length === 0) {
            console.warn('[UPDLProcessor] No starting space found, using first space')
            return null
        }

        const startingSpace = startingSpaces[0]
        console.log(`[UPDLProcessor] Starting space: ${startingSpace.id}`)

        // Build ordered scene chain
        const scenes: IUPDLScene[] = []
        let currentSpaceId = startingSpace.id
        let order = 0

        while (currentSpaceId) {
            const currentSpace = spaceNodes.find((s) => s.id === currentSpaceId)
            if (!currentSpace) break

            // Find Data nodes connected to this Space
            const directDataNodes = nodes.filter((node) => {
                if (node.data?.name?.toLowerCase() !== 'data') return false
                return edges.some((edge) => edge.target === currentSpace.id && edge.source === node.id)
            })

            // Find all related Data nodes (including answers connected to questions)
            const allRelatedDataNodes = new Set(directDataNodes)

            directDataNodes.forEach((dataNode) => {
                const relatedNodes = nodes.filter((node) => {
                    if (node.data?.name?.toLowerCase() !== 'data') return false
                    if (allRelatedDataNodes.has(node)) return false

                    return (
                        edges.some((edge) => edge.source === dataNode.id && edge.target === node.id) ||
                        edges.some((edge) => edge.source === node.id && edge.target === dataNode.id)
                    )
                })

                relatedNodes.forEach((node) => allRelatedDataNodes.add(node))
            })

            const connectedDataNodes = Array.from(allRelatedDataNodes)

            // Find Object nodes connected to any Data nodes of this Space
            const connectedObjectNodes = nodes.filter((node) => {
                if (node.data?.name?.toLowerCase() !== 'object') return false

                return connectedDataNodes.some(
                    (dataNode) =>
                        edges.some((edge) => edge.source === dataNode.id && edge.target === node.id) ||
                        edges.some((edge) => edge.source === node.id && edge.target === dataNode.id)
                )
            })

            // Universo Platformo | Derive visual objects from Entity + Component(render)
            const derivedObjects = (() => {
                try {
                    // Map componentId -> render config
                    const compMap = new Map<string, any>()
                    nodes.forEach((n) => {
                        if ((n.data?.name || '').toLowerCase() === 'component') {
                            const i = n.data?.inputs || {}
                            const ctype = (i.componentType || 'render').toLowerCase()
                            if (ctype === 'render') compMap.set(n.id, i)
                        }
                    })
                    // Collect pairs component(render) -> entity by edges
                    const entMap = new Map<string, any>()
                    nodes.forEach((n) => {
                        if ((n.data?.name || '').toLowerCase() === 'entity') entMap.set(n.id, n)
                    })
                    const pairs: { entity: any; render: any }[] = []
                    edges.forEach((e) => {
                        const render = compMap.get(e.source)
                        const ent = entMap.get(e.target)
                        if (render && ent) pairs.push({ entity: ent, render })
                    })
                    // Only keep entities that are related to this scene (connected to its data via any path)
                    const sceneEntityIds = new Set<string>()
                    pairs.forEach((p) => sceneEntityIds.add(p.entity.id))
                    const toObject = (p: { entity: any; render: any }) => {
                        const t = (p.entity.data?.inputs?.transform) || {}
                        const pos = t.position || t.pos || { x: 0, y: 0.5, z: 0 }
                        const sc = t.scale || { x: 1, y: 1, z: 1 }
                        const prim = (p.render.primitive || 'box').toLowerCase()
                        const color = p.render.color || '#ff0000'
                        return {
                            id: p.entity.id,
                            name: p.entity.data?.label || 'EntityRender',
                            type: prim,
                            position: { x: Number(pos.x) || 0, y: Number(pos.y) || 0.5, z: Number(pos.z) || 0 },
                            rotation: { x: 0, y: 0, z: 0 },
                            scale: { x: Number(sc.x) || 1, y: Number(sc.y) || 1, z: Number(sc.z) || 1 },
                            color
                        }
                    }
                    return pairs.filter((p) => sceneEntityIds.has(p.entity.id)).map(toObject)
                } catch {
                    return [] as any[]
                }
            })()

            const nextSpaceId = spaceEdgeMap.get(currentSpaceId)
            const isLast = !nextSpaceId

            const showPoints = currentSpace.data?.inputs?.showPoints || false
            const hasDataNodes = connectedDataNodes.length > 0
            const isResultsScene = isLast && showPoints && !hasDataNodes

            // Find Entity and Component nodes connected to this Space
            const connectedEntityNodes = nodes.filter((node) => {
                if (node.data?.name?.toLowerCase() !== 'entity') return false
                // Check if entity is connected to this space through any path
                return edges.some((edge) =>
                    (edge.target === currentSpace.id && edge.source === node.id) ||
                    (edge.source === currentSpace.id && edge.target === node.id) ||
                    // Or connected through data nodes
                    connectedDataNodes.some(dataNode =>
                        (edge.target === dataNode.id && edge.source === node.id) ||
                        (edge.source === dataNode.id && edge.target === node.id)
                    )
                )
            })

            const connectedComponentNodes = nodes.filter((node) => {
                if (node.data?.name?.toLowerCase() !== 'component') return false
                // Check if component is connected to any entity in this space
                return edges.some((edge) =>
                    connectedEntityNodes.some(entityNode =>
                        (edge.target === entityNode.id && edge.source === node.id) ||
                        (edge.source === entityNode.id && edge.target === node.id)
                    )
                )
            })

            console.log(`[UPDLProcessor] Space ${currentSpaceId} entities:`, {
                entitiesCount: connectedEntityNodes.length,
                componentsCount: connectedComponentNodes.length,
                entities: connectedEntityNodes.map(e => ({ id: e.id, entityType: e.data?.inputs?.entityType }))
            })

            const scene: IUPDLScene = {
                spaceId: currentSpaceId,
                spaceData: {
                    ...currentSpace.data,
                    // Attach components to their target entities for handler attachments
                    entities: connectedEntityNodes.map((entityNode) => {
                        // Gather components connected to this entity (both edge directions for robustness)
                        const compsForEntity = connectedComponentNodes.filter((compNode) =>
                            edges.some((edge) =>
                                (edge.source === compNode.id && edge.target === entityNode.id) ||
                                (edge.source === entityNode.id && edge.target === compNode.id)
                            )
                        )
                        return {
                            id: entityNode.id,
                            data: {
                                ...entityNode.data,
                                // Embed component nodes so EntityHandler can attach them
                                components: compsForEntity.map((cn) => ({ id: cn.id, data: cn.data }))
                            }
                        }
                    }),
                    components: connectedComponentNodes.map((node) => ({
                        id: node.id,
                        data: node.data
                    })),
                    leadCollection: {
                        collectName: currentSpace.data?.inputs?.collectLeadName || false,
                        collectEmail: currentSpace.data?.inputs?.collectLeadEmail || false,
                        collectPhone: currentSpace.data?.inputs?.collectLeadPhone || false
                    },
                    showPoints: showPoints
                },
                dataNodes: connectedDataNodes.map((node) => ({
                    id: node.id,
                    name: node.data?.label || 'Data',
                    dataType: node.data?.inputs?.dataType || 'question',
                    content: node.data?.inputs?.content || '',
                    isCorrect: node.data?.inputs?.isCorrect || false,
                    nextSpace: node.data?.inputs?.nextSpace,
                    objects: node.data?.inputs?.objects || [],
                    enablePoints: node.data?.inputs?.enablePoints || false,
                    pointsValue: Number(node.data?.inputs?.pointsValue) || 0,
                    metadata: {
                        difficulty: node.data?.inputs?.difficulty,
                        tags: node.data?.inputs?.tags || []
                    }
                })),
                objectNodes: [...connectedObjectNodes, ...derivedObjects].map((node) => {
                    const nodeData = node.data || {}
                    const inputs = nodeData.inputs || {}
                    return {
                        id: node.id,
                        name: nodeData.label || 'Object',
                        type: inputs.objectType || 'box',
                        position: {
                            x: Number(inputs.positionX) || 0,
                            y: Number(inputs.positionY) || 0.5,
                            z: Number(inputs.positionZ) || 0
                        },
                        rotation: { x: 0, y: 0, z: 0 },
                        scale: {
                            x: Number(inputs.scale) || 1,
                            y: Number(inputs.scale) || 1,
                            z: Number(inputs.scale) || 1
                        },
                        color: inputs.color || '#ff0000',
                        width: Number(inputs.width) || 1,
                        height: Number(inputs.height) || 1,
                        depth: Number(inputs.depth) || 1,
                        radius: Number(inputs.radius) || 1
                    }
                }),
                ...(nextSpaceId ? { nextSceneId: nextSpaceId } : {}),
                isLast,
                order,
                isResultsScene
            }

            scenes.push(scene)
            currentSpaceId = nextSpaceId || ''
            order++
        }

        return {
            scenes,
            currentSceneIndex: 0,
            totalScenes: scenes.length,
            isCompleted: false
        }
    }

    /**
     * Build a UPDL space from the flow nodes
     * Moved from buildUPDLflow.ts
     */

    static buildUPDLSpaceFromNodes(nodes: IReactFlowNode[], edges: any[] = []): any {
      
        // Find the space node
        const spaceNode = nodes.find((node) => node.data?.name?.toLowerCase() === 'space')

        if (!spaceNode) {
            throw new Error('Space node not found in flow')
        }

        const spaceData = spaceNode.data || {}

        const objectNodes = nodes.filter((node) => node.data?.name?.toLowerCase() === 'object')
        const cameraNodes = nodes.filter((node) => node.data?.name?.toLowerCase() === 'camera')
        const lightNodes = nodes.filter((node) => node.data?.name?.toLowerCase() === 'light')
        const dataNodes = nodes.filter((node) => node.data?.name?.toLowerCase() === 'data')
        const entityNodes = nodes.filter((node) => node.data?.name?.toLowerCase() === 'entity')
        const componentNodes = nodes.filter((node) => node.data?.name?.toLowerCase() === 'component')
        const eventNodes = nodes.filter((node) => node.data?.name?.toLowerCase() === 'event')
        const actionNodes = nodes.filter((node) => node.data?.name?.toLowerCase() === 'action')
        const universoNodes = nodes.filter((node) => node.data?.name?.toLowerCase() === 'universo')

        const objects: IUPDLObject[] = objectNodes.map((node) => {
            const nodeData = node.data || {}
            const inputs = nodeData.inputs || {}
            return {
                id: node.id,
                name: nodeData.label || 'Object',
                type: inputs.objectType || 'box',
                position: {
                    x: Number(inputs.positionX) || 0,
                    y: Number(inputs.positionY) || 0.5,
                    z: Number(inputs.positionZ) || 0
                },
                rotation: { x: 0, y: 0, z: 0 },
                scale: {
                    x: Number(inputs.scale) || 1,
                    y: Number(inputs.scale) || 1,
                    z: Number(inputs.scale) || 1
                },
                color: inputs.color || '#ff0000',
                width: Number(inputs.width) || 1,
                height: Number(inputs.height) || 1,
                depth: Number(inputs.depth) || 1,
                radius: Number(inputs.radius) || 1
            }
        })

        const cameras: IUPDLCamera[] = cameraNodes.map((node) => {
            const nodeData = node.data || {}
            const inputs = nodeData.inputs || {}
            return {
                id: node.id,
                name: nodeData.label || 'Camera',
                type: inputs.type || 'perspective',
                position: inputs.position || { x: 0, y: 0, z: 5 },
                rotation: inputs.rotation || { x: 0, y: 0, z: 0 },
                scale: inputs.scale || { x: 1, y: 1, z: 1 },
                fov: inputs.fov || 75,
                near: inputs.near || 0.1,
                far: inputs.far || 1000,
                lookAt: inputs.lookAt
            }
        })

        const lights: IUPDLLight[] = lightNodes.map((node) => {
            const nodeData = node.data || {}
            const inputs = nodeData.inputs || {}
            return {
                id: node.id,
                name: nodeData.label || 'Light',
                type: inputs.type || 'ambient',
                position: inputs.position || { x: 0, y: 0, z: 0 },
                rotation: inputs.rotation || { x: 0, y: 0, z: 0 },
                scale: inputs.scale || { x: 1, y: 1, z: 1 },
                color: inputs.color || { r: 1, g: 1, b: 1 },
                intensity: inputs.intensity || 1,
                distance: inputs.distance,
                decay: inputs.decay
            }
        })

        const datas: IUPDLData[] = dataNodes.map((node) => {
            const nodeData = node.data || {}
            const inputs = nodeData.inputs || {}

            let dataType = inputs.dataType || 'question'
            if (inputs.objects && inputs.objects.length > 0 && dataType === 'question') {
                dataType = 'answer'
            }
            dataType = dataType.toLowerCase()

            return {
                id: node.id,
                name: nodeData.label || 'Data',
                dataType: dataType,
                content: inputs.content || '',
                isCorrect: inputs.isCorrect || false,
                nextSpace: inputs.nextSpace,
                objects: inputs.objects ? (Array.isArray(inputs.objects) ? inputs.objects : [inputs.objects]) : [],
                enablePoints: inputs.enablePoints || false,
                pointsValue: Number(inputs.pointsValue) || 0,
                metadata: {
                    difficulty: inputs.difficulty,
                    tags: inputs.tags ? (Array.isArray(inputs.tags) ? inputs.tags : [inputs.tags]) : []
                }
            }
        })

        const components = componentNodes.map((node) => {
            const nodeData = node.data || {}
            const inputs = nodeData.inputs || {}

            let props
            if (inputs.props) {
                if (typeof inputs.props === 'string') {
                    try {
                        props = JSON.parse(inputs.props)
                    } catch {
                        props = {}
                    }
                } else if (typeof inputs.props === 'object') {
                    props = inputs.props
                } else {
                    props = {}
                }
            } else {
                props = {}
            }

            return {
                id: node.id,
                data: {
                    // Normalize component type to lower-case for cross-compat
                    componentType: String(inputs.componentType || 'render').toLowerCase(),
                    primitive: inputs.primitive,
                    color: inputs.color,
                    scriptName: inputs.scriptName,
                    // FIXED: Include all ComponentNode fields
                    maxCapacity: Number(inputs.maxCapacity) || 20,
                    currentLoad: Number(inputs.currentLoad) || 0,
                    fireRate: Number(inputs.fireRate) || 2,
                    damage: Number(inputs.damage) || 1,
                    pricePerTon: Number(inputs.pricePerTon) || 10,
                    interactionRange: Number(inputs.interactionRange) || 8,
                    resourceType: inputs.resourceType || 'asteroidMass',
                    maxYield: Number(inputs.maxYield) || 3,
                    asteroidVolume: Number(inputs.asteroidVolume) || 5,
                    hardness: Number(inputs.hardness) || 1,
                    targetWorld: inputs.targetWorld || 'konkordo',
                    cooldownTime: Number(inputs.cooldownTime) || 2000,
                    props
                }
            }
        })

        const entities = entityNodes.map((node) => {
            const nodeData = node.data || {}
            const inputs = nodeData.inputs || {}

            let transform: any

            if (inputs.transform) {
                let parsed: any = undefined
                if (typeof inputs.transform === 'string') {
                    try {
                        parsed = JSON.parse(inputs.transform)
                    } catch {
                        parsed = undefined
                    }
                } else if (typeof inputs.transform === 'object') {
                    parsed = inputs.transform
                }
                if (parsed) {
                    transform = {} as any

                    if (parsed.pos || parsed.position) {
                        const pos = parsed.pos || parsed.position
                        transform.position = Array.isArray(pos)
                            ? { x: Number(pos[0]) || 0, y: Number(pos[1]) || 0, z: Number(pos[2]) || 0 }
                            : pos
                    }
                    if (parsed.rot || parsed.rotation) {
                        const rot = parsed.rot || parsed.rotation
                        transform.rotation = Array.isArray(rot)
                            ? { x: Number(rot[0]) || 0, y: Number(rot[1]) || 0, z: Number(rot[2]) || 0 }
                            : rot
                    }
                    if (parsed.scale) {
                        const sc = parsed.scale
                        transform.scale = Array.isArray(sc)
                            ? { x: Number(sc[0]) || 1, y: Number(sc[1]) || 1, z: Number(sc[2]) || 1 }
                            : sc
                    }
                }
            }

            return {
                id: node.id,
                data: {
                    name: nodeData.label || 'Entity',
                    entityType: inputs.entityType,
                    transform,
                    tags: inputs.tags ? (Array.isArray(inputs.tags) ? inputs.tags : [inputs.tags]) : [],
                    components: [] as any[],
                    events: [] as any[]
                }
            }
        })

        const events = eventNodes.map((node) => {
            const nodeData = node.data || {}
            const inputs = nodeData.inputs || {}
            return {
                id: node.id,
                data: {
                    eventType: inputs.eventType || 'generic',
                    source: inputs.source,
                    actions: [] as any[]
                }
            }
        })

        const actions = actionNodes.map((node) => {
            const nodeData = node.data || {}
            const inputs = nodeData.inputs || {}
            return {
                id: node.id,
                data: {
                    actionType: inputs.actionType || 'custom',
                    target: inputs.target,
                    params: inputs.params || {}
                }
            }
        })

        // Map edges to attach components and actions
        const entityMap = new Map(entities.map((e) => [e.id, e]))
        const componentMap = new Map(components.map((c) => [c.id, c]))
        const eventMap = new Map(events.map((ev) => [ev.id, ev]))
        const actionMap = new Map(actions.map((a) => [a.id, a]))

        edges.forEach((edge) => {
            const sourceId = edge.source
            const targetId = edge.target
            if (componentMap.has(sourceId) && entityMap.has(targetId)) {
                const ent = entityMap.get(targetId)!
                ent.data.components.push(componentMap.get(sourceId)!)
            } else if (eventMap.has(sourceId) && entityMap.has(targetId)) {
                const ent = entityMap.get(targetId)!
                ent.data.events.push(eventMap.get(sourceId)!)
            } else if (actionMap.has(sourceId) && eventMap.has(targetId)) {
                const ev = eventMap.get(targetId)!
                ev.data.actions.push(actionMap.get(sourceId)!)
            }
        })

        const universo = universoNodes.map((node) => ({ id: node.id, data: node.data }))

        return {
            id: spaceNode.id,
            name: spaceData.label || 'UPDL Space',
            objects,
            cameras,
            lights,
            datas,
            entities,
            components,
            events,
            actions,
            universo,
            showPoints: spaceData.inputs?.showPoints || false,
            leadCollection: {
                collectName: spaceData.inputs?.collectLeadName || false,
                collectEmail: spaceData.inputs?.collectLeadEmail || false,
                collectPhone: spaceData.inputs?.collectLeadPhone || false
            }
        }
    }

    /**
     * Main method to process flow data from API
     * Analyzes nodes and returns UPDL structure
     */
    static processFlowData(flowDataString: string): {
        updlSpace?: IUPDLSpace
        multiScene?: IUPDLMultiScene
    } {
        try {
            const parsedFlowData = JSON.parse(flowDataString)
            const nodes = parsedFlowData.nodes || []
            const edges = parsedFlowData.edges || []

            console.log(`[UPDLProcessor] Processing flow with ${nodes.length} nodes and ${edges.length} edges`)

            // Check for multi-scene structure
            const multiScene = this.analyzeSpaceChain(nodes, edges)

            if (multiScene) {
                console.log(`[UPDLProcessor] Multi-scene detected: ${multiScene.totalScenes} scenes`)
                return { multiScene }
            } else {
                // Build single UPDL space
                const updlSpace = this.buildUPDLSpaceFromNodes(nodes, edges) as IUPDLSpace
                console.log(
                    `[UPDLProcessor] Single space built: ${updlSpace.entities?.length || 0} entities, ${updlSpace.objects.length} objects`
                )
                return { updlSpace }
            }
        } catch (error) {
            console.error('[UPDLProcessor] Error processing flow data:', error)
            throw error
        }
    }
}
