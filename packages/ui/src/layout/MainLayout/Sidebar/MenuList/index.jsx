import React from 'react'
import { useLocation } from 'react-router-dom'
import NavGroup from './NavGroup'
import dashboard from '@/menu-items/dashboard'
import unikDashboard from '@apps/uniks-frt/base/src/menu-items/unikDashboard'

const MenuList = () => {
    const location = useLocation()
    const unikMatch = location.pathname.match(/^\/uniks\/([^/]+)/)

    let menuItems
    if (unikMatch) {
        const unikId = unikMatch[1]
        // Universo Platformo | Update the links of each dashboard menu item, adding the prefix /uniks/{unikId}
        menuItems = {
            ...dashboard,
            children: dashboard.children.map((item) => ({
                ...item,
                // Universo Platformo | Assume that links in dashboard.js start with '/' (e.g., '/chatflows')
                url: `/uniks/${unikId}${item.url}`
            }))
        }
    } else {
        menuItems = unikDashboard
    }

    return <NavGroup item={menuItems} />
}

export default MenuList
