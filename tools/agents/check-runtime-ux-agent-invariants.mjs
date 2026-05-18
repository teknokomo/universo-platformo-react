#!/usr/bin/env node
/* eslint-disable no-console */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()

const skillEvaluationFiles = [
    '.agents/skills/mui-runtime-ux-patterns/references/evaluation.md',
    '.agents/skills/runtime-ux-qa/references/evaluation.md'
]

const reviewerFiles = [
    '.agents/agent-profiles/plan-ux-reviewer.md',
    '.agents/agent-profiles/mui-runtime-reviewer.md',
    '.agents/agent-profiles/runtime-ux-qa.md',
    '.agents/agent-profiles/test-oracle-reviewer.md',
    '.agents/agent-profiles/a11y-responsive-reviewer.md',
    '.codex/agents/plan-ux-reviewer.toml',
    '.codex/agents/mui-runtime-reviewer.toml',
    '.codex/agents/runtime-ux-qa.toml',
    '.codex/agents/test-oracle-reviewer.toml',
    '.codex/agents/a11y-responsive-reviewer.toml',
    '.gemini/agents/plan-ux-reviewer.md',
    '.gemini/agents/mui-runtime-reviewer.md',
    '.gemini/agents/runtime-ux-qa.md',
    '.gemini/agents/test-oracle-reviewer.md',
    '.gemini/agents/a11y-responsive-reviewer.md',
    '.claude/agents/plan-ux-reviewer.md',
    '.claude/agents/mui-runtime-reviewer.md',
    '.claude/agents/runtime-ux-qa.md',
    '.claude/agents/test-oracle-reviewer.md',
    '.claude/agents/a11y-responsive-reviewer.md',
    '.github/agents/plan-ux-reviewer.agent.md',
    '.github/agents/mui-runtime-reviewer.agent.md',
    '.github/agents/runtime-ux-qa.agent.md',
    '.github/agents/test-oracle-reviewer.agent.md',
    '.github/agents/a11y-responsive-reviewer.agent.md',
    '.qoder/agents/plan-ux-reviewer.md',
    '.qoder/agents/mui-runtime-reviewer.md',
    '.qoder/agents/runtime-ux-qa.md',
    '.qoder/agents/test-oracle-reviewer.md',
    '.qoder/agents/a11y-responsive-reviewer.md',
    '.kiro/steering/agent_profiles/plan-ux-reviewer.md',
    '.kiro/steering/agent_profiles/mui-runtime-reviewer.md',
    '.kiro/steering/agent_profiles/runtime-ux-qa.md',
    '.kiro/steering/agent_profiles/test-oracle-reviewer.md',
    '.kiro/steering/agent_profiles/a11y-responsive-reviewer.md'
]

const modeFiles = [
    'AGENTS.md',
    '.gemini/GEMINI.md',
    '.gemini/rules/custom_modes/plan_mode.md',
    '.gemini/rules/custom_modes/implement_mode.md',
    '.gemini/rules/custom_modes/qa_mode.md',
    '.claude/agents/plan.md',
    '.claude/agents/implement.md',
    '.claude/agents/qa.md',
    '.github/agents/plan.agent.md',
    '.github/agents/implement.agent.md',
    '.github/agents/qa.agent.md',
    '.qoder/agents/plan.md',
    '.qoder/agents/implement.md',
    '.qoder/agents/qa.md',
    '.kiro/steering/custom_modes/plan_mode.md',
    '.kiro/steering/custom_modes/implement_mode.md',
    '.kiro/steering/custom_modes/qa_mode.md'
]

const viewportMatrixFiles = [
    '.agents/skills/runtime-ux-qa/references/playwright-ux-oracles.md',
    'tools/testing/e2e/support/browser/runtimeUx.ts',
    'docs/en/contributing/runtime-ui-ux-quality-gate.md',
    'docs/ru/contributing/runtime-ui-ux-quality-gate.md'
]

const viewportMatrixUsageFiles = ['tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts']

const reviewerInvariants = [
    ['no raw user-facing IDs', /raw user-facing ids|raw owner\/user\/reference ids|raw ids|hidden ids/i],
    ['no raw JSON or object cells', /raw json|object cells|\[object object\]/i],
    ['multiline long-text fields', /multiline long-text fields|long-text fields are multiline|multiline controls/i],
    [
        'localized validation',
        /localized validation|validation is localized|validation messages are localized|localized and user-facing|untranslated\/internal validation/i
    ],
    ['no page-level horizontal overflow', /page-level horizontal overflow/i],
    ['reuse existing MUI dashboard primitives', /existing mui dashboard primitives|mui dashboard\/app-template primitives|one-off ui/i],
    ['browser evidence', /browser.*evidence|screenshots/i],
    ['normal-user verdict', /normal user|normal-user|user can complete|user-hostile runtime ui/i]
]

