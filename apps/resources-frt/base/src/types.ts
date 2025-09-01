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
}

export interface Revision {
    id: string
    version: string
}

export interface TreeNode {
    resource: Resource
    children?: { child: TreeNode }[]
}

export type UseApi = <T>(
    apiFunc: (...args: any[]) => Promise<{ data: T }>
) => {
    data: T | null
    error: any
    loading: boolean
    request: (...args: any[]) => Promise<void>
}
