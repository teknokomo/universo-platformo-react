import React from 'react'
import { useLocation } from 'react-router-dom'
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

    let menuItems
    if (unikMatch) {
        const unikId = unikMatch[1]
        // Universo Platformo | Update the links of each unikDashboard menu item, adding the prefix /unik/{unikId}
        menuItems = {
            ...unikDashboard,
            children: unikDashboard.children.map((item) => ({
                ...item,
                // Universo Platformo | Assume that links in unikDashboard.js start with '/' (e.g., '/chatflows')
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
    } else if (metaverseMatch) {
        const metaverseId = metaverseMatch[1]
        menuItems = {
            ...metaversesDashboard,
            children: metaversesDashboard.children.map((item) => ({
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
