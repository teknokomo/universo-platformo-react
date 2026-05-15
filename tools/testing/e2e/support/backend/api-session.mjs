import { loadE2eEnvironment } from '../env/load-e2e-env.mjs'

const jsonHeaders = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
}

const readJsonSafe = async (response) => {
    const text = await response.text()

    if (!text) {
        return null
    }

    try {
        return JSON.parse(text)
    } catch {
        return { raw: text }
    }
}

const buildError = async (response, label) => {
    const payload = await readJsonSafe(response)
    const details = payload && typeof payload === 'object' ? JSON.stringify(payload) : String(payload ?? '')
    return new Error(`${label} failed with ${response.status} ${response.statusText}: ${details}`)
}

const buildErrorFromPayload = (response, label, payload) => {
    const details = payload && typeof payload === 'object' ? JSON.stringify(payload) : String(payload ?? '')
    return new Error(`${label} failed with ${response.status} ${response.statusText}: ${details}`)
}

const resolveManagedKindKey = (fallbackKindKey, kindKey) => {
    const normalizedKindKey = typeof kindKey === 'string' ? kindKey.trim() : ''
    return normalizedKindKey || fallbackKindKey
}

const buildManagedEntityInstancesApiPath = (metahubId, fallbackKindKey, kindKey) =>
    `/api/v1/metahub/${metahubId}/entities/${encodeURIComponent(resolveManagedKindKey(fallbackKindKey, kindKey))}/instances`

const buildManagedEntityInstanceApiPath = (metahubId, entityId, fallbackKindKey, kindKey) =>
    `/api/v1/metahub/${metahubId}/entities/${encodeURIComponent(resolveManagedKindKey(fallbackKindKey, kindKey))}/instance/${entityId}`

const buildManagedEntityChildCollectionApiPath = (metahubId, entityId, fallbackKindKey, suffix, kindKey) =>
    `${buildManagedEntityInstanceApiPath(metahubId, entityId, fallbackKindKey, kindKey)}/${suffix}`

const buildManagedEntityChildItemApiPath = (metahubId, entityId, fallbackKindKey, suffix, childId, kindKey) =>
    `${buildManagedEntityChildCollectionApiPath(metahubId, entityId, fallbackKindKey, suffix, kindKey)}/${childId}`

export async function createApiContext() {
    const env = loadE2eEnvironment()

    return {
        baseURL: env.baseURL,
        cookies: new Map()
    }
}

const getResponseCookies = (response) => {
    if (typeof response.headers.getSetCookie === 'function') {
        return response.headers.getSetCookie()
    }

    const single = response.headers.get('set-cookie')
    return single ? [single] : []
}

const persistResponseCookies = (api, response) => {
    for (const entry of getResponseCookies(response)) {
        const cookiePart = entry.split(';')[0]
        const delimiterIndex = cookiePart.indexOf('=')
        if (delimiterIndex <= 0) {
            continue
        }

        const name = cookiePart.slice(0, delimiterIndex).trim()
        const value = cookiePart.slice(delimiterIndex + 1).trim()
        if (!name) {
            continue
        }

        api.cookies.set(name, value)
    }
}

const buildCookieHeader = (api) => {
    if (!api.cookies || api.cookies.size === 0) {
        return null
    }

    return Array.from(api.cookies.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ')
}

const resolveApiUrl = (api, input) => new URL(input, api.baseURL).toString()

const fetchFromApi = async (api, input, init = {}) => {
    const headers = new Headers(init.headers ?? {})
    if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json')
    }

    const cookieHeader = buildCookieHeader(api)
    if (cookieHeader) {
        headers.set('Cookie', cookieHeader)
    }

    const response = await fetch(resolveApiUrl(api, input), {
        ...init,
        headers
    })

    persistResponseCookies(api, response)
    return response
}

export async function createLoggedInApiContext(credentials) {
    const api = await createApiContext()
    await login(api, credentials)
    return api
}

export async function disposeApiContext(api) {
    void api
}

export async function fetchCsrfToken(api) {
    const response = await fetchFromApi(api, '/api/v1/auth/csrf', {
        method: 'GET'
    })
    if (!response.ok) {
        throw await buildError(response, 'Fetching CSRF token')
    }

    const payload = await response.json()
    if (!payload?.csrfToken) {
        throw new Error('CSRF token is missing in /api/v1/auth/csrf response')
    }

    return payload.csrfToken
}

export async function sendWithCsrf(api, method, url, payload) {
    const csrfToken = await fetchCsrfToken(api)
    const response = await fetchFromApi(api, url, {
        method,
        headers: {
            ...jsonHeaders,
            'x-csrf-token': csrfToken
        },
        body: JSON.stringify(payload)
    })

    return response
}

export async function login(api, { email, password }) {
    const response = await sendWithCsrf(api, 'POST', '/api/v1/auth/login', {
        email,
        password
    })

    if (!response.ok) {
        throw await buildError(response, `Logging in as ${email}`)
    }

    return response.json()
}

export async function getCurrentUser(api) {
    const response = await fetchFromApi(api, '/api/v1/auth/me', {
        method: 'GET'
    })
    if (!response.ok) {
        throw await buildError(response, 'Fetching current user')
    }

    return response.json()
}

export async function getAssignableRoles(api) {
    const response = await fetchFromApi(api, '/api/v1/admin/roles/assignable', {
        method: 'GET'
    })
    if (!response.ok) {
        throw await buildError(response, 'Fetching assignable roles')
    }

    const payload = await response.json()
    return payload?.data ?? []
}

