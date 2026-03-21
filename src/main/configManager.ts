import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'

export interface ProjectModuleConfig {
  projectPath: string
  configPath: string
  createdAt: string
  updatedAt: string
}

export interface ProjectConfig {
  [module: string]: any
}

const PROJECT_CONFIG_DIR = '.dicer'
const PROJECT_CONFIG_FILE = 'project.config.json'

class ConfigManager {
  private static instance: ConfigManager
  private configs: Map<string, any> = new Map()
  private projectConfigPath: string | null = null

  private constructor() {}

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager()
    }
    return ConfigManager.instance
  }

  private nowIso(): string {
    return new Date().toISOString()
  }

  private resolveProjectConfigPath(projectPath: string): string {
    return join(resolve(projectPath), PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILE)
  }

  private toProjectConfigObject(): ProjectConfig {
    const projectConfig: ProjectConfig = {}
    for (const [moduleName, config] of this.configs) {
      projectConfig[moduleName] = config
    }
    return projectConfig
  }

  private normalizeProjectModule(
    rawProject: Partial<ProjectModuleConfig> | undefined,
    expectedProjectPath?: string
  ): ProjectModuleConfig {
    const existingProject = (this.configs.get('project') ?? {}) as Partial<ProjectModuleConfig>
    const fixedProjectPath = expectedProjectPath
      ? resolve(expectedProjectPath)
      : resolve(rawProject?.projectPath ?? existingProject.projectPath ?? '')

    if (!fixedProjectPath) {
      throw new Error('Project path is required')
    }

    if (existingProject.projectPath && resolve(existingProject.projectPath) !== fixedProjectPath) {
      throw new Error('projectPath is immutable for current project')
    }

    if (rawProject?.projectPath && resolve(rawProject.projectPath) !== fixedProjectPath) {
      throw new Error('projectPath does not match selected project directory')
    }

    const configPath = this.projectConfigPath
      ? resolve(this.projectConfigPath)
      : this.resolveProjectConfigPath(fixedProjectPath)

    const createdAt = existingProject.createdAt ?? rawProject?.createdAt ?? this.nowIso()

    return {
      projectPath: fixedProjectPath,
      configPath,
      createdAt,
      updatedAt: this.nowIso()
    }
  }

  private async persist(): Promise<void> {
    if (!this.projectConfigPath) {
      throw new Error('Project config path is not initialized')
    }

    const projectModule = this.normalizeProjectModule(this.get('project') as Partial<ProjectModuleConfig>)
    this.configs.set('project', projectModule)

    await mkdir(dirname(this.projectConfigPath), { recursive: true })
    await writeFile(this.projectConfigPath, JSON.stringify(this.toProjectConfigObject(), null, 2), 'utf-8')
  }

  private assignFromProjectConfig(projectConfig: ProjectConfig, expectedProjectPath?: string): void {
    this.configs.clear()

    for (const [moduleName, moduleConfig] of Object.entries(projectConfig ?? {})) {
      if (moduleName === 'project') continue
      this.configs.set(moduleName, moduleConfig)
    }

    const projectModule = this.normalizeProjectModule(
      (projectConfig?.project ?? {}) as Partial<ProjectModuleConfig>,
      expectedProjectPath
    )

    this.configs.set('project', projectModule)
  }

  isLoaded(): boolean {
    return this.projectConfigPath !== null && this.configs.has('project')
  }

  has(moduleName: string): boolean {
    return this.configs.has(moduleName)
  }

  get(moduleName: string): any {
    return this.configs.get(moduleName)
  }

  async set(moduleName: string, configJson: any): Promise<any> {
    if (!this.projectConfigPath) {
      throw new Error('No project loaded')
    }

    if (moduleName === 'project') {
      const nextProject = this.normalizeProjectModule(configJson as Partial<ProjectModuleConfig>)
      this.configs.set('project', nextProject)
    } else {
      this.configs.set(moduleName, configJson)
    }

    await this.persist()
    return this.get(moduleName)
  }

  delete(moduleName: string): boolean {
    if (moduleName === 'project') {
      return false
    }
    return this.configs.delete(moduleName)
  }

  getProjectConfig(): ProjectConfig {
    return this.toProjectConfigObject()
  }

  async createProject(projectPath: string): Promise<ProjectConfig> {
    const fixedProjectPath = resolve(projectPath)
    const configPath = this.resolveProjectConfigPath(fixedProjectPath)

    if (existsSync(configPath)) {
      throw new Error('Project already exists at selected path')
    }

    this.projectConfigPath = configPath

    this.assignFromProjectConfig(
      {
        project: {
          projectPath: fixedProjectPath,
          configPath,
          createdAt: this.nowIso(),
          updatedAt: this.nowIso()
        },
        editor: {},
        images: {}
      },
      fixedProjectPath
    )

    await this.persist()
    return this.getProjectConfig()
  }

  async openProject(projectPath: string): Promise<ProjectConfig> {
    const fixedProjectPath = resolve(projectPath)
    const configPath = this.resolveProjectConfigPath(fixedProjectPath)

    if (!existsSync(configPath)) {
      throw new Error('Project config file does not exist in selected directory')
    }

    const raw = await readFile(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as ProjectConfig
    const normalizedConfig: ProjectConfig =
      parsed && typeof parsed.modules === 'object' && parsed.modules !== null
        ? {
            ...(parsed.modules as Record<string, any>),
            project: parsed.project
          }
        : parsed

    this.projectConfigPath = configPath
    this.assignFromProjectConfig(normalizedConfig, fixedProjectPath)
    await this.persist()

    return this.getProjectConfig()
  }
}

export const configManager = ConfigManager.getInstance()
