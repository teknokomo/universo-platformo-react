/**
 * MSW (Mock Service Worker) handlers for storages API
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
export const mockStorageData = {
    id: 'test-storage-id',
    name: 'Test Storage',
    description: 'A test storage for unit tests',
    containersCount: 11,
    slotsCount: 42,
    membersCount: 4,
    role: 'admin',
    createdAt: CREATED_30_DAYS_AGO,
    updatedAt: UPDATED_7_DAYS_AGO
}

export const mockStoragesList = [
    {
        id: 'storage-1',
        name: 'Production Storage',
        description: 'Main production environment',
        role: 'admin',
        containersCount: 10,
        slotsCount: 50,
        membersCount: 5,
        createdAt: CREATED_30_DAYS_AGO,
        updatedAt: UPDATED_7_DAYS_AGO
    },
    {
        id: 'storage-2',
        name: 'Testing Storage',
        description: 'Test environment',
        role: 'editor',
        containersCount: 3,
        slotsCount: 10,
        membersCount: 2,
        createdAt: CREATED_15_DAYS_AGO,
        updatedAt: UPDATED_1_DAY_AGO
    }
]

export const mockContainersList = [
    {
        id: 'container-1',
        storageId: 'test-storage-id',
        name: 'Main Container',
        description: 'Primary container for testing',
        slotsCount: 10,
        createdAt: CREATED_30_DAYS_AGO,
        updatedAt: UPDATED_7_DAYS_AGO
    },
    {
        id: 'container-2',
        storageId: 'test-storage-id',
        name: 'Secondary Container',
        description: 'Additional container',
        slotsCount: 5,
        createdAt: CREATED_15_DAYS_AGO,
        updatedAt: UPDATED_1_DAY_AGO
    }
]

export const mockSlotsList = [
    {
        id: 'slot-1',
        storageId: 'test-storage-id',
        containerId: 'container-1',
        name: 'Primary Slot',
        description: 'Main slot for testing',
        type: 'text',
        order: 0,
        createdAt: CREATED_30_DAYS_AGO,
        updatedAt: UPDATED_7_DAYS_AGO
    },
    {
        id: 'slot-2',
        storageId: 'test-storage-id',
        containerId: 'container-1',
        name: 'Secondary Slot',
        description: 'Additional slot',
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
        storageId: 'test-storage-id',
        role: 'admin',
        email: 'admin@example.com',
        name: 'Admin User',
        createdAt: CREATED_30_DAYS_AGO,
        updatedAt: UPDATED_7_DAYS_AGO
    },
    {
        id: 'member-2',
        userId: 'user-2',
        storageId: 'test-storage-id',
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
    // Get single storage
    http.get(`${API_BASE_URL}/storages/:id`, async ({ params }) => {
        await delay(50) // Simulate network delay

        const { id } = params

        if (id === 'not-found') {
            return HttpResponse.json({ message: 'Storage not found' }, { status: 404 })
        }

        if (id === 'error') {
            return HttpResponse.json({ message: 'Internal server error' }, { status: 500 })
        }

        return HttpResponse.json({
            data: {
                ...mockStorageData,
                id: String(id)
            }
        })
    }),

    // List storages
    http.get(`${API_BASE_URL}/storages`, async ({ request }) => {
        await delay(50)

        const url = new URL(request.url)
        const search = url.searchParams.get('search')
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const offset = parseInt(url.searchParams.get('offset') || '0')

        let filteredData = [...mockStoragesList]

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

    // List containers
    http.get(`${API_BASE_URL}/storages/:storageId/containers`, async ({ request }) => {
        await delay(50)

        const url = new URL(request.url)
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const offset = parseInt(url.searchParams.get('offset') || '0')

        const paginatedData = mockContainersList.slice(offset, offset + limit)

        return HttpResponse.json({
            data: paginatedData,
            pagination: {
                total: mockContainersList.length,
                limit,
                offset,
                count: paginatedData.length,
                hasMore: offset + limit < mockContainersList.length
            }
        })
    }),

    // List slots
    http.get(`${API_BASE_URL}/storages/:storageId/containers/:containerId/slots`, async ({ request }) => {
        await delay(50)

        const url = new URL(request.url)
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const offset = parseInt(url.searchParams.get('offset') || '0')

        const paginatedData = mockSlotsList.slice(offset, offset + limit)

        return HttpResponse.json({
            data: paginatedData,
            pagination: {
                total: mockSlotsList.length,
                limit,
                offset,
                count: paginatedData.length,
                hasMore: offset + limit < mockSlotsList.length
            }
        })
    }),

    // List storage members
    http.get(`${API_BASE_URL}/storages/:storageId/members`, async ({ request }) => {
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

    // XSS Test: Storage with HTML-encoded malicious content for safe testing
    // Tests should verify that this encoded content is NOT executed and displays as text
    http.get(`${API_BASE_URL}/storages/xss-test`, async () => {
        await delay(50)

        return HttpResponse.json({
            data: {
                ...mockStorageData,
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
    networkError: http.get(`${API_BASE_URL}/storages/:id`, () => {
        return HttpResponse.error()
    }),

    timeout: http.get(`${API_BASE_URL}/storages/:id`, async () => {
        // 4 second delay - just under Vitest's default 5s timeout
        // Tests using this handler should increase timeout: test('...', { timeout: 6000 }, async () => {...})
        await delay(4000)
        return HttpResponse.json({ data: mockStorageData })
    }),

    unauthorized: http.get(`${API_BASE_URL}/storages/:id`, () => {
        return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }),

    forbidden: http.get(`${API_BASE_URL}/storages/:id`, () => {
        return HttpResponse.json({ message: 'Forbidden: Insufficient permissions' }, { status: 403 })
    })
}