export async function listRoles(api, params = {}) {
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const url = query.size > 0 ? `/api/v1/admin/roles?${query.toString()}` : '/api/v1/admin/roles'
    const response = await fetchFromApi(api, url, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, 'Listing admin roles')
    }

    const body = await response.json()
    return body?.data ?? []
}

export async function getRole(api, roleId) {
    const response = await fetchFromApi(api, `/api/v1/admin/roles/${roleId}`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Fetching admin role ${roleId}`)
    }

    const body = await response.json()
    return body?.data ?? body
}

export async function createRole(api, payload) {
    const response = await sendWithCsrf(api, 'POST', '/api/v1/admin/roles', payload)
    if (!response.ok) {
        throw await buildError(response, `Creating admin role ${JSON.stringify(payload.codename ?? {})}`)
    }

    const body = await response.json()
    return body?.data ?? body
}

export async function updateRole(api, roleId, payload) {
    const response = await sendWithCsrf(api, 'PATCH', `/api/v1/admin/roles/${roleId}`, payload)
    if (!response.ok) {
        throw await buildError(response, `Updating admin role ${roleId}`)
    }

    const body = await response.json()
    return body?.data ?? body
}

export async function replaceRolePermissions(api, roleId, permissions) {
    const response = await sendWithCsrf(api, 'PUT', `/api/v1/admin/roles/${roleId}/permissions`, { permissions })
    if (!response.ok) {
        throw await buildError(response, `Replacing permissions for role ${roleId}`)
    }

    const body = await response.json()
    return body?.data ?? body
}

export async function copyRole(api, roleId, payload) {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/admin/roles/${roleId}/copy`, payload)
    if (!response.ok) {
        throw await buildError(response, `Copying admin role ${roleId}`)
    }

    const body = await response.json()
    return body?.data ?? body
}

export async function deleteRole(api, roleId) {
    const response = await sendWithCsrf(api, 'DELETE', `/api/v1/admin/roles/${roleId}`)
    if (response.ok || response.status === 404) {
        return true
    }

    throw await buildError(response, `Deleting admin role ${roleId}`)
}

export async function createAdminUser(api, payload) {
    const response = await sendWithCsrf(api, 'POST', '/api/v1/admin/global-users/create-user', payload)
    if (!response.ok) {
        throw await buildError(response, `Creating admin user ${payload.email}`)
    }

    const body = await response.json()
    return body?.data ?? body
}

export async function listGlobalUsers(api, params = {}) {
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const url = query.size > 0 ? `/api/v1/admin/global-users?${query.toString()}` : '/api/v1/admin/global-users'
    const response = await fetchFromApi(api, url, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, 'Listing global users')
    }

    const body = await response.json()
    return body?.data ?? []
}

export async function setGlobalUserRoles(api, userId, payload) {
    const response = await sendWithCsrf(api, 'PUT', `/api/v1/admin/global-users/${userId}/roles`, payload)
    if (!response.ok) {
        throw await buildError(response, `Setting roles for global user ${userId}`)
    }

    const body = await response.json()
    return body?.data ?? body
}

export async function listLocales(api, params = {}) {
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const url = query.size > 0 ? `/api/v1/admin/locales?${query.toString()}` : '/api/v1/admin/locales'
    const response = await fetchFromApi(api, url, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, 'Listing locales')
    }

    const body = await response.json()
    return body?.data?.items ?? []
}

export async function createLocale(api, payload) {
    const response = await sendWithCsrf(api, 'POST', '/api/v1/admin/locales', payload)
    if (!response.ok) {
        throw await buildError(response, `Creating locale ${payload.code}`)
    }

    const body = await response.json()
    return body?.data ?? body
}

export async function updateLocale(api, localeId, payload) {
    const response = await sendWithCsrf(api, 'PATCH', `/api/v1/admin/locales/${localeId}`, payload)
    if (!response.ok) {
        throw await buildError(response, `Updating locale ${localeId}`)
    }

    const body = await response.json()
    return body?.data ?? body
}

export async function deleteLocale(api, localeId) {
    const response = await sendWithCsrf(api, 'DELETE', `/api/v1/admin/locales/${localeId}`)
    if (response.ok || response.status === 404) {
        return true
    }

    throw await buildError(response, `Deleting locale ${localeId}`)
}

export async function listAdminSettings(api, category) {
    const path = category ? `/api/v1/admin/settings/${category}` : '/api/v1/admin/settings'
    const response = await fetchFromApi(api, path, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Listing admin settings${category ? ` for ${category}` : ''}`)
    }

    const body = await response.json()
    return body?.data?.items ?? []
}

export async function updateAdminSettingsCategory(api, category, values) {
    const response = await sendWithCsrf(api, 'PUT', `/api/v1/admin/settings/${category}`, { values })
    if (!response.ok) {
        throw await buildError(response, `Updating admin settings category ${category}`)
    }

    const body = await response.json()
    return body?.data?.items ?? body?.data ?? body
}

export async function updateAdminSetting(api, category, key, value) {
    const response = await sendWithCsrf(api, 'PUT', `/api/v1/admin/settings/${category}/${key}`, { value })
    if (!response.ok) {
        throw await buildError(response, `Updating admin setting ${category}/${key}`)
    }

    const body = await response.json()
    return body?.data ?? body
}

export async function deleteAdminSetting(api, category, key) {
    const response = await sendWithCsrf(api, 'DELETE', `/api/v1/admin/settings/${category}/${key}`)
    if (response.ok || response.status === 404) {
        return true
    }

    throw await buildError(response, `Deleting admin setting ${category}/${key}`)
}

export async function listInstances(api, params = {}) {
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const url = query.size > 0 ? `/api/v1/admin/instances?${query.toString()}` : '/api/v1/admin/instances'
    const response = await fetchFromApi(api, url, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, 'Listing admin instances')
    }

    const body = await response.json()
    return body?.data ?? []
}

export async function getInstance(api, instanceId) {
    const response = await fetchFromApi(api, `/api/v1/admin/instances/${instanceId}`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Fetching admin instance ${instanceId}`)
    }

    const body = await response.json()
    return body?.data ?? body
}

