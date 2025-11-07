import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendTestingDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)))

export default defineConfig({
  resolve: {
    alias: {
      '@testing/frontend': frontendTestingDir,
    },
  },
  test: {
    environment: 'happy-dom', // Changed from 'jsdom' to avoid canvas.node dependency
    setupFiles: [path.join(frontendTestingDir, 'setupTests.ts')],
  },
})
