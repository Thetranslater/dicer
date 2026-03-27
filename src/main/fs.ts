import { ipcMain, dialog } from 'electron'
import { readFileSync, statSync, readdirSync, writeFileSync, existsSync, mkdirSync, rmSync, renameSync, cpSync } from 'fs'
import { basename, extname, join, dirname } from 'path'

import type { FSNode, OpenOption, SaveOption } from '../renderer/src/utils/fileService'
import { DPath } from './path'

const TEXT_FILE_EXT = ['.txt', '.md', '.html', '.htm', '.json']

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
    const normalized = DPath.normalizePath(filePath)
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
        const normalized = DPath.normalizePath(fullPath)
        //ignore system files
        try {
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
        } catch (error) {
            continue
        }
    }

    return children
}
function toDirectoryNode(directoryPath: string, isRecursive: boolean, isLoadFile: boolean): FSNode {
    const normalized = DPath.normalizePath(directoryPath)
    return {
        path: normalized,
        name: basename(normalized),
        isDir: true,
        children: readDirectoryChildren(directoryPath, isRecursive, isLoadFile)
    }
}
function isProtectedSystemPath(targetPath: string): boolean {
    const normalized = DPath.normalizePath(targetPath).toLowerCase().replace(/\/+$/, '')

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
    const filePaths = (option?.fileOption?.path ?? []).map((p) => DPath.normalizePath(p))
    const dirPaths = (option?.dirOption?.path ?? []).map((p) => DPath.normalizePath(p))

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
        const normalized = DPath.normalizePath(selectedPath)
        if (!existsSync(normalized)) continue

        //ignore system files
        try {
            const st = statSync(normalized)
            if (st.isFile()) resolvedFiles.push(normalized)
            if (st.isDirectory()) resolvedDirs.push(normalized)
        } catch (error) {
            continue
        }
    }

    return { filePaths: resolvedFiles, dirPaths: resolvedDirs, dialogCanceled: false }
}

function fsOpen(option?: OpenOption): FSNode[] {
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
function fsSave(content: any[], option?: SaveOption): string[] {
    const payloads = Array.isArray(content) ? content : [content]
    const targetPaths = option?.path?.map((p) => DPath.normalizePath(p)) ?? []

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
        const normalized = DPath.normalizePath(selected)
        mkdirSync(dirname(normalized), { recursive: true })
        writeFileSync(normalized, toWritableContent(value), { flag: 'w' })
    })

    return targetPaths
}
function fsMkdir(path: string, _option?: any): void {
    const normalized = DPath.normalizePath(path)
    if (!normalized) return
    mkdirSync(normalized, { recursive: true })
}
function fsRm(paths: string[], _option?: any): void {
    const normalizedPaths = Array.isArray(paths) ? paths.map((p) => DPath.normalizePath(p)) : []
    for (const normalized of normalizedPaths) {
        if (!normalized) continue
        if (!existsSync(normalized)) continue

        if (isProtectedSystemPath(normalized)) {
            throw new Error(`Refuse to remove protected system path: ${normalized}`)
        }

        rmSync(normalized, { recursive: true, force: false })
    }
}
function fsMv(source: string, target: string, _option?: any): void {
    const normalizedSource = DPath.normalizePath(source)
    const normalizedTarget = DPath.normalizePath(target)

    if (!existsSync(normalizedSource)) {
        throw new Error(`Source path does not exist: ${normalizedSource}`)
    }

    if (isProtectedSystemPath(normalizedSource)) {
        throw new Error(`Refuse to move protected system path: ${normalizedSource}`)
    }

    let finalTarget = normalizedTarget
    if (existsSync(normalizedTarget) && statSync(normalizedTarget).isDirectory()) {
        finalTarget = DPath.normalizePath(join(normalizedTarget, basename(normalizedSource)))
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
function fsRnm(targetPath: string, nextName: string, _option?: any): string {
    const normalizedTarget = DPath.normalizePath(targetPath)
    const normalizedName = DPath.normalizePath(nextName)

    if (!existsSync(normalizedTarget)) {
        throw new Error(`Target path does not exist: ${normalizedTarget}`)
    }

    if (/[\\/:*?"<>|]/.test(normalizedName)) {
        throw new Error(`Invalid file or directory name: ${normalizedName}`)
    }

    const parent = dirname(normalizedTarget)
    const finalPath = DPath.normalizePath(join(parent, normalizedName))

    if (normalizedTarget.toLowerCase() === finalPath.toLowerCase()) {
        return finalPath
    }

    if (existsSync(finalPath)) {
        throw new Error(`Target path already exists: ${finalPath}`)
    }

    renameSync(normalizedTarget, finalPath)
    return finalPath
}

export const DFS = {
    fsOpen,
    fsSave,
    fsMkdir,
    fsRm,
    fsMv,
    fsRnm,
    registerIPC() {
        ipcMain.handle('fs:open', (_e, option?: OpenOption) => fsOpen(option))
        ipcMain.handle('fs:save', (_e, content: any[], option?: SaveOption) => fsSave(content, option))
        ipcMain.handle('fs:mkdir', (_e, path: string, option?: any) => fsMkdir(path, option))
        ipcMain.handle('fs:rm', (_e, paths: string[], option?: any) => fsRm(paths, option))
        ipcMain.handle('fs:mv', (_e, source: string, target: string, option?: any) => fsMv(source, target, option))
        ipcMain.handle('fs:rnm', (_e, targetPath: string, nextName: string, option?: any) => fsRnm(targetPath, nextName, option))
    }
}
