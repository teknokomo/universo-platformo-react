import React from 'react'
import { useLocation } from 'react-router-dom'
import NavGroup from './NavGroup'
import dashboard from '@/menu-items/dashboard'
import unikDashboard from '@apps/uniks-frt/base/src/menu-items/unikDashboard'
import resourcesDashboard from '@apps/resources-frt/base/src/menu-items/resourcesDashboard'

const MenuList = () => {
    const location = useLocation()
    const unikMatch = location.pathname.match(/^\/uniks\/([^/]+)/)
    const resourceMatch = location.pathname.match(/^\/resources\/([^/]+)/)

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
    } else if (resourceMatch) {
        const resourceId = resourceMatch[1]
        menuItems = {
            ...resourcesDashboard,
            children: resourcesDashboard.children.map((item) => ({
                ...item,
                url: `/resources/${resourceId}${item.url}`
            }))
        }
    } else {
        menuItems = dashboard
    }

    return <NavGroup item={menuItems} />
}

export default MenuList
