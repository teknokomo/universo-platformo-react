export interface StateAPI {
    get<TValue = unknown>(key: string): Promise<TValue | null>
    set(key: string, value: unknown): Promise<void>
    delete(key: string): Promise<void>
}
