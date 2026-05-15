// Comments in English only
import fs from 'fs'
import path from 'path'
import url from 'url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..', '..')

const localeRoots = {
    en: path.join(repoRoot, 'docs', 'en'),
    ru: path.join(repoRoot, 'docs', 'ru')
}

const staleTerms = [
    { locale: 'en', re: /\bFlowise\b/i, label: 'Flowise' },
    { locale: 'en', re: /\bcatalog-compatible\b/i, label: 'catalog-compatible' },
    { locale: 'en', re: /\blegacy\b/i, label: 'legacy' },
    { locale: 'en', re: /\blegacy-compatible\b/i, label: 'legacy-compatible' },
    { locale: 'en', re: /\bV2\b/, label: 'V2' },
    { locale: 'ru', re: /Flowise/i, label: 'Flowise' },
    { locale: 'ru', re: /catalog-compatible/i, label: 'catalog-compatible' },
    { locale: 'ru', re: /устаревш/i, label: 'устаревш*' },
    { locale: 'ru', re: /legacy-compatible/i, label: 'legacy-compatible' },
    { locale: 'ru', re: /\bV2\b/, label: 'V2' }
]

const ruProseDriftTerms = [
    /target object/i,
    /shared row/i,
    /runtime sections/i,
    /authoring flow/i,
    /browser proof/i,
    /rollout/i,
    /focused tests/i,
    /browser flows/i,
    /resource surfaces?/i,
    /resources workspace/i,
    /entity type/i,
    /entity instance/i,
    /runtime schema/i,
    /shared layout/i,
    /publication sync/i,
    /application sync/i,
    /frontend constants/i,
    /localized metadata/i,
    /persisted localized/i,
    /object-owned/i,
    /entity-owned/i,
    /route tree/i,
    /dedicated authoring/i,
    /safe presentation/i,
    /component manifest/i,
    /shipped path/i,
    /shared source row/i,
    /sparse override row/i,
    /shared containers/i,
    /snapshot import/i,
    /snapshot export/i,
    /runtime publication/i,
    /application tables/i,
    /runtime adapters/i
]

const requiredScreenshotPages = [
    'getting-started/quick-start.md',
    'api-reference/shared-entity-overrides.md',
    'architecture/entity-systems.md',
    'architecture/metahub-schema.md',
    'guides/application-layouts.md',
    'guides/app-template-views.md',
    'guides/entity-scoped-layouts.md',
    'guides/creating-application.md',
    'guides/custom-entity-types.md',
    'guides/general-section.md',
    'guides/lms-guest-access.md',
    'guides/lms-overview.md',
    'guides/lms-setup.md',
    'guides/metahub-scripting.md',
    'guides/publishing-content.md',
    'guides/quiz-application-tutorial.md',
    'guides/snapshot-export-import.md',
    'guides/working-with-updl.md',
    'guides/workspace-management.md',
    'platform/README.md',
    'platform/admin.md',
    'platform/analytics.md',
    'platform/applications.md',
    'platform/metaverses.md',
    'platform/metahubs.md',
    'platform/metahubs/common-section.md',
    'platform/metahubs/exclusions.md',
    'platform/metahubs/script-scopes.md',
    'platform/metahubs/scripts.md',
    'platform/metahubs/shared-behavior-settings.md',
    'platform/metahubs/shared-components.md',
    'platform/metahubs/shared-fixed-values.md',
    'platform/metahubs/shared-option-values.md',
    'platform/metahubs/shared-scripts.md',
    'platform/space-builder.md',
    'platform/spaces.md',
    'platform/updl/README.md',
    'platform/updl/action-nodes.md',
    'platform/updl/component-nodes.md',
    'platform/updl/data-nodes.md',
    'platform/updl/entity-nodes.md',
    'platform/updl/event-nodes.md',
    'platform/updl/space-nodes.md',
    'platform/workspaces.md',
    'platform/publications.md'
]

