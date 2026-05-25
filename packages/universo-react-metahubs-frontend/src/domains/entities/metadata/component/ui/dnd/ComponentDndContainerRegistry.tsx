import React, { createContext, useCallback, useContext, useState } from 'react'
import type { Component } from '../../../../../../types'

export interface ContainerEntry {
    id: string
    parentComponentId: string | null
    items: Component[]
}

interface ContainerRegistryValue {
    containers: ContainerEntry[]
    register: (entry: ContainerEntry) => void
    unregister: (id: string) => void
}

const ComponentDndContainerRegistryContext = createContext<ContainerRegistryValue | null>(null)

export const ComponentDndContainerRegistryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
        <ComponentDndContainerRegistryContext.Provider value={{ containers, register, unregister }}>
            {children}
        </ComponentDndContainerRegistryContext.Provider>
    )
}

export function useContainerRegistry() {
    const ctx = useContext(ComponentDndContainerRegistryContext)
    if (!ctx) throw new Error('useContainerRegistry must be inside ComponentDndContainerRegistryProvider')
    return ctx
}

export function useRegisteredContainers(): ContainerEntry[] {
    const { containers } = useContainerRegistry()
    return containers
}
