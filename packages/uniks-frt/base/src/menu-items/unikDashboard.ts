// assets
import {
  IconUsersGroup,
  IconHierarchy,
  IconBuildingStore,
  IconKey,
  IconTool,
  IconLock,
  IconRobot,
  IconVariable,
  IconFiles,
  IconChartBar
} from '@tabler/icons-react'
import type { Icon } from '@tabler/icons-react'

// constant
const icons: Record<string, Icon> = {
  IconUsersGroup,
  IconHierarchy,
  IconBuildingStore,
  IconKey,
  IconTool,
  IconLock,
  IconRobot,
  IconVariable,
  IconFiles,
  IconChartBar
}

interface MenuItem {
  id: string
  title: string
  type: 'item' | 'group'
  url?: string
  icon?: Icon
  breadcrumbs?: boolean
  children?: MenuItem[]
}

// ==============================|| UNIK DASHBOARD MENU ITEMS ||============================== //

const unikDashboard: MenuItem = {
  id: 'dashboard',
  title: '',
  type: 'group',
  children: [
    {
      id: 'unik-dashboard',
      title: 'menu.dashboard',
      type: 'item',
      // Relative URL for the main page of the Unik – will be /uniks/{unikId}
      url: '',
      icon: icons.IconBuildingStore,
      breadcrumbs: false
    },
    {
      id: 'spaces',
      title: 'menu.spaces',
      type: 'item',
      url: '/spaces',
      icon: icons.IconHierarchy,
      breadcrumbs: true
    },
    {
      id: 'agentflows',
      title: 'menu.agentflows',
      type: 'item',
      url: '/agentflows',
      icon: icons.IconUsersGroup,
      breadcrumbs: true
    },
    {
      id: 'assistants',
      title: 'menu.assistants',
      type: 'item',
      url: '/assistants',
      icon: icons.IconRobot,
      breadcrumbs: true
    },
    {
      id: 'tools',
      title: 'menu.tools',
      type: 'item',
      url: '/tools',
      icon: icons.IconTool,
      breadcrumbs: true
    },
    {
      id: 'credentials',
      title: 'menu.credentials',
      type: 'item',
      url: '/credentials',
      icon: icons.IconLock,
      breadcrumbs: true
    },
    {
      id: 'variables',
      title: 'menu.variables',
      type: 'item',
      url: '/variables',
      icon: icons.IconVariable,
      breadcrumbs: true
    },
    {
      id: 'apikey',
      title: 'menu.apiKeys',
      type: 'item',
      url: '/apikey',
      icon: icons.IconKey,
      breadcrumbs: true
    },
    {
      id: 'document-stores',
      title: 'menu.documentStores',
      type: 'item',
      url: '/document-stores',
      icon: icons.IconFiles,
      breadcrumbs: true
    },
    {
      id: 'analytics',
      title: 'menu.analytics',
      type: 'item',
      url: '/analytics',
      icon: icons.IconChartBar,
      breadcrumbs: true
    },
    {
      id: 'templates',
      title: 'menu.templates',
      type: 'item',
      url: '/templates',
      icon: icons.IconBuildingStore,
      breadcrumbs: true
    }
  ]
}

export default unikDashboard
