/**
 * Universo Platformo | Exporter API
 * Provides functions for interacting with UPDL exporters
 */

import axios, { AxiosError } from 'axios'
import FileSaver from 'file-saver'
import JSZip from 'jszip'
import httpClient from './httpClient'
import { UPDLScene } from './updlApi'
import { ExporterFactory, TechnologyType } from '../features/exporters/ExporterFactory'
import { ExportOptions } from '../features/exporters/BaseExporter'
import { ARJSExportOptions } from '../features/arjs/ARJSExporter'
import { AFrameVRExportOptions } from '../features/aframe/AFrameExporter'

// Base API URL - adjust as needed based on your environment
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api'

// Types
interface ErrorResponse {
    message: string
}

interface PublishRequest {
    sceneId: string
    title: string
    html: string
    technology: string
    options?: Record<string, any>
}

interface PublishResponse {
    id: string
    url: string
    title: string
    technology: string
    createdAt: string
}

export interface TechnologyInfo {
    id: string
    name: string
    description: string
    icon?: string
}

/**
 * Get all available technology types
 * @returns List of available technology types with info
 */
export function getAvailableTechnologies(): TechnologyInfo[] {
    const techTypes = ExporterFactory.getAvailableTechnologies()

    return techTypes.map((type) => {
        const info = ExporterFactory.getTechnologyInfo(type)
        return {
            id: type,
            name: info.name,
            description: info.description,
            // Icons can be added in the future
            icon: getTechnologyIcon(type)
        }
    })
}

/**
 * Get icon for a technology type
 * @param type Technology type
 * @returns Path to the icon
 */
function getTechnologyIcon(type: TechnologyType): string {
    switch (type) {
        case TechnologyType.ARJS:
            return '/assets/icons/arjs.svg'
        case TechnologyType.AFRAME:
            return '/assets/icons/aframe.svg'
        case TechnologyType.PLAYCANVAS:
            return '/assets/icons/playcanvas.svg'
        case TechnologyType.PLAYCANVAS_REACT:
            return '/assets/icons/playcanvas-react.svg'
        case TechnologyType.BABYLONJS:
            return '/assets/icons/babylonjs.svg'
        case TechnologyType.THREEJS:
            return '/assets/icons/threejs.svg'
        default:
            return '/assets/icons/3d.svg'
    }
}

/**
 * Generate HTML for a scene using the specified technology
 * @param scene UPDL scene
 * @param technology Technology type
 * @param options Export options
 * @returns Generated HTML
 */
export function generateHTML(scene: UPDLScene, technology: TechnologyType, options?: ExportOptions): string {
    try {
        const exporter = ExporterFactory.createExporter(technology, options)
        return exporter.generateHTML(scene, options)
    } catch (error) {
        console.error(`Error generating HTML for ${technology}:`, error)
        throw error
    }
}

/**
 * Generate HTML for AR.js with specific options
 * @param scene UPDL scene
 * @param options AR.js export options
 * @returns Generated HTML for AR.js
 */
export function generateARJSHTML(scene: UPDLScene, options?: ARJSExportOptions): string {
    return generateHTML(scene, TechnologyType.ARJS, options)
}

/**
 * Generate HTML for A-Frame VR with specific options
 * @param scene UPDL scene
 * @param options A-Frame VR export options
 * @returns Generated HTML for A-Frame VR
 */
export function generateAFrameVRHTML(scene: UPDLScene, options?: AFrameVRExportOptions): string {
    return generateHTML(scene, TechnologyType.AFRAME, options)
}

/**
 * Publish a scene with the specified technology
 * @param sceneId Scene ID
 * @param title Publication title
 * @param technology Technology type
 * @param options Export options
 * @returns Promise with publish response
 */
export async function publishScene(
    sceneId: string,
    title: string,
    technology: TechnologyType,
    options?: ExportOptions
): Promise<PublishResponse> {
    try {
        // Fetch the scene
        const sceneResponse = await axios.get(`${API_BASE_URL}/updl/scenes/${sceneId}`)
        const scene = sceneResponse.data as UPDLScene

        // Generate HTML using the appropriate exporter
        const html = generateHTML(scene, technology, options)

        // Prepare the publish request
        const publishData: PublishRequest = {
            sceneId,
            title,
            html,
            technology,
            options: options as Record<string, any>
        }

        // Send the publish request
        const response = await axios.post(`${API_BASE_URL}/updl/publish`, publishData)
        return response.data
    } catch (error) {
        const axiosError = error as AxiosError<ErrorResponse>
        console.error('Error publishing scene:', axiosError)
        throw new Error(axiosError.response?.data?.message || 'Failed to publish scene')
    }
}

/**
 * Fetch a published scene by ID
 * @param publishId Published scene ID
 * @returns Promise with the published scene
 */
export async function fetchPublishedScene(publishId: string): Promise<PublishResponse> {
    try {
        const response = await axios.get(`${API_BASE_URL}/updl/published/${publishId}`)
        return response.data
    } catch (error) {
        const axiosError = error as AxiosError<ErrorResponse>
        console.error('Error fetching published scene:', axiosError)
        throw new Error(axiosError.response?.data?.message || 'Failed to fetch published scene')
    }
}
