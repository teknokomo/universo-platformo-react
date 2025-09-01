import { IconInfoCircle, IconUsers, IconFolder } from '@tabler/icons-react'

const icons = { IconInfoCircle, IconUsers, IconFolder }

const entitiesDashboard = {
  id: 'entities-dashboard',
  title: '',
  type: 'group',
  children: [
    {
      id: 'entity-info',
      title: 'entities.detail.info',
      type: 'item',
      url: '',
      icon: icons.IconInfoCircle,
      breadcrumbs: false
    },
    {
      id: 'entity-owners',
      title: 'entities.detail.owners',
      type: 'item',
      url: '/owners',
      icon: icons.IconUsers,
      breadcrumbs: true
    },
    {
      id: 'entity-resources',
      title: 'entities.detail.resources',
      type: 'item',
      url: '/resources',
      icon: icons.IconFolder,
      breadcrumbs: true
    }
  ]
}

export default entitiesDashboard
