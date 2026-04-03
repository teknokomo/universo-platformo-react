import fs from 'fs/promises'
import path from 'path'
import { chromium } from '@playwright/test'
import { cleanupE2eRun } from './support/backend/e2eCleanup.mjs'
import { fullResetE2eProject } from './support/backend/e2eFullReset.mjs'
import { provisionE2eRun } from './support/backend/e2eProvisioning.mjs'
import { artifactsDir, ensureE2eDirectories, loadE2eEnvironment, repoRoot } from './support/env/load-e2e-env.mjs'

const authSelectors = {
    emailInput: 'auth-email-input',
    passwordInput: 'auth-password-input',
    submitButton: 'auth-submit-button'
}

const toolbarSelectors = {
    primaryAction: 'toolbar-primary-action'
}

const env = loadE2eEnvironment()
ensureE2eDirectories()

const diagnosticsDir = path.resolve(artifactsDir, 'diagnostics')
const pingUrl = `${env.baseURL}/api/v1/ping`
const resolvedBaseURL = new URL(env.baseURL)
const baseCommandEnv = {
    ...process.env,
    UNIVERSO_ENV_TARGET: env.envTarget,
    UNIVERSO_ENV_FILE: env.backendEnvPath ?? process.env.UNIVERSO_ENV_FILE,
    UNIVERSO_FRONTEND_ENV_FILE: env.frontendEnvPath ?? process.env.UNIVERSO_FRONTEND_ENV_FILE,
    E2E_BASE_URL: env.baseURL,
    PORT: resolvedBaseURL.port || process.env.PORT || '3100',
    HOST: resolvedBaseURL.hostname
}

const idleMs = Number.parseInt(process.env.E2E_DIALOG_IDLE_MS || '10000', 10)
const maxHeapDeltaBytes = Number.parseInt(process.env.E2E_DIALOG_MAX_HEAP_DELTA_BYTES || `${64 * 1024 * 1024}`, 10)
const maxTaskDurationDelta = Number.parseFloat(process.env.E2E_DIALOG_MAX_TASK_DURATION || '10')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function pipeChildStream(stream, target) {
    if (!stream) {
        return
    }

    stream.setEncoding('utf8')
    stream.on('data', (chunk) => target.write(chunk))
}

async function isServerReachable() {
    try {
        const response = await fetch(pingUrl, { method: 'GET' })
        return response.ok
    } catch {
        return false
    }
}

async function waitForServerReady(timeoutMs) {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
        if (await isServerReachable()) {
            return
        }

        await sleep(1_000)
    }

    throw new Error(`Dialog diagnostics: server did not become ready at ${pingUrl} within ${timeoutMs}ms`)
}

async function startOwnedServer() {
    if (await isServerReachable()) {
        throw new Error(`Dialog diagnostics: ${env.baseURL} is already serving requests. Stop the running server first.`)
    }

    const { spawn } = await import('child_process')
    const serverProcess = spawn('pnpm', ['start'], {
        cwd: repoRoot,
        env: baseCommandEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true
    })

    pipeChildStream(serverProcess.stdout, process.stdout)
    pipeChildStream(serverProcess.stderr, process.stderr)

    const earlyExit = new Promise((_, reject) => {
        serverProcess.once('exit', (code, signal) => {
            reject(new Error(`Dialog diagnostics: server exited early (code=${code ?? 'null'}, signal=${signal ?? 'null'})`))
        })
    })

    await Promise.race([waitForServerReady(180_000), earlyExit])
    return serverProcess
}

async function stopOwnedServer(serverProcess) {
    if (!serverProcess) {
        return
    }

    const exitPromise = new Promise((resolve) => {
        serverProcess.once('exit', () => resolve())
    })

    process.kill(-serverProcess.pid, 'SIGTERM')

    const forcedKillTimer = setTimeout(() => {
        if (!serverProcess.killed) {
            process.kill(-serverProcess.pid, 'SIGKILL')
        }
    }, 15_000)

    await exitPromise
    clearTimeout(forcedKillTimer)
}

