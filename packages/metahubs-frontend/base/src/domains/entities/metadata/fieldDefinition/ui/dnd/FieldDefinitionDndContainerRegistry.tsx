import React, { createContext, useCallback, useContext, useState } from 'react'
import type { FieldDefinition } from '../../../../../../types'

export interface ContainerEntry {
    id: string
    parentAttributeId: string | null
    items: FieldDefinition[]
}

interface ContainerRegistryValue {
    containers: ContainerEntry[]
    register: (entry: ContainerEntry) => void
    unregister: (id: string) => void
}

const FieldDefinitionDndContainerRegistryContext = createContext<ContainerRegistryValue | null>(null)

export const FieldDefinitionDndContainerRegistryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [containers, setContainers] = useState<ContainerEntry[]>([])

    const register = useCallback((entry: ContainerEntry) => {
        setContainers((prev) => {
            const filtered = prev.filter((c) => c.id !== entry.id)
            return [...filtered, entry]
        })
    }, [])

    const unregister = useCallback((id: string) => {
        setContainers((prev) => prev.filter((c) => c.id !== id))
    }, [])

    return (
        <FieldDefinitionDndContainerRegistryContext.Provider value={{ containers, register, unregister }}>
            {children}
        </FieldDefinitionDndContainerRegistryContext.Provider>
    )
}

export function useContainerRegistry() {
    const ctx = useContext(FieldDefinitionDndContainerRegistryContext)
    if (!ctx) throw new Error('useContainerRegistry must be inside FieldDefinitionDndContainerRegistryProvider')
    return ctx
}

export function useRegisteredContainers(): ContainerEntry[] {
    const { containers } = useContainerRegistry()
    return containers
}
