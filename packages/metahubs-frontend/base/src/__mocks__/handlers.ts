/**
 * MSW (Mock Service Worker) handlers for metahubs API
 *
 * These handlers intercept HTTP requests during testing and return mock responses.
 * This provides more realistic testing than vi.mock() as it tests the actual HTTP layer.
 */
import { http, HttpResponse, delay } from 'msw'

// Base API URL - configurable via environment variable for different environments (CI, staging, prod)
// Falls back to localhost for local development
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

/**
 * Date helpers for generating realistic relative timestamps
 */
const now = new Date()
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

// Common timestamps used across mock data
const CREATED_30_DAYS_AGO = daysAgo(30) // Created ~1 month ago
const UPDATED_7_DAYS_AGO = daysAgo(7) // Updated ~1 week ago
const CREATED_15_DAYS_AGO = daysAgo(15) // Created ~2 weeks ago
const UPDATED_1_DAY_AGO = daysAgo(1) // Updated yesterday

/**
 * Mock data for testing
 */
export const mockMetahubData = {
    id: 'test-metahub-id',
    name: 'Test Metahub',
    description: 'A test metahub for unit tests',
    meta_sectionsCount: 11,
    meta_entitiesCount: 42,
    membersCount: 4,
    role: 'admin',
    createdAt: CREATED_30_DAYS_AGO,
    updatedAt: UPDATED_7_DAYS_AGO
}

export const mockMetahubsList = [
    {
        id: 'metahub-1',
        name: 'Production Metahub',
        description: 'Main production environment',
        role: 'admin',
        meta_sectionsCount: 10,
        meta_entitiesCount: 50,
        membersCount: 5,
        createdAt: CREATED_30_DAYS_AGO,
        updatedAt: UPDATED_7_DAYS_AGO
    },
    {
        id: 'metahub-2',
        name: 'Testing Metahub',
        description: 'Test environment',
        role: 'editor',
        meta_sectionsCount: 3,
        meta_entitiesCount: 10,
        membersCount: 2,
        createdAt: CREATED_15_DAYS_AGO,
        updatedAt: UPDATED_1_DAY_AGO
    }
]

export const mockMetaSectionsList = [
    {
        id: 'section-1',
        metahubId: 'test-metahub-id',
        name: 'Main MetaSection',
        description: 'Primary section for testing',
        meta_entitiesCount: 10,
        createdAt: CREATED_30_DAYS_AGO,
        updatedAt: UPDATED_7_DAYS_AGO
    },
    {
        id: 'section-2',
        metahubId: 'test-metahub-id',
        name: 'Secondary MetaSection',
        description: 'Additional section',
        meta_entitiesCount: 5,
        createdAt: CREATED_15_DAYS_AGO,
        updatedAt: UPDATED_1_DAY_AGO
    }
]

export const mockMetaEntitiesList = [
    {
        id: 'entity-1',
        metahubId: 'test-metahub-id',
        sectionId: 'section-1',
        name: 'Primary MetaEntity',
        description: 'Main entity for testing',
        type: 'text',
        order: 0,
        createdAt: CREATED_30_DAYS_AGO,
        updatedAt: UPDATED_7_DAYS_AGO
    },
    {
        id: 'entity-2',
        metahubId: 'test-metahub-id',
        sectionId: 'section-1',
        name: 'Secondary MetaEntity',
        description: 'Additional entity',
        type: 'image',
        order: 1,
        createdAt: CREATED_15_DAYS_AGO,
        updatedAt: UPDATED_1_DAY_AGO
    }
]

export const mockMembersList = [
    {
        id: 'member-1',
        userId: 'user-1',
        metahubId: 'test-metahub-id',
        role: 'admin',
        email: 'admin@example.com',
        name: 'Admin User',
        createdAt: CREATED_30_DAYS_AGO,
        updatedAt: UPDATED_7_DAYS_AGO
    },
    {
        id: 'member-2',
        userId: 'user-2',
        metahubId: 'test-metahub-id',
        role: 'editor',
        email: 'editor@example.com',
        name: 'Editor User',
        createdAt: CREATED_15_DAYS_AGO,
        updatedAt: UPDATED_1_DAY_AGO
    }
]

/**
 * MSW request handlers
 */
