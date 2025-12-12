// Register i18n namespace (side-effect import must come first)
import './i18n'

// Main page exports
export { default as StorageList } from './pages/StorageList'
export { default as StorageBoard } from './pages/StorageBoard'
export { default as ContainerList } from './pages/ContainerList'
export { default as SlotList } from './pages/SlotList'
export { default as StorageMembers } from './pages/StorageMembers'

export { default as storagesDashboard } from './menu-items/storageDashboard'
export { storagesTranslations } from './i18n'
