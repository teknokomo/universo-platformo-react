// Universo Platformo | Publish API client for interacting with publish-srv
import httpClient from './httpClient'
import { PublishRequest, PublishResponse } from '../interfaces/publishTypes'

const API_BASE = '/publish'

/**
 * Publishes a project with the given parameters
 */
export const publishProject = async (request: PublishRequest): Promise<PublishResponse> => {
    try {
        const response = await httpClient.post(`${API_BASE}/projects`, request)
        return response.data
    } catch (error) {
        console.error('Failed to publish project:', error)
        throw error
    }
}

/**
 * Gets a list of published projects
 */
export const getPublishedProjects = async (): Promise<PublishResponse[]> => {
    try {
        const response = await httpClient.get(`${API_BASE}/projects`)
        return response.data
    } catch (error) {
        console.error('Failed to fetch published projects:', error)
        throw error
    }
}

/**
 * Gets information about a published project by ID
 */
export const getPublishedProject = async (projectId: string): Promise<PublishResponse> => {
    try {
        const response = await httpClient.get(`${API_BASE}/projects/${projectId}`)
        return response.data
    } catch (error) {
        console.error(`Failed to fetch project ${projectId}:`, error)
        throw error
    }
}