export const handlers = [
    // Get single metahub
    http.get(`${API_BASE_URL}/metahubs/:id`, async ({ params }) => {
        await delay(50) // Simulate network delay

        const { id } = params

        if (id === 'not-found') {
            return HttpResponse.json({ message: 'Metahub not found' }, { status: 404 })
        }

        if (id === 'error') {
            return HttpResponse.json({ message: 'Internal server error' }, { status: 500 })
        }

        return HttpResponse.json({
            data: {
                ...mockMetahubData,
                id: String(id)
            }
        })
    }),

    // List metahubs
    http.get(`${API_BASE_URL}/metahubs`, async ({ request }) => {
        await delay(50)

        const url = new URL(request.url)
        const search = url.searchParams.get('search')
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const offset = parseInt(url.searchParams.get('offset') || '0')

        let filteredData = [...mockMetahubsList]

        // Apply search filter
        if (search) {
            filteredData = filteredData.filter(
                (m) => m.name.toLowerCase().includes(search.toLowerCase()) || m.description?.toLowerCase().includes(search.toLowerCase())
            )
        }

        const paginatedData = filteredData.slice(offset, offset + limit)

        return HttpResponse.json({
            data: paginatedData,
            pagination: {
                total: filteredData.length,
                limit,
                offset,
                count: paginatedData.length,
                hasMore: offset + limit < filteredData.length
            }
        })
    }),

    // List sections
    http.get(`${API_BASE_URL}/metahubs/:metahubId/meta_sections`, async ({ request }) => {
        await delay(50)

        const url = new URL(request.url)
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const offset = parseInt(url.searchParams.get('offset') || '0')

        const paginatedData = mockMetaSectionsList.slice(offset, offset + limit)

        return HttpResponse.json({
            data: paginatedData,
            pagination: {
                total: mockMetaSectionsList.length,
                limit,
                offset,
                count: paginatedData.length,
                hasMore: offset + limit < mockMetaSectionsList.length
            }
        })
    }),

    // List entities
    http.get(`${API_BASE_URL}/metahubs/:metahubId/meta_sections/:sectionId/meta_entities`, async ({ request }) => {
        await delay(50)

        const url = new URL(request.url)
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const offset = parseInt(url.searchParams.get('offset') || '0')

        const paginatedData = mockMetaEntitiesList.slice(offset, offset + limit)

        return HttpResponse.json({
            data: paginatedData,
            pagination: {
                total: mockMetaEntitiesList.length,
                limit,
                offset,
                count: paginatedData.length,
                hasMore: offset + limit < mockMetaEntitiesList.length
            }
        })
    }),

    // List metahub members
    http.get(`${API_BASE_URL}/metahubs/:metahubId/members`, async ({ request }) => {
        await delay(50)

        const url = new URL(request.url)
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const offset = parseInt(url.searchParams.get('offset') || '0')

        const paginatedData = mockMembersList.slice(offset, offset + limit)

        return HttpResponse.json({
            data: paginatedData,
            pagination: {
                total: mockMembersList.length,
                limit,
                offset,
                count: paginatedData.length,
                hasMore: offset + limit < mockMembersList.length
            }
        })
    }),

    // XSS Test: Metahub with HTML-encoded malicious content for safe testing
    // Tests should verify that this encoded content is NOT executed and displays as text
    http.get(`${API_BASE_URL}/metahubs/xss-test`, async () => {
        await delay(50)

        return HttpResponse.json({
            data: {
                ...mockMetahubData,
                id: 'xss-test',
                name: 'XSS Test',
                // HTML-encoded XSS payloads - safe to use in tests, components should escape this
                description: '&lt;script&gt;alert("XSS")&lt;/script&gt;&lt;img src=x onerror="alert(1)"&gt;'
            }
        })
    })
]

/**
 * Error scenario handlers for specific test cases
 */
export const errorHandlers = {
    networkError: http.get(`${API_BASE_URL}/metahubs/:id`, () => {
        return HttpResponse.error()
    }),

    timeout: http.get(`${API_BASE_URL}/metahubs/:id`, async () => {
        // 4 second delay - just under Vitest's default 5s timeout
        // Tests using this handler should increase timeout: test('...', { timeout: 6000 }, async () => {...})
        await delay(4000)
        return HttpResponse.json({ data: mockMetahubData })
    }),

    unauthorized: http.get(`${API_BASE_URL}/metahubs/:id`, () => {
        return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }),

    forbidden: http.get(`${API_BASE_URL}/metahubs/:id`, () => {
        return HttpResponse.json({ message: 'Forbidden: Insufficient permissions' }, { status: 403 })
    })
}
