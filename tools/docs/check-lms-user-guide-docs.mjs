import { readdir, readFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import path from 'node:path'

const ROOT = process.cwd()
const MANIFEST_PATH = path.join(ROOT, 'tools/docs/lms-user-guide-screenshot-manifest.json')
const PROVENANCE_PATH = path.join(ROOT, 'tools/docs/lms-user-guide-screenshot-provenance.json')
const GENERATOR_PATH = path.join(ROOT, 'tools/testing/e2e/specs/generators/docs-lms-user-guide-screenshots.spec.ts')
const LOCALES = ['en', 'ru']
const REQUIRED_VIEWPORT_MATRIX = [
    { name: 'desktop-1920', width: 1920, height: 1080 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'mobile-390', width: 390, height: 844 }
]
const GUIDE_ROOT = {
    en: path.join(ROOT, 'docs/en/lms'),
    ru: path.join(ROOT, 'docs/ru/lms')
}
const ASSET_ROOT = {
    en: path.join(ROOT, 'docs/en/.gitbook/assets/lms-user-guide'),
    ru: path.join(ROOT, 'docs/ru/.gitbook/assets/lms-user-guide')
}
const LEGACY_LMS_GUIDE_ROOT = {
    en: path.join(ROOT, 'docs/en/guides'),
    ru: path.join(ROOT, 'docs/ru/guides')
}
const SUMMARY_PATH = {
    en: path.join(ROOT, 'docs/en/SUMMARY.md'),
    ru: path.join(ROOT, 'docs/ru/SUMMARY.md')
}
const GUIDES_README_PATH = {
    en: path.join(ROOT, 'docs/en/guides/README.md'),
    ru: path.join(ROOT, 'docs/ru/guides/README.md')
}

const TECHNICAL_TEXT_PATTERNS = [
    /\bE2E\b/i,
    /\[object Object\]/,
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
    /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z\b/,
    /\{[\s\S]{0,200}"(?:type|source|blocks|data|recordId|targetId|storageKey)"[\s\S]{0,200}\}/i
]
const ID_LIKE_ROUTE_SEGMENT_PATTERN =
    /\/(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{32})(?=\/|$|\?)/i

const USER_GUIDE_FORBIDDEN_PATTERNS = [
    ['screenshot placeholder comment', /<!--\s*screenshot:/i],
    ['disabled screenshot placeholder', /\bscreenshot:\s*none\b/i],
    ['unfinished TODO marker', /\bTODO\b/i],
    ['unfinished FIXME marker', /\bFIXME\b/i],
    ['placeholder marker', /\bplaceholder\b/i],
    ['raw ID wording', /\braw\s+IDs?\b/i],
    ['raw ISO wording', /\braw\s+ISO\b/i],
    ['raw JSON wording', /\braw\s+JSON\b/i],
    ['UUID wording', /\bUUIDs?\b/i],
    ['JSON wording', /\bJSON\b/i],
    ['object placeholder wording', /\bobject placeholders?\b/i],
    ['internal codename wording', /\binternal codenames?\b/i],
    ['row action wording', /\brow actions?\b/i],
    ['source preview wording', /\bsource preview\b/i],
    ['workspace selector wording', /\bworkspace selector\b/i],
    ['metahub wording', /\bmetahub\b/i],
    ['runtime wording', /\bruntime\b/i],
    ['source record wording', /\bsource record\b/i],
    ['progress-store wording', /\bprogress-store\b/i],
    ['application ID wording', /\bapplication IDs?\b/i],
    ['target ID wording', /\btarget IDs?\b/i],
    ['session token wording', /\bsession tokens?\b/i],
    ['raw Russian ID wording', /\bсырые\s+ID\b/i],
    ['raw Russian JSON wording', /\bсыр(?:ой|ого|ым)\s+JSON\b/i],
    ['Russian JSON field wording', /\bJSON-пол(?:я|ей)\b/i],
    ['Russian UUID wording', /\bUUID\b/i],
    ['Russian metahub wording', /\bметахаб\w*\b/i],
    ['Russian source-preview wording', /\bпредпросмотр источника\b/i],
    ['Russian row-action wording', /\bдействи(?:е|я)\s+строки\b/i],
    ['Russian workspace-switcher wording', /\bпереключатель рабочего пространства\b/i]
]
const LEGACY_LMS_USER_NAV_PATTERN =
    /\]\(guides\/lms-(?:overview|setup|learning-content|resource-model|reports|gamification|guest-access)\.md\)|\]\(lms-(?:overview|setup|learning-content|resource-model|reports|gamification|guest-access)\.md\)/i

