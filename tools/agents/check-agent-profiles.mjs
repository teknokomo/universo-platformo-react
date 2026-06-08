#!/usr/bin/env node
/* eslint-disable no-console */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()

const sharedProfiles = [
    'playcanvas-editor-reviewer.md',
    'thermo-nuclear-review.md',
    'thermo-nuclear-code-quality-review.md',
    'thermos-orchestrator.md'
]

const runtimes = [
    { dir: '.codex/agents', ext: '.toml', format: 'toml' },
    { dir: '.gemini/agents', ext: '.md', format: 'markdown' },
    { dir: '.claude/agents', ext: '.md', format: 'markdown' },
    { dir: '.github/agents', ext: '.agent.md', format: 'markdown' },
    { dir: '.qoder/agents', ext: '.md', format: 'markdown' },
    { dir: '.kiro/steering/agent_profiles', ext: '.md', format: 'markdown' }
]

const profileInvariants = {
    'playcanvas-editor-reviewer.md': [
        /playcanvas[- ]editor[- ]reviewer/i,
        /script lifecycle/i,
        /asset management|assets/i,
        /scene operations|scenes/i,
        /version control/i
    ],
    'thermo-nuclear-review.md': [
        /thermo[- ]nuclear[- ]reviewer|thermo[- ]nuclear[- ]review/i,
        /uuid/i,
        /sql/i,
        /origin/i
    ],
    'thermo-nuclear-code-quality-review.md': [
        /thermo[- ]nuclear[- ]code[- ]quality[- ]reviewer|thermo[- ]nuclear[- ]code[- ]quality[- ]review/i,
        /file.*complexity|file.*size|functions|modularity/i,
        /circular/i,
        /test/i
    ],
    'thermos-orchestrator.md': [
        /thermos[- ]orchestrator|thermos comprehensive review/i,
        /coordination|synthesize/i,
        /verdict/i,
        /synthesis|findings/i
    ]
}

const unsafePatterns = [
    ['destructive command', /\brm\s+-rf\b|\bgit\s+reset\s+--hard\b|\bgit\s+checkout\s+--\b/i],
    ['secret handling', /copy.*secret|exfiltrat|paste.*token|api[_-]?key/i],
    ['approval bypass', /bypass approval|ignore approval|skip approval/i]
]

const errors = []

const readFile = (relativePath) => {
    const fullPath = path.join(repoRoot, relativePath)
    if (!fs.existsSync(fullPath)) {
        return { ok: false, text: '', error: `${relativePath}: missing file` }
    }
    return { ok: true, text: fs.readFileSync(fullPath, 'utf8'), error: null }
}

// 1. Verify Shared Profiles
console.log('Checking shared profiles...')
for (const profile of sharedProfiles) {
    const relativePath = path.join('.agents/agent-profiles', profile)
    const file = readFile(relativePath)
    if (!file.ok) {
        errors.push(file.error)
        continue
    }

    const invariants = profileInvariants[profile] || []
    for (const pattern of invariants) {
        if (!pattern.test(file.text)) {
            errors.push(`${relativePath}: missing invariant matching ${pattern}`)
        }
    }
}

// 2. Verify Runtime Copies
console.log('Checking runtime copies...')
for (const profile of sharedProfiles) {
    const baseName = profile.replace('.md', '')
    const invariants = profileInvariants[profile] || []

    for (const runtime of runtimes) {
        const runtimeFileName = `${baseName}${runtime.ext}`
        const relativePath = path.join(runtime.dir, runtimeFileName)
        const file = readFile(relativePath)

        if (!file.ok) {
            errors.push(file.error)
            continue
        }

        // Check invariants
        for (const pattern of invariants) {
            if (!pattern.test(file.text)) {
                errors.push(`${relativePath}: missing invariant matching ${pattern}`)
            }
        }

        // Check unsafe patterns
        for (const [label, pattern] of unsafePatterns) {
            if (pattern.test(file.text)) {
                errors.push(`${relativePath}: contains unsafe pattern "${label}"`)
            }
        }
    }
}

if (errors.length > 0) {
    console.error(`Agent profile drift check failed with ${errors.length} issue(s):`)
    for (const error of errors) {
        console.error(`- ${error}`)
    }
    process.exit(1)
}

console.log('Agent profile drift check passed successfully.')
process.exit(0)
