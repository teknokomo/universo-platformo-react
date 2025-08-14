"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSeqState = updateSeqState;
exports.reconcileAck = reconcileAck;
function updateSeqState(state, incomingSeq) {
    const expectedNext = state.lastSeq + 1;
    const ok = incomingSeq === expectedNext;
    if (ok)
        state.lastSeq = incomingSeq;
    return { ok, expectedNext };
}
function reconcileAck(lastAckSeq, intentsBuffer) {
    const confirmedSeq = Math.max(lastAckSeq, 0);
    const unconfirmed = intentsBuffer.filter((i) => i.seq > confirmedSeq);
    return { confirmedSeq, unconfirmed };
}
//# sourceMappingURL=sequencing.js.map