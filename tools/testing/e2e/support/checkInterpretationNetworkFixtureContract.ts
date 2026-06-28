// Interpretation Network fixture contract CLI driver.
// Usage:
//   node checkInterpretationNetworkFixtureContract.ts <path-to-snapshot.json>
//   INTERPRETATION_NETWORK_FIXTURE_PATH=<path> node checkInterpretationNetworkFixtureContract.ts
//
// The default script (`pnpm check:interpretation-network-fixture-contract`) hard-codes
// the committed fixture path. The `test:e2e:interpretation-network-fixture-gate`
// script invokes this driver with `INTERPRETATION_NETWORK_FIXTURE_PATH` so that the
// freshly-generated artifact (not the committed fixture) is what the
// gate actually validates.

import { readFile } from 'fs/promises'
import type { MetahubSnapshotTransportEnvelope } from '@universo-react/types'
import { validateSnapshotEnvelope } from '@universo-react/utils'
import { assertInterpretationNetworkFixtureEnvelopeContract } from './interpretationNetworkFixtureContract.ts'

async function main(): Promise<void> {
    const fixturePath = process.env.INTERPRETATION_NETWORK_FIXTURE_PATH ?? process.argv[2]
    if (!fixturePath) {
        throw new Error(
            'Usage: pnpm run check:interpretation-network-fixture-contract <path> or INTERPRETATION_NETWORK_FIXTURE_PATH=<path> node checkInterpretationNetworkFixtureContract.ts'
        )
    }

    const raw = await readFile(fixturePath, 'utf8')
    const fixture = JSON.parse(raw) as MetahubSnapshotTransportEnvelope
    validateSnapshotEnvelope(fixture)
    assertInterpretationNetworkFixtureEnvelopeContract(fixture)
    process.stdout.write(`Interpretation Network fixture contract passed: ${fixturePath}\n`)
}

void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
})