export async function updateInstance(api, instanceId, payload) {
    const response = await sendWithCsrf(api, 'PUT', `/api/v1/admin/instances/${instanceId}`, payload)
    if (!response.ok) {
        throw await buildError(response, `Updating admin instance ${instanceId}`)
    }

    const body = await response.json()
    return body?.data ?? body
}

export async function getInstanceStats(api, instanceId) {
    const response = await fetchFromApi(api, `/api/v1/admin/instances/${instanceId}/stats`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Fetching stats for instance ${instanceId}`)
    }

    const body = await response.json()
    return body?.data ?? body
}

export async function getAdminDashboardStats(api) {
    const response = await fetchFromApi(api, '/api/v1/admin/dashboard/stats', { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, 'Fetching admin dashboard stats')
    }

    const body = await response.json()
    return body?.data ?? body
}

export async function revokeGlobalAccess(api, userId) {
    const response = await sendWithCsrf(api, 'DELETE', `/api/v1/admin/global-users/${userId}`)
    if (response.ok || response.status === 404) {
        return true
    }

    if (response.status === 400) {
        return false
    }

    throw await buildError(response, `Revoking global access for ${userId}`)
}

export async function listMetahubs(api, params = {}) {
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const url = query.size > 0 ? `/api/v1/metahubs?${query.toString()}` : '/api/v1/metahubs'
    const response = await fetchFromApi(api, url, {
        method: 'GET'
    })

    if (!response.ok) {
        throw await buildError(response, 'Listing metahubs')
    }

    return response.json()
}

export async function listMetahubEntityTypes(api, metahubId, params = {}) {
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(api, `/api/v1/metahub/${metahubId}/entity-types${suffix}`, {
        method: 'GET'
    })
    if (!response.ok) {
        throw await buildError(response, `Listing entity types for metahub ${metahubId}`)
    }

    return response.json()
}

export async function getMetahubEntityType(api, metahubId, entityTypeId) {
    const response = await fetchFromApi(api, `/api/v1/metahub/${metahubId}/entity-type/${entityTypeId}`, {
        method: 'GET'
    })
    if (!response.ok) {
        throw await buildError(response, `Fetching entity type ${entityTypeId} for metahub ${metahubId}`)
    }

    return response.json()
}

export async function createMetahubEntityType(api, metahubId, payload) {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/entity-types`, payload)
    if (!response.ok) {
        throw await buildError(response, `Creating entity type in metahub ${metahubId}`)
    }

    return response.json()
}

export async function updateMetahubEntityType(api, metahubId, entityTypeId, payload) {
    const response = await sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahubId}/entity-type/${entityTypeId}`, payload)
    if (!response.ok) {
        throw await buildError(response, `Updating entity type ${entityTypeId} in metahub ${metahubId}`)
    }

    return response.json()
}

export async function listTemplates(api, params = {}) {
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(api, `/api/v1/templates${suffix}`, {
        method: 'GET'
    })
    if (!response.ok) {
        throw await buildError(response, 'Listing metahub templates')
    }

    return response.json()
}

export async function getTemplate(api, templateId) {
    const response = await fetchFromApi(api, `/api/v1/templates/${templateId}`, {
        method: 'GET'
    })
    if (!response.ok) {
        throw await buildError(response, `Fetching template ${templateId}`)
    }

    return response.json()
}

export async function listObjectCollections(api, metahubId, params = {}) {
    const { kindKey, ...queryParams } = params
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(queryParams)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(api, `${buildManagedEntityInstancesApiPath(metahubId, 'object', kindKey)}${suffix}`, {
        method: 'GET'
    })
    if (!response.ok) {
        throw await buildError(response, `Listing objects for metahub ${metahubId}`)
    }

    return response.json()
}

export async function createObjectCollection(api, metahubId, payload) {
    const response = await sendWithCsrf(
        api,
        'POST',
        buildManagedEntityInstancesApiPath(metahubId, 'object', payload?.kindKey),
        payload
    )
    if (!response.ok) {
        throw await buildError(response, `Creating object in metahub ${metahubId}`)
    }

    return response.json()
}

export async function listMetahubScripts(api, metahubId, params = {}) {
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(api, `/api/v1/metahub/${metahubId}/scripts${suffix}`, {
        method: 'GET'
    })
    if (!response.ok) {
        throw await buildError(response, `Listing scripts for metahub ${metahubId}`)
    }

    return response.json()
}

export async function listTreeEntities(api, metahubId, params = {}) {
    const { kindKey, ...queryParams } = params
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(queryParams)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(api, `${buildManagedEntityInstancesApiPath(metahubId, 'hub', kindKey)}${suffix}`, {
        method: 'GET'
    })
    if (!response.ok) {
        throw await buildError(response, `Listing hubs for metahub ${metahubId}`)
    }

    return response.json()
}

export async function getTreeEntity(api, metahubId, hubId, kindKey) {
    const response = await fetchFromApi(api, buildManagedEntityInstanceApiPath(metahubId, hubId, 'hub', kindKey), { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Fetching hub ${hubId} for metahub ${metahubId}`)
    }

    return response.json()
}