const modeInvariants = [
    ['Runtime UI UX Quality Gate', /runtime ui ux quality gate/i],
    ['raw user-facing IDs', /raw.*ids/i],
    ['raw JSON or object cells', /raw json|object cells/i],
    ['multiline long text', /multiline|long text|long-text/i],
    ['browser evidence', /browser.*evidence|responsive proof|ux oracles/i]
]

const viewportMatrixInvariants = [
    ['shared viewport matrix helper', /expectRuntimeUxViewportMatrix/],
    ['wide desktop viewport', /1920\D+1080|1920x1080/i],
    ['tablet viewport', /768\D+1024|768x1024/i],
    ['mobile viewport', /390\D+844|390x844/i]
]

const unsafePatterns = [
    ['destructive command', /\brm\s+-rf\b|\bgit\s+reset\s+--hard\b|\bgit\s+checkout\s+--\b/i],
    ['secret handling', /copy.*secret|exfiltrat|paste.*token|api[_-]?key/i],
    ['approval bypass', /bypass approval|ignore approval|skip approval/i],
    ['broad write permission', /tools:\s*.*\b(Write|Edit|MultiEdit)\b/i]
]

const readFile = (relativePath) => {
    const fullPath = path.join(repoRoot, relativePath)
    if (!fs.existsSync(fullPath)) {
        return { ok: false, text: '', error: `${relativePath}: missing file` }
    }
    return { ok: true, text: fs.readFileSync(fullPath, 'utf8'), error: null }
}

const errors = []

for (const relativePath of skillEvaluationFiles) {
    const file = readFile(relativePath)
    if (!file.ok) {
        errors.push(file.error)
        continue
    }
    for (const [label, pattern] of [
        ['should-trigger fixture', /should trigger/i],
        ['should-not-trigger fixture', /should not trigger/i],
        ['bad fixture', /bad\s+.*fixture/i],
        ['expected outcome', /expected/i]
    ]) {
        if (!pattern.test(file.text)) {
            errors.push(`${relativePath}: missing ${label}`)
        }
    }
}

for (const relativePath of reviewerFiles) {
    const file = readFile(relativePath)
    if (!file.ok) {
        errors.push(file.error)
        continue
    }
    const lower = file.text.toLowerCase()
    if (/read\s+`?\.agents\/agent-profiles/i.test(file.text) && file.text.length < 800) {
        errors.push(`${relativePath}: appears to be a link-only wrapper`)
    }
    for (const [label, pattern] of reviewerInvariants) {
        if (!pattern.test(lower)) {
            errors.push(`${relativePath}: missing invariant "${label}"`)
        }
    }
    for (const [label, pattern] of unsafePatterns) {
        if (pattern.test(file.text)) {
            errors.push(`${relativePath}: contains unsafe pattern "${label}"`)
        }
    }
}

for (const relativePath of modeFiles) {
    const file = readFile(relativePath)
    if (!file.ok) {
        errors.push(file.error)
        continue
    }
    for (const [label, pattern] of modeInvariants) {
        if (!pattern.test(file.text)) {
            errors.push(`${relativePath}: missing mode invariant "${label}"`)
        }
    }
}

for (const relativePath of viewportMatrixFiles) {
    const file = readFile(relativePath)
    if (!file.ok) {
        errors.push(file.error)
        continue
    }
    for (const [label, pattern] of viewportMatrixInvariants) {
        if (!pattern.test(file.text)) {
            errors.push(`${relativePath}: missing viewport matrix invariant "${label}"`)
        }
    }
}

for (const relativePath of viewportMatrixUsageFiles) {
    const file = readFile(relativePath)
    if (!file.ok) {
        errors.push(file.error)
        continue
    }
    if (!/expectRuntimeUxViewportMatrix/.test(file.text)) {
        errors.push(`${relativePath}: missing shared viewport matrix helper usage`)
    }
}

if (errors.length > 0) {
    console.error(`Runtime UX agent invariant check failed with ${errors.length} issue(s):`)
    for (const error of errors) {
        console.error(`- ${error}`)
    }
    process.exit(1)
}

console.log('Runtime UX agent invariant check passed.')
