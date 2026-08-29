import { copyFile, mkdir, stat, writeFile } from 'fs/promises'
import { createRequire } from 'module'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)

// Serves the PlayCanvas ESM build from the SPA origin so the document-level
// import map can resolve the bare `playcanvas` specifier used by published
// script assets. The file is copied from the pinned workspace dependency on
// every dev/build (gitignored — never committed).
const TARGET_RELATIVE_PATH = resolve(__dirname, '../public/vendor/playcanvas/playcanvas.mjs')
const MARKER_PATH = resolve(__dirname, '../public/vendor/playcanvas/.engine-version')

const resolveEngineEsmPath = () => {
    // `playcanvas/package.json` is not exported by the package exports map, so
    // resolve the main entry and walk up to the package directory instead.
    const engineEntryPath = require.resolve('playcanvas', {
        paths: [resolve(__dirname, '../../universo-react-playcanvas-engine')]
    })
    let packageDir = dirname(engineEntryPath)
    while (packageDir !== dirname(packageDir)) {
        try {
            const enginePackageJson = JSON.parse(require('fs').readFileSync(resolve(packageDir, 'package.json'), 'utf-8'))
            if (enginePackageJson.name === 'playcanvas') {
                return { version: enginePackageJson.version, esmPath: resolve(packageDir, 'build/playcanvas.mjs') }
            }
        } catch {
            // Keep walking up.
        }
        packageDir = dirname(packageDir)
    }
    throw new Error('Unable to locate the playcanvas package directory')
}

const main = async () => {
    const { version, esmPath } = resolveEngineEsmPath()
    try {
        const [marker, target] = await Promise.all([stat(MARKER_PATH).catch(() => null), stat(TARGET_RELATIVE_PATH).catch(() => null)])
        if (marker && target && (await readFileMarker(MARKER_PATH)) === version) {
            return
        }
    } catch {
        // Fall through to the copy below.
    }
    await mkdir(dirname(TARGET_RELATIVE_PATH), { recursive: true })
    await copyFile(esmPath, TARGET_RELATIVE_PATH)
    await writeFile(MARKER_PATH, version, 'utf-8')
    console.log(`[ensure-playcanvas-esm] served playcanvas@${version} ESM build from public/vendor/playcanvas/`)
}

const readFileMarker = async (markerPath) => {
    const { readFile } = await import('fs/promises')
    return readFile(markerPath, 'utf-8')
}

main().catch((error) => {
    console.error('[ensure-playcanvas-esm] failed to stage the PlayCanvas ESM build', error)
    process.exit(1)
})
