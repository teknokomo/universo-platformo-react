import React from 'react'
import { useLocation } from 'react-router-dom'
import NavGroup from './NavGroup'
import dashboard from '@/menu-items/dashboard'
import unikDashboard from '@/menu-items/unikDashboard'

const MenuList = () => {
    const location = useLocation()
    const unikMatch = location.pathname.match(/^\/uniks\/([^/]+)/)

    let menuItems
    if (unikMatch) {
        const unikId = unikMatch[1]
        // Обновляем ссылки каждого пункта меню из dashboard, добавляя префикс /uniks/{unikId}
        menuItems = {
            ...dashboard,
            children: dashboard.children.map((item) => ({
                ...item,
                // Предполагаем, что в dashboard.js ссылки начинаются с '/' (например, '/chatflows')
                url: `/uniks/${unikId}${item.url}`
            }))
        }
    } else {
        menuItems = unikDashboard
    }

    return <NavGroup item={menuItems} />
}

export default MenuList
