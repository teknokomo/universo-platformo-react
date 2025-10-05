export interface Metaverse {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    // Optional aggregated counters provided by backend list endpoint
    sectionsCount?: number
    entitiesCount?: number
}

export interface Section {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
}

export interface Entity {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
}

export type UseApi = <T, TArgs extends any[] = any[]>(
    apiFunc: (...args: TArgs) => Promise<{ data: T }>
) => {
    data: T | null
    error: any
    loading: boolean
    request: (...args: TArgs) => Promise<T | null>
}