const screenshotExemptPages = new Set([
    'README.md',
    'api-reference/README.md',
    'api-reference/authentication.md',
    'api-reference/interactive-openapi-docs.md',
    'api-reference/rest-api.md',
    'api-reference/scripts.md',
    'api-reference/webhooks.md',
    'architecture/README.md',
    'architecture/auth.md',
    'architecture/backend.md',
    'architecture/database-access-standard.md',
    'architecture/database.md',
    'architecture/entity-component-system.md',
    'architecture/frontend.md',
    'architecture/ledgers.md',
    'architecture/lms-entities.md',
    'architecture/monorepo-structure.md',
    'architecture/optional-global-catalog.md',
    'architecture/scripting-system.md',
    'architecture/system-app-convergence.md',
    'architecture/system-app-migration-lifecycle.md',
    'contributing/README.md',
    'contributing/coding-guidelines.md',
    'contributing/creating-packages.md',
    'contributing/database-code-review-checklist.md',
    'contributing/development-setup.md',
    'getting-started/README.md',
    'getting-started/configuration.md',
    'getting-started/installation.md',
    'guides/README.md',
    'guides/browser-e2e-testing.md',
    'guides/multi-platform-export.md',
    'guides/updating-system-app-schemas.md'
])

function normalizeLines(content) {
    return content.replace(/\r\n/g, '\n').split('\n')
}

function walk(dir) {
    const files = []
    if (!fs.existsSync(dir)) return files

    const stack = [dir]
    while (stack.length > 0) {
        const currentDir = stack.pop()
        for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
            const full = path.join(currentDir, entry.name)
            if (entry.isDirectory()) stack.push(full)
            else files.push(full)
        }
    }

    return files.sort()
}

function markdownFiles(locale) {
    return walk(localeRoots[locale]).filter(
        (file) => file.endsWith('.md') && !path.relative(localeRoots[locale], file).split(path.sep).includes('.gitbook')
    )
}

function countByRegex(lines, re) {
    return lines.reduce((acc, line) => acc + (re.test(line) ? 1 : 0), 0)
}