const RU_FALLBACK_PATTERN =
    /\b(?:Learning Content|Create element|Edit element|No data to display|String must contain|Invalid input|What You Need|Workflow|Result|What To Check|Related Pages|Role|Goal)\b/
const RU_ALLOWED_LATIN_TOKEN =
    /^(?:LMS|CSV|URL|ID|JSON|UUID|HTTP|HTTPS|GitBook|TanStack|Query|React|Devtools|SCORM|xAPI|PDF|PPTX|DOCX|XLSX|MP3|MP4|FLV|MOV|Editor|js)$/i
const RU_TECHNICAL_MARKUP_LINE = /^\s*(?:---|description:|!\[|<!--)/
const RU_LINK_ONLY_LINE = /^\s*-\s+\[[^\]]+]\([^)]+\.md\)\s*$/
const MIN_RU_EN_WORD_RATIO = 0.75
const MAX_RU_EN_WORD_RATIO = 1.25
const MIN_SCREENSHOT_UNIQUE_BYTE_VALUES = 24
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/

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

function assertRequiredVisibleText(scope, requiredVisibleText, errors) {
    for (const locale of LOCALES) {
        assert(
            Array.isArray(requiredVisibleText?.[locale]) && requiredVisibleText[locale].length > 0,
            `${scope}: requiredVisibleText must define ${locale.toUpperCase()} runtime evidence strings`,
            errors
        )
        if (Array.isArray(requiredVisibleText?.[locale])) {
            requiredVisibleText[locale].forEach((text, index) => {
                assert(
                    typeof text === 'string' && text.trim().length > 0,
                    `${scope}: requiredVisibleText.${locale}[${index}] must be non-empty`,
                    errors
                )
            })
        }
    }
}

