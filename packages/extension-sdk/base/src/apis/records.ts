export interface RecordFilterInput {
    limit?: number
    offset?: number
    [key: string]: unknown
}

export interface ExtensionRecordApi {
    list(entityCodename: string, filters?: RecordFilterInput): Promise<unknown[]>
    get(entityCodename: string, recordId: string): Promise<unknown | null>
    findByCodename(entityCodename: string, codename: string): Promise<unknown | null>
    create(entityCodename: string, data: Record<string, unknown>): Promise<unknown>
    update(entityCodename: string, recordId: string, patch: Record<string, unknown>): Promise<unknown>
    delete(entityCodename: string, recordId: string): Promise<void>
}
