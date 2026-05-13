import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateSnapshotEnvelope } from '../snapshotArchive'

const FIXTURES_DIR = path.resolve(process.cwd(), '../../../tools/fixtures')

const SNAPSHOT_FIXTURES = ['metahubs-lms-app-snapshot.json', 'metahubs-quiz-app-snapshot.json', 'metahubs-self-hosted-app-snapshot.json']

describe('committed metahub snapshot fixtures', () => {
    it.each(SNAPSHOT_FIXTURES)('keeps %s importable by the runtime validator', (fixtureName) => {
        const fixturePath = path.join(FIXTURES_DIR, fixtureName)
        const envelope = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as unknown

        const result = validateSnapshotEnvelope(envelope)

        expect(result.kind).toBe('metahub_snapshot_bundle')
        expect(result.snapshotHash).toMatch(/^[a-f0-9]{64}$/)
    })
})
