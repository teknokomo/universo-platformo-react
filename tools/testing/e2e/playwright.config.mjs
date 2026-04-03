import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from '@playwright/test'
import { loadE2eEnvironment, repoRoot, storageStatePath } from './support/env/load-e2e-env.mjs'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const env = loadE2eEnvironment()
const setupPattern = /.*setup\/auth\.setup\.ts/
const matrixPattern = /.*matrix\/.*\.spec\.ts/
const generatorPattern = /.*generators\/.*\.spec\.ts/

export default defineConfig({
    testDir: path.resolve(currentDir, 'specs'),
    timeout: 60_000,
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 2 : 1,
    outputDir: path.resolve(repoRoot, 'test-results'),
    reporter: [['list'], ['html', { open: 'never', outputFolder: path.resolve(repoRoot, 'playwright-report') }]],
    use: {
        baseURL: env.baseURL,
        browserName: 'chromium',
        headless: true,
        ignoreHTTPSErrors: true,
        actionTimeout: 15_000,
        navigationTimeout: 30_000,
        locale: 'en-US',
        timezoneId: 'UTC',
        colorScheme: 'light',
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        testIdAttribute: 'data-testid',
        viewport: {
            width: 1440,
            height: 900
        },
        launchOptions: {
            args: ['--disable-dev-shm-usage']
        }
    },
    expect: {
        timeout: 10_000
    },
    projects: [
        {
            name: 'setup',
            testMatch: setupPattern
        },
        {
            name: 'chromium',
            dependencies: ['setup'],
            testIgnore: [setupPattern, matrixPattern, generatorPattern],
            use: {
                storageState: storageStatePath
            }
        },
        {
            name: 'ru-light',
            dependencies: ['setup'],
            testMatch: matrixPattern,
            use: {
                storageState: { cookies: [], origins: [] },
                locale: 'ru-RU',
                colorScheme: 'light'
            }
        },
        {
            name: 'ru-dark',
            dependencies: ['setup'],
            testMatch: matrixPattern,
            use: {
                storageState: { cookies: [], origins: [] },
                locale: 'ru-RU',
                colorScheme: 'dark'
            }
        },
        {
            name: 'generators',
            dependencies: ['setup'],
            testMatch: generatorPattern,
            use: {
                storageState: storageStatePath
            }
        }
    ]
})
