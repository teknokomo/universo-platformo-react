import fs from 'node:fs'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const upstreamRepository = 'https://github.com/playcanvas/editor'
export const upstreamTag = 'v2.22.1'
export const upstreamCommit = '0fcd44253ba1bba39c13d45b069265167249ecb6'
export const upstreamPackageVersion = '2.22.1'
export const nodeRequirement = '>=22.22.0'
export const artifactOutputRoot = 'dist/editor'
export const smokeMode = 'artifact-only'
export const manifestFileName = 'universo-artifact-manifest.json'

const currentFile = fileURLToPath(import.meta.url)
export const packageRoot = path.resolve(path.dirname(currentFile), '..', '..')
export const repositoryRoot = path.resolve(packageRoot, '..', '..')
export const rootLockfilePath = path.join(repositoryRoot, 'pnpm-lock.yaml')
export const vendorRoot = path.join(packageRoot, 'vendor')
export const vendorSourceRoot = path.join(vendorRoot, 'playcanvas-editor')
export const upstreamManifestPath = path.join(vendorRoot, 'package.playcanvas-editor.json')
export const upstreamLicensePath = path.join(vendorRoot, 'LICENSE.playcanvas-editor')
export const noticePath = path.join(packageRoot, 'NOTICE.md')
export const artifactRoot = path.join(packageRoot, artifactOutputRoot)
export const artifactManifestPath = path.join(artifactRoot, manifestFileName)

export const createArtifactManifest = (builtAt = new Date().toISOString()) => ({
    upstreamRepository,
    upstreamTag,
    upstreamCommit,
    upstreamPackageVersion,
    nodeRequirement,
    outputRoot: artifactOutputRoot,
    smokeMode,
    builtAt
})

export const assertNodeVersion = (version = process.versions.node) => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)(?:\+[\w.-]+)?$/.exec(version)
    if (!match) {
        throw new Error(`Unsupported Node.js version string: ${version}`)
    }

    const [, majorRaw, minorRaw, patchRaw] = match
    const major = Number(majorRaw)
    const minor = Number(minorRaw)
    const patch = Number(patchRaw)
    const ok = major > 22 || (major === 22 && (minor > 22 || (minor === 22 && patch >= 0)))

    if (!ok) {
        throw new Error(`PlayCanvas Editor ${upstreamPackageVersion} requires Node.js ${nodeRequirement}; current version is ${version}`)
    }
}

export const assertVendorMetadata = () => {
    const upstreamManifest = JSON.parse(fs.readFileSync(upstreamManifestPath, 'utf8'))
    const notice = fs.readFileSync(noticePath, 'utf8')
    const license = fs.readFileSync(upstreamLicensePath, 'utf8')

    if (upstreamManifest.name !== '@playcanvas/editor') {
        throw new Error('Unexpected upstream package name')
    }
    if (upstreamManifest.version !== upstreamPackageVersion) {
        throw new Error(`Unexpected upstream package version: ${upstreamManifest.version}`)
    }
    if (upstreamManifest.engines?.node !== nodeRequirement) {
        throw new Error(`Unexpected upstream Node requirement: ${upstreamManifest.engines?.node}`)
    }
    if (!license.includes('Copyright (c) 2011-2026 PlayCanvas Ltd.')) {
        throw new Error('Upstream PlayCanvas copyright notice is missing from vendor license')
    }
    if (!notice.includes('Copyright (c) 2011-2026 PlayCanvas Ltd.')) {
        throw new Error('PlayCanvas copyright notice is missing from NOTICE.md')
    }
}

