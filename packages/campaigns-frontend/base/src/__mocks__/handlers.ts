/**
 * MSW (Mock Service Worker) handlers for campaigns API
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
export const mockCampaignData = {
    id: 'test-campaign-id',
    name: 'Test Campaign',
    description: 'A test campaign for unit tests',
    eventsCount: 11,
    activitiesCount: 42,
    membersCount: 4,
    role: 'admin',
    createdAt: CREATED_30_DAYS_AGO,
    updatedAt: UPDATED_7_DAYS_AGO
}

export const mockCampaignsList = [
    {
        id: 'campaign-1',
        name: 'Production Campaign',
        description: 'Main production environment',
        role: 'admin',
        eventsCount: 10,
        activitiesCount: 50,
        membersCount: 5,
        createdAt: CREATED_30_DAYS_AGO,
        updatedAt: UPDATED_7_DAYS_AGO
    },
    {
        id: 'campaign-2',
        name: 'Testing Campaign',
        description: 'Test environment',
        role: 'editor',
        eventsCount: 3,
        activitiesCount: 10,
        membersCount: 2,
        createdAt: CREATED_15_DAYS_AGO,
        updatedAt: UPDATED_1_DAY_AGO
    }
]

export const mockEventsList = [
    {
        id: 'event-1',
        campaignId: 'test-campaign-id',
        name: 'Main Event',
        description: 'Primary event for testing',
        activitiesCount: 10,
        createdAt: CREATED_30_DAYS_AGO,
        updatedAt: UPDATED_7_DAYS_AGO
    },
    {
        id: 'event-2',
        campaignId: 'test-campaign-id',
        name: 'Secondary Event',
        description: 'Additional event',
        activitiesCount: 5,
        createdAt: CREATED_15_DAYS_AGO,
        updatedAt: UPDATED_1_DAY_AGO
    }
]

export const mockActivitiesList = [
    {
        id: 'activity-1',
        campaignId: 'test-campaign-id',
        eventId: 'event-1',
        name: 'Primary Activity',
        description: 'Main activity for testing',
        type: 'text',
        order: 0,
        createdAt: CREATED_30_DAYS_AGO,
        updatedAt: UPDATED_7_DAYS_AGO
    },
    {
        id: 'activity-2',
        campaignId: 'test-campaign-id',
        eventId: 'event-1',
        name: 'Secondary Activity',
        description: 'Additional activity',
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
        campaignId: 'test-campaign-id',
        role: 'admin',
        email: 'admin@example.com',
        name: 'Admin User',
        createdAt: CREATED_30_DAYS_AGO,
        updatedAt: UPDATED_7_DAYS_AGO
    },
    {
        id: 'member-2',
        userId: 'user-2',
        campaignId: 'test-campaign-id',
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
    // Get single campaign
    http.get(`${API_BASE_URL}/campaigns/:id`, async ({ params }) => {
        await delay(50) // Simulate network delay

        const { id } = params

        if (id === 'not-found') {
            return HttpResponse.json({ message: 'Campaign not found' }, { status: 404 })
        }

        if (id === 'error') {
            return HttpResponse.json({ message: 'Internal server error' }, { status: 500 })
        }

        return HttpResponse.json({
            data: {
                ...mockCampaignData,
                id: String(id)
            }
        })
    }),

    // List campaigns
    http.get(`${API_BASE_URL}/campaigns`, async ({ request }) => {
        await delay(50)

        const url = new URL(request.url)
        const search = url.searchParams.get('search')
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const offset = parseInt(url.searchParams.get('offset') || '0')

        let filteredData = [...mockCampaignsList]

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

    // List events
    http.get(`${API_BASE_URL}/campaigns/:campaignId/events`, async ({ request }) => {
        await delay(50)

        const url = new URL(request.url)
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const offset = parseInt(url.searchParams.get('offset') || '0')

        const paginatedData = mockEventsList.slice(offset, offset + limit)

        return HttpResponse.json({
            data: paginatedData,
            pagination: {
                total: mockEventsList.length,
                limit,
                offset,
                count: paginatedData.length,
                hasMore: offset + limit < mockEventsList.length
            }
        })
    }),

    // List activities
    http.get(`${API_BASE_URL}/campaigns/:campaignId/events/:eventId/activities`, async ({ request }) => {
        await delay(50)

        const url = new URL(request.url)
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const offset = parseInt(url.searchParams.get('offset') || '0')

        const paginatedData = mockActivitiesList.slice(offset, offset + limit)

        return HttpResponse.json({
            data: paginatedData,
            pagination: {
                total: mockActivitiesList.length,
                limit,
                offset,
                count: paginatedData.length,
                hasMore: offset + limit < mockActivitiesList.length
            }
        })
    }),

    // List campaign members
    http.get(`${API_BASE_URL}/campaigns/:campaignId/members`, async ({ request }) => {
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

    // XSS Test: Campaign with HTML-encoded malicious content for safe testing
    // Tests should verify that this encoded content is NOT executed and displays as text
    http.get(`${API_BASE_URL}/campaigns/xss-test`, async () => {
        await delay(50)

        return HttpResponse.json({
            data: {
                ...mockCampaignData,
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
    networkError: http.get(`${API_BASE_URL}/campaigns/:id`, () => {
        return HttpResponse.error()
    }),

    timeout: http.get(`${API_BASE_URL}/campaigns/:id`, async () => {
        // 4 second delay - just under Vitest's default 5s timeout
        // Tests using this handler should increase timeout: test('...', { timeout: 6000 }, async () => {...})
        await delay(4000)
        return HttpResponse.json({ data: mockCampaignData })
    }),

    unauthorized: http.get(`${API_BASE_URL}/campaigns/:id`, () => {
        return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }),

    forbidden: http.get(`${API_BASE_URL}/campaigns/:id`, () => {
        return HttpResponse.json({ message: 'Forbidden: Insufficient permissions' }, { status: 403 })
    })
}
