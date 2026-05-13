import fs from 'fs/promises'
import { spawn } from 'child_process'
import { cleanupE2eRun } from './support/backend/e2eCleanup.mjs'
import { fullResetE2eProject } from './support/backend/e2eFullReset.mjs'
import { artifactsDir, ensureE2eDirectories, loadE2eEnvironment, repoRoot } from './support/env/load-e2e-env.mjs'

const env = loadE2eEnvironment()
ensureE2eDirectories()

const playwrightArgs = process.argv.slice(2)
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

let serverProcess = null
let runnerStopping = false
let lockHandle = null
const lockPath = `${artifactsDir}/run.lock`
const testResultsDir = `${repoRoot}/test-results`
const playwrightReportDir = `${repoRoot}/playwright-report`

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const toErrorMessage = (error) => (error instanceof Error ? error.message : String(error))

const fullResetEnabled = env.fullResetMode !== 'off'

function printRunnerSummary() {
    process.stdout.write(
        [
            `[e2e-runner] App URL: ${env.baseURL}`,
            `[e2e-runner] Backend env: ${env.backendEnvPath || 'not resolved'}`,
            `[e2e-runner] Supabase: provider=${env.supabaseProvider || 'n/a'}, isolation=${env.supabaseIsolation || 'n/a'}, localInstance=${
                env.localSupabaseInstance || 'n/a'
            }, localStack=${env.localSupabaseStack || 'n/a'}`
        ].join('\n') + '\n'
    )
}

function pipeChildStream(stream, target) {
    if (!stream) {
        return
    }

    let buffered = ''

    stream.setEncoding('utf8')
    stream.on('data', (chunk) => {
        buffered += chunk
        const lines = buffered.split(/\r?\n/)
        buffered = lines.pop() ?? ''

        for (const line of lines) {
            if (runnerStopping && line.includes('ELIFECYCLE')) {
                continue
            }

            target.write(`${line}\n`)
        }
    })

    stream.on('end', () => {
        if (!buffered) {
            return
        }

        if (!(runnerStopping && buffered.includes('ELIFECYCLE'))) {
            target.write(buffered)
        }
    })
}

const isProcessAlive = (pid) => {
    if (!Number.isInteger(pid) || pid <= 0) {
        return false
    }

    try {
        process.kill(pid, 0)
        return true
    } catch (error) {
        return !(error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH')
    }
}

async function readLockMetadata() {
    try {
        const raw = await fs.readFile(lockPath, 'utf8')
        return JSON.parse(raw)
    } catch {
        return null
    }
}

async function acquireRunLock() {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            lockHandle = await fs.open(lockPath, 'wx')
            await lockHandle.writeFile(
                JSON.stringify(
                    {
                        pid: process.pid,
                        startedAt: new Date().toISOString(),
                        baseURL: env.baseURL,
                        args: playwrightArgs
                    },
                    null,
                    2
                )
            )
            return
        } catch (error) {
            if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) {
                throw error
            }

            const existingLock = await readLockMetadata()
            if (existingLock?.pid && !isProcessAlive(existingLock.pid)) {
                await fs.rm(lockPath, { force: true })
                continue
            }

            const holder = existingLock?.pid ? `pid=${existingLock.pid}` : 'unknown holder'
            throw new Error(
                `Another e2e runner is already active (${holder}). Wait for it to finish or run 'pnpm run test:e2e:cleanup' after a crash.`
            )
        }
    }
}

async function resetPlaywrightArtifacts() {
    await fs.rm(testResultsDir, { recursive: true, force: true })
    await fs.rm(playwrightReportDir, { recursive: true, force: true })
}

async function releaseRunLock() {
    if (lockHandle) {
        await lockHandle.close()
        lockHandle = null
    }

    await fs.rm(lockPath, { force: true })
}

async function isServerReachable() {
    try {
        const response = await fetch(pingUrl, {
            method: 'GET'
        })
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

        await sleep(env.serverPollIntervalMs)
    }

    throw new Error(`E2E server did not become ready at ${pingUrl} within ${timeoutMs}ms`)
}

async function waitForServerStopped(timeoutMs) {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
        if (!(await isServerReachable())) {
            return
        }

        await sleep(Math.min(env.serverPollIntervalMs, 250))
    }

    throw new Error(`E2E server at ${env.baseURL} did not stop within ${timeoutMs}ms`)
}

function terminateServerProcess(signal) {
    if (!serverProcess) {
        return
    }

    if (process.platform !== 'win32' && Number.isInteger(serverProcess.pid) && serverProcess.pid > 0) {
        process.kill(-serverProcess.pid, signal)
        return
    }

    serverProcess.kill(signal)
}

