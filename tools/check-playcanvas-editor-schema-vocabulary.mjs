#!/usr/bin/env node

// PlayCanvas Editor schema-keyword vocabulary gate.
//
// Since upstream v2.30.3 the vendored editor consumes a versioned JSON-Schema
// catalog (`{ version: 1, documents, assetData }`) and reads custom keywords
// exclusively through `src/editor-api/schema.ts`. This gate fails closed when
// either:
//   1. the tagged source consumes a custom `x-*` keyword this repository does
//      not model yet (the Universo catalog builder must learn it first), or
//   2. the tagged source still reads legacy `$`-prefixed keywords, which the
//      Universo catalog intentionally never emits.
//
// Run as part of the vendor import verification chain after every Editor
// upgrade.

import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SCHEMA_FILE = path.join(ROOT, 'packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/src/editor-api/schema.ts')

const SUPPORTED_CUSTOM_KEYWORDS = new Set(['x-editor-type', 'x-merge-method', 'x-scope', 'x-open-map'])

const fail = (message) => {
    console.error(`[check:playcanvas-editor-schema-vocabulary] FAIL: ${message}`)
    process.exit(1)
}

let schemaSource
try {
    schemaSource = readFileSync(SCHEMA_FILE, 'utf8')
} catch {
    fail(`tagged schema consumer not found at ${path.relative(ROOT, SCHEMA_FILE)}`)
}

const bracketAccesses = [...schemaSource.matchAll(/\[\s*'(x-[a-z][a-z0-9-]*)'\s*\]/g)].map((match) => match[1])
const dotAccesses = [...schemaSource.matchAll(/\bfield\.(x-[a-z][a-z0-9-]*)\b/g)].map((match) => match[1])
const consumedCustomKeywords = new Set([...bracketAccesses, ...dotAccesses])

const unknownKeywords = [...consumedCustomKeywords].filter((keyword) => !SUPPORTED_CUSTOM_KEYWORDS.has(keyword))
if (unknownKeywords.length > 0) {
    fail(
        `tagged editor consumes unsupported custom keyword(s): ${unknownKeywords.join(', ')}. ` +
            `Extend the Universo schema catalog builder and ${path.basename(__filename)} whitelist together.`
    )
}

const legacyKeywordAccesses = [...schemaSource.matchAll(/\[\s*'\$[a-zA-Z][a-zA-Z0-9]*'\s*\]/g)].map((match) => match[0])
if (legacyKeywordAccesses.length > 0) {
    fail(`tagged editor still reads legacy $-keywords (${legacyKeywordAccesses.slice(0, 5).join(', ')}…)`)
}

console.log(
    `[check:playcanvas-editor-schema-vocabulary] OK: consumed custom keywords=[${[...consumedCustomKeywords]
        .sort()
        .join(', ')}], no legacy $-keywords.`
)
process.exit(0)
