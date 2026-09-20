#!/usr/bin/env node

/**
 * check-i18n-coverage.mjs — Enforces translation bundle key coverage.
 *
 * Zero-violation policy: no baseline, no exceptions.
 *
 * For every configured package the check verifies that:
 *  1. every literal `t('key')` / `tc('key')` callsite in src/ resolves through
 *     the package's consolidated namespace, the shared i18next fallback
 *     namespaces (`common`, `header`, `spaces`) or an explicit `namespace:key`
 *     reference — matching the runtime consolidation exactly, including plural
 *     suffixed entries when the callsite passes `count`;
 *  2. the EN and RU bundles expose the same key set, ignoring plural suffix
 *     differences that are legitimate in Russian pluralisation;
 *  3. no locale file declares the same key twice (JSON.parse silently keeps the
 *     last value, which hides editor mistakes).
 *
 * Usage: node tools/check-i18n-coverage.mjs
 */

import { readFileSync, readdirSync } from 'fs'
import { join, sep } from 'path'
import { fileURLToPath } from 'url'

import {
    buildResolvableKeySet,
    describeVacuousScan,
    findHardcodedDiscardDefaults,
    findDuplicateKeys,
    flattenKeys,
    lineAt,
    lineOffsetsOf,
    normalizePluralKeys
} from './lib/i18n-keys.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')

/**
 * Consolidation mirrors the runtime `consolidate*Namespace` helpers: the JSON
 * subtree named by `rootSubtree` is spread at the namespace root and only the
 * listed top-level keys survive, so keys placed on the JSON root outside the
 * subtree or outside this allowlist never resolve at runtime.
 */
const TARGETS = [
    {
        name: '@universo-react/applications-frontend',
        namespace: 'applications',
        sourceRoot: 'packages/universo-react-applications-frontend/src',
        locales: {
            en: ['packages/universo-react-applications-frontend/src/i18n/locales/en/applications.json'],
            ru: ['packages/universo-react-applications-frontend/src/i18n/locales/ru/applications.json']
        },
        rootSubtree: 'applications',
        keptRootKeys: [
            'actions',
            'table',
            'connectors',
            'migrations',
            'members',
            'common',
            'errors',
            'migrationGuard',
            'underDevelopment',
            'maintenance'
        ]
    },
    {
        name: '@universo-react/apps-template-mui',
        namespace: 'apps',
        sourceRoot: 'packages/universo-react-apps-template-mui/src',
        locales: {
            en: ['packages/universo-react-apps-template-mui/src/i18n/locales/en/apps.json'],
            ru: ['packages/universo-react-apps-template-mui/src/i18n/locales/ru/apps.json']
        },
        additionalNamespaces: {
            quiz: {
                en: ['packages/universo-react-apps-template-mui/src/i18n/locales/en/quiz.json'],
                ru: ['packages/universo-react-apps-template-mui/src/i18n/locales/ru/quiz.json']
            },
            interpretationNetwork: {
                en: ['packages/universo-react-apps-template-mui/src/i18n/locales/en/interpretationNetwork.json'],
                ru: ['packages/universo-react-apps-template-mui/src/i18n/locales/ru/interpretationNetwork.json']
            }
        }
    },
    {
        name: '@universo-react/metahubs-frontend',
        namespace: 'metahubs',
        sourceRoot: 'packages/universo-react-metahubs-frontend/src',
        locales: {
            en: ['packages/universo-react-metahubs-frontend/src/i18n/locales/en/metahubs.json'],
            ru: ['packages/universo-react-metahubs-frontend/src/i18n/locales/ru/metahubs.json']
        },
        rootSubtree: 'metahubs',
        keptRootKeys: [
            'actions',
            'general',
            'shared',
            'templates',
            'branches',
            'layouts',
            'menus',
            'meta_sections',
            'meta_entities',
            'members',
            'entities',
            'documents',
            'hubs',
            'pages',
            'objects',
            'ledgers',
            'sets',
            'fixedValues',
            'enumerations',
            'optionValues',
            'components',
            'records',
            'publications',
            'packages',
            'modules',
            'migrations',
            'settings',
            'export',
            'createOptions',
            'oneCCompatible',
            'ref',
            'common',
            'table',
            'errors',
            'projects'
        ]
    }
]

/**
 * Shared @universo-react/i18n bundles keep their namespace content under a
 * single root key, so the fallback key universe is that subtree. `fallback`
 * mirrors the runtime `fallbackNS` configuration; `confirm` is only reachable
 * through an explicit `confirm:key` reference.
 */