export async function listOptionLists(api, metahubId, params = {}) {
    const { kindKey, ...queryParams } = params
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(queryParams)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(api, `${buildManagedEntityInstancesApiPath(metahubId, 'enumeration', kindKey)}${suffix}`, {
        method: 'GET'
    })
    if (!response.ok) {
        throw await buildError(response, `Listing enumerations for metahub ${metahubId}`)
    }

    return response.json()
}

export async function getOptionList(api, metahubId, enumerationId, kindKey) {
    const response = await fetchFromApi(
        api,
        buildManagedEntityInstanceApiPath(metahubId, enumerationId, 'enumeration', kindKey),
        { method: 'GET' }
    )
    if (!response.ok) {
        throw await buildError(response, `Fetching enumeration ${enumerationId} for metahub ${metahubId}`)
    }

    return response.json()
}

export async function listValueGroups(api, metahubId, params = {}) {
    const { kindKey, ...queryParams } = params
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(queryParams)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(api, `${buildManagedEntityInstancesApiPath(metahubId, 'set', kindKey)}${suffix}`, {
        method: 'GET'
    })
    if (!response.ok) {
        throw await buildError(response, `Listing sets for metahub ${metahubId}`)
    }

    return response.json()
}

export async function getValueGroup(api, metahubId, setId, kindKey) {
    const response = await fetchFromApi(api, buildManagedEntityInstanceApiPath(metahubId, setId, 'set', kindKey), { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Fetching set ${setId} for metahub ${metahubId}`)
    }

    return response.json()
}

export async function createMetahub(api, payload) {
    const response = await sendWithCsrf(api, 'POST', '/api/v1/metahubs', payload)
    if (!response.ok) {
        throw await buildError(response, 'Creating metahub')
    }

    return response.json()
}

export async function getMetahub(api, metahubId) {
    const response = await fetchFromApi(api, `/api/v1/metahub/${metahubId}`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Fetching metahub ${metahubId}`)
    }

    return response.json()
}

export async function listMetahubBranches(api, metahubId, params = {}) {
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(api, `/api/v1/metahub/${metahubId}/branches${suffix}`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Listing branches for metahub ${metahubId}`)
    }

    return response.json()
}

export async function getMetahubBranch(api, metahubId, branchId) {
    const response = await fetchFromApi(api, `/api/v1/metahub/${metahubId}/branch/${branchId}`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Fetching branch ${branchId} for metahub ${metahubId}`)
    }

    return response.json()
}

export async function createMetahubBranch(api, metahubId, payload) {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/branches`, payload)
    if (!response.ok) {
        throw await buildError(response, `Creating branch for metahub ${metahubId}`)
    }

    return response.json()
}

export async function listMetahubBranchOptions(api, metahubId, params = {}) {
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(api, `/api/v1/metahub/${metahubId}/branches/options${suffix}`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Listing branch options for metahub ${metahubId}`)
    }

    return response.json()
}

export async function listMetahubMigrations(api, metahubId, params = {}) {
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(api, `/api/v1/metahub/${metahubId}/migrations${suffix}`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Listing migrations for metahub ${metahubId}`)
    }

    return response.json()
}

export async function planMetahubMigrations(api, metahubId, payload = {}) {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/migrations/plan`, payload)
    if (!response.ok) {
        throw await buildError(response, `Planning migrations for metahub ${metahubId}`)
    }

    return response.json()
}

export async function applyMetahubMigrations(api, metahubId, payload = {}) {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/migrations/apply`, payload)
    if (!response.ok) {
        throw await buildError(response, `Applying migrations for metahub ${metahubId}`)
    }

    return response.json()
}

export async function getMetahubBoardSummary(api, metahubId) {
    const response = await fetchFromApi(api, `/api/v1/metahub/${metahubId}/board/summary`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Fetching metahub board summary ${metahubId}`)
    }

    return response.json()
}

export async function listMetahubSettings(api, metahubId) {
    const response = await fetchFromApi(api, `/api/v1/metahub/${metahubId}/settings`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Listing settings for metahub ${metahubId}`)
    }

    return response.json()
}

export async function updateMetahubSettings(api, metahubId, settings) {
    const response = await sendWithCsrf(api, 'PUT', `/api/v1/metahub/${metahubId}/settings`, { settings })
    if (!response.ok) {
        throw await buildError(response, `Updating settings for metahub ${metahubId}`)
    }

    return response.json()
}

export async function addMetahubMember(api, metahubId, payload) {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/members`, payload)
    if (!response.ok) {
        throw await buildError(response, `Adding member ${payload.email} to metahub ${metahubId}`)
    }

    return response.json()
}

export async function updateMetahubMember(api, metahubId, memberId, payload) {
    const response = await sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahubId}/member/${memberId}`, payload)
    if (!response.ok) {
        throw await buildError(response, `Updating metahub member ${memberId}`)
    }

    return response.json()
}

export async function listMetahubMembers(api, metahubId) {
    const response = await fetchFromApi(api, `/api/v1/metahub/${metahubId}/members`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Listing members for metahub ${metahubId}`)
    }

    return response.json()
}

