// Register i18n namespace (side-effect import must come first)
import './i18n'

// Main page exports
export { default as StorageList } from './pages/StorageList'
export { default as StorageBoard } from './pages/StorageBoard'
export { default as ContainerList } from './pages/ContainerList'
export { default as SlotList } from './pages/SlotList'
export { default as StorageMembers } from './pages/StorageMembers'

// Removed exports (files deleted during cleanup - 2025-01-18):
// - StorageDetail (old implementation, will be recreated with new architecture)
// - StorageAccess (old access control pattern)
// - ContainerDetail (old implementation, will be recreated as part of new architecture)
// - ContainersList (replaced by old SlotList pattern, recreated as ContainerList)
// - SlotDetail (old implementation, will be recreated as part of new architecture)
// - Old SlotList (replaced by new StorageList pattern, recreated with new architecture)

export { default as storagesDashboard } from './menu-items/storageDashboard'
export { storagesTranslations } from './i18n'
