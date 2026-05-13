import { isMainModule, LOCAL_NETWORK_ID, parseArgs, runCommand } from './shared.mjs'

export function ensureLocalNetwork(networkId = LOCAL_NETWORK_ID) {
    try {
        runCommand('docker', ['network', 'inspect', networkId])
        return { created: false, networkId }
    } catch {
        runCommand('docker', ['network', 'create', '-o', 'com.docker.network.bridge.host_binding_ipv4=127.0.0.1', networkId])
        return { created: true, networkId }
    }
}

export async function main(argv = process.argv.slice(2)) {
    const args = parseArgs(argv)
    const result = ensureLocalNetwork(args.get('network-id') || LOCAL_NETWORK_ID)
    process.stdout.write(
        `${result.created ? `Created Docker network ${result.networkId}.` : `Docker network ${result.networkId} already exists.`}\n`
    )
}

if (isMainModule(import.meta.url)) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error)
        process.exitCode = 1
    })
}
