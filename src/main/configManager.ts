import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'

export type ProjectConfig = Record<string, any>

const PROJECT_CONFIG_FILE = 'project.config.json'

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

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

  private normalizePath(pathValue: string): string {
    return pathValue.replace(/\\/g, '/')
  }

  private resolvePath(pathValue: string): string {
    return this.normalizePath(resolve(pathValue))
  }

  private toRecord(configJson: object): Record<string, any> {
    if (!isPlainObject(configJson)) {
      throw new Error('config must be a JSON object')
    }
    return configJson
  }

  private resolvePersistPath(): string {
    const project = isPlainObject(this.get('project')) ? this.get('project') : {}

    if (typeof project.configPath === 'string' && project.configPath.trim().length > 0) {
      return this.resolvePath(project.configPath)
    }

    const projectBase =
      (typeof project.projectPath === 'string' && project.projectPath.trim().length > 0
        ? project.projectPath
        : typeof project.root === 'string' && project.root.trim().length > 0
          ? project.root
          : '')

    if (!projectBase) {
      throw new Error('project config path is not available')
    }

    const configPath = this.normalizePath(join(this.resolvePath(projectBase), PROJECT_CONFIG_FILE))
    this.config.project = {
      ...project,
      configPath
    }

    return configPath
  }

  private persistToDisk(): void {
    const filePath = this.resolvePersistPath()
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, JSON.stringify(this.getProjectConfig(), null, 2), 'utf-8')
  }

  load(configJson: object): ProjectConfig {
    const record = this.toRecord(configJson)
    this.config = record
    this.loaded = true
    return this.getProjectConfig()
  }

  merge(configJson: object): ProjectConfig {
    const record = this.toRecord(configJson)
    for (const [moduleName, moduleConfig] of Object.entries(record)) {
      this.set(moduleName, moduleConfig)
    }

    return this.getProjectConfig()
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
    if (moduleName === 'project') return {root :this.config['root'], name : this.config['name']}
    return this.config[moduleName]
  }

  set(moduleName: string, configJson: unknown): any {
    this.config[moduleName] = configJson

    this.loaded = true
    this.persistToDisk()
    return this.get(moduleName)
  }

  delete(moduleName: string): boolean {
    if (!this.has(moduleName)) {
      return false
    }

    delete this.config[moduleName]
    this.loaded = Object.keys(this.config).length > 0
    return true
  }

  getProjectConfig(): ProjectConfig {
    return { ...this.config }
  }
}

export const configManager = ConfigManager.getInstance()
