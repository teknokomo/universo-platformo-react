// Universo Platformo | AR.js Publisher State Types
// Type definitions for ARJSPublisher reducer state

import type {
    ARJSSettings,
    MarkerType,
    ARDisplayType,
    WallpaperType,
    CameraUsage,
    TimerPosition,
    PublicationLink,
    GlobalLibrarySettings,
    QuizInteractionMode
} from '../../../types'
import type { LibrarySource } from '../../../types/library.types'

/**
 * AR.js Publisher State
 */
export interface ARJSState extends ARJSSettings {
    // UI State
    loading: boolean
    isPublishing: boolean
    settingsLoading: boolean
    settingsInitialized: boolean
    isLegacyScenario: boolean

    // Publication State
    publishedUrl: string
    publishLinkRecords: PublicationLink[]

    // Global Settings
    globalSettings: GlobalLibrarySettings | null
    globalSettingsLoaded: boolean

    // Error/Alert State
    error: string | null
    alert: { type: 'info' | 'warning' | 'error'; message: string } | null
}

/**
 * AR.js Publisher Actions
 */
export type ARJSAction =
    | { type: 'SET_PROJECT_TITLE'; payload: string }
    | { type: 'SET_MARKER_TYPE'; payload: MarkerType }
    | { type: 'SET_MARKER_VALUE'; payload: string }
    | { type: 'SET_TEMPLATE_TYPE'; payload: string }
    | { type: 'SET_AR_DISPLAY_TYPE'; payload: ARDisplayType }
    | { type: 'SET_WALLPAPER_TYPE'; payload: WallpaperType }
    | { type: 'SET_CAMERA_USAGE'; payload: CameraUsage }
    | { type: 'SET_BACKGROUND_COLOR'; payload: string }
    | { type: 'SET_TIMER_ENABLED'; payload: boolean }
    | { type: 'SET_TIMER_LIMIT_SECONDS'; payload: number }
    | { type: 'SET_TIMER_POSITION'; payload: TimerPosition }
    | { type: 'SET_INTERACTION_MODE'; payload: QuizInteractionMode }
    | { type: 'SET_ARJS_VERSION'; payload: string }
    | { type: 'SET_ARJS_SOURCE'; payload: LibrarySource }
    | { type: 'SET_AFRAME_VERSION'; payload: string }
    | { type: 'SET_AFRAME_SOURCE'; payload: LibrarySource }
    | { type: 'SET_IS_PUBLIC'; payload: boolean }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_IS_PUBLISHING'; payload: boolean }
    | { type: 'SET_SETTINGS_LOADING'; payload: boolean }
    | { type: 'SET_SETTINGS_INITIALIZED'; payload: boolean }
    | { type: 'SET_PUBLISHED_URL'; payload: string }
    | { type: 'SET_PUBLISH_LINK_RECORDS'; payload: PublicationLink[] }
    | { type: 'ADD_PUBLISH_LINK_RECORD'; payload: PublicationLink }
    | { type: 'REMOVE_PUBLISH_LINK_RECORD'; payload: string }
    | { type: 'SET_GLOBAL_SETTINGS'; payload: GlobalLibrarySettings | null }
    | { type: 'SET_GLOBAL_SETTINGS_LOADED'; payload: boolean }
    | { type: 'SET_IS_LEGACY_SCENARIO'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'SET_ALERT'; payload: { type: 'info' | 'warning' | 'error'; message: string } | null }
    | { type: 'LOAD_SETTINGS'; payload: Partial<ARJSSettings> }
    | { type: 'RESET_SETTINGS' }

/**
 * Initial state for AR.js Publisher
 */
export const initialARJSState: ARJSState = {
    // Settings
    projectTitle: '',
    isPublic: false,
    generationMode: 'streaming',
    templateId: 'quiz',
    arDisplayType: 'wallpaper',
    wallpaperType: 'standard',
    cameraUsage: 'none',
    backgroundColor: '#1976d2',
    markerType: 'preset',
    markerValue: 'hiro',
    libraryConfig: {
        arjs: { version: '3.4.7', source: 'official' as LibrarySource },
        aframe: { version: '1.7.1', source: 'official' as LibrarySource }
    },
    timerConfig: {
        enabled: false,
        limitSeconds: 60,
        position: 'top-center'
    },
    interactionMode: 'buttons',

    // UI State
    loading: false,
    isPublishing: false,
    settingsLoading: true,
    settingsInitialized: false,
    isLegacyScenario: false,

    // Publication State
    publishedUrl: '',
    publishLinkRecords: [],

    // Global Settings
    globalSettings: null,
    globalSettingsLoaded: false,

    // Error/Alert State
    error: null,
    alert: null
}

/**
 * AR.js Publisher Reducer
 */