function metricsToMap(metrics) {
    return new Map(metrics.map((entry) => [entry.name, entry.value]))
}

async function main() {
    let serverProcess = null
    let browser = null
    let context = null

    await fs.mkdir(diagnosticsDir, { recursive: true })

    try {
        await fullResetE2eProject({ dryRun: false, quiet: false, reason: 'dialog-diagnostics-pre-start' })
        serverProcess = await startOwnedServer()
        await cleanupE2eRun({ quiet: true })
        const manifest = await provisionE2eRun()

        browser = await chromium.launch({
            headless: true,
            args: ['--disable-dev-shm-usage']
        })
        context = await browser.newContext()
        await context.tracing.start({ screenshots: true, snapshots: true })

        const page = await context.newPage()
        await page.goto(`${env.baseURL}${process.env.E2E_AUTH_PATH || '/auth'}`)
        await page.getByTestId(authSelectors.emailInput).fill(manifest.testUser.email)
        await page.getByTestId(authSelectors.passwordInput).fill(manifest.testUser.password)
        await page.getByTestId(authSelectors.submitButton).click()
        await page.waitForURL((url) => !url.pathname.startsWith('/auth'))

        await page.goto(`${env.baseURL}/metahubs`)
        await page.getByTestId(toolbarSelectors.primaryAction).click()
        const dialog = page.getByRole('dialog')
        await dialog.waitFor({ state: 'visible' })

        const cdpSession = await context.newCDPSession(page)
        await cdpSession.send('Performance.enable')
        const beforeMetrics = metricsToMap((await cdpSession.send('Performance.getMetrics')).metrics ?? [])

        await page.waitForTimeout(idleMs)

        const afterMetrics = metricsToMap((await cdpSession.send('Performance.getMetrics')).metrics ?? [])
        const heapBefore = beforeMetrics.get('JSHeapUsedSize') ?? 0
        const heapAfter = afterMetrics.get('JSHeapUsedSize') ?? 0
        const taskBefore = beforeMetrics.get('TaskDuration') ?? 0
        const taskAfter = afterMetrics.get('TaskDuration') ?? 0
        const heapDelta = heapAfter - heapBefore
        const taskDelta = taskAfter - taskBefore

        const metricsPath = path.resolve(diagnosticsDir, `dialog-idle-metrics-${manifest.runId}.json`)
        const tracePath = path.resolve(diagnosticsDir, `dialog-idle-trace-${manifest.runId}.zip`)

        await fs.writeFile(
            metricsPath,
            JSON.stringify(
                {
                    capturedAt: new Date().toISOString(),
                    idleMs,
                    heapBefore,
                    heapAfter,
                    heapDelta,
                    taskBefore,
                    taskAfter,
                    taskDelta
                },
                null,
                2
            )
        )

        await context.tracing.stop({ path: tracePath })

        if (heapDelta > maxHeapDeltaBytes) {
            throw new Error(
                `Dialog diagnostics exceeded heap delta threshold: ${heapDelta} bytes > ${maxHeapDeltaBytes} bytes. See ${metricsPath} and ${tracePath}.`
            )
        }

        if (taskDelta > maxTaskDurationDelta) {
            throw new Error(
                `Dialog diagnostics exceeded task-duration threshold: ${taskDelta} > ${maxTaskDurationDelta}. See ${metricsPath} and ${tracePath}.`
            )
        }

        process.stdout.write(
            `[dialog-diagnostics] OK: heap delta ${heapDelta} bytes, task delta ${taskDelta}. Artifacts: ${metricsPath}, ${tracePath}\n`
        )
    } finally {
        await context?.close().catch(() => undefined)
        await browser?.close().catch(() => undefined)
        await stopOwnedServer(serverProcess).catch(() => undefined)
        await cleanupE2eRun({ quiet: true }).catch(() => undefined)
        await fullResetE2eProject({ dryRun: false, quiet: true, reason: 'dialog-diagnostics-finalize' }).catch(() => undefined)
    }
}

main().catch((error) => {
    console.error(`[dialog-diagnostics] ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
})
