import { describe, expect, it } from 'vitest'
import {
    PLAYCANVAS_EDITOR_PIPELINE_REPLAY_MAX_ENTRIES,
    PLAYCANVAS_EDITOR_PIPELINE_REPLAY_TTL_MS,
    claimPipelineReplay,
    completePipelineReplay,
    createPipelineReplayFingerprint,
    getPipelineReplayRegistrySize
} from './pipelineReplay'

describe('realtime pipeline replay protection', () => {
    it('serializes an in-flight job and replays its terminal result', () => {
        const scope = {}
        const payload = { job_id: 'job-1', asset_id: 700001, parse_result: { scripts: { Pilot: { speed: 2 } } } }
        const fingerprint = createPipelineReplayFingerprint(payload)

        expect(claimPipelineReplay(scope, 'job-1', fingerprint, 1)).toEqual({ kind: 'process' })
        expect(claimPipelineReplay(scope, 'job-1', fingerprint, 2)).toEqual({ kind: 'inFlight' })
        expect(completePipelineReplay(scope, 'job-1', fingerprint, { ok: true }, 3)).toBe(true)
        expect(claimPipelineReplay(scope, 'job-1', fingerprint, 4)).toEqual({ kind: 'completed', result: { ok: true } })
    })

    it('rejects a same-id retry with a different payload', () => {
        const scope = {}
        const firstFingerprint = createPipelineReplayFingerprint({ job_id: 'job-2', asset_id: 700001 })
        const secondFingerprint = createPipelineReplayFingerprint({ job_id: 'job-2', asset_id: 700002 })

        expect(claimPipelineReplay(scope, 'job-2', firstFingerprint)).toEqual({ kind: 'process' })
        expect(claimPipelineReplay(scope, 'job-2', secondFingerprint)).toEqual({ kind: 'conflict' })
    })

    it('expires completed entries and bounds the registry without evicting in-flight work', () => {
        const scope = {}
        const firstFingerprint = createPipelineReplayFingerprint({ job_id: 'expiring' })
        expect(claimPipelineReplay(scope, 'expiring', firstFingerprint, 10)).toEqual({ kind: 'process' })
        expect(completePipelineReplay(scope, 'expiring', firstFingerprint, { ok: false, code: 'pipelineFailed' }, 10)).toBe(true)
        expect(claimPipelineReplay(scope, 'expiring', firstFingerprint, 10 + PLAYCANVAS_EDITOR_PIPELINE_REPLAY_TTL_MS + 1)).toEqual({
            kind: 'process'
        })

        const boundedScope = {}
        const inFlightFingerprint = createPipelineReplayFingerprint({ job_id: 'in-flight' })
        expect(claimPipelineReplay(boundedScope, 'in-flight', inFlightFingerprint, 20)).toEqual({ kind: 'process' })
        for (let index = 0; index < PLAYCANVAS_EDITOR_PIPELINE_REPLAY_MAX_ENTRIES; index += 1) {
            const jobId = `completed-${index}`
            const fingerprint = createPipelineReplayFingerprint({ jobId })
            expect(claimPipelineReplay(boundedScope, jobId, fingerprint, 20)).toEqual({ kind: 'process' })
            expect(completePipelineReplay(boundedScope, jobId, fingerprint, { ok: true }, 20)).toBe(true)
        }
        expect(getPipelineReplayRegistrySize(boundedScope)).toBe(PLAYCANVAS_EDITOR_PIPELINE_REPLAY_MAX_ENTRIES)
        expect(claimPipelineReplay(boundedScope, 'new-job', createPipelineReplayFingerprint({ job_id: 'new-job' }), 20)).toEqual({
            kind: 'process'
        })
        expect(claimPipelineReplay(boundedScope, 'in-flight', inFlightFingerprint, 20)).toEqual({ kind: 'inFlight' })
        expect(getPipelineReplayRegistrySize(boundedScope)).toBe(PLAYCANVAS_EDITOR_PIPELINE_REPLAY_MAX_ENTRIES)
    })
})
