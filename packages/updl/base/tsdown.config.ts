import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts',
    'i18n/index': './src/i18n/index.ts'
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // Copy SVG assets to dist
  onSuccess: async () => {
    const fs = await import('fs/promises')
    const path = await import('path')

    // Recursively find all SVG files
    async function findSvgFiles(dir: string): Promise<string[]> {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      const files = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            return findSvgFiles(fullPath)
          } else if (entry.name.endsWith('.svg')) {
            return [fullPath]
          }
          return []
        })
      )
      return files.flat()
    }

    const svgFiles = await findSvgFiles('src')

    // Copy each SVG to dist, preserving directory structure
    for (const svgFile of svgFiles) {
      const destFile = svgFile.replace(/^src/, 'dist')
      const destDir = path.dirname(destFile)

      // Ensure destination directory exists
      await fs.mkdir(destDir, { recursive: true })

      // Copy file
      await fs.copyFile(svgFile, destFile)
    }

    console.log(`✓ Copied ${svgFiles.length} SVG files to dist/`)
  },
  // Externalize dependencies
  externals: ['react', 'react-dom', /^@universo\//]
})
