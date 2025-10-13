import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import client from '@/api/client'
import NavGroup from './NavGroup'
import dashboard from '@/menu-items/dashboard'
import unikDashboard from '@apps/uniks-frt/base/src/menu-items/unikDashboard'
import { clustersDashboard } from '@universo/resources-frt'
import { metaversesDashboard } from '@universo/metaverses-frt'

const MenuList = () => {
    const location = useLocation()
    const unikMatch = location.pathname.match(/^\/unik\/([^/]+)/)
    const clusterMatch = location.pathname.match(/^\/clusters\/([^/]+)/)
    const metaverseMatch = location.pathname.match(/^\/metaverses\/([^/]+)/)
    const metaverseId = metaverseMatch ? metaverseMatch[1] : null
    const [metaversePermissions, setMetaversePermissions] = useState({})
    const knownMetaversePermission = metaverseId ? metaversePermissions[metaverseId] : undefined

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
                const response = await client.get(`metaverses/${metaverseId}`)

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
    } else if (clusterMatch) {
        const clusterId = clusterMatch[1]
        menuItems = {
            ...clustersDashboard,
            children: clustersDashboard.children.map((item) => ({
                ...item,
                url: `/clusters/${clusterId}${item.url}`
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
    } else {
        menuItems = dashboard
    }

    return <NavGroup item={menuItems} />
}

export default MenuList
