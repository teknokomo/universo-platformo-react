export interface Cluster {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
}

export interface Domain {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
}

export interface Resource {
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