// Comments in English only.
// Hermetic suite: never requires the real OntoIndex binary. The runner takes
// injectable deps (spawnSync/log/warn), so we assert behavior without mocking
// modules or touching the filesystem/PATH.
import { describe, it, expect, vi } from 'vitest'
import { run, PINNED_VERSION, BINARY } from '../run-ontoindex.mjs'

// Build a fake spawnSync whose two calls (probe + forward) are scripted.
function makeSpawn({ probe, forward }) {
    const calls = []
    const spawnSync = vi.fn((bin, args, opts) => {
        calls.push({ bin, args, opts })
        // First call is the `--version` probe, second is the forwarded command.
        return calls.length === 1 ? probe : forward
    })
    return { spawnSync, calls }
}

function collector() {
    const lines = []
    return { fn: (msg) => lines.push(String(msg)), lines }
}

describe('run-ontoindex wrapper', () => {
    it('exits 127 with an install hint when the binary is missing', () => {
        const { spawnSync, calls } = makeSpawn({ probe: { status: 1, error: new Error('ENOENT') } })
        const log = collector()
        const code = run(['analyze'], { spawnSync, log: log.fn, warn: () => {} })

        expect(code).toBe(127)
        expect(calls).toHaveLength(1) // never forwards when the probe fails
        expect(log.lines.join('\n')).toContain('OntoIndex CLI not found on PATH')
        expect(log.lines.join('\n')).toContain(PINNED_VERSION)
    })

    it('warns on version mismatch but still forwards the command', () => {
        const { spawnSync } = makeSpawn({
            probe: { status: 0, stdout: '1.8.0\n' },
            forward: { status: 0 }
        })
        const warn = collector()
        const code = run(['status'], { spawnSync, log: () => {}, warn: warn.fn })

        expect(code).toBe(0)
        expect(warn.lines.join('\n')).toContain('differs from pinned')
    })

    it('forwards the exact argv array unchanged and returns the child exit code', () => {
        const { spawnSync, calls } = makeSpawn({
            probe: { status: 0, stdout: `${PINNED_VERSION}\n` },
            forward: { status: 3 }
        })
        const code = run(['impact', 'validateUser', '--depth', '2'], { spawnSync, log: () => {}, warn: () => {} })

        expect(code).toBe(3)
        const forwardCall = calls[1]
        expect(forwardCall.bin).toBe(BINARY)
        expect(forwardCall.args).toEqual(['impact', 'validateUser', '--depth', '2'])
        // shell is enabled only on Windows (to launch the .cmd shim); false elsewhere.
        expect(forwardCall.opts.shell ?? false).toBe(process.platform === 'win32')
    })

    it('defaults to the safe `status` verb when no args are given', () => {
        const { spawnSync, calls } = makeSpawn({
            probe: { status: 0, stdout: `${PINNED_VERSION}\n` },
            forward: { status: 0 }
        })
        const code = run([], { spawnSync, log: () => {}, warn: () => {} })

        expect(code).toBe(0)
        expect(calls[1].args).toEqual(['status'])
    })

    it('passes a shell-metacharacter arg as one literal element (no shell interpretation)', () => {
        const { spawnSync, calls } = makeSpawn({
            probe: { status: 0, stdout: `${PINNED_VERSION}\n` },
            forward: { status: 0 }
        })
        const malicious = '; rm -rf /'
        run(['query', malicious], { spawnSync, log: () => {}, warn: () => {} })

        const forwardCall = calls[1]
        expect(forwardCall.args).toEqual(['query', malicious]) // verbatim, not split
        expect(forwardCall.opts.shell ?? false).toBe(process.platform === 'win32')
    })

    it('returns 1 and reports when the forwarded launch errors', () => {
        const { spawnSync } = makeSpawn({
            probe: { status: 0, stdout: `${PINNED_VERSION}\n` },
            forward: { error: new Error('spawn failed') }
        })
        const log = collector()
        const code = run(['analyze'], { spawnSync, log: log.fn, warn: () => {} })

        expect(code).toBe(1)
        expect(log.lines.join('\n')).toContain('Failed to launch OntoIndex')
    })

    it('returns 1 when the child is terminated by a signal (status null)', () => {
        const { spawnSync } = makeSpawn({
            probe: { status: 0, stdout: `${PINNED_VERSION}\n` },
            forward: { status: null, signal: 'SIGTERM' }
        })
        const warn = collector()
        const code = run(['analyze'], { spawnSync, log: () => {}, warn: warn.fn })

        expect(code).toBe(1)
        expect(warn.lines.join('\n')).toContain('SIGTERM')
    })
})