export async function removeMetahubMember(api, metahubId, memberId) {
    const response = await sendWithCsrf(api, 'DELETE', `/api/v1/metahub/${metahubId}/member/${memberId}`)
    if (response.ok || response.status === 404) {
        return true
    }

    throw await buildError(response, `Removing metahub member ${memberId}`)
}

export async function deleteMetahub(api, metahubId) {
    const response = await sendWithCsrf(api, 'DELETE', `/api/v1/metahub/${metahubId}`)
    if (response.ok || response.status === 404) {
        return true
    }

    throw await buildError(response, `Deleting metahub ${metahubId}`)
}

export async function createComponent(api, metahubId, objectId, payload) {
    const response = await sendWithCsrf(
        api,
        'POST',
        buildManagedEntityChildCollectionApiPath(metahubId, objectId, 'object', 'components'),
        payload
    )
    if (!response.ok) {
        throw await buildError(response, `Creating component in metahub ${metahubId} object ${objectId}`)
    }

    return response.json()
}

export async function listComponents(api, metahubId, objectId, params = {}) {
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(
        api,
        `${buildManagedEntityChildCollectionApiPath(metahubId, objectId, 'object', 'components')}${suffix}`,
        {
            method: 'GET'
        }
    )
    if (!response.ok) {
        throw await buildError(response, `Listing components for object ${objectId} in metahub ${metahubId}`)
    }

    return response.json()
}

export async function getComponent(api, metahubId, objectId, componentId) {
    const response = await fetchFromApi(
        api,
        buildManagedEntityChildItemApiPath(metahubId, objectId, 'object', 'component', componentId),
        {
            method: 'GET'
        }
    )
    if (!response.ok) {
        throw await buildError(response, `Fetching component ${componentId} for object ${objectId} in metahub ${metahubId}`)
    }

    return response.json()
}

export async function listRecords(api, metahubId, objectId, params = {}) {
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(api, `${buildManagedEntityChildCollectionApiPath(metahubId, objectId, 'object', 'records')}${suffix}`, {
        method: 'GET'
    })
    if (!response.ok) {
        throw await buildError(response, `Listing elements for object ${objectId} in metahub ${metahubId}`)
    }

    return response.json()
}

export async function createRecord(api, metahubId, objectId, payload) {
    const response = await sendWithCsrf(
        api,
        'POST',
        buildManagedEntityChildCollectionApiPath(metahubId, objectId, 'object', 'records'),
        payload
    )

    if (!response.ok) {
        throw await buildError(response, `Creating record for object ${objectId} in metahub ${metahubId}`)
    }

    return response.json()
}

export async function getRecord(api, metahubId, objectId, elementId) {
    const response = await fetchFromApi(api, buildManagedEntityChildItemApiPath(metahubId, objectId, 'object', 'record', elementId), { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Fetching element ${elementId} for object ${objectId} in metahub ${metahubId}`)
    }

    return response.json()
}

export async function listOptionValues(api, metahubId, enumerationId, params = {}) {
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(
        api,
        `${buildManagedEntityChildCollectionApiPath(metahubId, enumerationId, 'enumeration', 'values')}${suffix}`,
        { method: 'GET' }
    )
    if (!response.ok) {
        throw await buildError(response, `Listing values for enumeration ${enumerationId} in metahub ${metahubId}`)
    }

    return response.json()
}

export async function getOptionValue(api, metahubId, enumerationId, valueId) {
    const response = await fetchFromApi(
        api,
        buildManagedEntityChildItemApiPath(metahubId, enumerationId, 'enumeration', 'value', valueId),
        {
            method: 'GET'
        }
    )
    if (!response.ok) {
        throw await buildError(response, `Fetching value ${valueId} for enumeration ${enumerationId} in metahub ${metahubId}`)
    }

    return response.json()
}

export async function listFixedValues(api, metahubId, setId, params = {}) {
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(api, `${buildManagedEntityChildCollectionApiPath(metahubId, setId, 'set', 'fixed-values')}${suffix}`, {
        method: 'GET'
    })
    if (!response.ok) {
        throw await buildError(response, `Listing constants for set ${setId} in metahub ${metahubId}`)
    }

    return response.json()
}

export async function getFixedValue(api, metahubId, setId, constantId) {
    const response = await fetchFromApi(api, buildManagedEntityChildItemApiPath(metahubId, setId, 'set', 'fixed-value', constantId), {
        method: 'GET'
    })
    if (!response.ok) {
        throw await buildError(response, `Fetching constant ${constantId} for set ${setId} in metahub ${metahubId}`)
    }

    return response.json()
}

export async function listPublications(api, metahubId) {
    const response = await fetchFromApi(api, `/api/v1/metahub/${metahubId}/publications`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Listing publications for metahub ${metahubId}`)
    }

    return response.json()
}

export async function getPublication(api, metahubId, publicationId) {
    const response = await fetchFromApi(api, `/api/v1/metahub/${metahubId}/publication/${publicationId}`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Fetching publication ${publicationId} in metahub ${metahubId}`)
    }

    return response.json()
}

export async function createPublication(api, metahubId, payload) {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/publications`, payload)
    if (!response.ok) {
        throw await buildError(response, `Creating publication in metahub ${metahubId}`)
    }

    return response.json()
}