const FALLBACK_LOCALES = {
    en: [
        ['packages/universo-react-i18n/src/locales/en/core/common.json', 'common', true],
        ['packages/universo-react-i18n/src/locales/en/core/header.json', 'header', true],
        ['packages/universo-react-i18n/src/locales/en/core/spaces.json', 'spaces', true],
        ['packages/universo-react-i18n/src/locales/en/dialogs/confirm.json', 'confirm', false]
    ],
    ru: [
        ['packages/universo-react-i18n/src/locales/ru/core/common.json', 'common', true],
        ['packages/universo-react-i18n/src/locales/ru/core/header.json', 'header', true],
        ['packages/universo-react-i18n/src/locales/ru/core/spaces.json', 'spaces', true],
        ['packages/universo-react-i18n/src/locales/ru/dialogs/confirm.json', 'confirm', false]
    ]
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx']
const IGNORED_PATH_SEGMENTS = new Set(['node_modules', 'dist', '__tests__', '__mocks__'])

const readJson = (relativePath) => JSON.parse(readFileSync(join(ROOT, relativePath), 'utf8'))

const collectSourceFiles = (relativeDir, into = []) => {
    const absoluteDir = join(ROOT, relativeDir)
    for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
        if (IGNORED_PATH_SEGMENTS.has(entry.name)) continue
        const relativePath = join(relativeDir, entry.name)
        if (entry.isDirectory()) {
            collectSourceFiles(relativePath, into)
            continue
        }
        if (!SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) continue
        if (/\.(test|spec)\.[cm]?tsx?$/u.test(entry.name)) continue
        into.push(relativePath)
    }
    return into
}

