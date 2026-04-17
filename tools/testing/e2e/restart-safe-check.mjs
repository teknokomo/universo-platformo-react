import { spawn } from 'child_process'
import { fullResetE2eProject } from './support/backend/e2eFullReset.mjs'
import { loadE2eEnvironment, repoRoot } from './support/env/load-e2e-env.mjs'

const env = loadE2eEnvironment()
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

        await sleep(env.serverPollIntervalMs)
    }

    throw new Error(`Restart-safe check: server did not become ready at ${pingUrl} within ${timeoutMs}ms`)
}

async function waitForServerStopped(timeoutMs) {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
        if (!(await isServerReachable())) {
            return
        }

        await sleep(Math.min(env.serverPollIntervalMs, 250))
    }

    throw new Error(`Restart-safe check: server at ${pingUrl} did not stop within ${timeoutMs}ms`)
}

async function startServer() {
    if (await isServerReachable()) {
        throw new Error(`Restart-safe check: ${env.baseURL} is already serving requests. Stop the running server first.`)
    }

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
            reject(new Error(`Restart-safe check: server exited early (code=${code ?? 'null'}, signal=${signal ?? 'null'})`))
        })
    })

    await Promise.race([waitForServerReady(env.serverReadyTimeoutMs), earlyExit])
    return serverProcess
}

async function stopServer(serverProcess) {
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
    await waitForServerStopped(env.serverStopTimeoutMs)
}

async function main() {
    let firstServer = null
    let secondServer = null

    try {
        await fullResetE2eProject({ dryRun: false, quiet: false, reason: 'restart-safe-pre-start' })

        firstServer = await startServer()
        await stopServer(firstServer)
        firstServer = null

        await sleep(Number.parseInt(process.env.E2E_RESTART_SAFE_DELAY_MS || '1000', 10))

        secondServer = await startServer()
        await stopServer(secondServer)
        secondServer = null

        await fullResetE2eProject({ dryRun: false, quiet: false, reason: 'restart-safe-finalize' })

        process.stdout.write(`[restart-safe] OK: sequential start-stop-start succeeded against ${env.baseURL}\n`)
    } finally {
        await stopServer(firstServer).catch(() => undefined)
        await stopServer(secondServer).catch(() => undefined)
        await fullResetE2eProject({ dryRun: false, quiet: true, reason: 'restart-safe-finally' }).catch(() => undefined)
    }
}

main().catch((error) => {
    console.error(`[restart-safe] ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
})
