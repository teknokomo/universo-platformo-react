import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { readPngDimensions } from '../testing/e2e/support/pngDimensions.mjs'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const PROVENANCE_PATH = path.join(ROOT, 'tools/docs/marketing-page-screenshot-provenance.json')
const MANIFEST_PATH = path.join(ROOT, 'tools/docs/marketing-page-screenshot-manifest.json')
const EXPECTED_GENERATOR = 'tools/testing/e2e/specs/generators/docs-marketing-page-screenshots.spec.ts'
const EXPECTED_MANIFEST = 'tools/docs/marketing-page-screenshot-manifest.json'
const EXPECTED_SOURCE_TEMPLATE = 'packages/universo-react-metahubs-backend/src/domains/templates/data/marketing-page.template.ts'
const EXPECTED_SEED_INPUTS = [
    'packages/universo-react-metahubs-backend/src/domains/templates/data/basic.template.ts',
    'packages/universo-react-metahubs-backend/src/domains/templates/data/marketing-page.hero.ts',
    'packages/universo-react-metahubs-backend/src/domains/templates/data/marketing-page.layouts.ts',
    'packages/universo-react-metahubs-backend/src/domains/templates/data/marketing-page.seed-helpers.ts'
]

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')
const resolveRepoPath = (relativePath) => {
    const absolutePath = path.resolve(ROOT, relativePath)
    if (!absolutePath.startsWith(`${ROOT}${path.sep}`)) {
        throw new Error(`Provenance path escapes the repository: ${relativePath}`)
    }
    return absolutePath
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const errors = []
let provenance
let manifest
try {
    provenance = JSON.parse(await readFile(PROVENANCE_PATH, 'utf8'))
    manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))
} catch (error) {
    console.error(`Marketing-page screenshot provenance check failed: ${error.message}`)
    process.exit(1)
}

if (!isRecord(provenance) || !isRecord(manifest)) {
    console.error('Marketing-page screenshot provenance check failed: provenance and manifest must be JSON objects')
    process.exit(1)
}

if (provenance.version !== 3) errors.push('provenance version must be 3')
if (manifest.version !== 1) errors.push('screenshot manifest version must be 1')
if (!Array.isArray(manifest.screenshots)) errors.push('manifest screenshots must be an array')
if (manifest.routePattern !== '/a/{applicationId}?locale={locale}&themeVariant=light') {
    errors.push('manifest route pattern must identify the public marketing application and locale')
}
if (manifest.scope !== 'public-published-application') errors.push('manifest scope must be public-published-application')
if (manifest.browser !== 'chromium' || manifest.theme !== 'light') errors.push('manifest browser/theme must be Chromium/light')
const manifestViewport = isRecord(manifest.viewport) ? manifest.viewport : {}
if (manifestViewport.width !== 1440 || manifestViewport.height !== 900) errors.push('manifest viewport must be 1440x900')
if (manifest.fullPage !== true) errors.push('manifest screenshots must capture the full page')
if (provenance.routePattern !== manifest.routePattern) errors.push('provenance route pattern differs from the manifest')
if (provenance.scope !== manifest.scope) errors.push('provenance scope differs from the manifest')
if (provenance.browser !== manifest.browser || provenance.theme !== manifest.theme) {
    errors.push('provenance browser/theme differs from the manifest')
}
if (provenance.captureMethod !== 'playwright.page.screenshot')
    errors.push('screenshots must record Playwright page.screenshot as the capture method')
if (
    !provenance.viewport ||
    provenance.viewport.width !== manifestViewport.width ||
    provenance.viewport.height !== manifestViewport.height
) {
    errors.push('provenance viewport differs from the manifest')
}
if (!Number.isFinite(Date.parse(provenance.generatedAt ?? ''))) errors.push('provenance generatedAt must be a valid timestamp')

for (const [field, expectedPath, hashField] of [
    ['generator', EXPECTED_GENERATOR, 'generatorSha256'],
    ['manifest', EXPECTED_MANIFEST, 'manifestSha256'],
    ['sourceTemplate', EXPECTED_SOURCE_TEMPLATE, 'sourceTemplateSha256']
]) {
    if (provenance[field] !== expectedPath) {
        errors.push(`${field} path must be ${expectedPath}`)
        continue
    }
    try {
        const file = await readFile(resolveRepoPath(expectedPath))
        if (sha256(file) !== provenance[hashField]) errors.push(`${field} hash differs from provenance`)
    } catch (error) {
        errors.push(`${field} cannot be read: ${error.message}`)
    }
}

