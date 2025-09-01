import { IconFolder } from '@tabler/icons-react'

const icons = { IconFolder }

const resourcesDashboard = {
  id: 'resources-dashboard',
  title: '',
  type: 'group',
  children: [
    {
      id: 'resources',
      title: 'resources.title',
      type: 'item',
      url: '',
      icon: icons.IconFolder,
      breadcrumbs: false
    }
  ]
}

export default resourcesDashboard
