import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '@universo/api-client'
import NavGroup from './NavGroup'
import dashboard from '../../../../menu-items/dashboard'
import unikDashboard from '@universo/uniks-frontend/menu-items/unikDashboard'
import { metaversesDashboard } from '@universo/metaverses-frontend'
import { applicationsDashboard } from '@universo/applications-frontend'
import { metahubsDashboard } from '@universo/metahubs-frontend'
import { clustersDashboard } from '@universo/clusters-frontend'
import { campaignsDashboard } from '@universo/campaigns-frontend'

const MenuList = () => {
    const location = useLocation()
    const unikMatch = location.pathname.match(/^\/unik\/([^/]+)/)
    const metaverseMatch = location.pathname.match(/^\/metaverses\/([^/]+)/)
    const metaverseId = metaverseMatch ? metaverseMatch[1] : null
    const applicationMatch = location.pathname.match(/^\/applications?\/([^/]+)/)
    const applicationId = applicationMatch ? applicationMatch[1] : null
    const metahubMatch = location.pathname.match(/^\/metahub\/([^/]+)/)
    const metahubId = metahubMatch ? metahubMatch[1] : null
    const clusterMatch = location.pathname.match(/^\/clusters?\/([^/]+)/)
    const clusterId = clusterMatch ? clusterMatch[1] : null
    const campaignMatch = location.pathname.match(/^\/campaigns?\/([^/]+)/)
    const campaignId = campaignMatch ? campaignMatch[1] : null
    const [metaversePermissions, setMetaversePermissions] = useState({})
    const [applicationPermissions, setApplicationPermissions] = useState({})
    const [metahubPermissions, setMetahubPermissions] = useState({})
    const [clusterPermissions, setClusterPermissions] = useState({})
    const [campaignPermissions, setCampaignPermissions] = useState({})
    const knownMetaversePermission = metaverseId ? metaversePermissions[metaverseId] : undefined
    const knownApplicationPermission = applicationId ? applicationPermissions[applicationId] : undefined
    const knownMetahubPermission = metahubId ? metahubPermissions[metahubId] : undefined
    const knownClusterPermission = clusterId ? clusterPermissions[clusterId] : undefined
    const knownCampaignPermission = campaignId ? campaignPermissions[campaignId] : undefined

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

    useEffect(() => {
        if (!clusterId) {
            return
        }
        if (knownClusterPermission !== undefined) {
            return
        }

        let isActive = true

        const fetchPermissions = async () => {
            try {
                const response = await api.$client.get(`/clusters/${clusterId}`)

                if (!isActive) return

                setClusterPermissions((prev) => ({
                    ...prev,
                    [clusterId]: Boolean(response?.data?.permissions?.manageMembers)
                }))
            } catch (error) {
                if (!isActive) return

                console.error('Failed to load cluster permissions', {
                    clusterId,
                    error
                })

                setClusterPermissions((prev) => ({
                    ...prev,
                    [clusterId]: false
                }))
            }
        }

        fetchPermissions()

        return () => {
            isActive = false
        }
    }, [clusterId, knownClusterPermission])

    useEffect(() => {
        if (!campaignId) {
            return
        }
        if (knownCampaignPermission !== undefined) {
            return
        }

        let isActive = true

        const fetchPermissions = async () => {
            try {
                const response = await api.$client.get(`/campaigns/${campaignId}`)

                if (!isActive) return

                setCampaignPermissions((prev) => ({
                    ...prev,
                    [campaignId]: Boolean(response?.data?.permissions?.manageMembers)
                }))
            } catch (error) {
                if (!isActive) return

                console.error('Failed to load campaign permissions', {
                    campaignId,
                    error
                })

                setCampaignPermissions((prev) => ({
                    ...prev,
                    [campaignId]: false
                }))
            }
        }

        fetchPermissions()

        return () => {
            isActive = false
        }
    }, [campaignId, knownCampaignPermission])

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
                url: `/application/${applicationId}${item.url}`
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
    } else if (clusterMatch && clusterId) {
        const filteredChildren = clustersDashboard.children.filter((item) => {
            if (item.id !== 'access') {
                return true
            }

            if (knownClusterPermission === undefined) {
                return true
            }

            return Boolean(knownClusterPermission)
        })

        menuItems = {
            ...clustersDashboard,
            children: filteredChildren.map((item) => {
                // clusterboard (empty url) and access use singular /cluster/:id
                // resources and domains use plural /clusters/:id/...
                const useSingular = item.id === 'clusterboard' || item.id === 'access'
                const prefix = useSingular ? `/cluster/${clusterId}` : `/clusters/${clusterId}`
                return {
                    ...item,
                    url: `${prefix}${item.url}`
                }
            })
        }
    } else if (campaignMatch && campaignId) {
        const filteredChildren = campaignsDashboard.children.filter((item) => {
            if (item.id !== 'access') {
                return true
            }

            if (knownCampaignPermission === undefined) {
                return true
            }

            return Boolean(knownCampaignPermission)
        })

        menuItems = {
            ...campaignsDashboard,
            children: filteredChildren.map((item) => {
                // campaignboard (empty url) and access use singular /campaign/:id
                // events and activities use plural /campaigns/:id/...
                const useSingular = item.id === 'campaignboard' || item.id === 'access'
                const prefix = useSingular ? `/campaign/${campaignId}` : `/campaigns/${campaignId}`
                return {
                    ...item,
                    url: `${prefix}${item.url}`
                }
            })
        }
    } else {
        menuItems = dashboard
    }

    return <NavGroup item={menuItems} />
}

export default MenuList
