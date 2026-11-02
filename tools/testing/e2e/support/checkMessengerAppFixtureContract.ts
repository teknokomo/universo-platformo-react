import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { validateSnapshotEnvelope } from '@universo-react/utils'
import { repoRoot } from './env/load-e2e-env.mjs'
import { resolvePathInsideRepository } from './fixtureOutputPath.ts'
import { assertMessengerAppFixtureEnvelopeContract } from './messengerAppFixtureContract.ts'

export const resolveMessengerFixturePath = (input = process.env.MESSENGER_APP_FIXTURE_PATH): string =>
    resolvePathInsideRepository(
        input ?? path.join(repoRoot, 'tools', 'fixtures', 'metahubs-messenger-app-snapshot.json'),
        'Messenger fixture paths'
    )

async function main(): Promise<void> {
    const fixtureArgument = process.argv.slice(2).find((argument) => argument !== '--')
    const fixturePath = resolveMessengerFixturePath(fixtureArgument ?? process.env.MESSENGER_APP_FIXTURE_PATH)
    if (!fs.existsSync(fixturePath)) throw new Error(`Messenger App fixture is missing: ${path.relative(repoRoot, fixturePath)}`)

    const fixture = validateSnapshotEnvelope(JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as Record<string, unknown>)
    assertMessengerAppFixtureEnvelopeContract(fixture)
    process.stdout.write(`Messenger App fixture contract passed: ${path.relative(repoRoot, fixturePath)}\n`)
}

const isDirectExecution = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isDirectExecution) {
    void main().catch((error: unknown) => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
        process.exitCode = 1
    })
}
