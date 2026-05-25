export interface TimeSyncSample {
    tClientSendMs: number
    tServerRecvMs: number
    tServerSendMs: number
    tClientRecvMs: number
}

export interface TimeSyncState {
    offsetMs: number
    rttMs: number
    jitterMs?: number
}
