import { MetahubValidationError } from '../../shared/domainErrors'
import { createLogger } from '../../../utils/logger'

import type { PlayCanvasProjectFileScope } from './PlayCanvasProjectFileService'

export const log = createLogger('PlayCanvasProjectsService')

export type PlayCanvasWrittenFile = {
    scope: PlayCanvasProjectFileScope
    sourcePath: string
    checksum: string
    label: string
}

export type PlayCanvasDeletedFileBackup = {
    scope: PlayCanvasProjectFileScope
    sourcePath: string
    content: Buffer
    checksum: string
    mime: string | null
}

export const STRICT_BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
export const COMPATIBILITY_SETTINGS_KEY = 'playCanvasEditorCompatibility'
export const REALTIME_SETTINGS_KEY = 'playCanvasEditorRealtime'
export const COMPATIBILITY_SCENE_SAVE_COMMAND_TYPE = 'compatibility.scene.save'

export const COMPATIBILITY_SETTINGS_WRITE_COMMAND_TYPE = 'compatibility.settings.write'
export const COMPATIBILITY_SOURCEFILE_WRITE_COMMAND_TYPE = 'compatibility.sourcefile.write'
export const COMPATIBILITY_SOURCEFILE_DELETE_COMMAND_TYPE = 'compatibility.sourcefile.delete'
export const CLOUD_ONLY_SURFACE_REASON = 'playcanvasCloudOnlySurfaceOutsideUniversoScope'
export const UNIVERSO_SOURCEFILES_REASON = 'universoDurableJavaScriptSourcefilesEnabled'

export const isCurrentChecksumMismatch = (error: unknown): error is MetahubValidationError =>
    error instanceof MetahubValidationError && error.details?.messageCode === 'playcanvas.files.path.currentChecksumMismatch'

export const isSceneMetadataUpdateFailure = (error: unknown): error is MetahubValidationError =>
    error instanceof MetahubValidationError && error.details?.messageCode === 'playcanvas.files.metadataUpdateFailed'
