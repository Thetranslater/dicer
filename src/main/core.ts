import { dialog, ipcMain } from 'electron'
import { readFileSync, statSync, readdirSync } from 'fs'
import { basename, join } from 'path'
import type { OpenFileOptions, OpenFileDetails, FSNode } from '../includes/fileService'
import assert from 'assert'

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

export async function openFile(options?: OpenFileOptions): Promise<[string | string[], any, OpenFileDetails]> {
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
    if(selected.canceled) {
      details.isDialogCanceled = true
      details.dev.message += 'dialog canceled; '
    }
    path = selected.filePaths ?? []
  } else {
    path = options.path
  }

  path.forEach((value) => {
    const entryStat = statSync(value)

    if (entryStat.isFile()) {
      if (options?.behavior === 'path') {
        // Keep path only and do not read file content.
        content.push(null)
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
      } else {
        content.push(null)
      }
    }
  })

  assert.ok(path.length === content.length, 'path长度和content长度不一致')

  const rpath = path.length === 1 ? path[0] : path
  const rcontent = content.length === 1 ? content[0] : content
  return [rpath, rcontent, details]
}

export function registerCoreIpcHandlers() : void {
    ipcMain.on('sys:openfile', async (event, options)=>{
        const result = await openFile(options)
        event.reply('sys:openfilec', result[0], result[1], result[2])
    })
}