// Universo Platformo | UPDL Processor
// Centralized UPDL processing logic for all packages

import {
    IUPDLPosition,
    IUPDLRotation,
    IUPDLObject,
    IUPDLCamera,
    IUPDLLight,
    IUPDLData,
    IUPDLSpace,
    IUPDLScene,
    IUPDLMultiScene,
    IReactFlowNode,
    IReactFlowEdge,
    UpIntentType
} from '@universo/types'

/**
 * UPDL Processor for handling UPDL node processing
 * Centralized version combining logic from all previous implementations
 */
export class UPDLProcessor {
    /**
     * Check if the node is a UPDL node
     * @param node - React Flow node to check
     * @returns true if the node is a UPDL node
     */
    static isUPDLNode(node: IReactFlowNode): boolean {
        const nodeData = node.data || {}
        return (
            nodeData.category === 'UPDL' ||
            ['space', 'object', 'camera', 'light', 'data', 'entity', 'component', 'event', 'action', 'universo'].includes(
                (nodeData.name || '').toLowerCase()
            )
        )
    }

    /**
     * Get the ending nodes of the UPDL chain
     * @param nodeDependencies - Node dependencies map
     * @param graph - Graph structure
     * @param allNodes - All nodes in the flow
     * @returns Array of ending UPDL nodes
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
     * @param nodes - All nodes in the flow
     * @param edges - All edges in the flow
     * @returns Multi-scene structure or null for single space
     */
    static analyzeSpaceChain(nodes: IReactFlowNode[], edges: IReactFlowEdge[]): IUPDLMultiScene | null {
        // Find all Space nodes
        const spaceNodes = nodes.filter((node) => node.data?.name?.toLowerCase() === 'space')

        // If only one Space, return null (use legacy single space processing)
        if (spaceNodes.length <= 1) {
            console.log('[UPDLProcessor] Single space detected, using legacy processing')
            return null
        }

        // Space nodes analysis - detailed logs disabled for production

        // Build edge map for Space connections
        const spaceEdgeMap = new Map<string, string>()
        const incomingConnections = new Set<string>()

        edges.forEach((edge) => {
            const sourceNode = nodes.find((n) => n.id === edge.source)
            const targetNode = nodes.find((n) => n.id === edge.target)

            if (sourceNode?.data?.name?.toLowerCase() === 'space' && targetNode?.data?.name?.toLowerCase() === 'space') {
                spaceEdgeMap.set(edge.source, edge.target)
                incomingConnections.add(edge.target)
            }
        })

        // Find root space (no incoming connections)
        const rootSpaces = spaceNodes.filter((space) => !incomingConnections.has(space.id))

        if (rootSpaces.length === 0) {
            console.log('[UPDLProcessor] No root space found, using legacy processing')
            return null
        }

        // Build scene chain starting from root
        const scenes: IUPDLScene[] = []
        let currentSpaceId: string | undefined = rootSpaces[0].id
        let order = 0

        while (currentSpaceId) {
            const spaceNode = spaceNodes.find((s) => s.id === currentSpaceId)
            if (!spaceNode) break

            // Get connected nodes for this space (excluding Data nodes)
            const connectedNodes = this.getConnectedNodes(currentSpaceId, nodes, edges)
            const objectNodes = connectedNodes.filter((n) => n.data?.name?.toLowerCase() === 'object')
            const entityNodes = connectedNodes.filter((n) => n.data?.name?.toLowerCase() === 'entity')
            const componentNodes = connectedNodes.filter((n) => n.data?.name?.toLowerCase() === 'component')
            const eventNodes = connectedNodes.filter((n) => n.data?.name?.toLowerCase() === 'event')
            const actionNodes = connectedNodes.filter((n) => n.data?.name?.toLowerCase() === 'action')

            // Get Data nodes separately using original backup logic
            const dataNodes = this.getConnectedDataNodes(currentSpaceId, nodes, edges)

            // Process entities with their components (using edge relationships)
            const entities = entityNodes.map((node) => this.convertNodeToUPDLEntity(node))
            const components = componentNodes.map((node) => this.convertNodeToUPDLComponent(node))
            const events = eventNodes.map((node) => this.convertNodeToUPDLEvent(node))
            const actions = actionNodes.map((node) => this.convertNodeToUPDLAction(node))

            // Apply edge relationships for this scene (filter edges to only include nodes in this scene)
            const entityMap = new Map(entities.map((e) => [e.id, e]))
            const componentMap = new Map(components.map((c) => [c.id, c]))
            const eventMap = new Map(events.map((ev) => [ev.id, ev]))
            const actionMap = new Map(actions.map((a) => [a.id, a]))

            // Get all node IDs that belong to this scene
            const sceneNodeIds = new Set(connectedNodes.map(n => n.id))

            // Filter edges to only include those connecting nodes within this scene
            const sceneEdges = edges.filter(edge =>
                sceneNodeIds.has(edge.source) && sceneNodeIds.has(edge.target)
            )

            // Scene edge processing - detailed logs disabled for production

            sceneEdges.forEach((edge) => {
                const sourceId = edge.source
                const targetId = edge.target

                // Attach components to entities
                if (componentMap.has(sourceId) && entityMap.has(targetId)) {
                    const entity = entityMap.get(targetId)!
                    const component = componentMap.get(sourceId)!
                    entity.components.push(component)
                    console.log(`[UPDLProcessor] Scene ${currentSpaceId}: Attached component ${component.componentType} to entity ${entity.id}`)
                }
                // Attach events to entities
                else if (eventMap.has(sourceId) && entityMap.has(targetId)) {
                    const entity = entityMap.get(targetId)!
                    const event = eventMap.get(sourceId)!
                    entity.events.push(event)
                }
                // Attach actions to events
                else if (actionMap.has(sourceId) && eventMap.has(targetId)) {
                    const event = eventMap.get(targetId)!
                    const action = actionMap.get(sourceId)!
                    if (!event.actions) event.actions = []
                    event.actions.push(action)
                }
            })

            const nextSpaceId = spaceEdgeMap.get(currentSpaceId)
            const isLast = !nextSpaceId

            const spaceInputs = (spaceNode.data && spaceNode.data.inputs) || {}
            const toBool = (v: any): boolean => v === true || v === 'true' || v === 1 || v === '1'
            scenes.push({
                spaceId: currentSpaceId,
                spaceData: {
                    ...spaceNode.data,
                    entities,
                    components,
                    events,
                    actions,
                    // Unified fields for AR.js quiz template consumption
                    showPoints: toBool(spaceInputs.showPoints),
                    leadCollection: {
                        // Support both new and legacy field names
                        collectName: toBool(spaceInputs.collectName ?? spaceInputs.collectLeadName),
                        collectEmail: toBool(spaceInputs.collectEmail ?? spaceInputs.collectLeadEmail),
                        collectPhone: toBool(spaceInputs.collectPhone ?? spaceInputs.collectLeadPhone)
                    }
                },
                dataNodes: dataNodes.map((n) => this.convertNodeToUPDLData(n)),
                objectNodes: objectNodes.map((n) => this.convertNodeToUPDLObject(n)),
                nextSceneId: nextSpaceId,
                isLast,
                order,
                isResultsScene: false
            })

            currentSpaceId = nextSpaceId
            order++
        }

        if (scenes.length > 1) {
            // Ensure final results scene exists: add empty results scene at the end
            const lastIndex = scenes.length - 1
            if (!scenes[lastIndex].isResultsScene) {
                scenes[lastIndex].isLast = false
                scenes.push({
                    spaceId: `${scenes[lastIndex].spaceId}-results`,
                    spaceData: { ...scenes[lastIndex].spaceData },
                    dataNodes: [],
                    objectNodes: [],
                    nextSceneId: undefined,
                    isLast: true,
                    order: scenes[lastIndex].order + 1,
                    isResultsScene: true
                } as any)
            }

            return {
                scenes,
                currentSceneIndex: 0,
                totalScenes: scenes.length,
                isCompleted: false
            }
        }

        return null
    }

