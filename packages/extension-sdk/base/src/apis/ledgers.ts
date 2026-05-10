export interface LedgerFactInput {
    data: Record<string, unknown>
}

export interface LedgerQueryOptions {
    filters?: Record<string, unknown>
    limit?: number
    offset?: number
}

export interface LedgerListOptions {
    limit?: number
    offset?: number
}

export interface ExtensionLedgerApi {
    list(): Promise<unknown[]>
    facts(ledgerCodename: string, options?: LedgerListOptions): Promise<unknown>
    query(ledgerCodename: string, projectionCodename: string, options?: LedgerQueryOptions): Promise<unknown>
    append(ledgerCodename: string, facts: LedgerFactInput[]): Promise<unknown>
    reverse(ledgerCodename: string, factIds: string[]): Promise<unknown>
}
