export interface SeqState {
    lastSeq: number;
}
export declare function updateSeqState(state: SeqState, incomingSeq: number): {
    ok: boolean;
    expectedNext: number;
};
export declare function reconcileAck(lastAckSeq: number, intentsBuffer: {
    seq: number;
}[]): {
    confirmedSeq: number;
    unconfirmed: {
        seq: number;
    }[];
};