    /**
     * Get Data nodes connected to a specific space (using original backup logic)
     * @param spaceId - ID of the space node
     * @param nodes - All nodes in the flow
     * @param edges - All edges in the flow
     * @returns Array of connected Data nodes only
     */
    static getConnectedDataNodes(spaceId: string, nodes: IReactFlowNode[], edges: IReactFlowEdge[]): IReactFlowNode[] {
        // 1) Find Data nodes directly connected to this Space
        const directDataNodes = nodes.filter((node) => {
            if (node.data?.name?.toLowerCase() !== 'data') return false
            return edges.some((edge) => edge.target === spaceId && edge.source === node.id)
        })

        // 2) Find all related Data nodes (including answers connected to questions)
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

        const result = Array.from(allRelatedDataNodes)
        console.log(`[UPDLProcessor] Space ${spaceId}: Found ${result.length} connected data nodes (${result.map(n => `${n.id}:${n.data?.inputs?.dataType}`).join(', ')})`)
        return result
    }

    /**
     * Get all nodes connected to a space (directly or indirectly)
     * Uses transitive search to include components connected to entities
     * @param spaceId - ID of the space node
     * @param nodes - All nodes in the flow
     * @param edges - All edges in the flow
     * @returns Array of connected nodes
     */
    static getConnectedNodes(spaceId: string, nodes: IReactFlowNode[], edges: IReactFlowEdge[]): IReactFlowNode[] {
        // 1) Direct predecessors of the Space (do NOT traverse through other Spaces)
        const directIds = new Set<string>()
        edges.forEach((edge) => {
            if (edge.target === spaceId) {
                directIds.add(edge.source)
            }
        })

        // 2) Limited expansion for relationships within a scene
        const expandIds = new Set<string>(directIds)

        // 2a) Entity graph: Entity <- Component/Event <- Action
        nodes.forEach((node) => {
            const nodeType = node.data?.name?.toLowerCase()
            if (nodeType === 'component' || nodeType === 'event') {
                const hasEdgeToEntity = edges.some(e => e.source === node.id && expandIds.has(e.target))
                if (hasEdgeToEntity) expandIds.add(node.id)
            }
        })
        nodes.forEach((node) => {
            const nodeType = node.data?.name?.toLowerCase()
            if (nodeType === 'action') {
                const hasEdgeToEvent = edges.some(e => e.source === node.id && expandIds.has(e.target))
                if (hasEdgeToEvent) expandIds.add(node.id)
            }
        })

        // 3) Filter out Space and Data nodes from results (Data handled separately)
        const result = nodes.filter((node) => {
            const nodeType = node.data?.name?.toLowerCase()
            return expandIds.has(node.id) && nodeType !== 'space' && nodeType !== 'data'
        })
        // Connected nodes analysis - detailed logs disabled for production
        return result
    }

