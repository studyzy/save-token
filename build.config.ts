import { copyFile, mkdir, readdir } from 'node:fs/promises'
import { dirname, join } from 'pathe'
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: ['src/cli'],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: false,
    inlineDependencies: true,
  },
  hooks: {
    'build:done': async () => {
      try {
        const findJsonFiles = async (basePath: string): Promise<string[]> => {
          const files: string[] = []
          const scanDirectory = async (dir: string): Promise<void> => {
            try {
              const entries = await readdir(dir, { withFileTypes: true })
              for (const entry of entries) {
                const fullPath = join(dir, entry.name)
                if (entry.isDirectory()) {
                  await scanDirectory(fullPath)
                }
                else if (entry.isFile() && entry.name.endsWith('.json')) {
                  files.push(fullPath)
                }
              }
            }
            catch (error) {
              console.warn(`Could not scan directory ${dir}:`, error)
            }
          }
          await scanDirectory(basePath)
          return files
        }

        let jsonFiles: string[] = []
        try {
          jsonFiles = await findJsonFiles('src/i18n/locales')
        }
        catch (error) {
          console.warn('Failed to find i18n files:', error)
        }

        if (jsonFiles.length === 0) {
          console.warn('No i18n JSON files found to copy')
          return
        }

        console.log(`Found ${jsonFiles.length} i18n files to copy`)

        for (const file of jsonFiles) {
          const relativePath = file.replace(/^src[/\\]i18n[/\\]/, '')
          const destFile = join('dist', 'i18n', relativePath)
          const destDir = dirname(destFile)
          await mkdir(destDir, { recursive: true })
          await copyFile(file, destFile)
        }

        console.log(`Successfully copied ${jsonFiles.length} i18n files`)
      }
      catch (error) {
        console.error('Failed to copy i18n files:', error)
        throw error
      }
    },
  },
})
