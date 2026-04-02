import { spawn } from 'child_process'
import { loadE2eEnvironment } from './load-e2e-env.mjs'

const [, , command, ...args] = process.argv

if (!command) {
    console.error('Usage: node tools/testing/e2e/support/env/run-with-e2e-env.mjs <command> [...args]')
    process.exit(1)
}

const env = loadE2eEnvironment()

const child = spawn(command, args, {
    stdio: 'inherit',
    shell: false,
    cwd: env.repoRoot,
    env: {
        ...process.env,
        UNIVERSO_ENV_TARGET: 'e2e',
        UNIVERSO_ENV_FILE: env.backendEnvPath ?? process.env.UNIVERSO_ENV_FILE,
        UNIVERSO_FRONTEND_ENV_FILE: env.frontendEnvPath ?? process.env.UNIVERSO_FRONTEND_ENV_FILE,
        E2E_BASE_URL: env.baseURL
    }
})

child.on('exit', (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal)
        return
    }

    process.exit(code ?? 1)
})