export const validateArtifactManifest = (manifest) => {
    const expected = createArtifactManifest(manifest?.builtAt)
    const allowedKeys = Object.keys(expected).sort()
    const actualKeys = Object.keys(manifest ?? {}).sort()

    if (JSON.stringify(actualKeys) !== JSON.stringify(allowedKeys)) {
        throw new Error(`Artifact manifest keys are not allowed: ${actualKeys.join(', ')}`)
    }

    for (const key of allowedKeys) {
        if (key === 'builtAt') {
            if (typeof manifest[key] !== 'string' || Number.isNaN(Date.parse(manifest[key]))) {
                throw new Error('Artifact manifest builtAt must be an ISO timestamp')
            }
            if (path.isAbsolute(manifest[key])) {
                throw new Error('Artifact manifest builtAt must not contain local absolute paths')
            }
            continue
        }
        if (manifest[key] !== expected[key]) {
            throw new Error(`Artifact manifest ${key} mismatch`)
        }
        if (typeof manifest[key] === 'string' && path.isAbsolute(manifest[key])) {
            throw new Error(`Artifact manifest ${key} must not contain local absolute paths`)
        }
    }
}

export const assertNoNestedPackageManifests = (root = packageRoot) => {
    const violations = []
    const ignoredDirs = new Set(['node_modules', 'dist', 'build', '.turbo', '.tmp', 'coverage'])

    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (ignoredDirs.has(entry.name)) continue
                walk(path.join(dir, entry.name))
                continue
            }
            if (entry.name !== 'package.json') continue
            const filePath = path.join(dir, entry.name)
            if (path.resolve(filePath) !== path.join(packageRoot, 'package.json')) {
                violations.push(path.relative(root, filePath))
            }
        }
    }

    walk(root)

    if (violations.length > 0) {
        throw new Error(`Nested package manifests are not allowed: ${violations.join(', ')}`)
    }
}

export const assertBuildScriptsDoNotInstall = (scriptRoot = path.join(packageRoot, 'scripts')) => {
    const scriptFiles = []
    const ignoredFiles = new Set(['playcanvas-editor-artifact.mjs'])
    const forbiddenPatterns = [
        /\bnpm\s+(?:install|i|ci|add|exec|x)\b/,
        /\bpnpm\s+(?:install|i|add|dlx|exec\s+(?:npm|pnpm|yarn|npx))\b/,
        /\byarn(?:\s+(?:install|add|dlx|exec))?\b/,
        /\bnpx(?:\s+\S+)?\b/,
        /\bbun\s+(?:install|i|add|x)\b/,
        /\bbunx(?:\s+\S+)?\b/,
        /\bcorepack\s+(?:prepare\b[\s\S]*?--activate\b|enable\b|install\b|(?:npm|pnpm|yarn)\s+(?:install|i|ci|add|dlx|exec)\b|exec\s+(?:npm|pnpm|yarn)\s+(?:install|i|ci|add|dlx|exec)\b)/,
        /\b(?:exec|execSync)\s*\(\s*['"`][\s\S]*?\b(?:npm\s+(?:install|i|ci|add|exec|x)|pnpm\s+(?:install|i|add|dlx|exec)|yarn(?:\s+(?:install|add|dlx|exec))?|npx(?:\s+\S+)?|bun\s+(?:install|i|add|x)|bunx(?:\s+\S+)?|corepack\s+(?:prepare|enable|install|(?:npm|pnpm|yarn)\s+(?:install|i|ci|add|dlx|exec)|exec\s+(?:npm|pnpm|yarn))|git\s+(?:clone|fetch|pull|submodule\s+update))\b[\s\S]*?['"`]/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`]npm['"`]\s*,\s*\[[\s\S]*?['"`](?:install|i|ci|add|exec|x)['"`]/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`]pnpm['"`]\s*,\s*\[[\s\S]*?['"`](?:install|i|add|dlx)['"`]/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`]pnpm['"`]\s*,\s*\[[\s\S]*?['"`]exec['"`][\s\S]*?['"`](?:npm|pnpm|yarn|npx)['"`]/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`]yarn['"`]\s*,\s*(?:\[\s*\]|\[[\s\S]*?['"`](?:install|add|dlx|exec)['"`])/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`]npx['"`]/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`]bun['"`]\s*,\s*\[[\s\S]*?['"`](?:install|i|add|x)['"`]/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`]bunx['"`]/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`]corepack['"`]\s*,\s*\[[\s\S]*?['"`](?:prepare|enable|install)['"`]/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`]corepack['"`]\s*,\s*\[[\s\S]*?['"`](?:npm|pnpm|yarn)['"`][\s\S]*?['"`](?:install|i|ci|add|dlx|exec)['"`]/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`](?:sh|bash)['"`]\s*,\s*\[[\s\S]*?['"`](?:-c|-lc)['"`][\s\S]*?['"`][\s\S]*?\b(?:npm\s+(?:install|i|ci|add|exec|x)|pnpm\s+(?:install|i|add|dlx|exec)|yarn(?:\s+(?:install|add|dlx|exec))?|npx(?:\s+\S+)?|bun\s+(?:install|i|add|x)|bunx(?:\s+\S+)?|corepack\s+(?:prepare|enable|install|(?:npm|pnpm|yarn)\s+(?:install|i|ci|add|dlx|exec)|exec\s+(?:npm|pnpm|yarn))|git\s+(?:clone|fetch|pull|submodule\s+update))\b[\s\S]*?['"`]/,
        /\bgit\s+(?:clone|fetch|pull|submodule\s+update)\b/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`]git['"`]\s*,\s*\[[\s\S]*?['"`](?:clone|fetch|pull|submodule)['"`]/
    ]

    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const entryPath = path.join(dir, entry.name)
            if (entry.isDirectory()) {
                walk(entryPath)
                continue
            }
            if (entry.name.endsWith('.mjs') && !ignoredFiles.has(entry.name)) {
                scriptFiles.push(entryPath)
            }
        }
    }

    walk(scriptRoot)

    for (const scriptPath of scriptFiles) {
        const source = fs.readFileSync(scriptPath, 'utf8')
        const relativeScriptPath = path.relative(packageRoot, scriptPath)
        for (const forbidden of forbiddenPatterns) {
            if (forbidden.test(source)) {
                throw new Error(`${relativeScriptPath} must not run unpinned install or network source commands`)
            }
        }
    }
}

export const readRootLockfileHash = () => {
    const content = fs.readFileSync(rootLockfilePath)
    return crypto.createHash('sha256').update(content).digest('hex')
}

export const assertRootLockfileHash = (expectedHash) => {
    const actualHash = readRootLockfileHash()
    if (actualHash !== expectedHash) {
        throw new Error('PlayCanvas Editor build must not mutate pnpm-lock.yaml')
    }
}

export const makeExternalTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'universo-playcanvas-editor-'))