if (!Array.isArray(provenance.seedInputs)) {
    errors.push('provenance seedInputs must be an array')
} else {
    if (provenance.seedInputs.length !== EXPECTED_SEED_INPUTS.length) {
        errors.push('seed input count differs from the expected template dependencies')
    }
    const seenSeedInputs = new Set()
    for (const [index, expectedPath] of EXPECTED_SEED_INPUTS.entries()) {
        const seedInput = provenance.seedInputs[index]
        if (!isRecord(seedInput)) {
            errors.push(`seed input entry ${index} must be an object`)
            continue
        }
        if (seedInput.path !== expectedPath) errors.push(`seed input ${index} path must be ${expectedPath}`)
        if (seenSeedInputs.has(seedInput.path)) errors.push(`duplicate seed input entry: ${seedInput.path}`)
        seenSeedInputs.add(seedInput.path)
        try {
            const bytes = await readFile(resolveRepoPath(expectedPath))
            if (sha256(bytes) !== seedInput.sha256) errors.push(`seed input hash differs from provenance: ${expectedPath}`)
        } catch (error) {
            errors.push(`seed input cannot be read (${expectedPath}): ${error.message}`)
        }
    }
}

const expectedScreenshots = Array.isArray(manifest.screenshots) ? manifest.screenshots : []
if (!Array.isArray(provenance.captures)) errors.push('provenance captures must be an array')
const captures = Array.isArray(provenance.captures) ? provenance.captures.filter(isRecord) : []
if (Array.isArray(manifest.screenshots) && expectedScreenshots.some((entry) => !isRecord(entry))) {
    errors.push('every manifest screenshot entry must be an object')
}
if (Array.isArray(provenance.captures) && captures.length !== provenance.captures.length) {
    errors.push('every provenance capture entry must be an object')
}
const capturesById = new Map()
for (const capture of captures) {
    if (typeof capture.id !== 'string' || capture.id.length === 0) errors.push('capture id must be a non-empty string')
    if (capturesById.has(capture.id)) errors.push(`duplicate capture entry: ${capture.id}`)
    capturesById.set(capture.id, capture)
}
if (captures.length !== expectedScreenshots.length) errors.push('capture count differs from the manifest')
const validExpectedScreenshots = expectedScreenshots.filter(isRecord)
if (validExpectedScreenshots.length !== 2 || new Set(validExpectedScreenshots.map((entry) => entry.locale)).size !== 2) {
    errors.push('manifest must contain exactly one English and one Russian screenshot')
}

const expectedAssets = {
    en: {
        id: 'marketing-page-runtime-en-light',
        path: 'docs/en/.gitbook/assets/marketing-page/marketing-page-runtime-en-light.png',
        requiredVisibleText: 'Our latest products',
        forbiddenVisibleText: 'Наши новые продукты'
    },
    ru: {
        id: 'marketing-page-runtime-ru-light',
        path: 'docs/ru/.gitbook/assets/marketing-page/marketing-page-runtime-ru-light.png',
        requiredVisibleText: 'Наши новые продукты',
        forbiddenVisibleText: 'Our latest products'
    }
}

const assetPaths = new Set()
if (!Array.isArray(provenance.assets)) errors.push('provenance assets must be an array')
const provenanceAssets = Array.isArray(provenance.assets) ? provenance.assets.filter(isRecord) : []
if (Array.isArray(provenance.assets) && provenanceAssets.length !== provenance.assets.length) {
    errors.push('every provenance asset entry must be an object')
}
const provenanceAssetsByPath = new Map()
for (const asset of provenanceAssets) {
    if (typeof asset.path !== 'string' || asset.path.length === 0) errors.push('provenance asset path must be a non-empty string')
    if (provenanceAssetsByPath.has(asset.path)) errors.push(`duplicate provenance asset entry: ${asset.path}`)
    provenanceAssetsByPath.set(asset.path, asset)
}
if (provenanceAssets.length !== expectedScreenshots.length) errors.push('asset count differs from the manifest')

