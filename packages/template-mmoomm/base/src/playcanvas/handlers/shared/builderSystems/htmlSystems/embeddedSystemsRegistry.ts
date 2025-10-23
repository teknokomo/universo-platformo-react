// Universo Platformo | MMOOMM Embedded Systems Registry
// Manages embedded JavaScript systems injection into HTML

/**
 * Interface for embedded system components
 */
export interface IEmbeddedSystem {
    name: string
    generateCode(): string
    getDependencies(): string[]
}

/**
 * Interface for embedded systems registry
 */
export interface IEmbeddedSystemsRegistry {
    registerSystem(system: IEmbeddedSystem): void
    unregisterSystem(name: string): void
    generateAllSystems(): string
    generateSystem(name: string): string
    getSystemDependencies(name: string): string[]
    validateDependencies(): boolean
    getRegisteredSystems(): string[]
    getInjectionOrder(): string[]
    setInjectionOrder(order: string[]): void
}

/**
 * Registry for managing embedded JavaScript systems
 * Handles injection order and dependencies
 */
export class EmbeddedSystemsRegistry implements IEmbeddedSystemsRegistry {
    private systems: Map<string, IEmbeddedSystem> = new Map()
    private injectionOrder: string[] = []

    /**
     * Register an embedded system
     */
    registerSystem(system: IEmbeddedSystem): void {
        this.systems.set(system.name, system)
        
        // Add to injection order if not already present
        if (!this.injectionOrder.includes(system.name)) {
            this.injectionOrder.push(system.name)
        }
    }

    /**
     * Unregister an embedded system
     */
    unregisterSystem(name: string): void {
        this.systems.delete(name)
        const index = this.injectionOrder.indexOf(name)
        if (index > -1) {
            this.injectionOrder.splice(index, 1)
        }
    }

    /**
     * Generate code for all registered systems
     */
    generateAllSystems(): string {
        const systemCodes: string[] = []
        
        for (const systemName of this.injectionOrder) {
            const system = this.systems.get(systemName)
            if (system) {
                systemCodes.push(`        // ${system.name} System`)
                systemCodes.push(system.generateCode())
                systemCodes.push('')
            }
        }
        
        return systemCodes.join('\n')
    }

    /**
     * Generate code for specific system
     */
    generateSystem(name: string): string {
        const system = this.systems.get(name)
        if (!system) {
            throw new Error(`System '${name}' not found in registry`)
        }
        return system.generateCode()
    }

    /**
     * Get dependencies for specific system
     */
    getSystemDependencies(name: string): string[] {
        const system = this.systems.get(name)
        if (!system) {
            return []
        }
        return system.getDependencies()
    }

    /**
     * Validate all system dependencies
     */
    validateDependencies(): boolean {
        for (const [name, system] of this.systems) {
            const dependencies = system.getDependencies()
            
            for (const dep of dependencies) {
                if (!this.systems.has(dep)) {
                    console.warn(`[EmbeddedSystemsRegistry] System '${name}' depends on missing system '${dep}'`)
                    return false
                }
            }
        }
        return true
    }

    /**
     * Set custom injection order
     */
    setInjectionOrder(order: string[]): void {
        // Validate that all systems in order are registered
        for (const systemName of order) {
            if (!this.systems.has(systemName)) {
                throw new Error(`Cannot set injection order: system '${systemName}' not registered`)
            }
        }
        this.injectionOrder = [...order]
    }

    /**
     * Get current injection order
     */
    getInjectionOrder(): string[] {
        return [...this.injectionOrder]
    }

    /**
     * Get all registered system names
     */
    getRegisteredSystems(): string[] {
        return Array.from(this.systems.keys())
    }

    /**
     * Clear all registered systems
     */
    clear(): void {
        this.systems.clear()
        this.injectionOrder = []
    }
}
