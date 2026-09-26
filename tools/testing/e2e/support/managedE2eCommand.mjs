import { spawn } from 'node:child_process'

function processIsAlive(processGroupId) {
    try {
        process.kill(-processGroupId, 0)
        return true
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH') return false
        return true
    }
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function waitForProcessGroupExit(processGroupId, timeoutMs) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        if (!processIsAlive(processGroupId)) return true
        await sleep(100)
    }
    return !processIsAlive(processGroupId)
}

async function stopProcessGroup(processGroupId) {
    if (await waitForProcessGroupExit(processGroupId, 1000)) return

    try {
        process.kill(-processGroupId, 'SIGTERM')
    } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH')) throw error
    }
    if (await waitForProcessGroupExit(processGroupId, 5000)) return

    try {
        process.kill(-processGroupId, 'SIGKILL')
    } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH')) throw error
    }
    if (!(await waitForProcessGroupExit(processGroupId, 5000))) {
        throw new Error(`E2E child process group ${processGroupId} remains active after termination`)
    }
}

export function createManagedE2eCommandRunner({ cwd, onUncertainProcessGroup = () => {} }) {
    let activeChild = null
    let activeProcessGroupId = null
    let receivedSignal = null
    let uncertainProcessGroup = false
    const processGroupStopTasks = new Map()

    function markProcessGroupUncertain(error) {
        if (uncertainProcessGroup) return
        uncertainProcessGroup = true
        onUncertainProcessGroup(error)
    }

    function ensureProcessGroupStopped(processGroupId) {
        let stopTask = processGroupStopTasks.get(processGroupId)
        if (!stopTask) {
            stopTask = stopProcessGroup(processGroupId).finally(() => processGroupStopTasks.delete(processGroupId))
            processGroupStopTasks.set(processGroupId, stopTask)
        }
        return stopTask
    }

    function signalActiveProcess(signal) {
        if (process.platform !== 'win32' && activeProcessGroupId) {
            const processGroupId = activeProcessGroupId
            try {
                process.kill(-processGroupId, signal)
            } catch (error) {
                if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH')) {
                    markProcessGroupUncertain(error)
                }
            }
            void ensureProcessGroupStopped(processGroupId).catch(markProcessGroupUncertain)
            return
        }

        if (activeChild && activeChild.exitCode === null) activeChild.kill(signal)
    }

    function handleSignal(signal, { setExitCode = true } = {}) {
        if (receivedSignal) {
            signalActiveProcess('SIGKILL')
            return
        }
        receivedSignal = signal
        if (setExitCode) process.exitCode = signal === 'SIGINT' ? 130 : 143
        signalActiveProcess(signal)
    }

    const signalHandlers = new Map(
        ['SIGINT', 'SIGTERM'].map((signal) => {
            const handler = () => handleSignal(signal)
            process.on(signal, handler)
            return [signal, handler]
        })
    )

    function run(command, args, { env = {}, captureOutput = false, allowAfterSignal = false, onStarted } = {}) {
        return new Promise((resolve, reject) => {
            if (receivedSignal && !allowAfterSignal) {
                reject(new Error(`E2E gate interrupted by ${receivedSignal}`))
                return
            }

            const detached = process.platform !== 'win32'
            const child = spawn(command, args, {
                cwd,
                stdio: captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
                shell: process.platform === 'win32',
                detached,
                env: { ...process.env, ...env }
            })
            activeChild = child
            if (detached && child.pid) activeProcessGroupId = child.pid
            if (onStarted) child.once('spawn', onStarted)

            let output = ''
            if (captureOutput) {
                child.stdout.setEncoding('utf8')
                child.stderr.setEncoding('utf8')
                child.stdout.on('data', (chunk) => (output += chunk))
                child.stderr.on('data', (chunk) => (output += chunk))
            }

            child.on('error', (error) => {
                if (activeChild === child) activeChild = null
                reject(error)
            })
            child.on('close', async (code, signal) => {
                if (activeChild === child) activeChild = null
                if (detached && child.pid) {
                    try {
                        await ensureProcessGroupStopped(child.pid)
                    } catch (error) {
                        markProcessGroupUncertain(error)
                        reject(error)
                        return
                    } finally {
                        if (activeProcessGroupId === child.pid) activeProcessGroupId = null
                    }
                }

                if (receivedSignal && !allowAfterSignal) {
                    reject(new Error(`E2E gate interrupted by ${receivedSignal}`))
                    return
                }

                const result = { code: code ?? 1, output }
                if (captureOutput || code === 0) {
                    resolve(result)
                    return
                }
                reject(new Error(`${command} ${args.join(' ')} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`))
            })
        })
    }

    return {
        run,
        requestShutdown(signal) {
            handleSignal(signal, { setExitCode: false })
        },
        get receivedSignal() {
            return receivedSignal
        },
        get hasUncertainProcessGroup() {
            return uncertainProcessGroup
        },
        dispose() {
            for (const [signal, handler] of signalHandlers) process.off(signal, handler)
        }
    }
}
