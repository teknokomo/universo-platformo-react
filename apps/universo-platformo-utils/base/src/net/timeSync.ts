import type { TimeSyncSample, TimeSyncState } from '@universo-platformo/types'

export function createTimeSyncEstimator(windowSize = 20, emaAlpha = 0.2) {
    const samples: TimeSyncSample[] = []
    let state: TimeSyncState = { offsetMs: 0, rttMs: 0, jitterMs: 0 }

    const compute = () => {
        const last = samples[samples.length - 1]
        if (!last) return
        const { tClientSendMs: tCs, tServerRecvMs: tSr, tServerSendMs: tSs, tClientRecvMs: tCr } = last
        const rtt = (tCr - tCs) - (tSs - tSr)
        const offset = ((tSr - tCs) + (tSs - tCr)) / 2
        state.rttMs = state.rttMs ? state.rttMs * (1 - emaAlpha) + rtt * emaAlpha : rtt
        const prevOffset = state.offsetMs || offset
        state.offsetMs = prevOffset * (1 - emaAlpha) + offset * emaAlpha
        state.jitterMs = Math.abs(offset - prevOffset)
    }

    return {
        addSample(sample: TimeSyncSample) {
            samples.push(sample)
            if (samples.length > windowSize) samples.shift()
            compute()
        },
        getState(): TimeSyncState {
            return { ...state }
        }
    }
}
