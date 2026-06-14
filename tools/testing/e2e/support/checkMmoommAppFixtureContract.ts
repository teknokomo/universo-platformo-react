import fs from 'fs'
import path from 'path'
import { repoRoot } from './env/load-e2e-env.mjs'
import { MMOOMM_APP_FIXTURE_FILENAME, assertMmoommAppFixtureEnvelopeContract, type SnapshotEnvelope } from './mmoommAppFixtureContract.ts'

const fixturePath = path.resolve(repoRoot, 'tools', 'fixtures', MMOOMM_APP_FIXTURE_FILENAME)
const envelope = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as SnapshotEnvelope

assertMmoommAppFixtureEnvelopeContract(envelope)

console.log(`MMOOMM app fixture contract passed: ${MMOOMM_APP_FIXTURE_FILENAME}`)
