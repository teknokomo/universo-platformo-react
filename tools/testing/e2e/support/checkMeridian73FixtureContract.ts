// 73rd Meridian Consortium fixture contract CLI driver.
// Usage:
//   node checkMeridian73FixtureContract.ts <path-to-snapshot.json>
//   MERIDIAN_73_FIXTURE_PATH=<path> node checkMeridian73FixtureContract.ts

import { readFile } from 'fs/promises'
import type { MetahubSnapshotTransportEnvelope } from '@universo-react/types'
import { validateSnapshotEnvelope } from '@universo-react/utils'
import { assertMeridian73FixtureEnvelopeContract, MERIDIAN_73_FIXTURE_FILENAME } from './meridian73FixtureContract.ts'

async function main(): Promise<void> {
    const fixturePath = process.env.MERIDIAN_73_FIXTURE_PATH ?? process.argv[2]
    if (!fixturePath) {
        throw new Error(
            `Usage: pnpm run check:73rd-meridian-fixture-contract <path> or MERIDIAN_73_FIXTURE_PATH=<path> node checkMeridian73FixtureContract.ts (default fixture: ${MERIDIAN_73_FIXTURE_FILENAME})`
        )
    }

    const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as MetahubSnapshotTransportEnvelope
    validateSnapshotEnvelope(fixture)
    assertMeridian73FixtureEnvelopeContract(fixture)
    process.stdout.write(`73rd Meridian Consortium fixture contract passed: ${fixturePath}\n`)
}

void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
})
