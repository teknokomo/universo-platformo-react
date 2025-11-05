// Register i18n namespace (side-effect import must come first)
import './i18n'

// Main page exports
export { default as MetaverseList } from './pages/MetaverseList'
export { default as MetaverseBoard } from './pages/MetaverseBoard'
export { default as SectionList } from './pages/SectionList'
export { default as EntityList } from './pages/EntityList'
export { default as MetaverseMembers } from './pages/MetaverseMembers'

// Removed exports (files deleted during cleanup - 2025-01-18):
// - MetaverseDetail (old implementation, will be recreated with new architecture)
// - MetaverseAccess (old access control pattern)
// - SectionDetail (old implementation, will be recreated as part of new architecture)
// - SectionsList (replaced by old EntityList pattern, recreated as SectionList)
// - EntityDetail (old implementation, will be recreated as part of new architecture)
// - Old EntityList (replaced by new MetaverseList pattern, recreated with new architecture)

export { default as metaversesDashboard } from './menu-items/metaverseDashboard'
export { metaversesTranslations } from './i18n'
