import { ipcMain } from 'electron'

import { dirname, normalize } from 'path'

function normalizePath(path: string): string {
    return normalize(path).replace(/\\/g, '/')
}
function parentPath(path: string): string | null {
    const normalize = normalizePath(path)
    if (/^[A-Za-z]:\/?$/.test(normalize)) return null
    return dirname(normalize)
}
export const DPath = {
    normalizePath,
    parentPath,
    registerIPC() {
        ipcMain.handle('path:normalize', (_e, path: string) => normalizePath(path))
        ipcMain.handle('path:parent', (_e, path: string) => parentPath(path))
    }
}
