import { dialog, ipcMain } from 'electron'
import { readFileSync, statSync, readdirSync, writeFileSync, existsSync, mkdirSync, rmSync} from 'fs'
import { basename, extname, join, dirname, normalize } from 'path'
import assert from 'assert'

import type { OpenFileOptions, OpenFileDetails, FSNode, SaveFileOptions, SaveFileDetails } from '../renderer/src/utils/fileService'
import { configManager } from './configManager'
import { broadcast, windowManager } from './windowManager'

import { rdSeed32, normalizeUint32 } from 'rdrand-lite'
import { Random } from 'random'

class RandomGenerator{
  static RNG? : RandomGenerator = undefined

  private _generator? : Random
  private _seed? : string | number
  private _is_pseudo : boolean
  constructor(pseudo? : boolean, seed?: string | number){
    this._is_pseudo = pseudo ?? true
    if(this._is_pseudo){
      this._seed = seed ?? rdSeed32()
      this._generator = new Random(this._seed)
    }
  }
  gen(pseudo? : boolean){
    if(pseudo) return normalizeUint32(rdSeed32())
    if(this._is_pseudo){
      return this._generator!.float()
    }
    return normalizeUint32(rdSeed32())
  }
  setseed(seed : string | number){
    this._is_pseudo = true
    this._seed = seed
    this._generator = new Random(seed)
  }
  seed() : string| number | undefined{
    if(this._is_pseudo) return this._seed
    return undefined
  }
}

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

export function normalizePath(path : string) : string {
  return normalize(path).replace(/\\/g, '/')
}
export function parentPath(path : string) : string | null {
  const normalize = normalizePath(path)
  if(/^[A-Za-z]:\/?$/.test(normalize)) return null
  return dirname(normalize)
}

function normalizeSettingsRoute(route?: string): string {
  if (!route) return '/project'
  const trimmed = route.trim()
  if (!trimmed) return '/project'
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
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
  path = path.map((value)=>normalizePath(value))
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
    if(options?.isMakedir){
      if(!existsSync(options.path))
        mkdirSync(options.path)
      return details
    }

    if (options.isBinary !== undefined) {
      const isContentBinary = typeof content !== 'string'
      if ((isContentBinary && !options.isBinary) || (!isContentBinary && options.isBinary)) {
        throw new Error('File format does not match content type')
      }
    }
    if (!existsSync(options.path)) {
      mkdirSync(dirname(options.path))
    }
    writeFileSync(options.path, content, {
      flag:'w',
    })
    details.isDialogCanceled = false
    details.savedPath = normalizePath(options.path)
    return details
  }

  const selected = await dialog.showSaveDialog({
    filters: options?.dialogfilters
  })

  if (!selected.canceled && selected.filePath) {
    writeFileSync(selected.filePath, content)
    details.savedPath = normalizePath(selected.filePath)
  } else if (details.dev) {
    details.dev.message += 'dialog canceled; '
  }

  details.isDialogCanceled = selected.canceled
  return details
}
export function deleteFileOrDir(path : string | string[], _options? : any){
  const paths : string[] = typeof path === 'string' ? [path] : path
  paths.forEach((path) => {
    if(path.length > 0 ){
      const normalize_path = normalizePath(path)
      if(existsSync(normalize_path)){
        rmSync(normalize_path, { recursive: true, force: false})
      }
    }
  })
}
export function registerCoreIpcHandlers(): void {
  ipcMain.handle('sys:openfile', (_e, options) => {
    return openFile(options)
  })
  ipcMain.handle('sys:savefile', (_e, content, options) => {
    return saveFile(content, options)
  })
  ipcMain.handle('sys:delete', (_e, path, options)=>deleteFileOrDir(path, options))
  ipcMain.handle('sys:normalizepath', (_e, path: string)=>{
    return normalizePath(path)
  })
  ipcMain.handle('sys:parentpath',(_e, path : string)=>{
    return parentPath(path)
  })
  ipcMain.handle('sys:loadprojectconfig', (_e, configJson: Record<string, any>) => {
    const projectConfig = configManager.load(configJson)
    broadcast('sys:onconfig', projectConfig)
    return projectConfig
  })

  ipcMain.handle('sys:deleteconfig', (_e, moduleName: string) => {
    const deleted = configManager.delete(moduleName)
    broadcast('sys:onconfig', configManager.getAll())
    return deleted
  })

  ipcMain.handle('sys:rand', (_e, pseudo?: boolean, seed?: string)=>{
    if(pseudo || seed) {
      RandomGenerator.RNG = new RandomGenerator(pseudo, seed)
    }
    if(!RandomGenerator.RNG) RandomGenerator.RNG = new RandomGenerator()
    return RandomGenerator.RNG.gen()
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

  ipcMain.handle('window:open-settings', async (_e, route?: string) => {
    const targetRoute = normalizeSettingsRoute(route)

    const existingWindow = windowManager.get('settings')
    const settingsWindow =
      existingWindow && !existingWindow.isDestroyed()
        ? existingWindow
        : windowManager.createWindow('settings', { focusIfExists: false })

    const navigate = () => {
      settingsWindow.webContents.send('settings:navigate', targetRoute)
      settingsWindow.focus()
    }

    if (settingsWindow.webContents.isLoadingMainFrame()) {
      settingsWindow.webContents.once('did-finish-load', navigate)
    } else {
      navigate()
    }
  })
}
