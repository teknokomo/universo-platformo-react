// Universo Platformo | Publication service
import { v4 as uuidv4 } from 'uuid'
import { PublishRequest, PublishResponse, PublishedProject } from '../interfaces/PublishInterfaces'

// In a real project, this would be a database
const publishedProjects: PublishedProject[] = []

/**
 * Service for working with publications
 */
export class PublishService {
    /**
     * Publishes a project with the given parameters
     */
    async publishProject(request: PublishRequest): Promise<PublishResponse> {
        try {
            const id = uuidv4()
            const now = new Date()

            const project: PublishedProject = {
                id,
                projectId: request.projectId,
                platform: request.platform,
                url: `/publish/${id}`,
                createdAt: now,
                updatedAt: now,
                status: 'in_progress',
                isPublic: request.options?.isPublic ?? true,
                customUrl: request.options?.customUrl,
                options: request.options
            }

            publishedProjects.push(project)

            // Simulate the publication process
            setTimeout(() => {
                const projectIndex = publishedProjects.findIndex((p) => p.id === id)
                if (projectIndex !== -1) {
                    publishedProjects[projectIndex].status = 'published'
                    publishedProjects[projectIndex].updatedAt = new Date()
                }
            }, 1000)

            return this.mapToResponse(project)
        } catch (error) {
            console.error('Failed to publish project:', error)
            throw error
        }
    }

    /**
     * Gets a list of published projects
     */
    async getPublishedProjects(): Promise<PublishResponse[]> {
        return publishedProjects.map(this.mapToResponse)
    }

    /**
     * Gets a published project by ID
     */
    async getPublishedProject(id: string): Promise<PublishResponse | null> {
        const project = publishedProjects.find((p) => p.id === id)
        return project ? this.mapToResponse(project) : null
    }

    /**
     * Converts the model to an API response
     */
    private mapToResponse(project: PublishedProject): PublishResponse {
        return {
            id: project.id,
            projectId: project.projectId,
            platform: project.platform,
            url: project.url,
            createdAt: project.createdAt.toISOString(),
            updatedAt: project.updatedAt.toISOString(),
            status: project.status,
            error: project.error
        }
    }
}
