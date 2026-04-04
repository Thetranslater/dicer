import { ipcMain } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'

import { DFS } from './fs'
import type { FSNode, OpenOption } from '../renderer/src/utils/fileService'

const CCOMPONENT_FILE_RE = /\.ccomponent\.json$/i

function getComponentDirPath(): string {
  return join(process.resourcesPath, 'mods', 'components')
  //return "D:/Programs/projects/dicer/dicer/src/mods/components"
}

function resolveComponentDir(): string | null {
  const dirPath = getComponentDirPath()
  if (existsSync(dirPath)) return dirPath
  return null
}

function loadCustomComponent(): FSNode[] {
  const dirPath = resolveComponentDir()
  if (!dirPath || !existsSync(dirPath)) return []

  const option: OpenOption = {
    dirOption: {
      path: [dirPath],
      isRecursive: false
    },
    fileOption: {
      isLoad: true
    }
  }

  const nodes = DFS.fsOpen(option)
  const rootNode = nodes[0]
  const children = Array.isArray(rootNode?.children) ? rootNode.children : []

  return children.filter((node) => !node.isDir && CCOMPONENT_FILE_RE.test(node.name))
}

export const DAsset = {
  loadCustomComponent,
  registerIPC(): void {
    ipcMain.handle('asset:loadccomponent', () => loadCustomComponent())
  }
}