for (const entry of validExpectedScreenshots) {
    const expectedAsset = expectedAssets[entry.locale]
    if (!expectedAsset) {
        errors.push(`unsupported locale in manifest: ${entry.locale}`)
        continue
    }
    if (entry.id !== expectedAsset.id) errors.push(`manifest id is invalid for ${entry.locale}`)
    if (entry.path !== expectedAsset.path) errors.push(`manifest path is invalid for ${entry.locale}`)
    if (entry.requiredVisibleText !== expectedAsset.requiredVisibleText) {
        errors.push(`manifest visible heading is invalid for ${entry.locale}`)
    }
    if (entry.forbiddenVisibleText !== expectedAsset.forbiddenVisibleText) {
        errors.push(`manifest opposite-locale heading is invalid for ${entry.locale}`)
    }
    if (entry.id !== expectedAsset.id || entry.path !== expectedAsset.path) continue

    const capture = capturesById.get(entry.id)
    if (!capture) {
        errors.push(`missing capture entry: ${entry.id}`)
        continue
    }
    if (capture.locale !== entry.locale) errors.push(`capture locale differs from manifest: ${entry.id}`)
    if (capture.path !== entry.path) errors.push(`capture path differs from manifest: ${entry.id}`)
    if (capture.route !== manifest.routePattern) errors.push(`capture route differs from manifest: ${entry.id}`)
    if (capture.scope !== manifest.scope) errors.push(`capture scope differs from manifest: ${entry.id}`)
    if (capture.browser !== manifest.browser || capture.theme !== manifest.theme) {
        errors.push(`capture browser/theme differs from manifest: ${entry.id}`)
    }
    if (capture.captureMethod !== provenance.captureMethod) errors.push(`capture method differs from provenance: ${entry.id}`)
    if (capture.viewport?.width !== manifestViewport.width || capture.viewport?.height !== manifestViewport.height) {
        errors.push(`capture viewport differs from manifest: ${entry.id}`)
    }
    if (!entry.path.startsWith(`docs/${entry.locale}/.gitbook/assets/marketing-page/`)) {
        errors.push(`capture asset is outside its locale GitBook tree: ${entry.path}`)
    }
    if (assetPaths.has(entry.path)) errors.push(`duplicate screenshot path: ${entry.path}`)
    assetPaths.add(entry.path)

    try {
        const buffer = await readFile(resolveRepoPath(entry.path))
        const dimensions = readPngDimensions(buffer)
        if (sha256(buffer) !== capture.sha256) errors.push(`capture hash differs from screenshot: ${entry.path}`)
        if (dimensions.width !== manifestViewport.width || dimensions.height < manifestViewport.height) {
            errors.push(`screenshot dimensions are invalid for ${entry.path}: ${dimensions.width}x${dimensions.height}`)
        }
        if (dimensions.width !== capture.dimensions?.width || dimensions.height !== capture.dimensions?.height) {
            errors.push(`capture dimensions differ from screenshot: ${entry.path}`)
        }
        const asset = provenanceAssetsByPath.get(entry.path)
        if (!asset) {
            errors.push(`missing provenance asset entry: ${entry.path}`)
        } else {
            if (asset.id !== entry.id || asset.locale !== entry.locale || asset.sha256 !== capture.sha256) {
                errors.push(`provenance asset identity/hash differs from capture: ${entry.path}`)
            }
            if (asset.dimensions?.width !== dimensions.width || asset.dimensions?.height !== dimensions.height) {
                errors.push(`provenance asset dimensions differ from screenshot: ${entry.path}`)
            }
        }
    } catch (error) {
        errors.push(`screenshot cannot be read: ${entry.path} (${error.message})`)
    }

    try {
        const docsPath = path.join(ROOT, `docs/${entry.locale}/platform/marketing-page-template.md`)
        const docs = await readFile(docsPath, 'utf8')
        const references = [...docs.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1])
        const marketingReferences = references.filter((reference) => /marketing-page-runtime-(?:en|ru)-light\.png$/.test(reference))
        const expectedReference = path.relative(path.dirname(docsPath), resolveRepoPath(entry.path)).split(path.sep).join('/')
        if (marketingReferences.length !== 1 || marketingReferences[0] !== expectedReference) {
            errors.push(`${entry.locale} marketing-page docs must reference only its locale screenshot (${expectedReference})`)
        }
    } catch (error) {
        errors.push(`cannot validate ${entry.locale} marketing-page docs image link: ${error.message}`)
    }

    try {
        const architectureDocsPath = path.join(ROOT, `docs/${entry.locale}/architecture/entity-backed-widgets.md`)
        const architectureDocs = await readFile(architectureDocsPath, 'utf8')
        const references = [...architectureDocs.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1])
        const marketingReferences = references.filter((reference) => /marketing-page-runtime-(?:en|ru)-light\.png$/.test(reference))
        const expectedReference = path.relative(path.dirname(architectureDocsPath), resolveRepoPath(entry.path)).split(path.sep).join('/')
        if (marketingReferences.length !== 1 || marketingReferences[0] !== expectedReference) {
            errors.push(`${entry.locale} entity-backed widget docs must reference only its locale screenshot (${expectedReference})`)
        }
    } catch (error) {
        errors.push(`cannot validate ${entry.locale} entity-backed widget docs image link: ${error.message}`)
    }
}

if (errors.length > 0) {
    console.error('Marketing-page screenshot provenance check failed:')
    for (const error of errors) console.error(`- ${error}`)
    process.exit(1)
}

process.stdout.write('Marketing-page EN/RU screenshot provenance, route/scope, and GitBook links passed.\n')
