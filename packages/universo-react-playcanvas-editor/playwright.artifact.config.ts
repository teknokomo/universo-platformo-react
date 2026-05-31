import path from 'node:path'
import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: path.resolve(__dirname, 'e2e'),
    timeout: 60_000,
    fullyParallel: false,
    workers: 1,
    outputDir: path.resolve(__dirname, '../../test-results/playcanvas-editor-smoke'),
    reporter: [['list'], ['html', { open: 'never', outputFolder: path.resolve(__dirname, '../../playwright-report/playcanvas-editor') }]],
    use: {
        baseURL: 'http://127.0.0.1:3487',
        browserName: 'chromium',
        headless: true,
        ignoreHTTPSErrors: true,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
    },
    projects: [
        {
            name: 'desktop',
            use: { viewport: { width: 1920, height: 1080 } }
        },
        {
            name: 'tablet',
            use: { viewport: { width: 768, height: 1024 } }
        },
        {
            name: 'mobile',
            use: { viewport: { width: 390, height: 844 } }
        }
    ],
    webServer: {
        command: 'node scripts/serve-editor.mjs --host 127.0.0.1 --port 3487',
        url: 'http://127.0.0.1:3487',
        reuseExistingServer: false,
        timeout: 30_000
    }
})