    /**
     * Convert React Flow node to UPDL Data
     * @param node - React Flow node
     * @returns UPDL Data object
     */
    static convertNodeToUPDLData(node: IReactFlowNode): IUPDLData {
        const inputs = node.data?.inputs || {}
        return {
            id: node.id,
            name: inputs.name || node.data?.label || 'Unnamed Data',
            dataType: inputs.dataType || 'Question',
            content: inputs.content || '',
            isCorrect: inputs.isCorrect || false,
            nextSpace: inputs.nextSpace,
            objects: inputs.objects || [],
            enablePoints: inputs.enablePoints || false,
            pointsValue: inputs.pointsValue || 0,
            metadata: {
                difficulty: inputs.difficulty || 1,
                tags: inputs.tags || []
            }
        }
    }

    /**
     * Convert React Flow node to UPDL Object
     * @param node - React Flow node
     * @returns UPDL Object
     */
    static convertNodeToUPDLObject(node: IReactFlowNode): IUPDLObject {
        const inputs = node.data?.inputs || {}
        return {
            id: node.id,
            name: inputs.name || node.data?.label || 'Unnamed Object',
            type: inputs.primitive || inputs.type || 'box',
            position: inputs.position || { x: 0, y: 0, z: 0 },
            rotation: inputs.rotation || { x: 0, y: 0, z: 0 },
            scale: inputs.scale || { x: 1, y: 1, z: 1 },
            color: inputs.color || '#ffffff',
            primitive: inputs.primitive,
            visible: inputs.visible !== false
        }
    }