export async function createPublicationLinkedApplication(api, metahubId, publicationId, payload) {
    const url = `/api/v1/metahub/${metahubId}/publication/${publicationId}/applications`
    const response = await sendWithCsrf(api, 'POST', url, payload)

    if (!response.ok) {
        const responsePayload = await readJsonSafe(response)
        throw buildErrorFromPayload(response, `Creating linked application for publication ${publicationId}`, responsePayload)
    }

    return response.json()
}

export async function syncApplicationSchema(api, applicationId, payload = {}) {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/application/${applicationId}/sync`, payload)
    if (!response.ok) {
        throw await buildError(response, `Syncing application schema for ${applicationId}`)
    }

    return response.json()
}

export async function createPublicationVersion(api, metahubId, publicationId, payload) {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/publication/${publicationId}/versions`, payload)
    if (!response.ok) {
        throw await buildError(response, `Creating publication version for ${publicationId}`)
    }

    return response.json()
}

export async function listPublicationApplications(api, metahubId, publicationId) {
    const response = await fetchFromApi(api, `/api/v1/metahub/${metahubId}/publication/${publicationId}/applications`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Listing linked applications for publication ${publicationId}`)
    }

    return response.json()
}

export async function syncPublication(api, metahubId, publicationId, payload = {}) {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/publication/${publicationId}/sync`, payload)
    if (!response.ok) {
        throw await buildError(response, `Syncing publication ${publicationId}`)
    }

    return response.json()
}

export async function waitForPublicationReady(
    api,
    metahubId,
    publicationId,
    { timeoutMs = 30000, intervalMs = 500, allowedStatuses = ['synced', 'outdated'] } = {}
) {
    const startedAt = Date.now()
    let lastPublication = null

    while (Date.now() - startedAt < timeoutMs) {
        lastPublication = await getPublication(api, metahubId, publicationId)

        if (typeof lastPublication?.activeVersionId === 'string' && allowedStatuses.includes(lastPublication?.schemaStatus)) {
            return lastPublication
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }

    throw new Error(
        `Publication ${publicationId} in metahub ${metahubId} did not become ready within ${timeoutMs}ms. Last state: ${JSON.stringify(
            lastPublication
        )}`
    )
}

export async function deletePublication(api, metahubId, publicationId) {
    const response = await sendWithCsrf(api, 'DELETE', `/api/v1/metahub/${metahubId}/publication/${publicationId}?confirm=true`)
    if (response.ok || response.status === 404) {
        return true
    }

    throw await buildError(response, `Deleting publication ${publicationId}`)
}

export async function listApplications(api, params = {}) {
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const url = query.size > 0 ? `/api/v1/applications?${query.toString()}` : '/api/v1/applications'
    const response = await fetchFromApi(api, url, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, 'Listing applications')
    }

    return response.json()
}

export async function listRoleUsers(api, roleId, params = {}) {
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(api, `/api/v1/admin/roles/${roleId}/users${suffix}`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Listing users for role ${roleId}`)
    }

    return response.json()
}

export async function createApplication(api, payload) {
    const response = await sendWithCsrf(api, 'POST', '/api/v1/applications', payload)
    if (!response.ok) {
        throw await buildError(response, 'Creating application')
    }

    return response.json()
}

export async function listLayouts(api, metahubId, params = {}) {
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(api, `/api/v1/metahub/${metahubId}/layouts${suffix}`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Listing layouts for metahub ${metahubId}`)
    }

    return response.json()
}

export async function createLayout(api, metahubId, payload) {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/layouts`, payload)
    if (!response.ok) {
        throw await buildError(response, `Creating layout in metahub ${metahubId}`)
    }

    return response.json()
}

export async function updateLayout(api, metahubId, layoutId, payload) {
    const response = await sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahubId}/layout/${layoutId}`, payload)
    if (!response.ok) {
        throw await buildError(response, `Updating layout ${layoutId} in metahub ${metahubId}`)
    }

    return response.json()
}

export async function getLayout(api, metahubId, layoutId) {
    const response = await fetchFromApi(api, `/api/v1/metahub/${metahubId}/layout/${layoutId}`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Fetching layout ${layoutId} for metahub ${metahubId}`)
    }

    return response.json()
}

export async function listLayoutZoneWidgets(api, metahubId, layoutId) {
    const response = await fetchFromApi(api, `/api/v1/metahub/${metahubId}/layout/${layoutId}/zone-widgets`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Listing layout widgets for layout ${layoutId} in metahub ${metahubId}`)
    }

    return response.json()
}

export async function assignLayoutZoneWidget(api, metahubId, layoutId, payload) {
    const response = await sendWithCsrf(api, 'PUT', `/api/v1/metahub/${metahubId}/layout/${layoutId}/zone-widget`, payload)
    if (!response.ok) {
        throw await buildError(response, `Assigning widget to layout ${layoutId} in metahub ${metahubId}`)
    }

    return response.json()
}

export async function moveLayoutZoneWidget(api, metahubId, layoutId, payload) {
    const response = await sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahubId}/layout/${layoutId}/zone-widgets/move`, payload)
    if (!response.ok) {
        throw await buildError(response, `Moving widget in layout ${layoutId} for metahub ${metahubId}`)
    }

    return response.json()
}

export async function toggleLayoutZoneWidgetActive(api, metahubId, layoutId, widgetId, isActive) {
    const response = await sendWithCsrf(
        api,
        'PATCH',
        `/api/v1/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widgetId}/toggle-active`,
        { isActive }
    )
    if (!response.ok) {
        throw await buildError(response, `Toggling widget ${widgetId} in layout ${layoutId} for metahub ${metahubId}`)
    }

    return response.json()
}

export async function getApplication(api, applicationId) {
    const response = await fetchFromApi(api, `/api/v1/applications/${applicationId}`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Fetching application ${applicationId}`)
    }

    return response.json()
}

