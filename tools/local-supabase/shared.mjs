import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const LOCAL_NETWORK_ID = 'universo-local-supabase'

export const backendEnvPathByTarget = {
    dev: path.join(REPO_ROOT, 'packages/universo-core-backend/base/.env.local-supabase'),
    e2e: path.join(REPO_ROOT, 'packages/universo-core-backend/base/.env.e2e.local-supabase')
}

export const frontendEnvPathByTarget = {
    dev: path.join(REPO_ROOT, 'packages/universo-core-frontend/base/.env.local-supabase'),
    e2e: path.join(REPO_ROOT, 'packages/universo-core-frontend/base/.env.e2e.local-supabase')
}

export const envFileByTarget = {
    dev: backendEnvPathByTarget.dev,
    e2e: backendEnvPathByTarget.e2e
}

export function parseArgs(argv) {
    const args = new Map()
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index]
        if (!token.startsWith('--')) continue

        const [key, inlineValue] = token.slice(2).split('=', 2)
        if (inlineValue !== undefined) {
            args.set(key, inlineValue)
            continue
        }

        const next = argv[index + 1]
        if (next && !next.startsWith('--')) {
            args.set(key, next)
            index += 1
        } else {
            args.set(key, 'true')
        }
    }

    return args
}

export function assertTarget(value) {
    if (value === 'dev' || value === 'e2e') return value
    throw new Error(`Unsupported target "${value}". Use "dev" or "e2e".`)
}

export function runCommand(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: options.cwd ?? REPO_ROOT,
        env: options.env ?? process.env,
        encoding: 'utf8',
        shell: false
    })

    if (result.error) {
        throw result.error
    }

    if (result.status !== 0) {
        const stderr = result.stderr?.trim()
        const stdout = result.stdout?.trim()
        const details = [stderr, stdout].filter(Boolean).join('\n')
        throw new Error(`${command} ${args.join(' ')} failed${details ? `:\n${details}` : ''}`)
    }

    return result.stdout ?? ''
}

export function parseEnvText(text) {
    const env = {}
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue

        const separatorIndex = line.indexOf('=')
        if (separatorIndex <= 0) continue

        const key = line.slice(0, separatorIndex).trim()
        let value = line.slice(separatorIndex + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
        }
        env[key] = value
    }

    return env
}

export function readEnvFile(filePath) {
    if (!existsSync(filePath)) return {}
    return parseEnvText(readFileSync(filePath, 'utf8'))
}

export function serializeEnv(env, headerLines = []) {
    const lines = [...headerLines]
    for (const [key, value] of Object.entries(env)) {
        if (value === undefined || value === null || value === '') continue
        lines.push(`${key}=${escapeEnvValue(String(value))}`)
    }
    return `${lines.join('\n')}\n`
}

function escapeEnvValue(value) {
    if (/^[A-Za-z0-9_./:@%+\-=]+$/.test(value)) return value
    return JSON.stringify(value)
}

export function firstPresent(source, keys) {
    for (const key of keys) {
        const value = source[key]
        if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return ''
}

export function isLocalHostname(hostname) {
    const normalized = hostname.toLowerCase()
    return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '[::1]'
}

export function assertLocalHttpUrl(rawUrl, label) {
    const parsed = new URL(rawUrl)
    if (!['http:', 'https:'].includes(parsed.protocol) || !isLocalHostname(parsed.hostname)) {
        throw new Error(`${label} must point to localhost or 127.0.0.1 for a local Supabase profile.`)
    }
    return parsed
}

export function assertLocalPostgresUrl(rawUrl, label) {
    const parsed = new URL(rawUrl)
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !isLocalHostname(parsed.hostname)) {
        throw new Error(`${label} must be a local PostgreSQL URL for a local Supabase profile.`)
    }
    return parsed
}

export function maskSecret(value) {
    if (!value) return ''
    if (value.length <= 12) return '***'
    return `${value.slice(0, 6)}...${value.slice(-4)}`
}

export function isMainModule(importMetaUrl) {
    return Boolean(process.argv[1]) && importMetaUrl === pathToFileURL(path.resolve(process.argv[1])).href
}
