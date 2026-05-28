import fs from 'fs'
import path from 'path'
import { repoRoot } from './env/load-e2e-env.mjs'
import {
    MMOOMM_FLIGHT_ACCEPTANCE_MATRIX,
    MMOOMM_FLIGHT_FIXTURE_FILENAME,
    assertMmoommFlightFixtureEnvelopeContract,
    type SnapshotEnvelope
} from './mmoommFlightFixtureContract.ts'

const fixturePath = path.resolve(repoRoot, 'tools', 'fixtures', MMOOMM_FLIGHT_FIXTURE_FILENAME)
const envelope = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as SnapshotEnvelope

assertMmoommFlightFixtureEnvelopeContract(envelope)

console.log(`MMOOMM flight fixture contract passed: ${MMOOMM_FLIGHT_ACCEPTANCE_MATRIX.length} checks`)