export function arjsReducer(state: ARJSState, action: ARJSAction): ARJSState {
    switch (action.type) {
        case 'SET_PROJECT_TITLE':
            return { ...state, projectTitle: action.payload }
        case 'SET_MARKER_TYPE':
            return { ...state, markerType: action.payload }
        case 'SET_MARKER_VALUE':
            return { ...state, markerValue: action.payload }
        case 'SET_TEMPLATE_TYPE':
            return { ...state, templateId: action.payload }
        case 'SET_AR_DISPLAY_TYPE':
            return { ...state, arDisplayType: action.payload }
        case 'SET_WALLPAPER_TYPE':
            return { ...state, wallpaperType: action.payload }
        case 'SET_CAMERA_USAGE':
            return { ...state, cameraUsage: action.payload }
        case 'SET_BACKGROUND_COLOR':
            return { ...state, backgroundColor: action.payload }
        case 'SET_TIMER_ENABLED':
            return {
                ...state,
                timerConfig: {
                    enabled: action.payload,
                    limitSeconds: state.timerConfig?.limitSeconds ?? 60,
                    position: state.timerConfig?.position ?? 'top-center'
                }
            }
        case 'SET_TIMER_LIMIT_SECONDS':
            return {
                ...state,
                timerConfig: {
                    enabled: state.timerConfig?.enabled ?? false,
                    limitSeconds: action.payload,
                    position: state.timerConfig?.position ?? 'top-center'
                }
            }
        case 'SET_TIMER_POSITION':
            return {
                ...state,
                timerConfig: {
                    enabled: state.timerConfig?.enabled ?? false,
                    limitSeconds: state.timerConfig?.limitSeconds ?? 60,
                    position: action.payload
                }
            }
        case 'SET_INTERACTION_MODE':
            return { ...state, interactionMode: action.payload }
        case 'SET_ARJS_VERSION':
            return {
                ...state,
                libraryConfig: {
                    ...state.libraryConfig,
                    arjs: { ...state.libraryConfig.arjs, version: action.payload }
                }
            }
        case 'SET_ARJS_SOURCE':
            return {
                ...state,
                libraryConfig: {
                    ...state.libraryConfig,
                    arjs: { ...state.libraryConfig.arjs, source: action.payload }
                }
            }
        case 'SET_AFRAME_VERSION':
            return {
                ...state,
                libraryConfig: {
                    ...state.libraryConfig,
                    aframe: { ...state.libraryConfig.aframe, version: action.payload }
                }
            }
        case 'SET_AFRAME_SOURCE':
            return {
                ...state,
                libraryConfig: {
                    ...state.libraryConfig,
                    aframe: { ...state.libraryConfig.aframe, source: action.payload }
                }
            }
        case 'SET_IS_PUBLIC':
            return { ...state, isPublic: action.payload }
        case 'SET_LOADING':
            return { ...state, loading: action.payload }
        case 'SET_IS_PUBLISHING':
            return { ...state, isPublishing: action.payload }
        case 'SET_SETTINGS_LOADING':
            return { ...state, settingsLoading: action.payload }
        case 'SET_SETTINGS_INITIALIZED':
            return { ...state, settingsInitialized: action.payload }
        case 'SET_PUBLISHED_URL':
            return { ...state, publishedUrl: action.payload }
        case 'SET_PUBLISH_LINK_RECORDS':
            return { ...state, publishLinkRecords: action.payload }
        case 'ADD_PUBLISH_LINK_RECORD':
            return {
                ...state,
                publishLinkRecords: [...state.publishLinkRecords.filter((r) => r.id !== action.payload.id), action.payload]
            }
        case 'REMOVE_PUBLISH_LINK_RECORD':
            return {
                ...state,
                publishLinkRecords: state.publishLinkRecords.filter((r) => r.id !== action.payload)
            }
        case 'SET_GLOBAL_SETTINGS':
            return { ...state, globalSettings: action.payload }
        case 'SET_GLOBAL_SETTINGS_LOADED':
            return { ...state, globalSettingsLoaded: action.payload }
        case 'SET_IS_LEGACY_SCENARIO':
            return { ...state, isLegacyScenario: action.payload }
        case 'SET_ERROR':
            return { ...state, error: action.payload }
        case 'SET_ALERT':
            return { ...state, alert: action.payload }
        case 'LOAD_SETTINGS':
            const newState = {
                ...state,
                ...action.payload,
                libraryConfig: action.payload.libraryConfig || state.libraryConfig,
                timerConfig: action.payload.timerConfig || state.timerConfig
            }
            return newState
        case 'RESET_SETTINGS':
            return { ...initialARJSState, globalSettings: state.globalSettings, globalSettingsLoaded: state.globalSettingsLoaded }
        default:
            return state
    }
}
