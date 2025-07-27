// Universo Platformo | MMOOMM Global Objects Manager
// Manages window.* objects lifecycle and dependencies

/**
 * Interface for global object definition
 */
export interface IGlobalObject {
    name: string
    type: 'object' | 'function' | 'primitive'
    dependencies: string[]
    generateCode(): string
    getInitializationCode?(): string
}

/**
 * Interface for global objects manager
 */
export interface IGlobalObjectsManager {
    registerGlobalObject(globalObject: IGlobalObject): void
    unregisterGlobalObject(name: string): void
    generateInitializationCode(): string
    generateGlobalObject(name: string): string
    validateDependencies(): boolean
    getInitializationOrder(): string[]
    setInitializationOrder(order: string[]): void
    getRegisteredObjects(): string[]
    hasGlobalObject(name: string): boolean
}

/**
 * Manager for window.* global objects lifecycle
 * Ensures proper creation order and dependency management
 */
export class GlobalObjectsManager implements IGlobalObjectsManager {
    private globalObjects: Map<string, IGlobalObject> = new Map()
    private initializationOrder: string[] = []

    /**
     * Register a global object
     */
    registerGlobalObject(globalObject: IGlobalObject): void {
        this.globalObjects.set(globalObject.name, globalObject)
        
        // Add to initialization order if not already present
        if (!this.initializationOrder.includes(globalObject.name)) {
            this.initializationOrder.push(globalObject.name)
        }
    }

    /**
     * Unregister a global object
     */
    unregisterGlobalObject(name: string): void {
        this.globalObjects.delete(name)
        const index = this.initializationOrder.indexOf(name)
        if (index > -1) {
            this.initializationOrder.splice(index, 1)
        }
    }

    /**
     * Generate initialization code for all global objects
     */
    generateInitializationCode(): string {
        const initCodes: string[] = []
        
        for (const objectName of this.initializationOrder) {
            const globalObject = this.globalObjects.get(objectName)
            if (globalObject) {
                initCodes.push(`// Initialize window.${objectName}`)
                
                if (globalObject.getInitializationCode) {
                    initCodes.push(globalObject.getInitializationCode())
                } else {
                    initCodes.push(globalObject.generateCode())
                }
                
                initCodes.push('')
            }
        }
        
        return initCodes.join('\n')
    }

    /**
     * Generate code for specific global object
     */
    generateGlobalObject(name: string): string {
        const globalObject = this.globalObjects.get(name)
        if (!globalObject) {
            throw new Error(`Global object '${name}' not found`)
        }
        return globalObject.generateCode()
    }

    /**
     * Validate all global object dependencies
     */
    validateDependencies(): boolean {
        for (const [name, globalObject] of this.globalObjects) {
            const dependencies = globalObject.dependencies
            
            for (const dep of dependencies) {
                if (!this.globalObjects.has(dep)) {
                    console.warn(`[GlobalObjectsManager] Global object '${name}' depends on missing object '${dep}'`)
                    return false
                }
            }
        }
        return true
    }

    /**
     * Get current initialization order
     */
    getInitializationOrder(): string[] {
        return [...this.initializationOrder]
    }

    /**
     * Set custom initialization order
     */
    setInitializationOrder(order: string[]): void {
        // Validate that all objects in order are registered
        for (const objectName of order) {
            if (!this.globalObjects.has(objectName)) {
                throw new Error(`Cannot set initialization order: global object '${objectName}' not registered`)
            }
        }
        this.initializationOrder = [...order]
    }

    /**
     * Get all registered global object names
     */
    getRegisteredObjects(): string[] {
        return Array.from(this.globalObjects.keys())
    }

    /**
     * Check if global object is registered
     */
    hasGlobalObject(name: string): boolean {
        return this.globalObjects.has(name)
    }

    /**
     * Clear all registered global objects
     */
    clear(): void {
        this.globalObjects.clear()
        this.initializationOrder = []
    }

    /**
     * Generate dependency graph for debugging
     */
    generateDependencyGraph(): Record<string, string[]> {
        const graph: Record<string, string[]> = {}
        
        for (const [name, globalObject] of this.globalObjects) {
            graph[name] = globalObject.dependencies
        }
        
        return graph
    }

    /**
     * Resolve initialization order based on dependencies
     */
    resolveInitializationOrder(): string[] {
        const resolved: string[] = []
        const visiting: Set<string> = new Set()
        const visited: Set<string> = new Set()

        const visit = (name: string): void => {
            if (visited.has(name)) return
            if (visiting.has(name)) {
                throw new Error(`Circular dependency detected involving '${name}'`)
            }

            visiting.add(name)
            
            const globalObject = this.globalObjects.get(name)
            if (globalObject) {
                for (const dep of globalObject.dependencies) {
                    if (this.globalObjects.has(dep)) {
                        visit(dep)
                    }
                }
            }

            visiting.delete(name)
            visited.add(name)
            resolved.push(name)
        }

        for (const name of this.globalObjects.keys()) {
            visit(name)
        }

        return resolved
    }

    /**
     * Auto-resolve and set initialization order based on dependencies
     */
    autoResolveInitializationOrder(): void {
        try {
            const resolvedOrder = this.resolveInitializationOrder()
            this.initializationOrder = resolvedOrder
        } catch (error) {
            console.error('[GlobalObjectsManager] Failed to auto-resolve initialization order:', error)
            throw error
        }
    }
}
