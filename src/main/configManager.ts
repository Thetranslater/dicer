interface ProjectConfig{
    [module: string] : any
}

class ConfigManager {
    private static instance : ConfigManager
    private configs : Map<string, Object> = new Map()
    private constructor() {}

    static getInstance() : ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance  = new ConfigManager()
        }
        return ConfigManager.instance
    }

    has(moduleName: string) : boolean{
        return this.configs.has(moduleName)
    }
    get(moduleName : string) : Object | undefined {
        return this.configs.get(moduleName)
    }
    register(moduleName : string, configJson : Object) : void {
        this.configs.set(moduleName, configJson)
    }
    delete(moduleName : string) : boolean {
        return this.configs.delete(moduleName)
    }
    getProjectConfig() : ProjectConfig {
        let projectConfig : ProjectConfig = {}
        for (const [module, config] of this.configs){
            projectConfig[module] = config
        }
        return projectConfig
    }
}

export const configManager = ConfigManager.getInstance()