import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'

import { normalizePath } from './core'
import { ipcMain } from 'electron'
import { broadcast } from './windowManager'

export type ProjectConfig = Record<string, any>

const PROJECT_CONFIG_FILE = 'project.config.json'

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const MODULE_NAMES = new Set(['project','editor','image','setting'])

class ConfigManager {
  private static instance: ConfigManager
  private config: ProjectConfig = {}
  private loaded = false

  private constructor() {}

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager()
    }
    return ConfigManager.instance
  }

  private toRecord(configJson: object): Record<string, any> {
    if (!isPlainObject(configJson)) {
      throw new Error('config must be a JSON object')
    }
    return configJson
  }

  private persistToDisk(): void {
    const projectBase =(typeof this.config.root === 'string' && this.config.root.trim().length > 0? this.config.root: '')

    if (!projectBase) {
      throw new Error('project root path is not available')
    }

    const filePath = normalizePath(join(resolve(projectBase), PROJECT_CONFIG_FILE))

    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, JSON.stringify(this.config, null, 2), 'utf-8')
  }

  load(configJson: object): ProjectConfig {
    const record = this.toRecord(configJson)
    this.config = record
    this.loaded = true
    return this.getAll()
  }

  merge(configJson: object): ProjectConfig {
    const record = this.toRecord(configJson)
    for (const [moduleName, moduleConfig] of Object.entries(record)) {
      this.set(moduleName, moduleConfig)
    }

    return this.getAll()
  }

  clear(): void {
    this.config = {}
    this.loaded = false
  }

  isLoaded(): boolean {
    return this.loaded && this.has('root')
  }

  has(moduleName: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.config, moduleName)
  }

  get(moduleName: string): any {
    if(!MODULE_NAMES.has(moduleName)) return undefined
    if (moduleName === 'project') return {root :this.config['root'], name : this.config['name']}
    return this.config[moduleName]
  }

  set(moduleName: string, configJson: unknown): boolean {
    if(!MODULE_NAMES.has(moduleName)) return false
    this.config[moduleName] = configJson

    this.loaded = true
    this.persistToDisk()
    return true
  }

  delete(moduleName: string): boolean {
    if (!this.has(moduleName)) {
      return false
    }

    delete this.config[moduleName]
    this.loaded = Object.keys(this.config).length > 0
    return true
  }

  getAll(): ProjectConfig {
    return { ...this.config }
  }
}

export const configManager = ConfigManager.getInstance()
export function registerConfigIpcHandlers(){
  ipcMain.handle('sys:getconfig', (_e, moduleName: string) : string | null => {
    return configManager.get(moduleName)
  })
  
  ipcMain.handle('sys:setconfig', (_e, moduleName: string, configJson: unknown) => {
    const result = configManager.set(moduleName, configJson)
    broadcast('sys:onconfig', configManager.getAll())
    return result
  })
}
