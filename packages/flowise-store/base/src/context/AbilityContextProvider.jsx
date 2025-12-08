/**
 * CASL Ability Context Provider
 *
 * Loads user permissions from API and provides CASL ability to all children.
 * Integrates with @casl/react for declarative permission checks.
 *
 * Usage:
 * ```jsx
 * import { AbilityContextProvider } from '@flowise/store'
 *
 * <AbilityContextProvider>
 *   <App />
 * </AbilityContextProvider>
 * ```
 *
 * Then in components:
 * ```jsx
 * import { Can } from '@casl/react'
 * import { useAbility } from '@flowise/store'
 *
 * // Declarative (recommended)
 * <Can I="delete" a="Metaverse">
 *   <DeleteButton />
 * </Can>
 *
 * // Imperative
 * const ability = useAbility()
 * if (ability.can('delete', 'Metaverse')) { ... }
 * ```
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import PropTypes from 'prop-types'
import { createMongoAbility } from '@casl/ability'
import AbilityContext from './AbilityContext'

// Module to CASL subject mapping (must match backend)
const MODULE_TO_SUBJECT = {
    metaverses: 'Metaverse',
    clusters: 'Cluster',
    projects: 'Project',
    spaces: 'Space',
    sections: 'Section',
    organizations: 'Organization',
    storages: 'Storage',
    credentials: 'Credential',
    chatflows: 'Chatflow',
    tools: 'Tool',
    assistants: 'Assistant',
    users: 'User',
    roles: 'Role',
    instances: 'Instance'
}

// Action mapping
const ACTION_MAP = {
    create: 'create',
    read: 'read',
    update: 'update',
    delete: 'delete',
    '*': 'manage'
}

/**
 * Creates empty ability (no permissions)
 */
const createEmptyAbility = () => createMongoAbility([])

/**
 * Builds CASL ability from database permissions
 */
const buildAbilityFromPermissions = (permissions) => {
    if (!permissions || permissions.length === 0) {
        return createEmptyAbility()
    }

    const rules = []

    for (const perm of permissions) {
        // Map module to subject ('metaverses' -> 'Metaverse', '*' -> 'all')
        const subject = perm.module === '*' ? 'all' : (MODULE_TO_SUBJECT[perm.module] || perm.module)

        // Map action ('*' -> 'manage')
        const action = ACTION_MAP[perm.action] || perm.action

        // Build rule
        const rule = { action, subject }

        // Add conditions if present
        if (perm.conditions && Object.keys(perm.conditions).length > 0) {
            rule.conditions = perm.conditions
        }

        // Add fields if present
        if (perm.fields && perm.fields.length > 0) {
            rule.fields = perm.fields
        }

        rules.push(rule)
    }

    return createMongoAbility(rules)
}

/**
 * Fetches permissions from API (new format with metadata and config)
 * @returns {Promise<{permissions: Array, globalRoles: Array, hasGlobalAccess: boolean, rolesMetadata: Object, config: Object}>}
 */
const fetchPermissions = async () => {
    try {
        const response = await fetch('/api/v1/auth/permissions', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        })

        if (!response.ok) {
            if (response.status === 401) {
                // Not authenticated - return empty permissions with default config
                return {
                    permissions: [],
                    globalRoles: [],
                    hasGlobalAccess: false,
                    rolesMetadata: {},
                    config: { adminPanelEnabled: true, globalAdminEnabled: true }
                }
            }
            throw new Error(`Failed to fetch permissions: ${response.status}`)
        }

        const data = await response.json()
        // Support both old format (just permissions array) and new format (full object)
        if (Array.isArray(data.permissions) && !data.globalRoles) {
            // Old format - convert to new format
            return {
                permissions: data.permissions,
                globalRoles: [],
                hasGlobalAccess: false,
                rolesMetadata: {},
                config: { adminPanelEnabled: true, globalAdminEnabled: true }
            }
        }
        return {
            permissions: data.permissions || [],
            globalRoles: data.globalRoles || [],
            hasGlobalAccess: data.hasGlobalAccess ?? false,
            rolesMetadata: data.rolesMetadata || {},
            config: data.config || { adminPanelEnabled: true, globalAdminEnabled: true }
        }
    } catch (error) {
        console.error('[AbilityProvider] Failed to load permissions:', error)
        return {
            permissions: [],
            globalRoles: [],
            hasGlobalAccess: false,
            rolesMetadata: {},
            config: { adminPanelEnabled: true, globalAdminEnabled: true }
        }
    }
}

const AbilityContextProvider = ({ children }) => {
    const [ability, setAbility] = useState(() => createEmptyAbility())
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    // New state for global roles and metadata
    const [globalRoles, setGlobalRoles] = useState([])
    const [hasGlobalAccess, setHasGlobalAccess] = useState(false)
    const [rolesMetadata, setRolesMetadata] = useState({})
    // Admin feature flags configuration
    const [adminConfig, setAdminConfig] = useState({ adminPanelEnabled: true, globalAdminEnabled: true })

    // Load permissions on mount
    useEffect(() => {
        let mounted = true

        const loadPermissions = async () => {
            setLoading(true)
            setError(null)

            try {
                const data = await fetchPermissions()

                if (mounted) {
                    const newAbility = buildAbilityFromPermissions(data.permissions)
                    setAbility(newAbility)
                    setGlobalRoles(data.globalRoles)
                    setHasGlobalAccess(data.hasGlobalAccess)
                    setRolesMetadata(data.rolesMetadata)
                    setAdminConfig(data.config)
                    console.log('[AbilityProvider] Permissions loaded', {
                        rulesCount: newAbility.rules.length,
                        globalRolesCount: data.globalRoles.length,
                        hasGlobalAccess: data.hasGlobalAccess,
                        adminConfig: data.config
                    })
                }
            } catch (err) {
                if (mounted) {
                    setError(err)
                    console.error('[AbilityProvider] Error:', err)
                }
            } finally {
                if (mounted) {
                    setLoading(false)
                }
            }
        }

        loadPermissions()

        return () => {
            mounted = false
        }
    }, [])

    // Refresh function (can be called after login/logout)
    const refreshAbility = useCallback(async () => {
        setLoading(true)
        const data = await fetchPermissions()
        const newAbility = buildAbilityFromPermissions(data.permissions)
        setAbility(newAbility)
        setGlobalRoles(data.globalRoles)
        setHasGlobalAccess(data.hasGlobalAccess)
        setRolesMetadata(data.rolesMetadata)
        setAdminConfig(data.config)
        setLoading(false)
        return newAbility
    }, [])

    // Clear ability (for logout)
    const clearAbility = useCallback(() => {
        setAbility(createEmptyAbility())
        setGlobalRoles([])
        setHasGlobalAccess(false)
        setRolesMetadata({})
        setAdminConfig({ adminPanelEnabled: true, globalAdminEnabled: true })
    }, [])

    // Context value with new fields
    const value = useMemo(
        () => ({
            ability,
            loading,
            error,
            refreshAbility,
            clearAbility,
            // New fields for global roles
            globalRoles,
            hasGlobalAccess,
            rolesMetadata,
            // Admin feature flags
            adminConfig
        }),
        [ability, loading, error, refreshAbility, clearAbility, globalRoles, hasGlobalAccess, rolesMetadata, adminConfig]
    )

    return <AbilityContext.Provider value={value}>{children}</AbilityContext.Provider>
}

AbilityContextProvider.propTypes = {
    children: PropTypes.any
}

export default AbilityContextProvider
