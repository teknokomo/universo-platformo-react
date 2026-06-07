#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const run = (command, args, options = {}) => {
    const result = spawnSync(command, args, {
        stdio: 'inherit',
        env: {
            ...process.env,
            ...options.env
        }
    })
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`)
    }
}

run(process.execPath, ['scripts/build-editor.mjs'], {
    env: {
        UNIVERSO_PLAYCANVAS_EDITOR_ARTIFACT_MODE: 'universo-hosted'
    }
})
run('playwright', ['test', '--config', 'playwright.artifact.config.ts'])
