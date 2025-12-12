// Register i18n namespace (side-effect import must come first)
import './i18n'

// Main page exports
export { default as ClusterList } from './pages/ClusterList'
export { default as ClusterBoard } from './pages/ClusterBoard'
export { default as DomainList } from './pages/DomainList'
export { default as ResourceList } from './pages/ResourceList'
export { default as ClusterMembers } from './pages/ClusterMembers'

export { default as clustersDashboard } from './menu-items/clusterDashboard'
export { clustersTranslations } from './i18n'
