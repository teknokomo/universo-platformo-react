// Register i18n namespace (side-effect import must come first)
import './i18n'

// Main page exports
export { default as ProjectList } from './pages/ProjectList'
export { default as ProjectBoard } from './pages/ProjectBoard'
export { default as MilestoneList } from './pages/MilestoneList'
export { default as TaskList } from './pages/TaskList'
export { default as ProjectMembers } from './pages/ProjectMembers'

// Removed exports (files deleted during cleanup - 2025-01-18):
// - ProjectDetail (old implementation, will be recreated with new architecture)
// - ProjectAccess (old access control pattern)
// - MilestoneDetail (old implementation, will be recreated as part of new architecture)
// - MilestonesList (replaced by old TaskList pattern, recreated as MilestoneList)
// - TaskDetail (old implementation, will be recreated as part of new architecture)
// - Old TaskList (replaced by new ProjectList pattern, recreated with new architecture)

export { default as ProjectsDashboard } from './menu-items/ProjectDashboard'
export { ProjectsTranslations } from './i18n'
