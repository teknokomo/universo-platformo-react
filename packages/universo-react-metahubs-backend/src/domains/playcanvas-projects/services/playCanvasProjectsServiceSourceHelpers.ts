import { PLAYCANVAS_PROJECT_FILE_ROOT } from '@universo-react/types'

import { MetahubValidationError } from '../../shared/domainErrors'
import { assertSafeRelativePlayCanvasProjectPath, PlayCanvasProjectFileService } from './PlayCanvasProjectFileService'

export const normalizeEditorSourceFilePath = (
    projectId: string,
    sourceFileId: string,
    inputPath: string,
    fileService: PlayCanvasProjectFileService
): string => {
    const normalized = inputPath.replace(/\\/g, '/').trim()
    if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) {
        throw new MetahubValidationError('PlayCanvas sourcefile path must be relative', {
            messageCode: 'playcanvas.files.sourcefile.pathMismatch',
            sourceFileId,
            sourcePath: inputPath
        })
    }
    const storagePrefix = `${PLAYCANVAS_PROJECT_FILE_ROOT}/${projectId}/sourcefiles/`
    const storageProjectPrefix = `${PLAYCANVAS_PROJECT_FILE_ROOT}/${projectId}/`
    if (normalized.startsWith(storagePrefix)) {
        return assertSafeRelativePlayCanvasProjectPath(normalized)
    }
    if (normalized.startsWith(storageProjectPrefix)) {
        throw new MetahubValidationError('Sourcefile path does not match the sourcefiles storage namespace', {
            messageCode: 'playcanvas.files.sourcefile.pathMismatch',
            sourceFileId,
            sourcePath: normalized
        })
    }
    const parts = normalized.split('/').filter(Boolean)
    if (parts.some((part) => part === '..' || part.startsWith('.'))) {
        throw new MetahubValidationError('PlayCanvas sourcefile path cannot contain hidden or parent segments', {
            messageCode: 'playcanvas.files.path.hiddenOrParentSegment',
            sourceFileId,
            sourcePath: normalized
        })
    }
    const filename = parts[parts.length - 1] ?? `${sourceFileId}.mjs`
    const dot = filename.lastIndexOf('.')
    const extension = dot >= 0 ? filename.slice(dot) : '.mjs'
    return fileService.buildDefaultSourceFilePath(projectId, sourceFileId, extension === '.js' ? '.js' : '.mjs')
}

export const normalizeEditorSourceFileStableId = (sourceFileId: string): string => sourceFileId.replace(/\.[cm]?js$/i, '')

export const getEditorSourceFileName = (sourceFileId: string, inputPath: string, requestedName?: string): string => {
    if (requestedName?.trim()) return requestedName.trim()
    const normalized = inputPath.replace(/\\/g, '/').trim()
    const filename = normalized.split('/').filter(Boolean).pop()
    return filename && !filename.startsWith('.') ? filename : `${sourceFileId}.mjs`
}

export const readRealtimeSettingsDocumentVersion = (document: Record<string, unknown>): number =>
    typeof document.version === 'number' && Number.isInteger(document.version) && document.version >= 0 ? document.version : 0

export const waitForRealtimeSettingsRetry = (attempt: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, attempt * 25)
    })
