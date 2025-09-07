export interface Category {
    id: string
    titleEn: string
    titleRu: string
    parentCategory?: { id: string }
    children?: Category[]
}

export interface Resource {
    id: string
    titleEn: string
    titleRu: string
    category?: { id: string }
    state?: { id: string }
    storageType?: { id: string }
}

export interface State {
    id: string
    code: string
    label: string
}

export interface StorageType {
    id: string
    code: string
    label: string
}

export interface Revision {
    id: string
    version: string
}

export interface TreeNode {
    resource: Resource
    children?: { child: TreeNode }[]
}

export type UseApi = <T>(apiFunc: (...args: any[]) => Promise<{ data: T }>) => {
    data: T | null
    error: unknown
    loading: boolean
    request: (...args: any[]) => Promise<void>
}