export async function listApplicationLayouts(api, applicationId, params = {}) {
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(api, `/api/v1/applications/${applicationId}/layouts${suffix}`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Listing layouts for application ${applicationId}`)
    }

    return response.json()
}

export async function getApplicationLayout(api, applicationId, layoutId) {
    const response = await fetchFromApi(api, `/api/v1/applications/${applicationId}/layouts/${layoutId}`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Fetching layout ${layoutId} for application ${applicationId}`)
    }

    return response.json()
}

export async function updateApplicationLayout(api, applicationId, layoutId, payload) {
    const response = await sendWithCsrf(api, 'PATCH', `/api/v1/applications/${applicationId}/layouts/${layoutId}`, payload)
    if (!response.ok) {
        throw await buildError(response, `Updating layout ${layoutId} for application ${applicationId}`)
    }

    return response.json()
}

export async function copyApplicationLayout(api, applicationId, layoutId) {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/applications/${applicationId}/layouts/${layoutId}/copy`, {})
    if (!response.ok) {
        throw await buildError(response, `Copying layout ${layoutId} for application ${applicationId}`)
    }

    return response.json()
}

export async function deleteApplicationLayout(api, applicationId, layoutId, expectedVersion) {
    const query = new URLSearchParams()
    if (expectedVersion !== undefined && expectedVersion !== null) {
        query.set('expectedVersion', String(expectedVersion))
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(api, `/api/v1/applications/${applicationId}/layouts/${layoutId}${suffix}`, {
        method: 'DELETE',
        headers: {
            'x-csrf-token': await fetchCsrfToken(api)
        }
    })
    if (!response.ok) {
        throw await buildError(response, `Deleting layout ${layoutId} for application ${applicationId}`)
    }
}

export async function listApplicationLayoutWidgetObject(api, applicationId, layoutId) {
    const response = await fetchFromApi(api, `/api/v1/applications/${applicationId}/layouts/${layoutId}/zone-widgets/object`, {
        method: 'GET'
    })
    if (!response.ok) {
        throw await buildError(response, `Listing application layout widget object for layout ${layoutId}`)
    }

    return response.json()
}

export async function moveApplicationLayoutZoneWidget(api, applicationId, layoutId, payload) {
    const response = await sendWithCsrf(api, 'PATCH', `/api/v1/applications/${applicationId}/layouts/${layoutId}/zone-widgets/move`, payload)
    if (!response.ok) {
        throw await buildError(response, `Moving application layout widget in layout ${layoutId}`)
    }

    return response.json()
}

export async function listApplicationMigrations(api, applicationId, params = {}) {
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        query.set(key, String(value))
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(api, `/api/v1/application/${applicationId}/migrations${suffix}`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Listing migrations for application ${applicationId}`)
    }

    return response.json()
}

export async function getApplicationMigration(api, applicationId, migrationId) {
    const response = await fetchFromApi(api, `/api/v1/application/${applicationId}/migration/${migrationId}`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Fetching migration ${migrationId} for application ${applicationId}`)
    }

    return response.json()
}

export async function analyzeApplicationMigrationRollback(api, applicationId, migrationId) {
    const response = await fetchFromApi(api, `/api/v1/application/${applicationId}/migration/${migrationId}/analyze`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Analyzing rollback for migration ${migrationId} in application ${applicationId}`)
    }

    return response.json()
}

export async function getApplicationWorkspaceLimits(api, applicationId, locale = 'en') {
    const query = new URLSearchParams()
    if (locale) {
        query.set('locale', locale)
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(api, `/api/v1/applications/${applicationId}/settings/limits${suffix}`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Fetching application workspace limits for ${applicationId}`)
    }

    const body = await response.json()
    return body?.items ?? body?.data?.items ?? []
}

export async function updateApplicationWorkspaceLimits(api, applicationId, limits) {
    const response = await sendWithCsrf(api, 'PUT', `/api/v1/applications/${applicationId}/settings/limits`, {
        limits
    })
    if (!response.ok) {
        throw await buildError(response, `Updating application workspace limits for ${applicationId}`)
    }

    const body = await response.json()
    return body?.items ?? body?.data?.items ?? []
}

export async function listApplicationWorkspaces(api, applicationId) {
    const response = await fetchFromApi(api, `/api/v1/applications/${applicationId}/runtime/workspaces`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Fetching application workspaces for ${applicationId}`)
    }

    return response.json()
}

export async function setApplicationDefaultWorkspace(api, applicationId, workspaceId) {
    const response = await sendWithCsrf(api, 'PATCH', `/api/v1/applications/${applicationId}/runtime/workspaces/${workspaceId}/default`, {})
    if (!response.ok) {
        throw await buildError(response, `Setting default workspace ${workspaceId} for ${applicationId}`)
    }

    return response.json()
}

