import { dialog, ipcMain } from 'electron'
import { readFileSync, statSync, readdirSync, writeFileSync, existsSync, mkdirSync, rmSync, renameSync, cpSync} from 'fs'
import { basename, extname, join, dirname, normalize } from 'path'

import type { FSNode, SaveFileOptions, SaveFileDetails, OpenOption, SaveOption } from '../renderer/src/utils/fileService'
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

const TEXT_FILE_EXT = ['.txt', '.md', '.html', '.htm', '.json']

export function normalizePath(path : string) : string {
  return normalize(path).replace(/\\/g, '/')
}
export function parentPath(path : string) : string | null {
  const normalize = normalizePath(path)
  if(/^[A-Za-z]:\/?$/.test(normalize)) return null
  return dirname(normalize)
}

function loadFileData(filePath: string): string | Buffer {
  const extension = extname(filePath).toLowerCase()
  if (TEXT_FILE_EXT.includes(extension)) {
    return readFileSync(filePath, 'utf-8')
  }
  return readFileSync(filePath)
}

function toWritableContent(value: any): string | Buffer {
  if (Buffer.isBuffer(value)) return value
  if (typeof value === 'string') return value
  if (value instanceof Uint8Array) return Buffer.from(value)
  if (value === undefined || value === null) return ''
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function toFileNode(filePath: string, isLoad: boolean): FSNode {
  const normalized = normalizePath(filePath)
  return {
    path: normalized,
    name: basename(normalized),
    isDir: false,
    ...(isLoad ? { data: loadFileData(filePath) } : {})
  }
}

function readDirectoryChildren(directoryPath: string, isRecursive: boolean, isLoadFile: boolean): FSNode[] {
  const entries = readdirSync(directoryPath)
  const children: FSNode[] = []

  for (const entry of entries) {
    const fullPath = join(directoryPath, entry)
    const normalized = normalizePath(fullPath)
    const entryStat = statSync(fullPath)

    if (entryStat.isDirectory()) {
      const dirNode: FSNode = {
        path: normalized,
        name: entry,
        isDir: true,
        children: isRecursive ? readDirectoryChildren(fullPath, true, isLoadFile) : []
      }
      children.push(dirNode)
      continue
    }

    if (entryStat.isFile()) {
      children.push({
        path: normalized,
        name: entry,
        isDir: false,
        ...(isLoadFile ? { data: loadFileData(fullPath) } : {})
      })
    }
  }

  return children
}

function toDirectoryNode(directoryPath: string, isRecursive: boolean, isLoadFile: boolean): FSNode {
  const normalized = normalizePath(directoryPath)
  return {
    path: normalized,
    name: basename(normalized),
    isDir: true,
    children: readDirectoryChildren(directoryPath, isRecursive, isLoadFile)
  }
}

function isProtectedSystemPath(targetPath: string): boolean {
  const normalized = normalizePath(targetPath).toLowerCase().replace(/\/+$/, '')

  if (/^[a-z]:$/.test(normalized)) return true
  if (/^[a-z]:\/$/.test(normalized)) return true

  const blockedExact = new Set([
    'c:/pagefile.sys',
    'c:/hiberfil.sys',
    'c:/swapfile.sys'
  ])

  if (blockedExact.has(normalized)) return true

  const blockedPrefix = [
    'c:/windows',
    'c:/program files',
    'c:/program files (x86)',
    'c:/programdata'
  ]

  for (const prefix of blockedPrefix) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return true
    }
  }

  if (normalized === '/' || normalized === '/bin' || normalized === '/etc' || normalized === '/usr' || normalized === '/var') {
    return true
  }

  return false
}

function resolveFsOpenTargets(option?: OpenOption): { filePaths: string[]; dirPaths: string[]; dialogCanceled: boolean } {
  const filePaths = (option?.fileOption?.path ?? []).map((p) => normalizePath(p))
  const dirPaths = (option?.dirOption?.path ?? []).map((p) => normalizePath(p))

  if (filePaths.length > 0 || dirPaths.length > 0) {
    return { filePaths, dirPaths, dialogCanceled: false }
  }

  const selected = dialog.showOpenDialogSync({
    title: 'Select File or Folder',
    filters: option?.fileOption?.dialogfilters,
    properties: [
      option?.dialogOpenType === 'file' ? 'openFile' : 'openDirectory',
      ...(option?.isMultiselection ? (['multiSelections'] as const) : [])
    ]
  })

  if (!selected || selected.length === 0) {
    return { filePaths: [], dirPaths: [], dialogCanceled: true }
  }

  const resolvedFiles: string[] = []
  const resolvedDirs: string[] = []

  for (const selectedPath of selected) {
    const normalized = normalizePath(selectedPath)
    if (!existsSync(normalized)) continue

    const st = statSync(normalized)
    if (st.isFile()) resolvedFiles.push(normalized)
    if (st.isDirectory()) resolvedDirs.push(normalized)
  }

  return { filePaths: resolvedFiles, dirPaths: resolvedDirs, dialogCanceled: false }
}

