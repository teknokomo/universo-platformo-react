import NavGroup from './NavGroup'
// Импортируем новую конфигурацию меню
import menuItem from '@/menu-items/unikDashboard'

const MenuList = () => {
    // Поскольку новый файл содержит группу, достаточно отрендерить один NavGroup
    return <NavGroup item={menuItem} />
}

export default MenuList