export async function getApplicationRuntime(api, applicationId, params = {}) {
    const query = new URLSearchParams()
    const resolvedObjectCollectionId = params.objectCollectionId ?? params.sectionId ?? params.objectId ?? null

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        if (key === 'objectId' || key === 'sectionId' || key === 'objectCollectionId') {
            continue
        }

        query.set(key, String(value))
    }

    if (resolvedObjectCollectionId) {
        query.set('objectCollectionId', String(resolvedObjectCollectionId))
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(api, `/api/v1/applications/${applicationId}/runtime${suffix}`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Fetching runtime for application ${applicationId}`)
    }

    const body = await response.json()
    const resolvedObject = body?.objectCollection ?? body?.object ?? body?.section ?? null
    const resolvedObjects = body?.objectCollections ?? body?.objects ?? body?.sections ?? []
    const resolvedActiveObjectId = body?.activeObjectCollectionId ?? body?.activeObjectId ?? body?.activeSectionId ?? null

    return {
        ...body,
        object: resolvedObject,
        objects: resolvedObjects,
        activeObjectId: resolvedActiveObjectId
    }
}

export async function addApplicationMember(api, applicationId, payload) {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/applications/${applicationId}/members`, payload)
    if (!response.ok) {
        throw await buildError(response, `Adding application member ${payload.email}`)
    }

    return response.json()
}

export async function listApplicationMembers(api, applicationId) {
    const response = await fetchFromApi(api, `/api/v1/applications/${applicationId}/members`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Listing application members for ${applicationId}`)
    }

    return response.json()
}

export async function updateApplicationMember(api, applicationId, memberId, payload) {
    const response = await sendWithCsrf(api, 'PATCH', `/api/v1/applications/${applicationId}/members/${memberId}`, payload)
    if (!response.ok) {
        throw await buildError(response, `Updating application member ${memberId}`)
    }

    return response.json()
}

export async function removeApplicationMember(api, applicationId, memberId) {
    const response = await sendWithCsrf(api, 'DELETE', `/api/v1/applications/${applicationId}/members/${memberId}`)
    if (response.ok || response.status === 404) {
        return true
    }

    throw await buildError(response, `Removing application member ${memberId}`)
}

export async function deleteApplication(api, applicationId) {
    const response = await sendWithCsrf(api, 'DELETE', `/api/v1/applications/${applicationId}`)
    if (response.ok || response.status === 404) {
        return true
    }

    throw await buildError(response, `Deleting application ${applicationId}`)
}

export async function createConnector(api, applicationId, payload) {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/applications/${applicationId}/connectors`, payload)
    if (!response.ok) {
        throw await buildError(response, `Creating connector in application ${applicationId}`)
    }

    return response.json()
}

export async function listConnectors(api, applicationId) {
    const response = await fetchFromApi(api, `/api/v1/applications/${applicationId}/connectors`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Listing connectors for application ${applicationId}`)
    }

    return response.json()
}

export async function getConnector(api, applicationId, connectorId) {
    const response = await fetchFromApi(api, `/api/v1/applications/${applicationId}/connectors/${connectorId}`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Fetching connector ${connectorId} for application ${applicationId}`)
    }

    return response.json()
}

export async function listConnectorPublicationLinks(api, applicationId, connectorId) {
    const response = await fetchFromApi(api, `/api/v1/applications/${applicationId}/connectors/${connectorId}/publications`, {
        method: 'GET'
    })
    if (!response.ok) {
        throw await buildError(response, `Listing publication links for connector ${connectorId} in application ${applicationId}`)
    }

    return response.json()
}

export async function createRuntimeRow(api, applicationId, payload) {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/applications/${applicationId}/runtime/rows`, payload)
    if (!response.ok) {
        throw await buildError(response, `Creating runtime row in application ${applicationId}`)
    }

    return response.json()
}

export async function postRuntimeRow(api, applicationId, rowId, payload = {}) {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/applications/${applicationId}/runtime/rows/${rowId}/post`, payload)
    if (!response.ok) {
        throw await buildError(response, `Posting runtime row ${rowId} in application ${applicationId}`)
    }

    return response.json()
}

export async function unpostRuntimeRow(api, applicationId, rowId, payload = {}) {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/applications/${applicationId}/runtime/rows/${rowId}/unpost`, payload)
    if (!response.ok) {
        throw await buildError(response, `Unposting runtime row ${rowId} in application ${applicationId}`)
    }

    return response.json()
}

export async function listRuntimeLedgers(api, applicationId) {
    const response = await fetchFromApi(api, `/api/v1/applications/${applicationId}/runtime/ledgers`, { method: 'GET' })
    if (!response.ok) {
        throw await buildError(response, `Listing runtime ledgers in application ${applicationId}`)
    }

    return response.json()
}

export async function listRuntimeLedgerFacts(api, applicationId, ledgerId, params = {}) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue
        }
        query.set(key, String(value))
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await fetchFromApi(api, `/api/v1/applications/${applicationId}/runtime/ledgers/${ledgerId}/facts${suffix}`, {
        method: 'GET'
    })
    if (!response.ok) {
        throw await buildError(response, `Listing runtime ledger facts for ${ledgerId} in application ${applicationId}`)
    }

    return response.json()
}

export async function deleteSupabaseAuthUser(userId) {
    loadE2eEnvironment()

    const supabaseUrl = process.env.SUPABASE_URL
    const serviceRoleKey = process.env.SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('SUPABASE_URL and SERVICE_ROLE_KEY are required for auth-user cleanup')
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`
        }
    })

    if (response.ok || response.status === 404) {
        return true
    }

    const payload = await response.text()
    throw new Error(`Deleting Supabase auth user ${userId} failed with ${response.status}: ${payload}`)
}
