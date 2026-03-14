#!/usr/bin/env node

/**
 * lint-db-access.mjs — Enforces the Unified Database Access Standard.
 *
 * Zero-violation policy: no baseline, no exceptions.
 * Domain packages must not import Knex directly, use KnexClient, or
 * interpolate identifiers in SQL strings.
 *
 * Usage: node tools/lint-db-access.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, sep } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')

const DOMAIN_PACKAGES = [
    'packages/metahubs-backend/base/src',
    'packages/applications-backend/base/src',
    'packages/admin-backend/base/src',
    'packages/profile-backend/base/src',
    'packages/auth-backend/base/src',
    'packages/start-backend/base/src'
]

// Path patterns to exclude (legitimate Tier 3 infrastructure)
const EXCLUDED_PATTERNS = [
    // auth-backend: ensureAuthWithRls middleware legitimately uses getKnex() for RLS
    /packages\/auth-backend\/.*\/middlewares\//,
    // metahubs-backend DDL subsystem: legitimate Knex usage for DDL
    /packages\/metahubs-backend\/.*\/domains\/ddl\//,
    /packages\/metahubs-backend\/.*\/services\/SystemTableDDLGenerator\.ts$/,
    /packages\/metahubs-backend\/.*\/services\/SystemTableMigrator\.ts$/,
    /packages\/metahubs-backend\/.*\/services\/structureVersions\.ts$/,
    // metahubs-backend template seed subsystem: Knex-based seed/migration flow via MetahubSchemaService
    /packages\/metahubs-backend\/.*\/templates\/services\//,
    // MetahubSchemaService: DDL orchestrator using Knex for advisory locks, migration recording, seed flow
    /packages\/metahubs-backend\/.*\/services\/MetahubSchemaService\.ts$/,
    // MetahubBranchesService: uses Knex for advisory locks during branch create/delete
    /packages\/metahubs-backend\/.*\/services\/MetahubBranchesService\.ts$/,
    // metahubs-backend DDL-adjacent services: build SQL descriptors / index SQL, not executable interpolation
    /packages\/metahubs-backend\/.*\/services\/systemTableDefinitions\.ts$/,
    /packages\/metahubs-backend\/.*\/services\/systemTableDiff\.ts$/,
    // metahubs-backend platform migration seed files: Tier 3 Knex-based migrations
    /packages\/metahubs-backend\/.*\/platform\/migrations\//,
    // applications-backend DDL boundary: legitimate Knex usage for schema sync/runtime metadata orchestration
    /packages\/applications-backend\/.*\/ddl\//
]

const RULES = [
    {
        name: 'no-knex-import',
        pattern: /import\s+(?:type\s+)?(?:\{[^}]*\}|[\w*]+)\s+from\s+['"]knex['"]/,
        message: 'Domain code must not import from \'knex\' — use @universo/database or @universo/utils/database contracts'
    },
    {
        name: 'no-knex-client-singleton',
        pattern: /KnexClient\.getInstance\(\)/,
        message: 'KnexClient.getInstance() is banned — use getPoolExecutor() from @universo/database'
    },
    {
        name: 'no-knex-client-import',
        pattern: /import\s+(?:type\s+)?(?:\{[^}]*\}|[\w*]+)\s+from\s+['"].*KnexClient['"]/,
        message: 'KnexClient import is banned — wrapper has been removed'
    },
    {
        name: 'no-get-knex-in-domain',
        pattern: /\bgetKnex\s*\(/,
        message: 'getKnex() in domain code is banned — use getPoolExecutor() from @universo/database'
    },
    {
        name: 'no-unsafe-schema-table-interpolation',
        pattern: /`[^`]*"\$\{[^}]+\}"\s*\.\s*"\$\{[^}]+\}"[^`]*`/,
        message: 'Unsafe schema.table interpolation — use qSchemaTable() from @universo/database'
    },
    {
        name: 'no-unsafe-identifier-in-sql',
        pattern: /(?:^|[\s(])(?:SELECT|FROM|JOIN|INTO|UPDATE|DELETE\s+FROM|WHERE|SET|INSERT|CREATE|ALTER|DROP)\s+[^`]*"\$\{/i,
        message: 'Unsafe identifier interpolation in SQL — use qSchemaTable()/qColumn() from @universo/database'
    }
]

function isExcluded(filePath) {
    return EXCLUDED_PATTERNS.some((pattern) => pattern.test(filePath))
}

function walkDir(dir) {
    const files = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__' || entry.name === 'tests') continue
            files.push(...walkDir(fullPath))
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
            files.push(fullPath)
        }
    }
    return files
}

let totalViolations = 0
const violations = []

for (const pkgDir of DOMAIN_PACKAGES) {
    const absDir = join(ROOT, pkgDir)
    try {
        statSync(absDir)
    } catch {
        continue
    }

    const files = walkDir(absDir)

    for (const filePath of files) {
        const relPath = relative(ROOT, filePath)

        if (isExcluded(relPath)) continue

        const content = readFileSync(filePath, 'utf-8')
        const lines = content.split('\n')

        for (let i = 0; i < lines.length; i++) {
            for (const rule of RULES) {
                if (rule.pattern.test(lines[i])) {
                    violations.push({
                        file: relPath,
                        line: i + 1,
                        rule: rule.name,
                        message: rule.message,
                        code: lines[i].trim()
                    })
                    totalViolations++
                }
            }
        }
    }
}

if (totalViolations === 0) {
    console.log('✅ lint-db-access: 0 violations — all domain packages follow the unified standard.')
    process.exit(0)
} else {
    console.error(`❌ lint-db-access: ${totalViolations} violation(s) found:\n`)
    for (const v of violations) {
        console.error(`  ${v.file}:${v.line} [${v.rule}]`)
        console.error(`    ${v.message}`)
        console.error(`    > ${v.code}\n`)
    }
    process.exit(1)
}
