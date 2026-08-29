import fs from 'node:fs'
import path from 'node:path'

export const PLAYCANVAS_BUILTIN_SCRIPT_ASSETS = [
    { filename: 'flight-control.mjs', scriptName: 'flightControl' },
    { filename: 'follow-camera.mjs', scriptName: 'followCamera' },
    { filename: 'remote-ships.mjs', scriptName: 'remoteShips' }
] as const

const BUILTIN_ASSETS_DIRECTORY = [
    'packages',
    'universo-react-metahubs-backend',
    'src',
    'domains',
    'playcanvas-projects',
    'builtin-script-assets'
]

const resolveBuiltinAssetPath = (repoRoot: string, filename: string): string => {
    const directory = path.resolve(repoRoot, ...BUILTIN_ASSETS_DIRECTORY)
    const filePath = path.resolve(directory, filename)
    if (!filePath.startsWith(`${directory}${path.sep}`)) {
        throw new Error(`PlayCanvas builtin asset path escapes its catalog: ${filename}`)
    }
    return filePath
}

export const readCanonicalPlayCanvasBuiltinAsset = (repoRoot: string, filename: string): string =>
    fs.readFileSync(resolveBuiltinAssetPath(repoRoot, filename), 'utf8')

export const readCanonicalPlayCanvasBuiltinScriptAsset = (repoRoot: string, filename: string): string => {
    const asset = PLAYCANVAS_BUILTIN_SCRIPT_ASSETS.find((candidate) => candidate.filename === filename)
    if (!asset) {
        throw new Error(`Unknown PlayCanvas builtin script asset: ${filename}`)
    }
    return readCanonicalPlayCanvasBuiltinAsset(repoRoot, asset.filename)
}

export const assertPlayCanvasBuiltinScriptCatalog = (repoRoot: string): void => {
    const names = new Set<string>()
    for (const asset of PLAYCANVAS_BUILTIN_SCRIPT_ASSETS) {
        if (names.has(asset.scriptName)) {
            throw new Error(`Duplicate PlayCanvas builtin script name: ${asset.scriptName}`)
        }
        names.add(asset.scriptName)

        const source = readCanonicalPlayCanvasBuiltinScriptAsset(repoRoot, asset.filename)
        const scriptNamePattern = new RegExp(`static\\s+scriptName\\s*=\\s*['"]${asset.scriptName}['"]`)
        if (!/export\s+class\s+\w+\s+extends\s+Script\b/.test(source) || !scriptNamePattern.test(source)) {
            throw new Error(`PlayCanvas builtin script contract is invalid: ${asset.filename}`)
        }
        const hostContractPattern =
            asset.scriptName === 'flightControl'
                ? /bridge\.sendIntent\(intent\)/
                : asset.scriptName === 'followCamera'
                ? /bridge\.pickAt\(clientX, clientY, includeFlightPlane === true\)/
                : /bridge\.getParticipants\(\)/
        if (!source.includes('this.app?.__universoHost') || !hostContractPattern.test(source)) {
            throw new Error(`PlayCanvas builtin script host contract is missing: ${asset.filename}`)
        }
        if (source.includes('playcanvasFlightScripts.ts')) {
            throw new Error(`PlayCanvas builtin script still references removed duplicate source: ${asset.filename}`)
        }
    }

    const legacyFrontendSource = path.resolve(
        repoRoot,
        'packages',
        'universo-react-apps-template-mui',
        'src',
        'dashboard',
        'components',
        'playcanvasFlightScripts.ts'
    )
    if (fs.existsSync(legacyFrontendSource)) {
        throw new Error(`Removed PlayCanvas builtin script source is still present: ${legacyFrontendSource}`)
    }
}
