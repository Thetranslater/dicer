import { dialog, ipcMain } from 'electron'
import { readFileSync, statSync, readdirSync } from 'fs'
import { basename, join } from 'path'
import { OpenFileOptions, OpenFileDetails, FSNode } from '../renderer/src/utils/fileService'

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
      children.push({
        name: entry
      })
    }
  }

  return {
    name: basename(directoryPath),
    children: children
  }
}

export async function openFile(options?: OpenFileOptions): Promise<[string[], any[], OpenFileDetails]> {
  let path: string[] = []
  let content: any[] = []
  let details: OpenFileDetails = {}

  if (options?.dev?.source === undefined) {
    details.dev = {
      source: 'unknown',
      message: 'no options provided, can not deduce the source; '
    }
  } else {
    details.dev = {
      source: options.dev.source,
      message: options.dev.message
    }
  }

  details.broadcastInfo = options?.broadcastInfo

  if (options === undefined || options.path === undefined) {
    const selected = await dialog.showOpenDialog({
      title: 'Select File or Folder',
      filters: options?.dialogfilters,
      properties: options?.dialogProperties === undefined ? ([
        'openFile',
        ...(options?.isMultiselection ? (['multiSelections'] as const) : [])
      ]) : options.dialogProperties
    })
    if(selected.canceled) details.dev.message += 'dialog canceled; '
    path = selected.filePaths ?? []
  } else {
    path = options.path
  }

  path.forEach((value) => {
    const entryStat = statSync(value)

    if (entryStat.isFile()) {
      if (options?.behavior === 'path') {
        // Keep path only and do not read file content.
      } else {
        const fileContent = readFileSync(value, 'utf-8')
        content.push(fileContent)
      }
      return
    }

    if (entryStat.isDirectory()) {
      if (options?.behavior === 'content') {
        const directoryNode = buildDirectoryNode(value)
        content.push(directoryNode)
      }
      if(options?.behavior === undefined){
        content.push(null)
      }
    }
  })

  return [path, content, details]
}

export function registerCoreIpcHandlers() : void {
    ipcMain.on('sys:openfile', async (event, options)=>{
        const result = await openFile(options)
        const path = result[0].length === 1 ? result[0][0] : result[0]
        const content = result[1].length === 1 ? result[1][0] : result[1]
        event.reply('sys:openfilec', path, content, result[2])
    })
}