const LITERAL_CALL_RE = /\b(?:t|tc|tl)\(\s*(['"])((?:[^\\]|\\.)*?)\1/gu
/** Fully static template-literal callsites: t(`aliases.states.${...}`) stay dynamic and are skipped. */
const STATIC_TEMPLATE_CALL_RE = /\b(?:t|tc|tl)\(\s*`([^`$\\]*)`/gu
const COMMENT_LINE_RE = /^\s*(?:\/\/|\/\*|\*)/u
/**
 * `useCommonTranslations('prefix')` and `keyPrefix: 'prefix'` shift every key of
 * a file, so the gate resolves prefixed candidates too.
 */
const KEY_PREFIX_RES = [/useCommonTranslations\(\s*'([^']+)'/gu, /keyPrefix:\s*'([^']+)'/gu]
/** Roots that the runtime merges with the subtree instead of replacing. */
const MERGED_ROOT_KEYS = new Set(['actions', 'table', 'modules'])

/**
 * Scans the whole file so Prettier-wrapped multiline callsites are covered as
 * well; comment-only lines are ignored to avoid documenting examples failing
 * the gate.
 */
const collectLiteralKeys = (files) => {
    const byKey = new Map()
    for (const relativePath of files) {
        const source = readFileSync(join(ROOT, relativePath), 'utf8')
        const offsets = lineOffsetsOf(source)
        const prefixes = new Set()
        for (const prefixRe of KEY_PREFIX_RES) {
            prefixRe.lastIndex = 0
            let prefixMatch
            while ((prefixMatch = prefixRe.exec(source)) !== null) prefixes.add(prefixMatch[1])
        }
        LITERAL_CALL_RE.lastIndex = 0
        let match
        while ((match = LITERAL_CALL_RE.exec(source)) !== null) {
            const key = match[2]
            if (!key || key.includes('${')) continue
            if (!/^[A-Za-z][A-Za-z0-9_.:-]*$/u.test(key)) continue
            const line = lineAt(offsets, match.index)
            if (COMMENT_LINE_RE.test(source.slice(offsets[line - 1], offsets[line] ?? source.length))) continue
            const lookahead = source.slice(match.index, match.index + 240)
            const hasCount = /\bcount\b/u.test(lookahead)
            const existing = byKey.get(key)
            if (!existing) {
                byKey.set(key, { location: `${relativePath.split(sep).join('/')}:${line}`, hasCount, prefixes: new Set(prefixes) })
            } else {
                if (hasCount) existing.hasCount = true
                for (const prefix of prefixes) existing.prefixes.add(prefix)
            }
        }

        STATIC_TEMPLATE_CALL_RE.lastIndex = 0
        while ((match = STATIC_TEMPLATE_CALL_RE.exec(source)) !== null) {
            const key = match[1]?.trim()
            if (!key || !/^[A-Za-z][A-Za-z0-9_.:-]*$/u.test(key)) continue
            const line = lineAt(offsets, match.index)
            if (COMMENT_LINE_RE.test(source.slice(offsets[line - 1], offsets[line] ?? source.length))) continue
            if (!byKey.has(key)) {
                byKey.set(key, {
                    location: `${relativePath.split(sep).join('/')}:${line}`,
                    hasCount: false,
                    prefixes: new Set(prefixes)
                })
            }
        }
    }
    return byKey
}

const buildConsolidatedKeySet = (localeFiles, rootSubtree, keptRootKeys) => {
    const keys = new Set()
    for (const localeFile of localeFiles) {
        const bundle = readJson(localeFile)
        if (!rootSubtree) {
            flattenKeys(bundle, '', keys)
            continue
        }
        const subtree = bundle?.[rootSubtree]
        if (subtree && typeof subtree === 'object') flattenKeys(subtree, '', keys)
        for (const rootKey of keptRootKeys ?? []) {
            if (!MERGED_ROOT_KEYS.has(rootKey)) {
                // The runtime replaces the subtree branch with the root branch
                // (or with an empty object when the root key is absent), so
                // shadowed subtree keys never resolve.
                for (const key of [...keys]) {
                    if (key === rootKey || key.startsWith(`${rootKey}.`)) keys.delete(key)
                }
            }
            const value = bundle?.[rootKey]
            if (value && typeof value === 'object') flattenKeys(value, rootKey, keys)
        }
    }
    return keys
}

const buildSharedKeySet = (localeFiles, rootKey) => {
    const keys = new Set()
    for (const [localeFile, bundleRootKey] of localeFiles) {
        if (bundleRootKey !== rootKey) continue
        const bundle = readJson(localeFile)
        const subtree = bundle?.[rootKey]
        if (subtree && typeof subtree === 'object') flattenKeys(subtree, '', keys)
    }
    return keys
}

let failures = 0

/**
 * Shared dialog primitives (template-mui) are reused by every localized
 * front-end, so literal English discard defaults would leak into Russian UI.
 */
const TEMPLATE_MUI_DIALOG_ROOT = 'packages/universo-react-template-mui/src/components'

const reportFailure = (message) => {
    failures += 1
    console.error(`✖ ${message}`)
}

for (const target of TARGETS) {
    const localeFiles = [...target.locales.en, ...target.locales.ru]
    const duplicateProblems = []
    for (const localeFile of localeFiles) {
        const filePath = join(ROOT, localeFile)
        const duplicates = findDuplicateKeys(readFileSync(filePath, 'utf8'))
        for (const duplicate of duplicates) {
            duplicateProblems.push({ localeFile, ...duplicate })
        }
    }
    if (duplicateProblems.length > 0) {
        reportFailure(`${target.name}: ${duplicateProblems.length} duplicate locale key(s) hide earlier values`)
        for (const problem of duplicateProblems) {
            console.error(`  - ${problem.key}  (${problem.localeFile}:${problem.line})`)
        }
    }

    const namespaceKeys = new Map()
    for (const language of ['en', 'ru']) {
        const packageKeys = buildConsolidatedKeySet(target.locales[language], target.rootSubtree, target.keptRootKeys)
        namespaceKeys.set(`${language}:${target.namespace}`, packageKeys)
        for (const [namespace, locales] of Object.entries(target.additionalNamespaces ?? {})) {
            const bundle = readJson(locales[language][0])
            namespaceKeys.set(`${language}:${namespace}`, flattenKeys(bundle, '', new Set()))
        }
        for (const [, rootKey] of FALLBACK_LOCALES[language]) {
            namespaceKeys.set(`${language}:${rootKey}`, buildSharedKeySet(FALLBACK_LOCALES[language], rootKey))
        }
    }

    const fallbackNamespaces = ['common', 'header', 'spaces']
    const packageNamespaces = [target.namespace, ...Object.keys(target.additionalNamespaces ?? {})]
    const resolveInNamespace = (language, namespace, key, hasCount) => {
        const keys = namespaceKeys.get(`${language}:${namespace}`)
        if (!keys) return false
        if (keys.has(key)) return true
        return hasCount && buildResolvableKeySet(keys).has(key)
    }

    const sourceFiles = collectSourceFiles(target.sourceRoot)
    const literalKeys = collectLiteralKeys(sourceFiles)
    const vacuousScan = describeVacuousScan({
        name: target.name,
        sourceFileCount: sourceFiles.length,
        literalKeyCount: literalKeys.size,
        minLiteralKeys: target.minLiteralKeys ?? 1
    })
    if (vacuousScan) reportFailure(vacuousScan)
    const missing = []
    const unknownNamespaces = new Set()
    for (const [key, entry] of literalKeys) {
        const separatorIndex = key.indexOf(':')
        const namespace = separatorIndex === -1 ? undefined : key.slice(0, separatorIndex)
        if (namespace && !namespaceKeys.has(`en:${namespace}`)) {
            unknownNamespaces.add(`${key}  (${entry.location})`)
            continue
        }
        const bareKey = namespace ? key.slice(separatorIndex + 1) : key
        const namespaces = namespace ? [namespace] : [...packageNamespaces, ...fallbackNamespaces]
        const candidates = [bareKey, ...[...entry.prefixes].map((prefix) => `${prefix}.${bareKey}`)]
        const resolvesEn = namespaces.some((candidate) =>
            candidates.some((value) => resolveInNamespace('en', candidate, value, entry.hasCount))
        )
        const resolvesRu = namespaces.some((candidate) =>
            candidates.some((value) => resolveInNamespace('ru', candidate, value, entry.hasCount))
        )
        if (!resolvesEn || !resolvesRu) {
            missing.push({ key, location: entry.location, resolvesEn, resolvesRu })
        }
    }
    if (unknownNamespaces.size > 0) {
        reportFailure(`${target.name}: ${unknownNamespaces.size} key(s) reference an unknown translation namespace`)
        for (const entry of unknownNamespaces) console.error(`  - ${entry}`)
    }
    if (missing.length > 0) {
        reportFailure(`${target.name}: ${missing.length} literal t()/tc() keys do not resolve in both locales`)
        for (const entry of missing) {
            const localeState = `${entry.resolvesEn ? 'en:ok' : 'en:missing'} ${entry.resolvesRu ? 'ru:ok' : 'ru:missing'}`
            console.error(`  - ${entry.key}  (${entry.location})  [${localeState}]`)
        }
    }

    const enNormalized = normalizePluralKeys(buildConsolidatedKeySet(target.locales.en, target.rootSubtree, target.keptRootKeys))
    const ruNormalized = normalizePluralKeys(buildConsolidatedKeySet(target.locales.ru, target.rootSubtree, target.keptRootKeys))
    const onlyEn = [...enNormalized].filter((key) => !ruNormalized.has(key)).sort()
    const onlyRu = [...ruNormalized].filter((key) => !enNormalized.has(key)).sort()
    if (onlyEn.length > 0) {
        reportFailure(`${target.name}: ${onlyEn.length} keys exist only in EN`)
        for (const key of onlyEn.slice(0, 20)) console.error(`  - ${key}`)
        if (onlyEn.length > 20) console.error(`  - … ${onlyEn.length - 20} more`)
    }
    if (onlyRu.length > 0) {
        reportFailure(`${target.name}: ${onlyRu.length} keys exist only in RU`)
        for (const key of onlyRu.slice(0, 20)) console.error(`  - ${key}`)
        if (onlyRu.length > 20) console.error(`  - … ${onlyRu.length - 20} more`)
    }

    if (
        missing.length === 0 &&
        onlyEn.length === 0 &&
        onlyRu.length === 0 &&
        duplicateProblems.length === 0 &&
        unknownNamespaces.size === 0 &&
        !vacuousScan
    ) {
        console.log(`✔ ${target.name}: ${literalKeys.size} literal keys resolve in both locales, EN/RU bundles are in parity`)
    }
}

try {
    for (const relativePath of collectSourceFiles(TEMPLATE_MUI_DIALOG_ROOT)) {
        const source = readFileSync(join(ROOT, relativePath), 'utf8')
        const defaults = findHardcodedDiscardDefaults(source)
        for (const entry of defaults) {
            reportFailure(
                `${relativePath}: hardcoded English discard default "${entry.value}" must use the shared common:unsavedChanges keys`
            )
        }
    }
} catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    reportFailure(`Unable to scan shared dialog discard defaults: ${message}`)
}

if (failures > 0) {
    console.error(`\ni18n coverage check failed with ${failures} violation(s).`)
    process.exit(1)
}

console.log('\ni18n coverage check passed.')
