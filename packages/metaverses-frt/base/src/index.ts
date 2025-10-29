// Register i18n namespace (side-effect import must come first)
import './i18n'

// Main page exports
export { default as MetaverseList } from './pages/MetaverseList'
export { default as MetaverseBoard } from './pages/MetaverseBoard'

// Removed exports (files deleted during cleanup - 2025-01-18):
// - MetaverseDetail (old implementation, will be recreated with new architecture)
// - MetaverseAccess (old access control pattern)
// - SectionDetail (old implementation, will be recreated as part of new architecture)
// - SectionsList (replaced by new pattern in MetaverseList)
// - EntityDetail (old implementation, will be recreated as part of new architecture)
// - EntityList (replaced by new pattern in MetaverseList)

export { default as metaversesDashboard } from './menu-items/metaverseDashboard'
export { metaversesTranslations } from './i18n'
