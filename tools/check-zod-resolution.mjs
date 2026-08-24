import fs from 'node:fs'
import path from 'node:path'

const ROOT_DIR = process.cwd()
const LOCKFILE_PATH = path.join(ROOT_DIR, 'pnpm-lock.yaml')
const ROOT_PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json')

const REQUIRED_ZOD_OVERRIDE = '3.25.76'

const fail = (message) => {
    console.error(`[check-zod-resolution] FAIL: ${message}`)
    process.exit(1)
}

const readRootOverride = () => {
    const rootPackageJson = JSON.parse(fs.readFileSync(ROOT_PACKAGE_JSON_PATH, 'utf8'))
    const override = rootPackageJson?.pnpm?.overrides?.zod
    if (override !== REQUIRED_ZOD_OVERRIDE) {
        fail(`root pnpm.overrides.zod must stay "${REQUIRED_ZOD_OVERRIDE}", found "${String(override)}"`)
    }
}

const collectZodLockfileVersions = () => {
    if (!fs.existsSync(LOCKFILE_PATH)) {
        fail('pnpm-lock.yaml not found; run pnpm install first')
    }
    const lockfile = fs.readFileSync(LOCKFILE_PATH, 'utf8')
    const versions = new Set()
    for (const match of lockfile.matchAll(/zod@(\d+\.\d+\.\d+(?:-[0-9a-zA-Z.]+)?)/g)) {
        versions.add(match[1])
    }
    return [...versions]
}

const main = () => {
    readRootOverride()

    const versions = collectZodLockfileVersions()
    if (versions.length === 0) {
        fail('no zod entries found in the lockfile; expected a resolved zod@3.x dependency set')
    }

    const major4 = versions.filter((version) => version.startsWith('4.') || version === '4')
    if (major4.length > 0) {
        fail(`zod v4 resolved in the lockfile (${major4.join(', ')}); the repository pins zod ${REQUIRED_ZOD_OVERRIDE}`)
    }

    console.log(
        `[check-zod-resolution] OK: override=${REQUIRED_ZOD_OVERRIDE}, lockfile zod versions=[${versions.slice().sort().join(', ')}]`
    )
}

main()
