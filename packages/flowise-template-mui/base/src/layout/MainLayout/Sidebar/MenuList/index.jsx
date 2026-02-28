import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '@universo/api-client'
import NavGroup from './NavGroup'
import dashboard from '../../../../menu-items/dashboard'
import unikDashboard from '@universo/uniks-frontend/menu-items/unikDashboard'
import { metaversesDashboard } from '@universo/metaverses-frontend'
import { applicationsDashboard } from '@universo/applications-frontend'
import { metahubsDashboard } from '@universo/metahubs-frontend'

const MenuList = () => {
    const location = useLocation()
    const unikMatch = location.pathname.match(/^\/unik\/([^/]+)/)
    const metaverseMatch = location.pathname.match(/^\/metaverses\/([^/]+)/)
    const metaverseId = metaverseMatch ? metaverseMatch[1] : null
    const applicationMatch = location.pathname.match(/^\/a\/([^/]+)(?:\/admin(?:\/|$)|\/|$)/)
    const applicationId = applicationMatch ? applicationMatch[1] : null
    const metahubMatch = location.pathname.match(/^\/metahub\/([^/]+)/)
    const metahubId = metahubMatch ? metahubMatch[1] : null
    const [metaversePermissions, setMetaversePermissions] = useState({})
    const [applicationPermissions, setApplicationPermissions] = useState({})
    const [metahubPermissions, setMetahubPermissions] = useState({})
    const knownMetaversePermission = metaverseId ? metaversePermissions[metaverseId] : undefined
    const knownApplicationPermission = applicationId ? applicationPermissions[applicationId] : undefined
    const knownMetahubPermission = metahubId ? metahubPermissions[metahubId] : undefined

    useEffect(() => {
        if (!metaverseId) {
            return
        }
        if (knownMetaversePermission !== undefined) {
            return
        }

        let isActive = true

        const fetchPermissions = async () => {
            try {
                // Use the raw axios client exposed as $client and ensure leading slash in path
                const response = await api.$client.get(`/metaverses/${metaverseId}`)

                if (!isActive) return

                setMetaversePermissions((prev) => ({
                    ...prev,
                    [metaverseId]: Boolean(response?.data?.permissions?.manageMembers)
                }))
            } catch (error) {
                if (!isActive) return

                console.error('Failed to load metaverse permissions', {
                    metaverseId,
                    error
                })

                setMetaversePermissions((prev) => ({
                    ...prev,
                    [metaverseId]: false
                }))
            }
        }

        fetchPermissions()

        return () => {
            isActive = false
        }
    }, [metaverseId, knownMetaversePermission])

    useEffect(() => {
        if (!applicationId) {
            return
        }
        if (knownApplicationPermission !== undefined) {
            return
        }

        let isActive = true

        const fetchPermissions = async () => {
            try {
                const response = await api.$client.get(`/applications/${applicationId}`)

                if (!isActive) return

                setApplicationPermissions((prev) => ({
                    ...prev,
                    [applicationId]: Boolean(response?.data?.permissions?.manageMembers)
                }))
            } catch (error) {
                if (!isActive) return

                console.error('Failed to load application permissions', {
                    applicationId,
                    error
                })

                setApplicationPermissions((prev) => ({
                    ...prev,
                    [applicationId]: false
                }))
            }
        }

        fetchPermissions()

        return () => {
            isActive = false
        }
    }, [applicationId, knownApplicationPermission])

    useEffect(() => {
        if (!metahubId) {
            return
        }
        if (knownMetahubPermission !== undefined) {
            return
        }

        let isActive = true

        const fetchPermissions = async () => {
            try {
                const response = await api.$client.get(`/metahub/${metahubId}`)

                if (!isActive) return

                setMetahubPermissions((prev) => ({
                    ...prev,
                    [metahubId]: Boolean(response?.data?.permissions?.manageMembers)
                }))
            } catch (error) {
                if (!isActive) return

                console.error('Failed to load metahub permissions', {
                    metahubId,
                    error
                })

                setMetahubPermissions((prev) => ({
                    ...prev,
                    [metahubId]: false
                }))
            }
        }

        fetchPermissions()

        return () => {
            isActive = false
        }
    }, [metahubId, knownMetahubPermission])

    let menuItems
    if (unikMatch) {
        const unikId = unikMatch[1]
        // Universo Platformo | Update the links of each unikDashboard menu item, adding the prefix /unik/{unikId}
        menuItems = {
            ...unikDashboard,
            children: unikDashboard.children.map((item) => ({
                ...item,
                // Universo Platformo | Assume that links in unikDashboard.js start with '/' (e.g., '/canvases')
                url: `/unik/${unikId}${item.url}`
            }))
        }
    } else if (metaverseMatch && metaverseId) {
        const filteredChildren = metaversesDashboard.children.filter((item) => {
            if (item.id !== 'access') {
                return true
            }

            if (knownMetaversePermission === undefined) {
                return true
            }

            return Boolean(knownMetaversePermission)
        })

        menuItems = {
            ...metaversesDashboard,
            children: filteredChildren.map((item) => ({
                ...item,
                url: `/metaverses/${metaverseId}${item.url}`
            }))
        }
    } else if (applicationMatch && applicationId) {
        const filteredChildren = applicationsDashboard.children.filter((item) => {
            if (item.id !== 'access') {
                return true
            }

            if (knownApplicationPermission === undefined) {
                return true
            }

            return Boolean(knownApplicationPermission)
        })

        menuItems = {
            ...applicationsDashboard,
            children: filteredChildren.map((item) => ({
                ...item,
                url: `/a/${applicationId}/admin${item.url}`
            }))
        }
    } else if (metahubMatch && metahubId) {
        const filteredChildren = metahubsDashboard.children.filter((item) => {
            if (item.id !== 'access') {
                return true
            }

            if (knownMetahubPermission === undefined) {
                return true
            }

            return Boolean(knownMetahubPermission)
        })

        menuItems = {
            ...metahubsDashboard,
            children: filteredChildren.map((item) => ({
                ...item,
                url: `/metahub/${metahubId}${item.url}`
            }))
        }
    } else {
        menuItems = dashboard
    }

    return <NavGroup item={menuItems} />
}

export default MenuList