    /**
     * Main method to process flow data from API
     * Analyzes nodes and returns UPDL structure
     * @param flowDataString - JSON string containing flow data
     * @returns Object with either updlSpace or multiScene
     */
    static processFlowData(flowDataString: string): {
        updlSpace?: IUPDLSpace
        multiScene?: IUPDLMultiScene
    } {
        try {
            const parsedFlowData = JSON.parse(flowDataString)
            const nodes = parsedFlowData.nodes || []
            const edges = parsedFlowData.edges || []

            // Processing flow - detailed logs disabled for production

            // Check for multi-scene structure
            const multiScene = this.analyzeSpaceChain(nodes, edges)

            if (multiScene) {
                console.log(`[UPDLProcessor] Multi-scene detected: ${multiScene.totalScenes} scenes`)
                return { multiScene }
            } else {
                // Build single UPDL space
                const updlSpace = this.buildUPDLSpaceFromNodes(nodes, edges)
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

    /**
     * Build UPDL Space from nodes and edges
     * @param nodes - All nodes in the flow
     * @param edges - All edges in the flow
     * @returns UPDL Space object
     */
    static buildUPDLSpaceFromNodes(nodes: IReactFlowNode[], edges: IReactFlowEdge[]): IUPDLSpace {
        // Find Space node
        const spaceNode = nodes.find((node) => node.data?.name?.toLowerCase() === 'space')
        const spaceInputs = spaceNode?.data?.inputs || {}

        // Get all UPDL nodes
        const updlNodes = nodes.filter((node) => this.isUPDLNode(node))

        // Separate nodes by type
        const objectNodes = updlNodes.filter((node) => node.data?.name?.toLowerCase() === 'object')
        const cameraNodes = updlNodes.filter((node) => node.data?.name?.toLowerCase() === 'camera')
        const lightNodes = updlNodes.filter((node) => node.data?.name?.toLowerCase() === 'light')
        const dataNodes = updlNodes.filter((node) => node.data?.name?.toLowerCase() === 'data')
        const entityNodes = updlNodes.filter((node) => node.data?.name?.toLowerCase() === 'entity')
        const componentNodes = updlNodes.filter((node) => node.data?.name?.toLowerCase() === 'component')
        const eventNodes = updlNodes.filter((node) => node.data?.name?.toLowerCase() === 'event')
        const actionNodes = updlNodes.filter((node) => node.data?.name?.toLowerCase() === 'action')
        const universoNodes = updlNodes.filter((node) => node.data?.name?.toLowerCase() === 'universo')

        // Convert nodes to UPDL objects
        const objects = objectNodes.map((node) => this.convertNodeToUPDLObject(node))
        const cameras = cameraNodes.map((node) => this.convertNodeToUPDLCamera(node))
        const lights = lightNodes.map((node) => this.convertNodeToUPDLLight(node))
        const datas = dataNodes.map((node) => this.convertNodeToUPDLData(node))
        const entities = entityNodes.map((node) => this.convertNodeToUPDLEntity(node))
        const components = componentNodes.map((node) => this.convertNodeToUPDLComponent(node))
        const events = eventNodes.map((node) => this.convertNodeToUPDLEvent(node))
        const actions = actionNodes.map((node) => this.convertNodeToUPDLAction(node))
        const universo = universoNodes.map((node) => node.data)

        // CRITICAL FIX: Process edges to attach components to entities
        // This was missing in the centralized version but existed in backup
        const entityMap = new Map(entities.map((e) => [e.id, e]))
        const componentMap = new Map(components.map((c) => [c.id, c]))
        const eventMap = new Map(events.map((ev) => [ev.id, ev]))
        const actionMap = new Map(actions.map((a) => [a.id, a]))

        console.log(`[UPDLProcessor] Processing ${edges.length} edges for entity-component relationships`)

        edges.forEach((edge) => {
            const sourceId = edge.source
            const targetId = edge.target

            // Attach components to entities
            if (componentMap.has(sourceId) && entityMap.has(targetId)) {
                const entity = entityMap.get(targetId)!
                const component = componentMap.get(sourceId)!
                entity.components.push(component)
                console.log(`[UPDLProcessor] Attached component ${component.componentType} to entity ${entity.id} (${entity.entityType})`)
            }
            // Attach events to entities
            else if (eventMap.has(sourceId) && entityMap.has(targetId)) {
                const entity = entityMap.get(targetId)!
                const event = eventMap.get(sourceId)!
                entity.events.push(event)
                console.log(`[UPDLProcessor] Attached event ${event.eventType} to entity ${entity.id}`)
            }
            // Attach actions to events
            else if (actionMap.has(sourceId) && eventMap.has(targetId)) {
                const event = eventMap.get(targetId)!
                const action = actionMap.get(sourceId)!
                if (!event.actions) event.actions = []
                event.actions.push(action)
                console.log(`[UPDLProcessor] Attached action ${action.actionType} to event ${event.id}`)
            }
        })

        // Log final entity-component relationships
        entities.forEach((entity) => {
            if (entity.components.length > 0) {
                console.log(`[UPDLProcessor] Entity ${entity.id} (${entity.entityType}) has ${entity.components.length} components:`,
                    entity.components.map((c: any) => c.componentType))
            }
        })

        return {
            id: spaceNode?.id || 'default-space',
            name: spaceInputs.name || spaceNode?.data?.label || 'Unnamed Space',
            spaceType: spaceInputs.spaceType || 'default',
            isRootNode: spaceInputs.isRootNode || false,
            description: spaceInputs.description || '',
            objects,
            cameras,
            lights,
            datas,
            entities,
            components,
            events,
            actions,
            universo,
            showPoints: spaceInputs.showPoints || false,
            leadCollection: {
                collectName: spaceInputs.collectName || false,
                collectEmail: spaceInputs.collectEmail || false,
                collectPhone: spaceInputs.collectPhone || false
            },
            settings: {
                background: spaceInputs.background || '#000000',
                fog: spaceInputs.fog,
                physics: spaceInputs.physics
            }
        }
    }

    /**
     * Convert React Flow node to UPDL Camera
     * @param node - React Flow node
     * @returns UPDL Camera object
     */
    static convertNodeToUPDLCamera(node: IReactFlowNode): IUPDLCamera {
        const inputs = node.data?.inputs || {}
        return {
            id: node.id,
            name: inputs.name || node.data?.label || 'Unnamed Camera',
            type: 'camera',
            position: inputs.position || { x: 0, y: 0, z: 5 },
            rotation: inputs.rotation || { x: 0, y: 0, z: 0 },
            scale: inputs.scale || { x: 1, y: 1, z: 1 },
            fov: inputs.fov || 75,
            near: inputs.near || 0.1,
            far: inputs.far || 1000
        }
    }

    /**
     * Convert React Flow node to UPDL Light
     * @param node - React Flow node
     * @returns UPDL Light object
     */
    static convertNodeToUPDLLight(node: IReactFlowNode): IUPDLLight {
        const inputs = node.data?.inputs || {}
        return {
            id: node.id,
            name: inputs.name || node.data?.label || 'Unnamed Light',
            type: inputs.lightType || 'directional',
            position: inputs.position || { x: 0, y: 10, z: 0 },
            rotation: inputs.rotation || { x: 0, y: 0, z: 0 },
            scale: inputs.scale || { x: 1, y: 1, z: 1 },
            color: inputs.color ? { r: inputs.color.r || 1, g: inputs.color.g || 1, b: inputs.color.b || 1 } : undefined,
            intensity: inputs.intensity || 1,
            distance: inputs.distance,
            decay: inputs.decay
        }
    }

    /**
     * Convert React Flow node to UPDL Entity
     * @param node - React Flow node
     * @returns UPDL Entity object
     */
    static convertNodeToUPDLEntity(node: IReactFlowNode): any {
        const inputs = node.data?.inputs || {}

        // Parse transform from JSON string or object (like in backup)
        let transform: any = {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
        }

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

        // Parse tags from string or array
        let tags: string[] = []
        if (inputs.tags) {
            if (typeof inputs.tags === 'string') {
                tags = inputs.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean)
            } else if (Array.isArray(inputs.tags)) {
                tags = inputs.tags
            }
        }

        return {
            id: node.id,
            name: inputs.name || node.data?.label || 'Unnamed Entity',
            entityType: inputs.entityType || 'default',
            transform,
            tags,
            components: [], // Will be populated by edge processing
            events: [] // Will be populated by edge processing
        }
    }

    /**
     * Convert React Flow node to UPDL Component
     * @param node - React Flow node
     * @returns UPDL Component object
     */
    static convertNodeToUPDLComponent(node: IReactFlowNode): any {
        const inputs = node.data?.inputs || {}
        const componentType = inputs.componentType || 'default'

        // Parse props if string to keep compatibility with UI
        let props: any = inputs.props
        try {
            if (typeof props === 'string') props = JSON.parse(props)
        } catch {
            // keep as is
        }

        const base: any = {
            id: node.id,
            componentType,
            primitive: inputs.primitive,
            color: inputs.color,
            scriptName: inputs.scriptName,
            props: props || {}
        }

        // Attach component-type specific fields on TOP-LEVEL (new unified format)
        switch (String(componentType).toLowerCase()) {
            case 'inventory':
                base.maxCapacity = Number(inputs.maxCapacity) || 20
                base.currentLoad = Number(inputs.currentLoad) || 0
                break
            case 'weapon':
                base.fireRate = Number(inputs.fireRate) || 2
                base.damage = Number(inputs.damage) || 1
                break
            case 'trading':
                base.pricePerTon = Number(inputs.pricePerTon) || 10
                base.interactionRange = Number(inputs.interactionRange) || 15
                break
            case 'mineable':
                base.resourceType = inputs.resourceType || 'asteroidMass'
                base.maxYield = Number(inputs.maxYield) || 3
                break
            case 'portal':
                base.targetWorld = inputs.targetWorld || 'konkordo'
                base.cooldownTime = Number(inputs.cooldownTime) || 2000
                break
            default:
                break
        }

        return base
    }

    /**
     * Convert React Flow node to UPDL Event
     * @param node - React Flow node
     * @returns UPDL Event object
     */
    static convertNodeToUPDLEvent(node: IReactFlowNode): any {
        const inputs = node.data?.inputs || {}
        return {
            id: node.id,
            eventType: inputs.eventType || 'click',
            source: inputs.source,
            actions: inputs.actions || []
        }
    }

    /**
     * Convert React Flow node to UPDL Action
     * @param node - React Flow node
     * @returns UPDL Action object
     */
    static convertNodeToUPDLAction(node: IReactFlowNode): any {
        const inputs = node.data?.inputs || {}
        return {
            id: node.id,
            actionType: inputs.actionType || 'default',
            target: inputs.target,
            params: inputs.params || {}
        }
    }
}
