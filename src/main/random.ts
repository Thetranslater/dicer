import { ipcMain } from 'electron'

import { join } from 'path'
import { Random } from 'random'


type RdrandLiteModule = {
    rdSeed32: () => number
    normalizeUint32: (value: number) => number
}
class RandomGenerator {
    static RNG?: RandomGenerator = undefined
    static mod = RandomGenerator._loadRdrandLite()

    private _generator?: Random
    private _seed?: string | number
    private _is_pseudo: boolean
    constructor(pseudo?: boolean, seed?: string | number) {
        this._is_pseudo = pseudo ?? true
        if (this._is_pseudo) {
            this._seed = seed ?? RandomGenerator._rdSeed32Safe()
            this._generator = new Random(this._seed)
        }
    }
    private static _loadRdrandLite(): RdrandLiteModule | null {
        const requireFunc = eval('require') as NodeJS.Require
        const candidates = process.env.NODE_ENV === 'production'
            ? [
                join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'rdrand-lite'),
                'rdrand-lite'
            ]
            : ['rdrand-lite']

        for (const target of candidates) {
            try {
                const mod = requireFunc(target) as RdrandLiteModule
                if (typeof mod?.rdSeed32 === 'function' && typeof mod?.normalizeUint32 === 'function') {
                    console.log('[Random] rdrand-lite loaded:', target)
                    return mod
                }
            } catch (error) {
                console.warn('[Random] failed to load rdrand-lite from', target, error)
            }
        }
        return null
    }
    private static _rdSeed32Safe(): number {
        if (RandomGenerator.mod) return RandomGenerator.mod.rdSeed32()
        return (Math.random() * 0xFFFFFFFF) >>> 0
    }
    private static _normalizeUint32Safe(value: number): number {
        if (RandomGenerator.mod) return RandomGenerator.mod.normalizeUint32(value)
        return (value >>> 0) / 0xFFFFFFFF
    }
    gen(pseudo?: boolean) {
        if (pseudo) return RandomGenerator._normalizeUint32Safe(RandomGenerator._rdSeed32Safe())
        if (this._is_pseudo) {
            return this._generator!.float()
        }
        return RandomGenerator._normalizeUint32Safe(RandomGenerator._rdSeed32Safe())
    }
    setseed(seed: string | number) {
        this._is_pseudo = true
        this._seed = seed
        this._generator = new Random(seed)
    }
    seed(): string | number | undefined {
        if (this._is_pseudo) return this._seed
        return undefined
    }
}

export const DRandom = {
    resgisterIPC() {
        ipcMain.handle('sys:rand', (_e, pseudo?: boolean, seed?: string) => {
            if (seed) {
                if (RandomGenerator.RNG) RandomGenerator.RNG.setseed(seed)
            }
            if (!RandomGenerator.RNG) RandomGenerator.RNG = new RandomGenerator(pseudo, seed)
            return RandomGenerator.RNG.gen(pseudo)
        })
    }
}