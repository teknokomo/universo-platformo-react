import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendTestingDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)))

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@testing/frontend',
        replacement: frontendTestingDir,
      },
      {
        find: '@testing/frontend/',
        replacement: `${frontendTestingDir}/`,
      },
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: [path.join(frontendTestingDir, 'setupTests.ts')],
  },
})
