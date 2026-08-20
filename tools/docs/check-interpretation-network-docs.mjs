import { readdir, readFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { readPngDimensions, readPngImageData } from './png-inspection.mjs'

const ROOT = process.cwd()
const MANIFEST_PATH = path.join(ROOT, 'tools/docs/interpretation-network-screenshot-manifest.json')
const PROVENANCE_PATH = path.join(ROOT, 'tools/docs/interpretation-network-screenshot-provenance.json')
const GENERATOR_PATH = path.join(ROOT, 'tools/testing/e2e/specs/generators/docs-interpretation-network-screenshots.spec.ts')
const LOCALES = ['en', 'ru']
const REQUIRED_VIEWPORT_MATRIX = [
    { name: 'desktop-1920', width: 1920, height: 1080 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'mobile-390', width: 390, height: 844 }
]
const GUIDE_ROOT = {
    en: path.join(ROOT, 'docs/en/interpretation-network'),
    ru: path.join(ROOT, 'docs/ru/interpretation-network')
}
const ASSET_ROOT = {
    en: path.join(ROOT, 'docs/en/.gitbook/assets/interpretation-network'),
    ru: path.join(ROOT, 'docs/ru/.gitbook/assets/interpretation-network')
}
const SUMMARY_PATH = {
    en: path.join(ROOT, 'docs/en/SUMMARY.md'),
    ru: path.join(ROOT, 'docs/ru/SUMMARY.md')
}
const OVERVIEW_PATH = {
    en: path.join(ROOT, 'docs/en/guides/interpretation-network.md'),
    ru: path.join(ROOT, 'docs/ru/guides/interpretation-network.md')
}

const TECHNICAL_TEXT_PATTERNS = [
    /\[object Object\]/,
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
    /\{[\s\S]{0,200}"(?:type|blocks|recordId|targetId|storageKey|sourceConfig|layoutId|widgetId)"[\s\S]{0,200}\}/i
]
const USER_GUIDE_FORBIDDEN_PATTERNS = [
    ['screenshot placeholder comment', /<!--\s*screenshot:/i],
    ['unfinished TODO marker', /\bTODO\b/i],
    ['unfinished FIXME marker', /\bFIXME\b/i],
    ['placeholder marker', /\bplaceholder\b/i],
    ['raw ID wording', /\braw\s+IDs?\b/i],
    ['raw JSON wording', /\braw\s+JSON\b/i],
    ['internal field CellId', /\bCellId\b/],
    ['internal field ParentCellId', /\bParentCellId\b/],
    ['internal field OwnerId', /\bOwnerId\b/],
    ['internal field TemplateOwnerId', /\bTemplateOwnerId\b/],
    ['internal field MaterialRef', /\bMaterialRef\b/],
    ['internal field RowKey', /\bRowKey\b/],
    ['internal field ColKey', /\bColKey\b/],
    ['internal sort field', /\b_tp_sort_order\b/],
    ['widget id wording', /\bwidget\s+IDs?\b/i],
    ['layout id wording', /\blayout\s+IDs?\b/i],
    ['source config wording', /\bsource_config\b/i],
    ['raw Russian ID wording', /\bсырые\s+ID\b/i],
    ['raw Russian JSON wording', /\bсыр(?:ой|ого|ым)\s+JSON\b/i]
]
const RU_FALLBACK_PATTERN =
    /\b(?:Getting Started|Create And Publish|Application Settings|Workspace And Matrix|Cells And Materials|Troubleshooting|Role And Goal|Prerequisites|Workflow|Expected Result|What To Check|Related Pages|Create|Cancel|Save|Delete|Reset|No data to display|String must contain|Invalid input)\b/
const RU_ALLOWED_LATIN_TOKEN =
    /^(?:Universo|Platformo|GitBook|MVP|Matrix|Structure|Structures|Interpretation|Network|Relation|Material|Materials|Start|Playwright|Supabase|URL|UI|UX|API|README|Runtime|Editor)$/
const RU_TECHNICAL_MARKUP_LINE = /^\s*(?:---|description:|!\[|<!--|```|pnpm\b)/
const RU_LINK_ONLY_LINE = /^\s*-\s+\[[^\]]+]\([^)]+\.md\)\s*$/
const MIN_RU_EN_WORD_RATIO = 0.65
const MAX_RU_EN_WORD_RATIO = 1.45
const MIN_SCREENSHOT_UNIQUE_BYTE_VALUES = 24
const ID_LIKE_ROUTE_SEGMENT_PATTERN =
    /\/(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{32})(?=\/|$|\?)/i

async function readText(file) {
    return readFile(file, 'utf8')
}

async function listMarkdownFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
        .map((entry) => entry.name)
        .sort()
}

async function listFilesIfExists(dir) {
    try {
        return (await readdir(dir, { withFileTypes: true })).filter((entry) => entry.isFile()).map((entry) => entry.name)
    } catch {
        return []
    }
}

function collectMatches(content, regex) {
    return content
        .split('\n')
        .map((line, index) => ({ line, index: index + 1 }))
        .filter(({ line }) => regex.test(line))
}

function collectSequence(content, regex) {
    const lineRegex = new RegExp(regex.source, regex.flags.replace('g', ''))
    return content
        .split('\n')
        .map((line) => line.match(lineRegex)?.[1] ?? null)
        .filter(Boolean)
}

function countWords(content) {
    return content.match(/[\p{L}\p{N}]+/gu)?.length ?? 0
}

function assert(condition, message, errors) {
    if (!condition) errors.push(message)
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hashBuffer(buffer) {
    return createHash('sha256').update(buffer).digest('hex')
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeRouteHint(routeHint) {
    return routeHint.replace(':applicationId', '{applicationId}').replace(/:[A-Za-z][A-Za-z0-9]*/g, '{routeId}')
}

function routeMatchesHint(route, routeHint) {
    const normalizedHint = normalizeRouteHint(routeHint)
    return route === normalizedHint || route.startsWith(`${normalizedHint}?`)
}

async function fileExists(file) {
    try {
        await stat(file)
        return true
    } catch {
        return false
    }
}

function assertPngLooksNonBlank(scope, buffer, errors) {
    try {
        const pixels = readPngImageData(buffer)
        const uniqueValues = new Set()
        const sampleStep = Math.max(1, Math.floor(pixels.length / 20_000))
        for (let index = 0; index < pixels.length; index += sampleStep) {
            uniqueValues.add(pixels[index])
            if (uniqueValues.size >= MIN_SCREENSHOT_UNIQUE_BYTE_VALUES) break
        }
        assert(
            uniqueValues.size >= MIN_SCREENSHOT_UNIQUE_BYTE_VALUES,
            `${scope}: screenshot appears blank or placeholder-like (${uniqueValues.size} unique sampled byte values)`,
            errors
        )
    } catch (error) {
        errors.push(`${scope}: screenshot pixel data could not be inspected: ${error.message}`)
    }
}

function assertRequiredVisibleText(scope, requiredVisibleText, errors) {
    for (const locale of LOCALES) {
        assert(
            Array.isArray(requiredVisibleText?.[locale]) && requiredVisibleText[locale].length > 0,
            `${scope}: requiredVisibleText must define ${locale.toUpperCase()} runtime evidence strings`,
            errors
        )
    }
}

function isAllowedRussianLatinText(value) {
    const tokens = value.match(/[A-Za-z][A-Za-z0-9.-]*/g) ?? []
    return tokens.length > 0 && tokens.every((token) => RU_ALLOWED_LATIN_TOKEN.test(token))
}

function assertRussianUserTextIsLocalized(scope, content, errors) {
    content.split('\n').forEach((line, index) => {
        if (RU_TECHNICAL_MARKUP_LINE.test(line) || RU_LINK_ONLY_LINE.test(line)) return
        const heading = line.match(/^#{1,6}\s+(.+)$/)?.[1]?.trim()
        if (heading && /[A-Za-z]/.test(heading) && !/[\u0400-\u04FF]/.test(heading) && !isAllowedRussianLatinText(heading)) {
            errors.push(`${scope}: Russian heading at line ${index + 1} must be localized: "${heading}"`)
        }
        const latinTokens = line.match(/[A-Za-z][A-Za-z0-9.-]*/g) ?? []
        const disallowedTokens = latinTokens
            .map((token) => token.replace(/^[^A-Za-z]+|[^A-Za-z0-9]+$/g, ''))
            .filter(Boolean)
            .filter((token) => !RU_ALLOWED_LATIN_TOKEN.test(token))
            .filter((token) => !token.endsWith('.md'))
        if (disallowedTokens.length > 0) {
            errors.push(
                `${scope}: Russian user text at line ${index + 1} contains unexpected Latin token(s): ${[...new Set(disallowedTokens)].join(
                    ', '
                )}`
            )
        }
    })
}

const manifest = JSON.parse(await readText(MANIFEST_PATH))
const provenance = (await fileExists(PROVENANCE_PATH)) ? JSON.parse(await readText(PROVENANCE_PATH)) : null
const errors = []
const entriesByFile = new Map((manifest.screenshots ?? []).map((entry) => [path.basename(entry.docPages.en), entry]))
const allowedAssetFilenames = new Set()
const expectedAssetHashes = new Map(Array.isArray(provenance?.assets) ? provenance.assets.map((asset) => [asset.path, asset]) : [])
const viewportMatrixEvidence = new Map(
    Array.isArray(provenance?.viewportMatrix) ? provenance.viewportMatrix.map((entry) => [`${entry.id}:${entry.locale}`, entry]) : []
)
const captureEvidence = new Map(Array.isArray(provenance?.captures) ? provenance.captures.map((entry) => [entry.path, entry]) : [])
const globalScreenshotHashes = new Map()

assert(
    provenance,
    'Interpretation Network screenshot provenance file is required; regenerate screenshots with docs:interpretation-network:screenshots',
    errors
)
if (provenance) {
    assert(provenance.version === 1, 'Interpretation Network screenshot provenance version must be 1', errors)
    assert(
        provenance.viewport?.width === 1920 && provenance.viewport?.height === 1080,
        'Interpretation Network screenshot provenance viewport must be 1920x1080',
        errors
    )
    assert(
        provenance.generatorSha256 === hashBuffer(await readFile(GENERATOR_PATH)),
        'Interpretation Network screenshot provenance is stale: generator hash differs',
        errors
    )
    assert(
        provenance.manifestSha256 === hashBuffer(await readFile(MANIFEST_PATH)),
        'Interpretation Network screenshot provenance is stale: manifest hash differs',
        errors
    )
    assert(
        Array.isArray(provenance.viewportMatrix),
        'Interpretation Network screenshot provenance must include viewport matrix evidence',
        errors
    )
    assert(Array.isArray(provenance.captures), 'Interpretation Network screenshot provenance must include per-capture evidence', errors)
    assert(Array.isArray(provenance.assets), 'Interpretation Network screenshot provenance must include asset evidence', errors)
}

const [enFiles, ruFiles] = await Promise.all([listMarkdownFiles(GUIDE_ROOT.en), listMarkdownFiles(GUIDE_ROOT.ru)])
assert(
    JSON.stringify(enFiles) === JSON.stringify(ruFiles),
    `Interpretation Network guide page lists differ: EN=${enFiles.join(', ')} RU=${ruFiles.join(', ')}`,
    errors
)

for (const file of enFiles) {
    const enPath = path.join(GUIDE_ROOT.en, file)
    const ruPath = path.join(GUIDE_ROOT.ru, file)
    const [enContent, ruContent] = await Promise.all([readText(enPath), readText(ruPath)])
    const entry = entriesByFile.get(file)
    assert(entry, `${file}: page must be listed in Interpretation Network screenshot manifest`, errors)

    const enWordCount = countWords(enContent)
    const ruWordCount = countWords(ruContent)
    const wordRatio = enWordCount > 0 ? ruWordCount / enWordCount : 0
    assert(
        wordRatio >= MIN_RU_EN_WORD_RATIO && wordRatio <= MAX_RU_EN_WORD_RATIO,
        `${file}: RU/EN word-count ratio must stay equivalent (${ruWordCount}/${enWordCount} = ${wordRatio.toFixed(2)})`,
        errors
    )

    for (const [label, regex] of [
        ['numbered steps', /^(\d+)\.\s+/gm],
        ['image targets', /^\s*!\[[^\]]*]\(([^)]+)\)$/gm]
    ]) {
        const enSeq = collectSequence(enContent, regex)
        const ruSeq = collectSequence(ruContent, regex)
        assert(enSeq.length === ruSeq.length, `${file}: ${label} count differs EN=${enSeq.length} RU=${ruSeq.length}`, errors)
    }

    for (const [locale, content] of [
        ['en', enContent],
        ['ru', ruContent]
    ]) {
        const expectedHeading = entry?.heading?.[locale]
        const h1 = content.match(/^#\s+(.+)$/m)?.[1]
        assert(h1 === expectedHeading, `${locale}/${file}: H1 must match manifest heading "${expectedHeading}", got "${h1}"`, errors)
        assert(countWords(content) >= 180, `${locale}/${file}: guide page must be detailed enough for users`, errors)
        assert(
            locale === 'en' ? /^## Role And Goal$/m.test(content) : /^## Роль и цель$/m.test(content),
            `${locale}/${file}: guide page must include a localized role/goal section`,
            errors
        )

        const numberedSteps = collectMatches(content, /^\d+\.\s+/)
        assert(
            !entry || numberedSteps.length === entry.workflowStepIds.length,
            `${locale}/${file}: numbered step count must match manifest workflowStepIds (${entry?.workflowStepIds.length}), got ${numberedSteps.length}`,
            errors
        )

        const expectedVisibleImages = entry ? entry.workflowStepIds.length + 1 : 0
        const imageTargets = collectSequence(content, /^\s*!\[[^\]]*]\(([^)]+)\)$/gm)
        assert(
            imageTargets.length === expectedVisibleImages,
            `${locale}/${file}: visible image count must be ${expectedVisibleImages}, got ${imageTargets.length}`,
            errors
        )

        for (const pattern of TECHNICAL_TEXT_PATTERNS) {
            const matches = collectMatches(content, pattern)
            assert(
                matches.length === 0,
                `${locale}/${file}: technical text leak ${pattern}: ${matches.map((m) => m.index).join(', ')}`,
                errors
            )
        }
        for (const [label, pattern] of USER_GUIDE_FORBIDDEN_PATTERNS) {
            const matches = collectMatches(content, pattern)
            assert(
                matches.length === 0,
                `${locale}/${file}: user guide contains ${label}: ${matches.map((m) => m.index).join(', ')}`,
                errors
            )
        }
        if (locale === 'ru') {
            const matches = collectMatches(content, RU_FALLBACK_PATTERN)
            assert(matches.length === 0, `ru/${file}: English fallback text: ${matches.map((m) => m.index).join(', ')}`, errors)
            assertRussianUserTextIsLocalized(`ru/${file}`, content, errors)
        }

        const lines = content.split('\n')
        let stepIndex = 0
        lines.forEach((line, index) => {
            if (/^\d+\.\s+/.test(line)) {
                stepIndex += 1
                const nextNonEmpty = lines.slice(index + 1).find((candidate) => candidate.trim().length > 0) ?? ''
                const expectedImage = entry ? `interpretation-network/${entry.filename.replace(/\.png$/, '')}-step-${stepIndex}.png` : ''
                assert(
                    /^\s*!\[[^\]]+]\([^)]+\)\s*$/.test(nextNonEmpty) && nextNonEmpty.includes(expectedImage),
                    `${locale}/${file}: numbered step at line ${index + 1} must be followed by visible screenshot image ${expectedImage}`,
                    errors
                )
            }
        })
    }
}

const manifestIds = new Set()
for (const entry of manifest.screenshots ?? []) {
    const id = entry.id
    const filenameBase = entry.filename.replace(/\.png$/, '')
    allowedAssetFilenames.add(entry.filename)
    for (let stepIndex = 1; stepIndex <= entry.workflowStepIds.length; stepIndex += 1) {
        allowedAssetFilenames.add(`${filenameBase}-step-${stepIndex}.png`)
    }
    assert(typeof id === 'string' && /^[a-z0-9-]+$/.test(id), `Invalid screenshot id: ${id}`, errors)
    assert(!manifestIds.has(id), `Duplicate screenshot id: ${id}`, errors)
    manifestIds.add(id)
    assert(entry.workflowStepIds.length >= 2, `${id}: each guide page must define at least two workflowStepIds`, errors)
    assert(new Set(entry.workflowStepIds).size === entry.workflowStepIds.length, `${id}: workflowStepIds must be unique`, errors)
    assert(entry.expectedDimensions?.width === 1920, `${id}: expected width must be 1920`, errors)
    assert(entry.expectedDimensions?.height === 1080, `${id}: expected height must be 1080`, errors)
    assert(entry.captureMode === 'viewport', `${id}: captureMode must be viewport`, errors)
    assert(typeof entry.state === 'string' && entry.state.length > 0, `${id}: state must be a non-empty string`, errors)
    assert(
        typeof entry.routeHint === 'string' && entry.routeHint.startsWith('/'),
        `${id}: routeHint must be an absolute application route`,
        errors
    )
    assertRequiredVisibleText(id, entry.requiredVisibleText, errors)

    if (entry.viewportMatrixRequired) {
        for (const locale of LOCALES) {
            const matrix = viewportMatrixEvidence.get(`${id}:${locale}`)
            assert(matrix, `${id}: ${locale} viewport matrix evidence is missing from provenance`, errors)
            if (matrix) {
                for (const requiredViewport of REQUIRED_VIEWPORT_MATRIX) {
                    const matched = matrix.viewports?.find(
                        (viewport) =>
                            viewport?.name === requiredViewport.name &&
                            viewport?.width === requiredViewport.width &&
                            viewport?.height === requiredViewport.height
                    )
                    assert(
                        matched,
                        `${id}: ${locale} viewport matrix evidence is missing ${requiredViewport.name} ${requiredViewport.width}x${requiredViewport.height}`,
                        errors
                    )
                }
            }
        }
    }

    for (const locale of LOCALES) {
        const docPage = path.join(ROOT, entry.docPages?.[locale] ?? '')
        assert(await fileExists(docPage), `${id}: ${locale} doc page does not exist: ${entry.docPages?.[locale]}`, errors)
        if (await fileExists(docPage)) {
            const content = await readText(docPage)
            const overviewImageCount = (content.match(new RegExp(`interpretation-network/${escapeRegExp(entry.filename)}`, 'g')) ?? [])
                .length
            assert(overviewImageCount === 1, `${id}: ${locale} doc page must reference overview screenshot exactly once`, errors)
            for (let index = 0; index < entry.workflowStepIds.length; index += 1) {
                const stepFilename = `${filenameBase}-step-${index + 1}.png`
                const stepImageCount = (content.match(new RegExp(`interpretation-network/${escapeRegExp(stepFilename)}`, 'g')) ?? []).length
                assert(stepImageCount === 1, `${id}: ${locale} doc page must reference ${stepFilename} exactly once`, errors)
            }
        }

        const assetsToInspect = [path.join(ASSET_ROOT[locale], entry.filename)]
        for (let index = 0; index < entry.workflowStepIds.length; index += 1) {
            assetsToInspect.push(path.join(ASSET_ROOT[locale], `${filenameBase}-step-${index + 1}.png`))
        }

        const stepHashes = []
        let overviewHash = null
        for (const [assetIndex, assetToInspect] of assetsToInspect.entries()) {
            assert(
                await fileExists(assetToInspect),
                `${id}: ${locale} screenshot asset does not exist: ${path.relative(ROOT, assetToInspect)}`,
                errors
            )
            if (!(await fileExists(assetToInspect))) continue

            const buffer = await readFile(assetToInspect)
            const hash = hashBuffer(buffer)
            if (assetIndex === 0) overviewHash = hash
            else stepHashes.push(hash)

            const relativeAssetPath = path.relative(ROOT, assetToInspect).replaceAll(path.sep, '/')
            const expectedAsset = expectedAssetHashes.get(relativeAssetPath)
            const expectedCapture = captureEvidence.get(relativeAssetPath)
            assert(expectedAsset, `${id}: ${locale} screenshot missing from provenance: ${relativeAssetPath}`, errors)
            assert(expectedCapture, `${id}: ${locale} screenshot missing per-capture provenance: ${relativeAssetPath}`, errors)
            if (expectedAsset) {
                assert(
                    expectedAsset.sha256 === hash,
                    `${id}: ${locale} screenshot hash differs from provenance for ${path.basename(assetToInspect)}`,
                    errors
                )
            }
            if (expectedCapture) {
                assert(expectedCapture.id === id, `${relativeAssetPath}: capture provenance id must be ${id}`, errors)
                assert(expectedCapture.locale === locale, `${relativeAssetPath}: capture provenance locale must be ${locale}`, errors)
                if (assetIndex === 0) {
                    assert(expectedCapture.captureType === 'overview', `${relativeAssetPath}: capture type must be overview`, errors)
                    assert(expectedCapture.stepId === undefined, `${relativeAssetPath}: overview capture must not declare a stepId`, errors)
                    assert(
                        expectedCapture.stepIndex === undefined,
                        `${relativeAssetPath}: overview capture must not declare a stepIndex`,
                        errors
                    )
                    assert(
                        routeMatchesHint(expectedCapture.route, entry.routeHint),
                        `${relativeAssetPath}: overview route must match routeHint ${entry.routeHint}, got ${expectedCapture.route}`,
                        errors
                    )
                } else {
                    assert(
                        expectedCapture.captureType === 'workflow-step',
                        `${relativeAssetPath}: capture type must be workflow-step`,
                        errors
                    )
                    assert(
                        expectedCapture.stepIndex === assetIndex,
                        `${relativeAssetPath}: capture stepIndex must be ${assetIndex}`,
                        errors
                    )
                    assert(
                        expectedCapture.stepId === entry.workflowStepIds[assetIndex - 1],
                        `${relativeAssetPath}: capture stepId must be ${entry.workflowStepIds[assetIndex - 1]}`,
                        errors
                    )
                }
                assert(
                    expectedCapture.viewport?.width === 1920 && expectedCapture.viewport?.height === 1080,
                    `${relativeAssetPath}: capture provenance viewport must be 1920x1080`,
                    errors
                )
                assert(
                    typeof expectedCapture.route === 'string' && !ID_LIKE_ROUTE_SEGMENT_PATTERN.test(expectedCapture.route),
                    `${relativeAssetPath}: capture provenance route must not expose route ids: ${expectedCapture.route}`,
                    errors
                )
            }
            const dimensions = readPngDimensions(buffer)
            assert(
                dimensions.width === 1920 && dimensions.height === 1080,
                `${id}: ${locale} screenshot dimensions must be 1920x1080 for ${path.basename(assetToInspect)}, got ${dimensions.width}x${
                    dimensions.height
                }`,
                errors
            )
            assertPngLooksNonBlank(`${id}: ${locale} ${path.basename(assetToInspect)}`, buffer, errors)
            if (!globalScreenshotHashes.has(hash)) globalScreenshotHashes.set(hash, [])
            globalScreenshotHashes.get(hash).push(relativeAssetPath)
        }

        assert(
            overviewHash && stepHashes.some((hash) => hash !== overviewHash),
            `${id}: ${locale} step screenshots must not all duplicate the overview`,
            errors
        )
    }
}

for (const locale of LOCALES) {
    const summary = await readText(SUMMARY_PATH[locale])
    for (const file of locale === 'en' ? enFiles : ruFiles) {
        const link = `interpretation-network/${file}`
        assert(summary.includes(`](${link})`), `${locale}/SUMMARY.md must include ${link}`, errors)
    }
    const overview = await readText(OVERVIEW_PATH[locale])
    assert(
        overview.includes('../interpretation-network/README.md'),
        `${locale}/guides/interpretation-network.md must link to the dedicated guide`,
        errors
    )
}

for (const locale of LOCALES) {
    const assetFiles = await listFilesIfExists(ASSET_ROOT[locale])
    for (const file of assetFiles) {
        if (file.endsWith('.png')) {
            assert(
                allowedAssetFilenames.has(file),
                `${locale}: stale Interpretation Network screenshot asset is not listed in manifest: ${file}`,
                errors
            )
        }
    }
}

for (const [hash, paths] of globalScreenshotHashes) {
    void hash
    assert(paths.length <= 2, `Screenshot appears duplicated across too many captures: ${paths.join(', ')}`, errors)
}

if (errors.length > 0) {
    console.error('Interpretation Network GitBook documentation check failed:')
    for (const error of errors) {
        console.error(`- ${error}`)
    }
    process.exit(1)
}

console.log('Interpretation Network GitBook documentation check passed.')
