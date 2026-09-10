import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { repoRoot } from './env/load-e2e-env.mjs'

const standaloneBaseUrl = process.env.E2E_MARKETING_PAGE_STANDALONE_BASE_URL?.trim() || ''
const standaloneApplicationId = process.env.E2E_MARKETING_PAGE_STANDALONE_APPLICATION_ID?.trim() || ''
const standalonePageEntityTypeId = process.env.E2E_MARKETING_PAGE_STANDALONE_PAGE_ENTITY_TYPE_ID?.trim() || ''
const standaloneObjectEntityTypeId = process.env.E2E_MARKETING_PAGE_STANDALONE_OBJECT_ENTITY_TYPE_ID?.trim() || ''
const standaloneGlobalTemplate = process.env.E2E_MARKETING_PAGE_STANDALONE_GLOBAL_TEMPLATE?.trim() || ''
const standalonePageTemplate = process.env.E2E_MARKETING_PAGE_STANDALONE_PAGE_TEMPLATE?.trim() || ''
const standaloneObjectTemplate = process.env.E2E_MARKETING_PAGE_STANDALONE_OBJECT_TEMPLATE?.trim() || ''
const artifactRunId = new Date()
    .toISOString()
    .replace(/[^0-9A-Za-z]+/g, '-')
    .replace(/-+$/g, '')
const artifactRoot = path.join(repoRoot, 'tools/testing/e2e/.artifacts/cross-template-standalone', artifactRunId)

const writeStatus = async (status, error = null) => {
    await fs.mkdir(artifactRoot, { recursive: true })
    await fs.writeFile(
        path.join(artifactRoot, 'status.json'),
        `${JSON.stringify(
            {
                status,
                baseUrlConfigured: Boolean(standaloneBaseUrl),
                applicationIdConfigured: Boolean(standaloneApplicationId),
                pageEntityTypeIdConfigured: Boolean(standalonePageEntityTypeId),
                objectEntityTypeIdConfigured: Boolean(standaloneObjectEntityTypeId),
                globalTemplateConfigured: Boolean(standaloneGlobalTemplate),
                pageTemplateConfigured: Boolean(standalonePageTemplate),
                objectTemplateConfigured: Boolean(standaloneObjectTemplate),
                error,
                finishedAt: new Date().toISOString()
            },
            null,
            2
        )}\n`,
        'utf8'
    )
}

const run = (args, env) =>
    new Promise((resolve, reject) => {
        const child = spawn('pnpm', args, {
            cwd: repoRoot,
            env,
            stdio: 'inherit',
            shell: process.platform === 'win32'
        })

        child.once('error', reject)
        child.once('close', (code, signal) => {
            if (code === 0) {
                resolve()
                return
            }
            reject(new Error(`Standalone Playwright run failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`))
        })
    })

const missingConfiguration = [
    ['E2E_MARKETING_PAGE_STANDALONE_BASE_URL', standaloneBaseUrl],
    ['E2E_MARKETING_PAGE_STANDALONE_APPLICATION_ID', standaloneApplicationId],
    ['E2E_MARKETING_PAGE_STANDALONE_PAGE_ENTITY_TYPE_ID', standalonePageEntityTypeId],
    ['E2E_MARKETING_PAGE_STANDALONE_OBJECT_ENTITY_TYPE_ID', standaloneObjectEntityTypeId],
    ['E2E_MARKETING_PAGE_STANDALONE_GLOBAL_TEMPLATE', standaloneGlobalTemplate],
    ['E2E_MARKETING_PAGE_STANDALONE_PAGE_TEMPLATE', standalonePageTemplate],
    ['E2E_MARKETING_PAGE_STANDALONE_OBJECT_TEMPLATE', standaloneObjectTemplate]
].filter(([, value]) => !value)

let parsedBaseUrl = null
let preflightError = null
if (missingConfiguration.length === 0) {
    try {
        parsedBaseUrl = new URL(standaloneBaseUrl)
        const pingResponse = await fetch(new URL('/api/v1/ping', parsedBaseUrl), { method: 'GET' })
        if (!pingResponse.ok) {
            preflightError = `standalone /api/v1/ping returned ${pingResponse.status} ${pingResponse.statusText}`
        }
    } catch (error) {
        preflightError = error instanceof Error ? error.message : String(error)
    }
}

if (missingConfiguration.length > 0 || preflightError) {
    const missing = missingConfiguration.map(([name]) => name).join(', ')
    const message = `BLOCKED: standalone cross-template acceptance requires a built standalone host with a same-origin /api/v1 proxy, repository auth setup, application and Page/Object entity type IDs, and explicit template expectations. ${
        missing ? `Missing: ${missing}. ` : ''
    }${preflightError ? `Preflight: ${preflightError}.` : ''}`
    await writeStatus('BLOCKED', message)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
} else {
    try {
        await run(
            [
                'exec',
                'node',
                'tools/testing/e2e/run-playwright-suite.mjs',
                'tools/testing/e2e/specs/flows/marketing-page-standalone-runtime.spec.ts',
                'tools/testing/e2e/specs/flows/cross-template-standalone-runtime.spec.ts',
                '--project',
                'chromium'
            ],
            {
                ...process.env,
                E2E_BASE_URL: parsedBaseUrl.toString(),
                E2E_ALLOW_REUSE_SERVER: 'true',
                E2E_FULL_RESET_MODE: 'off',
                E2E_MARKETING_PAGE_STANDALONE_BASE_URL: parsedBaseUrl.toString(),
                E2E_MARKETING_PAGE_STANDALONE_APPLICATION_ID: standaloneApplicationId,
                E2E_MARKETING_PAGE_STANDALONE_PAGE_ENTITY_TYPE_ID: standalonePageEntityTypeId,
                E2E_MARKETING_PAGE_STANDALONE_OBJECT_ENTITY_TYPE_ID: standaloneObjectEntityTypeId,
                E2E_MARKETING_PAGE_STANDALONE_GLOBAL_TEMPLATE: standaloneGlobalTemplate,
                E2E_MARKETING_PAGE_STANDALONE_PAGE_TEMPLATE: standalonePageTemplate,
                E2E_MARKETING_PAGE_STANDALONE_OBJECT_TEMPLATE: standaloneObjectTemplate
            }
        )
        await writeStatus('passed')
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await writeStatus('failed', message)
        process.exitCode = 1
    }
}
