export interface SeqState {
    lastSeq: number
}

export function updateSeqState(state: SeqState, incomingSeq: number) {
    const expectedNext = state.lastSeq + 1
    const ok = incomingSeq === expectedNext
    if (ok) state.lastSeq = incomingSeq
    return { ok, expectedNext }
}

export function reconcileAck(lastAckSeq: number, intentsBuffer: { seq: number }[]) {
    const confirmedSeq = Math.max(lastAckSeq, 0)
    const unconfirmed = intentsBuffer.filter((i) => i.seq > confirmedSeq)
    return { confirmedSeq, unconfirmed }
}
