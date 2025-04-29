/**
 * UPDL API Client
 * Provides functions for interacting with UPDL backend services
 */

import axios, { AxiosError } from 'axios'

// Base API URL - adjust as needed based on your environment
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api'

// Types
interface ErrorResponse {
    message: string
}

export interface UPDLScene {
    id: string
    name: string
    description?: string
    updatedAt: string
    cameras?: UPDLCamera[]
    lights?: UPDLLight[]
    objects?: UPDLObject[]
}

interface PublishedScene {
    id: string
    title: string
    url: string
    markerType: string
    createdAt: string
    size: number
}

export interface UPDLObject {
    id: string
    type: string
    position: Vector3
    rotation?: Vector3
    scale?: Vector3
    color?: Color
    model?: string
    properties?: Record<string, any>
}

export interface UPDLCamera {
    id: string
    type: string
    position: Vector3
    rotation?: Vector3
    fov?: number
    properties?: Record<string, any>
}

export interface UPDLLight {
    id: string
    type: string
    position?: Vector3
    color?: Color
    intensity?: number
    properties?: Record<string, any>
}

export interface Vector3 {
    x: number
    y: number
    z: number
}

export interface Color {
    r: number
    g: number
    b: number
}

interface PublishARJSRequest {
    sceneId: string
    title: string
    html: string
    markerType: string
    markerValue: string
}

interface PublishARJSResponse {
    id: string
    url: string
    title: string
    createdAt: string
}

/**
 * Fetch a UPDL scene by ID
 * @param sceneId - The ID of the scene to fetch
 * @returns Promise resolving to the scene data
 */
export const fetchUPDLScene = async (sceneId: string): Promise<UPDLScene> => {
    try {
        const response = await axios.get(`${API_BASE_URL}/updl/scenes/${sceneId}`)
        return response.data
    } catch (error: unknown) {
        const axiosError = error as AxiosError<ErrorResponse>
        console.error('Error fetching UPDL scene:', axiosError)
        throw new Error(axiosError.response?.data?.message || 'Failed to fetch UPDL scene')
    }
}

/**
 * Publish an AR.js project
 * @param data - The publish request data including scene ID, title, and HTML content
 * @returns Promise resolving to the publish response
 */
export const publishARJSProject = async (data: PublishARJSRequest): Promise<PublishARJSResponse> => {
    try {
        const response = await axios.post(`${API_BASE_URL}/updl/publish/arjs`, data)
        return response.data
    } catch (error: unknown) {
        const axiosError = error as AxiosError<ErrorResponse>
        console.error('Error publishing AR.js project:', axiosError)
        throw new Error(axiosError.response?.data?.message || 'Failed to publish AR.js project')
    }
}

/**
 * Fetch all available UPDL scenes
 * @returns Promise resolving to an array of scene summaries
 */
export async function fetchUPDLScenes(): Promise<UPDLScene[]> {
    try {
        const response = await axios.get(`${API_BASE_URL}/updl/scenes`)
        return response.data
    } catch (error) {
        const axiosError = error as AxiosError<ErrorResponse>
        console.error('Error fetching UPDL scenes:', axiosError)
        throw new Error(axiosError.response?.data?.message || 'Failed to fetch UPDL scenes')
    }
}

/**
 * Delete a published AR.js project
 * @param projectId - The ID of the project to delete
 * @returns Promise resolving to the delete response
 */
export async function deleteARJSProject(id: string): Promise<void> {
    try {
        await axios.delete(`${API_BASE_URL}/updl/arjs/${id}`)
    } catch (error) {
        const axiosError = error as AxiosError<ErrorResponse>
        console.error('Error deleting AR.js project:', axiosError)
        throw new Error(axiosError.response?.data?.message || 'Failed to delete AR.js project')
    }
}

/**
 * List all published UPDL scenes
 * @returns Promise with the list of published scenes
 */
export async function listPublishedScenes(): Promise<PublishedScene[]> {
    try {
        const response = await axios.get(`${API_BASE_URL}/updl/published`)
        return response.data
    } catch (error) {
        const axiosError = error as AxiosError<ErrorResponse>
        console.error('Error listing published scenes:', axiosError)
        throw new Error(axiosError.response?.data?.message || 'Failed to list published scenes')
    }
}

/**
 * Delete a published scene
 * @param publishId The ID of the published scene to delete
 * @returns Promise with the deletion response
 */
export async function deletePublishedScene(id: string): Promise<void> {
    try {
        await axios.delete(`${API_BASE_URL}/updl/published/${id}`)
    } catch (error) {
        const axiosError = error as AxiosError<ErrorResponse>
        console.error('Error deleting published scene:', axiosError)
        throw new Error(axiosError.response?.data?.message || 'Failed to delete published scene')
    }
}

/**
 * Fetches all available UPDL scenes
 * @returns Promise with an array of scenes
 */
export const fetchAllUPDLScenes = async () => {
    try {
        const response = await fetch('/api/updl/scenes')

        if (!response.ok) {
            throw new Error(`Failed to fetch scenes: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error('Error fetching UPDL scenes:', error)
        throw error
    }
}

/**
 * Deletes a UPDL scene
 * @param sceneId - The ID of the scene to delete
 * @returns Promise with the deletion result
 */
export const deleteUPDLScene = async (sceneId: string) => {
    try {
        const response = await fetch(`/api/updl/scenes/${sceneId}`, {
            method: 'DELETE'
        })

        if (!response.ok) {
            throw new Error(`Failed to delete scene: ${response.status} ${response.statusText}`)
        }

        const result = await response.json()
        return result
    } catch (error) {
        console.error('Error deleting UPDL scene:', error)
        throw error
    }
}