export function fsOpen(option?: OpenOption): FSNode[] {
  const { filePaths, dirPaths } = resolveFsOpenTargets(option)
  const isLoadFile = option?.fileOption?.isLoad ?? true
  const isRecursive = option?.dirOption?.isRecursive ?? false

  const result: FSNode[] = []

  for (const filePath of filePaths) {
    if (!existsSync(filePath)) continue
    const st = statSync(filePath)
    if (!st.isFile()) continue
    result.push(toFileNode(filePath, isLoadFile))
  }

  for (const dirPath of dirPaths) {
    if (!existsSync(dirPath)) continue
    const st = statSync(dirPath)
    if (!st.isDirectory()) continue
    result.push(toDirectoryNode(dirPath, isRecursive, isLoadFile))
  }

  return result
}

export function fsSave(content: any[], option?: SaveOption): string[] {
  const payloads = Array.isArray(content) ? content : [content]
  const targetPaths = option?.path?.map((p) => normalizePath(p)) ?? []

  if (targetPaths.length > 0) {
    if (targetPaths.length !== payloads.length) {
      throw new Error('SaveOption.path length must match content length')
    }

    payloads.forEach((value, idx) => {
      const targetPath = targetPaths[idx]
      mkdirSync(dirname(targetPath), { recursive: true })
      writeFileSync(targetPath, toWritableContent(value), { flag: 'w' })
    })
    return targetPaths
  }

  payloads.forEach((value, idx) => {
    const selected = dialog.showSaveDialogSync({
      title: payloads.length > 1 ? `Save File (${idx + 1}/${payloads.length})` : 'Save File',
      filters: option?.dialogfilters
    })
    targetPaths.push(selected)
    if (!selected) return
    const normalized = normalizePath(selected)
    mkdirSync(dirname(normalized), { recursive: true })
    writeFileSync(normalized, toWritableContent(value), { flag: 'w' })
  })

  return targetPaths
}

export function fsMkdir(path: string, _option?: any): void {
  const normalized = normalizePath(path)
  if (!normalized) return
  mkdirSync(normalized, { recursive: true })
}

export function fsRm(paths: string[], _option?: any): void {
  const normalizedPaths = Array.isArray(paths) ? paths.map((p) => normalizePath(p)) : []
  for (const normalized of normalizedPaths) {
    if (!normalized) continue
    if (!existsSync(normalized)) continue

    if (isProtectedSystemPath(normalized)) {
      throw new Error(`Refuse to remove protected system path: ${normalized}`)
    }

    rmSync(normalized, { recursive: true, force: false })
  }
}

export function fsMv(source: string, target: string, _option?: any): void {
  const normalizedSource = normalizePath(source)
  const normalizedTarget = normalizePath(target)

  if (!existsSync(normalizedSource)) {
    throw new Error(`Source path does not exist: ${normalizedSource}`)
  }

  if (isProtectedSystemPath(normalizedSource)) {
    throw new Error(`Refuse to move protected system path: ${normalizedSource}`)
  }

  let finalTarget = normalizedTarget
  if (existsSync(normalizedTarget) && statSync(normalizedTarget).isDirectory()) {
    finalTarget = normalizePath(join(normalizedTarget, basename(normalizedSource)))
  }

  mkdirSync(dirname(finalTarget), { recursive: true })

  try {
    renameSync(normalizedSource, finalTarget)
  } catch (error: any) {
    if (error?.code !== 'EXDEV') throw error
    cpSync(normalizedSource, finalTarget, { recursive: true, force: false })
    rmSync(normalizedSource, { recursive: true, force: false })
  }
}

function normalizeSettingsRoute(route?: string): string {
  if (!route) return '/project'
  const trimmed = route.trim()
  if (!trimmed) return '/project'
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
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
export function registerCoreIpcHandlers(): void {
  ipcMain.handle('fs:open', (_e, option?: OpenOption) => fsOpen(option))
  ipcMain.handle('fs:save', (_e, content: any[], option?: SaveOption) => fsSave(content, option))
  ipcMain.handle('fs:mkdir', (_e, path: string, option?: any) => fsMkdir(path, option))
  ipcMain.handle('fs:rm', (_e, paths: string[], option?: any) => fsRm(paths, option))
  ipcMain.handle('fs:mv', (_e, source: string, target: string, option?: any) => fsMv(source, target, option))
  ipcMain.handle('sys:savefile', (_e, content, options) => {
    return saveFile(content, options)
  })
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
