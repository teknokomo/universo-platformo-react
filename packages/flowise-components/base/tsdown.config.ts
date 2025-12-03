import { defineConfig } from 'tsdown'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.svg'])

async function copyStaticAssets() {
  const fs = await import('fs/promises')
  const path = await import('path')

  async function ensureDir(dir: string) {
    await fs.mkdir(dir, { recursive: true })
  }

  async function copyNodeAssets(sourceDir: string, targetDir: string) {
    const entries = await fs.readdir(sourceDir, { withFileTypes: true })

    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name)
      const targetPath = path.join(targetDir, entry.name)

      if (entry.isDirectory()) {
        await copyNodeAssets(sourcePath, targetPath)
        continue
      }

      const extension = path.extname(entry.name).toLowerCase()
      if (IMAGE_EXTENSIONS.has(extension)) {
        await ensureDir(path.dirname(targetPath))
        await fs.copyFile(sourcePath, targetPath)
      }
    }
  }

  await copyNodeAssets('nodes', 'dist/nodes')
  await ensureDir('dist')
  await fs.copyFile('models.json', 'dist/models.json')
}

export default defineConfig({
  entry: ['src/**/*.ts', 'nodes/**/*.ts', 'credentials/**/*.ts'],
  format: ['esm', 'cjs'],
  platform: 'node',
  dts: true,
  unbundle: true,
  clean: true,
  skipNodeModulesBundle: true,
  outExtensions: ({ format }) => (format === 'esm' ? '.mjs' : '.js'),
  external: [/^[^./]/],
  onSuccess: async () => {
    await copyStaticAssets()
    console.log('✓ Copied static assets for flowise-components')
  }
})