function assertRussianUserTextIsLocalized(scope, content, errors) {
    const lines = content.split('\n')
    lines.forEach((line, index) => {
        const heading = line.match(/^#{1,6}\s+(.+)$/)?.[1]?.trim()
        if (heading && /[A-Za-z]/.test(heading) && !/[\u0400-\u04FF]/.test(heading) && !isAllowedRussianLatinText(heading)) {
            errors.push(`${scope}: Russian heading at line ${index + 1} must be localized: "${heading}"`)
        }

        const tableLabel = line.match(/^\|\s*([^|]+?)\s*\|/)?.[1]?.trim()
        if (tableLabel && /[A-Za-z]/.test(tableLabel) && !/[\u0400-\u04FF]/.test(tableLabel) && !isAllowedRussianLatinText(tableLabel)) {
            errors.push(`${scope}: Russian table label at line ${index + 1} must be localized: "${tableLabel}"`)
        }

        if (RU_TECHNICAL_MARKUP_LINE.test(line) || RU_LINK_ONLY_LINE.test(line)) return

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

function isAllowedRussianLatinText(value) {
    const tokens = value.match(/[A-Za-z][A-Za-z0-9.-]*/g) ?? []
    return tokens.length > 0 && tokens.every((token) => RU_ALLOWED_LATIN_TOKEN.test(token))
}

function readPngDimensions(buffer) {
    const signature = buffer.subarray(0, 8).toString('hex')
    if (signature !== '89504e470d0a1a0a') {
        throw new Error('not a PNG file')
    }
    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20)
    }
}

function readPngImageData(buffer) {
    const signature = buffer.subarray(0, 8).toString('hex')
    if (signature !== '89504e470d0a1a0a') {
        throw new Error('not a PNG file')
    }

    const width = buffer.readUInt32BE(16)
    const height = buffer.readUInt32BE(20)
    const bitDepth = buffer.readUInt8(24)
    const colorType = buffer.readUInt8(25)
    const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0
    if (bitDepth !== 8 || bytesPerPixel === 0) {
        throw new Error(`unsupported PNG format bitDepth=${bitDepth} colorType=${colorType}`)
    }

    const chunks = []
    let offset = 8
    while (offset + 8 <= buffer.length) {
        const length = buffer.readUInt32BE(offset)
        const type = buffer.subarray(offset + 4, offset + 8).toString('ascii')
        const dataStart = offset + 8
        const dataEnd = dataStart + length
        if (type === 'IDAT') {
            chunks.push(buffer.subarray(dataStart, dataEnd))
        }
        offset = dataEnd + 4
        if (type === 'IEND') break
    }

    const inflated = inflateSync(Buffer.concat(chunks))
    const rowBytes = width * bytesPerPixel
    const pixels = Buffer.alloc(rowBytes * height)
    let sourceOffset = 0

    for (let y = 0; y < height; y += 1) {
        const filter = inflated[sourceOffset]
        sourceOffset += 1
        const rowOffset = y * rowBytes
        for (let x = 0; x < rowBytes; x += 1) {
            const raw = inflated[sourceOffset + x]
            const left = x >= bytesPerPixel ? pixels[rowOffset + x - bytesPerPixel] : 0
            const up = y > 0 ? pixels[rowOffset - rowBytes + x] : 0
            const upLeft = y > 0 && x >= bytesPerPixel ? pixels[rowOffset - rowBytes + x - bytesPerPixel] : 0
            let value = raw
            if (filter === 1) value = raw + left
            if (filter === 2) value = raw + up
            if (filter === 3) value = raw + Math.floor((left + up) / 2)
            if (filter === 4) {
                const p = left + up - upLeft
                const pa = Math.abs(p - left)
                const pb = Math.abs(p - up)
                const pc = Math.abs(p - upLeft)
                value = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)
            }
            pixels[rowOffset + x] = value & 0xff
        }
        sourceOffset += rowBytes
    }

    return pixels
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

function hashBuffer(buffer) {
    return createHash('sha256').update(buffer).digest('hex')
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function fileExists(file) {
    try {
        await stat(file)
        return true
    } catch {
        return false
    }
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

assert(provenance, 'LMS screenshot provenance file is required; regenerate screenshots with docs:lms-user-guide:screenshots', errors)
if (provenance) {
    assert(provenance.version === 1, 'LMS screenshot provenance version must be 1', errors)
    assert(
        typeof provenance.generatedAt === 'string' && ISO_TIMESTAMP_PATTERN.test(provenance.generatedAt),
        'LMS screenshot provenance must include generatedAt as an ISO timestamp',
        errors
    )
    assert(
        provenance.viewport?.width === 1920 && provenance.viewport?.height === 1080,
        'LMS screenshot provenance viewport must be 1920x1080',
        errors
    )
    assert(
        provenance.generatorSha256 === hashBuffer(await readFile(GENERATOR_PATH)),
        'LMS screenshot provenance is stale: generator hash differs',
        errors
    )
    assert(
        provenance.manifestSha256 === hashBuffer(await readFile(MANIFEST_PATH)),
        'LMS screenshot provenance is stale: manifest hash differs',
        errors
    )
    assert(Array.isArray(provenance.viewportMatrix), 'LMS screenshot provenance must include viewport matrix evidence', errors)
    assert(Array.isArray(provenance.captures), 'LMS screenshot provenance must include per-capture evidence', errors)
    assert(Array.isArray(provenance.assets), 'LMS screenshot provenance must include asset evidence', errors)
    for (const asset of provenance.assets ?? []) {
        assert(LOCALES.includes(asset.locale), `${asset.path ?? 'unknown asset'}: provenance asset locale must be en or ru`, errors)
        if (typeof asset.path === 'string') {
            const expectedLocale = asset.path.startsWith('docs/en/') ? 'en' : asset.path.startsWith('docs/ru/') ? 'ru' : null
            assert(
                expectedLocale === asset.locale,
                `${asset.path}: provenance asset locale must match localized docs path, got ${asset.locale}`,
                errors
            )
        }
    }
}

const [enFiles, ruFiles] = await Promise.all([listMarkdownFiles(GUIDE_ROOT.en), listMarkdownFiles(GUIDE_ROOT.ru)])
assert(
    JSON.stringify(enFiles) === JSON.stringify(ruFiles),
    `LMS guide page lists differ: EN=${enFiles.join(', ')} RU=${ruFiles.join(', ')}`,
    errors
)

for (const file of enFiles) {
    const enPath = path.join(GUIDE_ROOT.en, file)
    const ruPath = path.join(GUIDE_ROOT.ru, file)
    const [enContent, ruContent] = await Promise.all([readText(enPath), readText(ruPath)])
    const entry = entriesByFile.get(file)
    assert(entry, `${file}: page must be listed in LMS screenshot manifest`, errors)

    const enWordCount = countWords(enContent)
    const ruWordCount = countWords(ruContent)
    const wordRatio = enWordCount > 0 ? ruWordCount / enWordCount : 0
    assert(
        wordRatio >= MIN_RU_EN_WORD_RATIO && wordRatio <= MAX_RU_EN_WORD_RATIO,
        `${file}: RU/EN word-count ratio must stay equivalent (${ruWordCount}/${enWordCount} = ${wordRatio.toFixed(2)})`,
        errors
    )

    const checks = [
        ['heading sequence', /^#{1,6}\s+(.+)$/gm],
        ['numbered steps', /^(\d+)\.\s+/gm],
        ['image targets', /^\s*!\[[^\]]*]\(([^)]+)\)$/gm],
        ['table rows', /^(\|.*\|)$/gm]
    ]

    for (const [label, regex] of checks) {
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
        assert(countWords(content) >= 320, `${locale}/${file}: LMS guide page must be detailed enough for users`, errors)
        assert(
            locale === 'en' ? /^## Screen Details$/m.test(content) : /^## Детали экрана$/m.test(content),
            `${locale}/${file}: LMS guide page must include a localized Screen Details section`,
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
                const visibleImage = lines[index + 1] ?? ''
                const expectedImage = entry ? `lms-user-guide/${entry.filename.replace(/\.png$/, '')}-step-${stepIndex}.png` : ''
                assert(
                    /^\s*!\[[^\]]+]\([^)]+\)\s*$/.test(visibleImage) && visibleImage.includes(expectedImage),
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
    const workflowStepIds = entry.workflowStepIds ?? []
    const workflowStepIdSet = new Set(workflowStepIds)
    for (let stepIndex = 1; stepIndex <= workflowStepIds.length; stepIndex += 1) {
        allowedAssetFilenames.add(`${filenameBase}-step-${stepIndex}.png`)
    }
    assert(typeof id === 'string' && /^[a-z0-9-]+$/.test(id), `Invalid screenshot id: ${id}`, errors)
    assert(!manifestIds.has(id), `Duplicate screenshot id: ${id}`, errors)
    manifestIds.add(id)
    assert(workflowStepIds.length >= 4, `${id}: each LMS guide page must define at least four workflowStepIds`, errors)
    assert(workflowStepIdSet.size === workflowStepIds.length, `${id}: workflowStepIds must be unique`, errors)
    workflowStepIds.forEach((stepId, index) => {
        assert(
            stepId === `${id}-step-${index + 1}` || (id === 'dashboard-overview' && stepId === `README-step-${index + 1}`),
            `${id}: workflowStepIds[${index}] must match the generated step filename order`,
            errors
        )
    })

    assert(
        entry.captureMode === 'viewport' || entry.pairedContextId,
        `${id}: non-viewport/detail capture must define pairedContextId`,
        errors
    )
    assert(entry.expectedDimensions?.width === 1920, `${id}: expected width must be 1920`, errors)
    assert(entry.expectedDimensions?.height === 1080, `${id}: expected height must be 1080`, errors)
    assert(
        Array.isArray(entry.forbiddenVisibleText?.ru) && entry.forbiddenVisibleText.ru.length > 0,
        `${id}: RU forbidden fallback list is required`,
        errors
    )
    assertRequiredVisibleText(id, entry.requiredVisibleText, errors)

    if (entry.viewportMatrixRequired) {
        for (const locale of LOCALES) {
            const matrix = viewportMatrixEvidence.get(`${id}:${locale}`)
            assert(matrix, `${id}: ${locale} viewport matrix evidence is missing from provenance`, errors)
            if (matrix) {
                assert(
                    Array.isArray(matrix.viewports) && matrix.viewports.length === REQUIRED_VIEWPORT_MATRIX.length,
                    `${id}: ${locale} viewport matrix evidence must include desktop, tablet, and mobile checks`,
                    errors
                )
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

    assert(isPlainObject(entry.workflowStepEvidence), `${id}: workflowStepEvidence must be an object keyed by workflowStepIds`, errors)
    if (isPlainObject(entry.workflowStepEvidence)) {
        for (const stepId of workflowStepIds) {
            assert(
                isPlainObject(entry.workflowStepEvidence[stepId]),
                `${id}: workflowStepEvidence must define visible evidence for ${stepId}`,
                errors
            )
        }
        for (const [stepId, evidence] of Object.entries(entry.workflowStepEvidence)) {
            assert(workflowStepIdSet.has(stepId), `${id}: workflowStepEvidence references unknown workflow step id ${stepId}`, errors)
            assert(isPlainObject(evidence), `${id}: workflowStepEvidence.${stepId} must be an object`, errors)
            assertRequiredVisibleText(`${id}: workflowStepEvidence.${stepId}`, evidence?.requiredVisibleText, errors)
        }
    }

    for (const locale of LOCALES) {
        const docPage = path.join(ROOT, entry.docPages?.[locale] ?? '')
        const asset = path.join(ASSET_ROOT[locale], entry.filename)
        assert(await fileExists(docPage), `${id}: ${locale} doc page does not exist: ${entry.docPages?.[locale]}`, errors)
        assert(await fileExists(asset), `${id}: ${locale} screenshot asset does not exist: ${path.relative(ROOT, asset)}`, errors)

        if (await fileExists(docPage)) {
            const content = await readText(docPage)
            const imageCount = (content.match(new RegExp(`lms-user-guide/${escapeRegExp(entry.filename)}`, 'g')) ?? []).length
            assert(imageCount === 1, `${id}: ${locale} doc page must reference the overview screenshot image exactly once`, errors)

            for (let index = 0; index < entry.workflowStepIds.length; index += 1) {
                const stepFilename = `${filenameBase}-step-${index + 1}.png`
                const stepImageCount = (content.match(new RegExp(`lms-user-guide/${escapeRegExp(stepFilename)}`, 'g')) ?? []).length
                assert(stepImageCount === 1, `${id}: ${locale} doc page must reference ${stepFilename} exactly once`, errors)
            }
        }

        const assetsToInspect = [asset]
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

            try {
                const buffer = await readFile(assetToInspect)
                const hash = hashBuffer(buffer)
                if (assetIndex === 0) {
                    overviewHash = hash
                } else {
                    stepHashes.push(hash)
                }
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
                    assert(
                        expectedCapture.viewport?.width === 1920 && expectedCapture.viewport?.height === 1080,
                        `${relativeAssetPath}: capture provenance viewport must be 1920x1080`,
                        errors
                    )
                    assert(
                        typeof expectedCapture.route === 'string' && expectedCapture.route.length > 0,
                        `${relativeAssetPath}: capture provenance must include normalized route`,
                        errors
                    )
                    assert(
                        typeof expectedCapture.route === 'string' && !ID_LIKE_ROUTE_SEGMENT_PATTERN.test(expectedCapture.route),
                        `${relativeAssetPath}: capture provenance route must not expose raw route IDs: ${expectedCapture.route}`,
                        errors
                    )
                    if (assetIndex === 0) {
                        assert(expectedCapture.captureType === 'overview', `${relativeAssetPath}: captureType must be overview`, errors)
                    } else {
                        const expectedStepId = entry.workflowStepIds[assetIndex - 1]
                        assert(
                            expectedCapture.captureType === 'workflow-step',
                            `${relativeAssetPath}: captureType must be workflow-step`,
                            errors
                        )
                        assert(expectedCapture.stepId === expectedStepId, `${relativeAssetPath}: stepId must be ${expectedStepId}`, errors)
                        assert(expectedCapture.stepIndex === assetIndex, `${relativeAssetPath}: stepIndex must be ${assetIndex}`, errors)
                    }
                }
                const dimensions = readPngDimensions(buffer)
                assert(
                    dimensions.width === 1920 && dimensions.height === 1080,
                    `${id}: ${locale} screenshot dimensions must be 1920x1080 for ${path.basename(assetToInspect)}, got ${
                        dimensions.width
                    }x${dimensions.height}`,
                    errors
                )
                assertPngLooksNonBlank(`${id}: ${locale} ${path.basename(assetToInspect)}`, buffer, errors)
                const existingGlobalHash = globalScreenshotHashes.get(hash)
                assert(
                    !existingGlobalHash,
                    `${id}: ${locale} ${path.basename(assetToInspect)} duplicates screenshot ${existingGlobalHash ?? ''}`,
                    errors
                )
                globalScreenshotHashes.set(hash, relativeAssetPath)
            } catch (error) {
                errors.push(`${id}: ${locale} screenshot could not be inspected for ${path.basename(assetToInspect)}: ${error.message}`)
            }
        }

        const uniqueStepHashes = new Set(stepHashes)
        assert(
            uniqueStepHashes.size === stepHashes.length,
            `${id}: ${locale} workflow step screenshots must be unique, got ${uniqueStepHashes.size} unique hashes for ${stepHashes.length} steps`,
            errors
        )
        if (overviewHash && stepHashes.length > 0) {
            assert(
                stepHashes.some((hash) => hash !== overviewHash),
                `${id}: ${locale} workflow step screenshots must not all duplicate the overview screenshot`,
                errors
            )
        }
    }
}

for (const locale of LOCALES) {
    const files = await readdir(ASSET_ROOT[locale])
    for (const file of files.filter((name) => name.endsWith('.png'))) {
        const referenced = allowedAssetFilenames.has(file)
        assert(referenced, `${locale}: stale LMS user-guide asset not listed in manifest: ${file}`, errors)
    }
}

for (const locale of LOCALES) {
    const [summaryContent, guidesReadmeContent] = await Promise.all([readText(SUMMARY_PATH[locale]), readText(GUIDES_README_PATH[locale])])
    assert(
        !LEGACY_LMS_USER_NAV_PATTERN.test(summaryContent),
        `${locale}/SUMMARY.md: legacy docs/${locale}/guides/lms-* pages must not be exposed in the user-facing GitBook navigation`,
        errors
    )
    assert(
        !LEGACY_LMS_USER_NAV_PATTERN.test(guidesReadmeContent),
        `${locale}/guides/README.md: legacy LMS guide pages must not be exposed from the visible guide index`,
        errors
    )

    const guideFiles = (await readdir(LEGACY_LMS_GUIDE_ROOT[locale])).filter((file) => /^lms-.*\.md$/.test(file)).sort()
    for (const file of guideFiles) {
        const content = await readText(path.join(LEGACY_LMS_GUIDE_ROOT[locale], file))
        assert(
            !content.includes('quiz-tutorial/runtime-quiz.png'),
            `${locale}/guides/${file}: stale quiz tutorial screenshot must not be reused for LMS documentation`,
            errors
        )
    }
}

if (errors.length > 0) {
    console.error('LMS user guide documentation check failed:')
    for (const error of errors) {
        console.error(`- ${error}`)
    }
    process.exit(1)
}

process.stdout.write('LMS user guide documentation check passed.\n')
