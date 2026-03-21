import { dialog, ipcMain } from 'electron'
import { readFileSync, statSync, readdirSync, writeFileSync, existsSync, mkdirSync} from 'fs'
import { basename, extname, join, dirname } from 'path'
import assert from 'assert'

import type { OpenFileOptions, OpenFileDetails, FSNode, SaveFileOptions, SaveFileDetails } from '../renderer/src/utils/fileService'
import { configManager } from './configManager'
import { broadcast, windowManager } from './windowManager'

function buildDirectoryNode(directoryPath: string): FSNode {
  const children: FSNode[] = []
  const entries = readdirSync(directoryPath)

  for (const entry of entries) {
    const fullPath = join(directoryPath, entry)
    const entryStat = statSync(fullPath)

    if (entryStat.isDirectory()) {
      children.push(buildDirectoryNode(fullPath))
      continue
    }

    if (entryStat.isFile()) {
      children.push({ name: entry })
    }
  }

  return {
    name: basename(directoryPath),
    children
  }
}

export async function openFile(options?: OpenFileOptions): Promise<[string | string[], string | Buffer | FSNode | null | (string | Buffer | FSNode | null)[], OpenFileDetails]> {
  const TEXT_FILE_EXT = ['.txt', '.md', '.html', '.htm', '.json']

  let path: string[] = []
  const content: (string | Buffer | FSNode | null)[] = []
  const details: OpenFileDetails = {
    dev: {
      source: options?.dev?.source ?? 'unknown',
      message: options?.dev?.message ?? 'no options provided, can not deduce the source; '
    },
    broadcastInfo: options?.broadcastInfo
  }

  if (options === undefined || options.path === undefined) {
    const selected = await dialog.showOpenDialog({
      title: 'Select File or Folder',
      filters: options?.dialogfilters,
      properties:
        options?.dialogProperties === undefined
          ? ['openFile', ...(options?.isMultiselection ? (['multiSelections'] as const) : [])]
          : options.dialogProperties
    })

    if (selected.canceled) {
      details.isDialogCanceled = true
      if (details.dev) details.dev.message += 'dialog canceled; '
    }

    path = selected.filePaths ?? []
  } else {
    path = options.path
  }

  for (const value of path) {
    if (!existsSync(value)){
      content.push(null)
      continue
    }

    const entryStat = statSync(value)
    if (entryStat.isFile()) {
      if (options?.behavior === 'path') {
        content.push(null)
      } else {
        let encoding: BufferEncoding | undefined
        const extension = extname(value)
        if (TEXT_FILE_EXT.includes(extension)) {
          encoding = 'utf-8'
        }
        const fileContent = readFileSync(value, encoding)
        content.push(fileContent)
      }
      continue
    }
    if (entryStat.isDirectory()) {
      if (options?.behavior === 'content') {
        content.push(buildDirectoryNode(value))
      } else {
        content.push(null)
      }
    }
  }

  assert.ok(path.length === content.length, 'path length does not match content length')

  const rpath = path.length === 1 ? path[0] : path
  const rcontent = content.length === 1 ? content[0] : content
  return [rpath, rcontent, details]
}

export async function saveFile(content: string | Buffer, options?: SaveFileOptions): Promise<SaveFileDetails> {
  const details: SaveFileDetails = {
    broadcastInfo: options?.broadcastInfo,
    dev: {
      source: options?.dev?.source ?? 'unknown',
      message: options?.dev?.message ?? 'no options provided, can not deduce the source; '
    }
  }

  if (options?.path) {
    if (options.isBinary !== undefined) {
      const isContentBinary = typeof content !== 'string'
      if ((isContentBinary && !options.isBinary) || (!isContentBinary && options.isBinary)) {
        throw new Error('File format does not match content type')
      }
    }
    if (!existsSync(options.path)) mkdirSync(dirname(options.path))
    writeFileSync(options.path, content, {
      flag:'w'
    })
    details.isDialogCanceled = false
    return details
  }

  const selected = await dialog.showSaveDialog({
    filters: options?.dialogfilters
  })

  if (!selected.canceled && selected.filePath) {
    writeFileSync(selected.filePath, content)
  } else if (details.dev) {
    details.dev.message += 'dialog canceled; '
  }

  details.isDialogCanceled = selected.canceled
  return details
}

export function registerCoreIpcHandlers(): void {
  ipcMain.handle('sys:openfile', (_e, options) => {
    return openFile(options)
  })

  ipcMain.handle('sys:savefile', (_e, content, options) => {
    return saveFile(content, options)
  })

  ipcMain.handle('sys:getconfig', (_e, moduleName: string) => {
    return configManager.get(moduleName)
  })

  ipcMain.handle('sys:getprojectconfig', () => {
    return configManager.getProjectConfig()
  })

  ipcMain.handle('sys:setconfig', async (_e, moduleName: string, configJson: any) => {
    const result = await configManager.set(moduleName, configJson)
    broadcast('sys:onconfig', configManager.getProjectConfig())
    return result
  })

  ipcMain.handle('project:pick-directory', async (_e, allowCreate = false) => {
    const result = await dialog.showOpenDialog({
      properties: allowCreate ? ['openDirectory', 'createDirectory'] : ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  ipcMain.handle('project:open', async (_e, projectPath: string) => {
    const projectConfig = await configManager.openProject(projectPath)
    broadcast('sys:onconfig', projectConfig)
    return projectConfig
  })

  ipcMain.handle('project:create', async (_e, projectPath: string) => {
    const projectConfig = await configManager.createProject(projectPath)
    broadcast('sys:onconfig', projectConfig)
    return projectConfig
  })

  ipcMain.handle('project:is-loaded', () => {
    return configManager.isLoaded()
  })

  ipcMain.handle('project:ready', () => {
    if (windowManager.has('launcher')) {
      const launcherWindow = windowManager.get('launcher')
      if (launcherWindow && !launcherWindow.isDestroyed()) {
        launcherWindow.close()
      }
    }
    
    if (windowManager.has('editor')) {
      const existingWindow = windowManager.get('editor')
      if (existingWindow && !existingWindow.isDestroyed()) {
        existingWindow.focus()
        return
      }
    }
    
    windowManager.createWindow('editor')
  })
}
