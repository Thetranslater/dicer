import { app, dialog, ipcMain } from 'electron'
import { copyFile, mkdir, readdir, readFile, rename, stat, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'path'

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.avif'
])

const IMAGE_MANAGER_CONFIG_NAME = 'image-manager.config.json'

type ImageManagerConfig = {
  rootPath: string | null
}

type ImageItem = {
  name: string
  path: string
  isDirectory: boolean
  size: number
}

function getConfigPath(): string {
  return join(app.getPath('userData'), IMAGE_MANAGER_CONFIG_NAME)
}

async function readConfig(): Promise<ImageManagerConfig> {
  const filePath = getConfigPath()
  if (!existsSync(filePath)) {
    return { rootPath: null }
  }

  try {
    const raw = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<ImageManagerConfig>
    return {
      rootPath: parsed.rootPath ? resolve(parsed.rootPath) : null
    }
  } catch {
    return { rootPath: null }
  }
}

async function writeConfig(config: ImageManagerConfig): Promise<void> {
  const filePath = getConfigPath()
  await writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8')
}

function isPathWithinRoot(rootPath: string, targetPath: string): boolean {
  const rel = relative(resolve(rootPath), resolve(targetPath))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

async function requireRootPath(): Promise<string> {
  const config = await readConfig()
  if (!config.rootPath) {
    throw new Error('Image root is not configured')
  }
  if (!existsSync(config.rootPath)) {
    throw new Error('Image root directory does not exist')
  }
  return resolve(config.rootPath)
}

function sanitizeName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Name cannot be empty')
  }
  if (/[\\/:*?"<>|]/.test(trimmed)) {
    throw new Error('Name contains invalid characters')
  }
  return trimmed
}

async function createFolderWithAutoName(parentPath: string, baseName = 'New Folder'): Promise<string> {
  const safeBaseName = sanitizeName(baseName)
  let candidate = safeBaseName
  let index = 1

  while (existsSync(join(parentPath, candidate))) {
    candidate = `${safeBaseName} (${index})`
    index += 1
  }

  const fullPath = join(parentPath, candidate)
  await mkdir(fullPath)
  return fullPath
}

async function toImageItems(directoryPath: string): Promise<ImageItem[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true })
  const rawItems = await Promise.all(
    entries.map(async (entry) => {
      try {
        const fullPath = join(directoryPath, entry.name)
        const stats = await stat(fullPath)
        const extension = extname(entry.name).toLowerCase()

        if (!entry.isDirectory() && !IMAGE_EXTENSIONS.has(extension)) {
          return null
        }

        return {
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
          size: stats.size
        } satisfies ImageItem
      } catch {
        // Skip entries that cannot be stat-ed (for example, protected system files).
        return null
      }
    })
  )

  return rawItems.filter((item): item is ImageItem => item !== null)
}

async function getUniquePath(targetDir: string, fileName: string): Promise<string> {
  const ext = extname(fileName)
  const base = basename(fileName, ext)
  let candidate = join(targetDir, fileName)
  let index = 1

  while (existsSync(candidate)) {
    candidate = join(targetDir, `${base} (${index})${ext}`)
    index += 1
  }

  return candidate
}

async function importImages(targetDirectory: string, sourceFilePaths: string[]): Promise<string[]> {
  const resolvedTarget = resolve(targetDirectory)
  if (!existsSync(resolvedTarget)) {
    throw new Error('Target directory does not exist')
  }

  const imported: string[] = []
  for (const sourcePath of sourceFilePaths) {
    const extension = extname(sourcePath).toLowerCase()
    if (!IMAGE_EXTENSIONS.has(extension)) {
      continue
    }

    const fileName = basename(sourcePath)
    const targetPath = await getUniquePath(resolvedTarget, fileName)
    await copyFile(sourcePath, targetPath)
    imported.push(targetPath)
  }

  return imported
}

export function registerImageManagerIpcHandlers(): void {
  ipcMain.handle('images:get-config', async () => {
    return readConfig()
  })

  ipcMain.handle('images:select-root', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const rootPath = resolve(result.filePaths[0])
    await writeConfig({ rootPath })
    return rootPath
  })

  ipcMain.handle('images:list-dir', async (_event, directoryPath?: string) => {
    const rootPath = await requireRootPath()
    const requestedPath = directoryPath ? resolve(directoryPath) : rootPath
    const currentPath = existsSync(requestedPath) ? requestedPath : rootPath
    const items = await toImageItems(currentPath)

    return {
      rootPath,
      currentPath,
      items
    }
  })

  ipcMain.handle('images:create-folder', async (_event, parentPath: string, folderName?: string) => {
    await requireRootPath()
    const resolvedParent = resolve(parentPath)
    if (!existsSync(resolvedParent)) {
      throw new Error('Target directory does not exist')
    }

    if (folderName && folderName.trim()) {
      const nextName = sanitizeName(folderName)
      const fullPath = join(resolvedParent, nextName)
      await mkdir(fullPath)
      return fullPath
    }

    return createFolderWithAutoName(resolvedParent)
  })

  ipcMain.handle('images:rename', async (_event, targetPath: string, nextName: string) => {
    await requireRootPath()
    const resolvedTarget = resolve(targetPath)
    if (!existsSync(resolvedTarget)) {
      throw new Error('Target path does not exist')
    }

    const safeName = sanitizeName(nextName)
    const targetDir = dirname(resolvedTarget)
    const nextPath = resolve(join(targetDir, safeName))

    await rename(resolvedTarget, nextPath)
    return nextPath
  })

  ipcMain.handle('images:move', async (_event, sourcePath: string, targetDirectory: string) => {
    await requireRootPath()
    const resolvedSource = resolve(sourcePath)
    const resolvedTargetDir = resolve(targetDirectory)

    if (!existsSync(resolvedSource)) {
      throw new Error('Source path does not exist')
    }
    if (!existsSync(resolvedTargetDir)) {
      throw new Error('Target directory does not exist')
    }

    const sourceStats = await stat(resolvedSource)
    if (sourceStats.isDirectory() && isPathWithinRoot(resolvedSource, resolvedTargetDir)) {
      throw new Error('Cannot move a folder into itself or its subdirectory')
    }

    const nextPath = await getUniquePath(resolvedTargetDir, basename(resolvedSource))
    await rename(resolvedSource, nextPath)
    return nextPath
  })

  ipcMain.handle('images:import-dialog', async (_event, targetDirectory: string) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'] }]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return []
    }

    return importImages(targetDirectory, result.filePaths)
  })

  ipcMain.handle('images:import-files', async (_event, targetDirectory: string, sourceFilePaths: string[]) => {
    return importImages(targetDirectory, sourceFilePaths)
  })
}