function stripFencedBlocks(lines) {
    const visible = []
    let inFence = false

    for (const line of lines) {
        if (/^```/.test(line)) {
            inFence = !inFence
            visible.push(line)
            continue
        }

        if (!inFence) visible.push(line)
    }

    return visible
}

function checkFrontMatter(file, lines) {
    const errors = []

    if (lines[0] === '---') {
        const closingIndex = lines.slice(1).findIndex((line) => line === '---')
        if (closingIndex < 0) errors.push('Front matter has no closing delimiter')
        return errors
    }

    if (lines.slice(0, 5).some((line) => /^description:/.test(line))) {
        errors.push('Front matter starts with description but has no opening delimiter')
    }

    return errors
}

function extractLinkDestination(target) {
    const trimmed = target.trim()
    if (!trimmed) return ''

    if (trimmed.startsWith('<')) {
        const closingIndex = trimmed.indexOf('>')
        return closingIndex >= 0 ? trimmed.slice(1, closingIndex) : trimmed.slice(1)
    }

    const titleMatch = trimmed.match(/^(\S+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?$/)
    return titleMatch ? titleMatch[1] : trimmed.split(/\s+/)[0]
}

function resolveLocalTarget(file, target) {
    const cleanTarget = extractLinkDestination(target).split('#')[0].split('?')[0]
    if (!cleanTarget || cleanTarget.startsWith('#')) return null
    if (/^[a-z]+:/i.test(cleanTarget)) return null

    const decoded = decodeURIComponent(cleanTarget)
    const resolved = decoded.startsWith('/') ? path.join(repoRoot, decoded) : path.resolve(path.dirname(file), decoded)

    if (fs.existsSync(resolved)) return resolved
    if (!path.extname(resolved) && fs.existsSync(`${resolved}.md`)) return `${resolved}.md`
    if (!path.extname(resolved) && fs.existsSync(path.join(resolved, 'README.md'))) {
        return path.join(resolved, 'README.md')
    }

    return resolved
}

function checkLocalLinks(file, lines) {
    const errors = []
    const linkPattern = /!?\[[^\]]*]\(([^)]+)\)/g

    for (const [index, line] of lines.entries()) {
        let match
        while ((match = linkPattern.exec(line)) !== null) {
            const target = match[1].trim()
            const resolved = resolveLocalTarget(file, target)
            if (resolved && !fs.existsSync(resolved)) {
                errors.push(`Broken local link at line ${index + 1}: ${target}`)
            }
        }
    }

    return errors
}

function checkStaleTerms(locale, file, visibleLines) {
    const errors = []
    const rules = staleTerms.filter((term) => term.locale === locale)

    for (const [index, line] of visibleLines.entries()) {
        for (const rule of rules) {
            if (rule.re.test(line)) {
                errors.push(`Stale term "${rule.label}" at line ${index + 1}`)
            }
        }
    }

    return errors
}

function checkRuProseDrift(locale, visibleLines) {
    const errors = []
    if (locale !== 'ru') return errors

    for (const [index, line] of visibleLines.entries()) {
        for (const re of ruProseDriftTerms) {
            if (re.test(line)) {
                errors.push(`Avoidable English prose at line ${index + 1}: ${re.source}`)
            }
        }
    }

    return errors
}

function checkPair(enFile, ruFile) {
    const enContent = fs.readFileSync(enFile, 'utf8')
    const ruContent = fs.readFileSync(ruFile, 'utf8')
    const enLines = normalizeLines(enContent)
    const ruLines = normalizeLines(ruContent)
    const enVisible = stripFencedBlocks(enLines)
    const ruVisible = stripFencedBlocks(ruLines)

    const errors = []

    if (enLines.length !== ruLines.length) {
        errors.push(`Line count differs: EN=${enLines.length} RU=${ruLines.length}`)
    }

    const structuralChecks = [
        ['Headings count differs', /^#{1,6}\s/, enVisible, ruVisible],
        ['Code fences differ', /^```/, enLines, ruLines],
        ['Bullets count differs', /^[-*+]\s/, enVisible, ruVisible],
        ['Numbered list items differ', /^\d+\.\s/, enVisible, ruVisible],
        ['Images count differs', /^!\[/, enVisible, ruVisible],
        ['Table rows differ', /^\|/, enVisible, ruVisible]
    ]

    for (const [label, re, enSource, ruSource] of structuralChecks) {
        const enCount = countByRegex(enSource, re)
        const ruCount = countByRegex(ruSource, re)
        if (enCount !== ruCount) errors.push(`${label}: EN=${enCount} RU=${ruCount}`)
    }

    return errors
}

function collectSummaryLinks(locale) {
    const summaryPath = path.join(localeRoots[locale], 'SUMMARY.md')
    const content = fs.readFileSync(summaryPath, 'utf8')
    const links = new Map()
    const linkPattern = /\[[^\]]+]\(([^)\s#?]+\.md)(?:#[^)\s]+)?(?:\s+[^)]+)?\)/g
    let match

    while ((match = linkPattern.exec(content)) !== null) {
        const linked = path.normalize(match[1])
        links.set(linked, (links.get(linked) || 0) + 1)
    }

    return links
}

function checkSummaryCoverage(locale) {
    const errors = []
    const links = collectSummaryLinks(locale)
    const files = markdownFiles(locale)
        .map((file) => path.relative(localeRoots[locale], file))
        .filter((rel) => rel !== 'SUMMARY.md')
        .sort()

    for (const rel of files) {
        const normalized = path.normalize(rel)
        const count = links.get(normalized) || 0
        if (count === 0) errors.push(`Missing SUMMARY.md entry: ${rel}`)
        if (count > 1) errors.push(`Duplicate SUMMARY.md entry: ${rel}`)
    }

    for (const linked of links.keys()) {
        if (!fs.existsSync(path.join(localeRoots[locale], linked))) {
            errors.push(`SUMMARY.md points to missing page: ${linked}`)
        }
    }

    return errors
}

function collectReferencedImages(locale) {
    const referenced = new Set()
    const linkPattern = /!\[[^\]]*]\(([^)]+)\)/g

    for (const file of markdownFiles(locale)) {
        const content = fs.readFileSync(file, 'utf8')
        let match
        while ((match = linkPattern.exec(content)) !== null) {
            const resolved = resolveLocalTarget(file, match[1])
            if (resolved) referenced.add(resolved)
        }
    }

    return referenced
}

function checkAssetCoverage(locale) {
    const errors = []
    const assetsRoot = path.join(localeRoots[locale], '.gitbook', 'assets')
    const referenced = collectReferencedImages(locale)
    const imageFiles = walk(assetsRoot).filter((file) => /\.(png|jpe?g|webp|gif)$/i.test(file))

    for (const file of imageFiles) {
        if (!referenced.has(file)) {
            errors.push(`Unreferenced image asset: ${path.relative(localeRoots[locale], file)}`)
        }
    }

    return errors
}

