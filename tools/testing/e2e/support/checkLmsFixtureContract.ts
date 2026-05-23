import { readFile } from 'fs/promises'
import { assertLmsFixtureEnvelopeContract, type SnapshotEnvelope } from './lmsFixtureContract.ts'

async function main(): Promise<void> {
    const fixturePath = process.argv[2]
    if (!fixturePath) {
        throw new Error('Usage: pnpm run check:lms-fixture-contract')
    }

    const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as SnapshotEnvelope
    assertLmsFixtureEnvelopeContract(fixture)
    process.stdout.write(`LMS fixture contract passed: ${fixturePath}\n`)
}

void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
})
