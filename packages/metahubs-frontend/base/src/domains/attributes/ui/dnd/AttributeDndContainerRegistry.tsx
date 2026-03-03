import React, { createContext, useCallback, useContext, useState } from 'react'
import type { Attribute } from '../../../../types'

export interface ContainerEntry {
    id: string
    parentAttributeId: string | null
    items: Attribute[]
}

interface ContainerRegistryValue {
    containers: ContainerEntry[]
    register: (entry: ContainerEntry) => void
    unregister: (id: string) => void
}

const AttributeDndContainerRegistryContext = createContext<ContainerRegistryValue | null>(null)

export const AttributeDndContainerRegistryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
        <AttributeDndContainerRegistryContext.Provider value={{ containers, register, unregister }}>
            {children}
        </AttributeDndContainerRegistryContext.Provider>
    )
}

export function useContainerRegistry() {
    const ctx = useContext(AttributeDndContainerRegistryContext)
    if (!ctx) throw new Error('useContainerRegistry must be inside AttributeDndContainerRegistryProvider')
    return ctx
}

export function useRegisteredContainers(): ContainerEntry[] {
    const { containers } = useContainerRegistry()
    return containers
}
