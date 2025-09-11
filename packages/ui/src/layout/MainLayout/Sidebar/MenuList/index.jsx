import React from 'react'
import { useLocation } from 'react-router-dom'
import NavGroup from './NavGroup'
import dashboard from '@/menu-items/dashboard'
import unikDashboard from '@apps/uniks-frt/base/src/menu-items/unikDashboard'
import { clustersDashboard } from '@universo/resources-frt'
import { entitiesDashboard } from '@universo/entities-frt'

const MenuList = () => {
    const location = useLocation()
    const unikMatch = location.pathname.match(/^\/uniks\/([^/]+)/)
    const clusterMatch = location.pathname.match(/^\/clusters\/([^/]+)/)
    const entityMatch = location.pathname.match(/^\/entities\/([^/]+)/)

    let menuItems
    if (unikMatch) {
        const unikId = unikMatch[1]
        // Universo Platformo | Update the links of each unikDashboard menu item, adding the prefix /uniks/{unikId}
        menuItems = {
            ...unikDashboard,
            children: unikDashboard.children.map((item) => ({
                ...item,
                // Universo Platformo | Assume that links in unikDashboard.js start with '/' (e.g., '/chatflows')
                url: `/uniks/${unikId}${item.url}`
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
    } else if (entityMatch) {
        const entityId = entityMatch[1]
        menuItems = {
            ...entitiesDashboard,
            children: entitiesDashboard.children.map((item) => ({
                ...item,
                url: `/entities/${entityId}${item.url}`
            }))
        }
    } else {
        menuItems = dashboard
    }

    return <NavGroup item={menuItems} />
}

export default MenuList
