export interface Owner {
    id: string
    userId: string
    role: string
    isPrimary: boolean
}

export interface Entity {
    id: string
    titleEn: string
    titleRu: string
    templateId: string
    statusId: string
    owners?: Owner[]
}

export interface Template {
    id: string
    name: string
}

export interface Status {
    id: string
    name: string
}

export type UseApi = <T, TArgs extends any[]>(
    apiFunc: (...args: TArgs) => Promise<{ data: T }>
) => {
    data: T | null
    error: unknown
    loading: boolean
    request: (...args: TArgs) => Promise<void>
}
