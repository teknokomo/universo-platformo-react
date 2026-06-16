#!/usr/bin/env node
/* eslint-disable no-console */
// Comments in English only.
// Thin, safe launcher for the locally-installed OntoIndex CLI.
// Phase A: developer/agent code-intelligence only. No network, no secrets.
//
// Uses only Node built-ins (no added dependency), consistent with sibling
// tools/*.mjs. spawnSync is always called with shell:false and an argv array,
// so an argument can never be interpreted by a shell (no injection surface).
// On Windows the global npm bin is a `.cmd` shim, so the binary name is resolved
// per platform; non-Windows uses the bare name.
import { spawnSync as nodeSpawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

// Keep in sync with:
//   .agents/skills/ontoindex-code-intelligence/SKILL.md (metadata.version)
//   .agents/skills/SOURCES.md (ledger row)
export const PINNED_VERSION = '1.9.10'

export const BINARY = process.platform === 'win32' ? 'ontoindex.cmd' : 'ontoindex'
const INSTALL_URL = `https://github.com/ontograph/ontoindex/releases/download/v${PINNED_VERSION}/ontoindex-${PINNED_VERSION}.tgz`

// Exported for unit testing; returns the process exit code instead of calling
// process.exit, so the suite can assert behavior without tearing down the runner.
export function run(argv, deps = {}) {
    const spawnSync = deps.spawnSync ?? nodeSpawnSync
    const log = deps.log ?? console.error
    const warn = deps.warn ?? console.warn

    // argv passthrough; default to a safe read-only verb when none is given.
    const forwarded = argv.length > 0 ? argv : ['status']

    // Probe the binary first so a missing tool produces a friendly hint instead
    // of an opaque spawn error.
    const probe = spawnSync(BINARY, ['--version'], { encoding: 'utf8' })
    if (probe.error || probe.status !== 0) {
        log(
            [
                'OntoIndex CLI not found on PATH.',
                `Install the pinned version (${PINNED_VERSION}) per the contributor docs:`,
                '  docs/en/contributing/ontoindex-code-intelligence.md',
                'Quick install:',
                `  npm install -g ${INSTALL_URL}`
            ].join('\n')
        )
        return 127
    }

    const installed = (probe.stdout || '').trim()
    if (installed && !installed.includes(PINNED_VERSION)) {
        // Advisory only: pinning is a guideline for a local dev tool, not a block.
        warn(`Warning: OntoIndex ${installed} differs from pinned ${PINNED_VERSION}.`)
    }

    // Forward verbatim. shell is never enabled, so an arg like "; rm -rf /" is a
    // single argv element and can never be interpreted by a shell.
    const result = spawnSync(BINARY, forwarded, { stdio: 'inherit' })
    if (result.error) {
        log(`Failed to launch OntoIndex: ${result.error.message}`)
        return 1
    }
    if (typeof result.status === 'number') return result.status
    // Child terminated by signal (status === null): surface a conventional code.
    if (result.signal) {
        warn(`OntoIndex terminated by signal ${result.signal}.`)
        return 1
    }
    return 1
}

// Only execute when invoked directly (not when imported by the test suite).
// pathToFileURL handles Windows drive paths correctly, unlike string concat.
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) {
    process.exit(run(process.argv.slice(2)))
}
