import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveFixtureOutputPath } from './fixtureOutputPath.ts'
import { repoRoot } from './env/load-e2e-env.mjs'

test('fixture generators resolve to an ignored artifact by default', () => {
    const environmentKey = 'TEST_FIXTURE_OUTPUT_PATH'
    const previous = process.env[environmentKey]
    delete process.env[environmentKey]

    try {
        assert.equal(
            path.relative(repoRoot, resolveFixtureOutputPath(environmentKey, 'sample.json')),
            path.join('tools', 'testing', 'e2e', '.artifacts', 'generated-sample.json')
        )
    } finally {
        if (previous === undefined) delete process.env[environmentKey]
        else process.env[environmentKey] = previous
    }
})

test('fixture generators accept isolated repository artifact paths and reject path traversal', () => {
    const environmentKey = 'TEST_FIXTURE_OUTPUT_PATH'
    const previous = process.env[environmentKey]

    try {
        process.env[environmentKey] = 'tools/testing/e2e/.artifacts/generated-sample.json'
        assert.equal(
            path.relative(repoRoot, resolveFixtureOutputPath(environmentKey, 'sample.json')),
            path.join('tools', 'testing', 'e2e', '.artifacts', 'generated-sample.json')
        )

        process.env[environmentKey] = '../outside.json'
        assert.throws(() => resolveFixtureOutputPath(environmentKey, 'sample.json'), /inside the repository/)
    } finally {
        if (previous === undefined) delete process.env[environmentKey]
        else process.env[environmentKey] = previous
    }
})

test('fixture generators reject symlink traversal outside the repository', () => {
    const environmentKey = 'TEST_FIXTURE_OUTPUT_PATH'
    const previous = process.env[environmentKey]
    const externalDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'universo-fixture-output-'))
    const symlinkPath = path.join(repoRoot, 'tools', 'testing', 'e2e', `.fixture-output-${process.pid}-${Date.now()}`)

    try {
        fs.symlinkSync(externalDirectory, symlinkPath, 'dir')
        process.env[environmentKey] = path.join(path.relative(repoRoot, symlinkPath), 'generated.json')

        assert.throws(() => resolveFixtureOutputPath(environmentKey, 'sample.json'), /symbolic links/u)
    } finally {
        if (previous === undefined) delete process.env[environmentKey]
        else process.env[environmentKey] = previous
        fs.rmSync(symlinkPath, { force: true })
        fs.rmSync(externalDirectory, { recursive: true, force: true })
    }
})
