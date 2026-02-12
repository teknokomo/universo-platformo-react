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
    codename: 'test-metahub',
    name: 'Test Metahub',
    description: 'A test metahub for unit tests',
    membersCount: 4,
    role: 'admin',
    createdAt: CREATED_30_DAYS_AGO,
    updatedAt: UPDATED_7_DAYS_AGO
}

export const mockMetahubsList = [
    {
        id: 'metahub-1',
        codename: 'production-metahub',
        name: 'Production Metahub',
        description: 'Main production environment',
        role: 'admin',
        membersCount: 5,
        createdAt: CREATED_30_DAYS_AGO,
        updatedAt: UPDATED_7_DAYS_AGO
    },
    {
        id: 'metahub-2',
        codename: 'testing-metahub',
        name: 'Testing Metahub',
        description: 'Test environment',
        role: 'editor',
        membersCount: 2,
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

const createVlc = (en: string, ru: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: {
            content: en,
            version: 1,
            isActive: true,
            createdAt: CREATED_30_DAYS_AGO,
            updatedAt: UPDATED_1_DAY_AGO
        },
        ru: {
            content: ru,
            version: 1,
            isActive: true,
            createdAt: CREATED_30_DAYS_AGO,
            updatedAt: UPDATED_1_DAY_AGO
        }
    }
})

const mockTemplatesList = [
    {
        id: 'template-basic',
        codename: 'basic',
        name: createVlc('Basic template', 'Базовый шаблон'),
        description: createVlc('Default template for metahubs', 'Шаблон по умолчанию для метахабов'),
        icon: 'Dashboard',
        isSystem: true,
        sortOrder: 1,
        activeVersion: {
            id: 'template-basic-v1',
            versionNumber: 1,
            versionLabel: '1.0.0',
            changelog: 'Baseline template version'
        }
    }
]

/**
 * MSW request handlers
 */
export const handlers = [
    // Profile settings endpoint (required by many components)
    http.get(`${API_BASE_URL}/profile/settings`, async () => {
        await delay(10)
        return HttpResponse.json({
            data: {
                locale: 'en',
                theme: 'light',
                timezone: 'UTC'
            }
        })
    }),

    // List templates (used by metahub create/edit forms)
    http.get(`${API_BASE_URL}/templates`, async () => {
        await delay(20)
        return HttpResponse.json({
            data: mockTemplatesList,
            total: mockTemplatesList.length
        })
    }),

    // Get template details by id
    http.get(`${API_BASE_URL}/templates/:templateId`, async ({ params }) => {
        await delay(20)
        const template = mockTemplatesList.find((item) => item.id === params.templateId)

        if (!template) {
            return HttpResponse.json({ message: 'Template not found' }, { status: 404 })
        }

        return HttpResponse.json({
            id: template.id,
            codename: template.codename,
            name: template.name,
            description: template.description,
            icon: template.icon,
            isSystem: template.isSystem,
            isActive: true,
            sortOrder: template.sortOrder,
            activeVersionId: template.activeVersion?.id ?? null,
            versions: [
                {
                    id: template.activeVersion?.id ?? 'template-version-1',
                    versionNumber: template.activeVersion?.versionNumber ?? 1,
                    versionLabel: template.activeVersion?.versionLabel ?? '1.0.0',
                    changelog: template.activeVersion?.changelog ?? null,
                    isActive: true,
                    createdAt: CREATED_30_DAYS_AGO
                }
            ]
        })
    }),

    // Get single metahub
    http.get(`${API_BASE_URL}/metahub/:id`, async ({ params }) => {
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

    // List metahub members
    http.get(`${API_BASE_URL}/metahub/:metahubId/members`, async ({ request }) => {
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
    http.get(`${API_BASE_URL}/metahub/xss-test`, async () => {
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
    networkError: http.get(`${API_BASE_URL}/metahub/:id`, () => {
        return HttpResponse.error()
    }),

    timeout: http.get(`${API_BASE_URL}/metahub/:id`, async () => {
        // 4 second delay - just under Vitest's default 5s timeout
        // Tests using this handler should increase timeout: test('...', { timeout: 6000 }, async () => {...})
        await delay(4000)
        return HttpResponse.json({ data: mockMetahubData })
    }),

    unauthorized: http.get(`${API_BASE_URL}/metahub/:id`, () => {
        return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }),

    forbidden: http.get(`${API_BASE_URL}/metahub/:id`, () => {
        return HttpResponse.json({ message: 'Forbidden: Insufficient permissions' }, { status: 403 })
    })
}