export const writeSafeUnavailablePage = (targetRoot) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PlayCanvas Editor Artifact Unavailable</title>
  <style>
    :root { color-scheme: light dark; font-family: Arial, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f5f7fb; color: #172033; }
    main { max-width: 760px; padding: 32px; line-height: 1.5; }
    h1 { font-size: 24px; margin: 0 0 16px; }
    p { margin: 0 0 12px; overflow-wrap: anywhere; }
    [lang="ru"] { margin-top: 24px; }
    code { background: rgba(30, 41, 59, 0.08); padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <section lang="en" aria-labelledby="playcanvas-editor-artifact-title-en">
      <h1 id="playcanvas-editor-artifact-title-en">PlayCanvas Editor artifact is available</h1>
      <p>The static frontend artifact was built, but this foundation package is not connected to PlayCanvas-hosted or Universo-backed project persistence yet.</p>
      <p>Smoke mode: <code>artifact-only</code>.</p>
    </section>
    <section lang="ru" aria-labelledby="playcanvas-editor-artifact-title-ru">
      <h1 id="playcanvas-editor-artifact-title-ru">Артефакт PlayCanvas Editor доступен</h1>
      <p>Static frontend artifact собран, но этот foundation-пакет ещё не подключён к PlayCanvas-hosted или Universo-backed сохранению проектов.</p>
      <p>Режим smoke-проверки: <code>artifact-only</code>.</p>
    </section>
  </main>
</body>
</html>
`
    fs.writeFileSync(path.join(targetRoot, 'index.html'), html)
}