function checkRequiredScreenshotCoverage(locale) {
    const errors = []

    for (const rel of requiredScreenshotPages) {
        const file = path.join(localeRoots[locale], rel)
        if (!fs.existsSync(file)) {
            errors.push(`Required screenshot page is missing: ${rel}`)
            continue
        }

        const content = fs.readFileSync(file, 'utf8')
        if (!/!\[[^\]]*]\([^)]+\)/.test(content)) {
            errors.push(`Required screenshot page has no image: ${rel}`)
        }
    }

    return errors
}

function checkScreenshotPolicy(locale) {
    const errors = []

    for (const file of markdownFiles(locale)) {
        const rel = path.relative(localeRoots[locale], file)
        if (rel === 'SUMMARY.md' || screenshotExemptPages.has(rel)) continue

        const content = fs.readFileSync(file, 'utf8')
        if (!/!\[[^\]]*]\([^)]+\)/.test(content)) {
            errors.push(`Public workflow/product page has no screenshot and is not exempt: ${rel}`)
        }
    }

    return errors
}

function checkRequiredRoots() {
    const errors = []
    for (const locale of Object.keys(localeRoots)) {
        for (const filename of ['README.md', 'SUMMARY.md']) {
            const file = path.join(localeRoots[locale], filename)
            if (!fs.existsSync(file)) errors.push(`Missing docs/${locale}/${filename}`)
        }
    }
    return errors
}

function main() {
    const failures = []

    for (const error of checkRequiredRoots()) {
        failures.push({ scope: 'GitBook roots', errors: [error] })
    }

    const enFiles = markdownFiles('en')
    const ruFiles = markdownFiles('ru')
    const enRel = new Set(enFiles.map((file) => path.relative(localeRoots.en, file)))
    const ruRel = new Set(ruFiles.map((file) => path.relative(localeRoots.ru, file)))
    const allRel = [...new Set([...enRel, ...ruRel])].sort()

    for (const rel of allRel) {
        const enFile = path.join(localeRoots.en, rel)
        const ruFile = path.join(localeRoots.ru, rel)

        if (!fs.existsSync(enFile) || !fs.existsSync(ruFile)) {
            const errors = []
            if (!fs.existsSync(enFile)) errors.push('Missing EN counterpart')
            if (!fs.existsSync(ruFile)) errors.push('Missing RU counterpart')
            failures.push({ scope: rel, errors })
            continue
        }

        const pairErrors = checkPair(enFile, ruFile)
        if (pairErrors.length > 0) failures.push({ scope: rel, errors: pairErrors })
    }

    for (const locale of ['en', 'ru']) {
        for (const file of markdownFiles(locale)) {
            const rel = path.relative(localeRoots[locale], file)
            const lines = normalizeLines(fs.readFileSync(file, 'utf8'))
            const errors = [
                ...checkFrontMatter(file, lines),
                ...checkLocalLinks(file, lines),
                ...checkStaleTerms(locale, file, stripFencedBlocks(lines)),
                ...checkRuProseDrift(locale, stripFencedBlocks(lines))
            ]

            if (errors.length > 0) failures.push({ scope: `docs/${locale}/${rel}`, errors })
        }

        const summaryErrors = checkSummaryCoverage(locale)
        if (summaryErrors.length > 0) {
            failures.push({ scope: `docs/${locale}/SUMMARY.md coverage`, errors: summaryErrors })
        }

        const assetErrors = checkAssetCoverage(locale)
        if (assetErrors.length > 0) {
            failures.push({ scope: `docs/${locale}/asset coverage`, errors: assetErrors })
        }

        const screenshotErrors = checkRequiredScreenshotCoverage(locale)
        if (screenshotErrors.length > 0) {
            failures.push({ scope: `docs/${locale}/required screenshot coverage`, errors: screenshotErrors })
        }

        const screenshotPolicyErrors = checkScreenshotPolicy(locale)
        if (screenshotPolicyErrors.length > 0) {
            failures.push({ scope: `docs/${locale}/screenshot policy`, errors: screenshotPolicyErrors })
        }
    }

    if (failures.length > 0) {
        console.error('GitBook documentation checks failed:')
        for (const failure of failures) {
            console.error(`\n${failure.scope}`)
            for (const error of failure.errors) console.error(`  - ${error}`)
        }
        process.exit(1)
    }

    console.log(`GitBook documentation OK. Checked ${allRel.length} EN/RU page pair(s).`)
}

main()