async function startServerIfNeeded() {
    if (process.env.E2E_ALLOW_REUSE_SERVER === 'true' && fullResetEnabled) {
        throw new Error(
            'E2E_ALLOW_REUSE_SERVER=true is incompatible with E2E_FULL_RESET_MODE=strict. Set E2E_FULL_RESET_MODE=off only for manual debugging against an already running server.'
        )
    }

    if (await isServerReachable()) {
        if (process.env.E2E_ALLOW_REUSE_SERVER === 'true') {
            return false
        }

        throw new Error(
            `E2E base URL ${env.baseURL} is already serving requests. Stop the existing server or set E2E_ALLOW_REUSE_SERVER=true if you intentionally want to reuse it.`
        )
    }

    serverProcess = spawn('pnpm', ['start'], {
        cwd: repoRoot,
        env: baseCommandEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32'
    })

    pipeChildStream(serverProcess.stdout, process.stdout)
    pipeChildStream(serverProcess.stderr, process.stderr)

    const earlyExit = new Promise((_, reject) => {
        serverProcess.once('exit', (code, signal) => {
            if (!runnerStopping) {
                reject(new Error(`E2E server exited before readiness (code=${code ?? 'null'}, signal=${signal ?? 'null'})`))
            }
        })
    })

    await Promise.race([waitForServerReady(env.serverReadyTimeoutMs), earlyExit])
    return true
}

async function runFullReset(reason) {
    if (!fullResetEnabled) {
        return null
    }

    return fullResetE2eProject({ dryRun: false, quiet: false, reason })
}

async function stopServerIfOwned() {
    if (!serverProcess) {
        return
    }

    runnerStopping = true

    const exitPromise = new Promise((resolve) => {
        serverProcess.once('exit', () => resolve())
    })

    terminateServerProcess('SIGTERM')

    const forcedKillTimer = setTimeout(() => {
        if (serverProcess && !serverProcess.killed) {
            terminateServerProcess('SIGKILL')
        }
    }, 15_000)

    await exitPromise
    clearTimeout(forcedKillTimer)
    await waitForServerStopped(env.serverStopTimeoutMs)
    serverProcess = null
}

async function runPlaywrightTests(args) {
    const child = spawn('pnpm', ['exec', 'playwright', 'test', '-c', 'tools/testing/e2e/playwright.config.mjs', ...args], {
        cwd: repoRoot,
        env: baseCommandEnv,
        stdio: 'inherit'
    })

    return new Promise((resolve, reject) => {
        child.once('exit', (code, signal) => {
            if (signal) {
                reject(new Error(`Playwright test process exited with signal ${signal}`))
                return
            }

            resolve(code ?? 1)
        })
        child.once('error', reject)
    })
}

async function finalizeAndExit(code) {
    let cleanupFailed = false
    let manifestCleanupError = null
    let fullResetError = null

    if (!fullResetEnabled) {
        try {
            await cleanupE2eRun({ quiet: false })
        } catch (error) {
            manifestCleanupError = error
        }
    }

    try {
        await stopServerIfOwned()
    } catch (error) {
        cleanupFailed = true
        console.error(`[e2e-runner] Failed to stop E2E server: ${toErrorMessage(error)}`)
    }

    try {
        await runFullReset('runner-finalize')
    } catch (error) {
        cleanupFailed = true
        fullResetError = error
        console.error(`[e2e-runner] Full reset failed: ${toErrorMessage(error)}`)
    }

    if (manifestCleanupError && (!fullResetEnabled || fullResetError)) {
        console.warn(`[e2e-runner] Manifest cleanup warning: ${toErrorMessage(manifestCleanupError)}`)
    }

    try {
        await releaseRunLock()
    } catch (error) {
        cleanupFailed = true
        console.error(`[e2e-runner] Failed to release E2E run lock: ${toErrorMessage(error)}`)
    }

    process.exit(code !== 0 || cleanupFailed ? 1 : 0)
}

async function main() {
    try {
        printRunnerSummary()

        if (playwrightArgs.includes('--no-deps')) {
            throw new Error(
                'Playwright --no-deps is disallowed for the E2E runner because it bypasses setup dependencies and teardown guarantees.'
            )
        }

        await acquireRunLock()
        await resetPlaywrightArtifacts()

        if (fullResetEnabled && (await isServerReachable())) {
            throw new Error(
                `E2E full reset requires ${env.baseURL} to be stopped before the suite starts. Stop the running server or set E2E_FULL_RESET_MODE=off only for manual debugging.`
            )
        }

        await runFullReset('runner-pre-start')
        await startServerIfNeeded()
        const exitCode = await runPlaywrightTests(playwrightArgs)
        await finalizeAndExit(exitCode)
    } catch (error) {
        console.error(`[e2e-runner] ${toErrorMessage(error)}`)
        await finalizeAndExit(1)
    }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
        if (runnerStopping) {
            return
        }

        runnerStopping = true
        await finalizeAndExit(1)
    })
}

await main()
