// Register i18n namespace (side-effect import must come first)
import './i18n'

// Main page exports
export { default as ProjectList } from './pages/ProjectList'
export { default as ProjectBoard } from './pages/ProjectBoard'
export { default as MilestoneList } from './pages/MilestoneList'
export { default as TaskList } from './pages/TaskList'
export { default as ProjectMembers } from './pages/ProjectMembers'

export { default as projectsDashboard } from './menu-items/projectDashboard'
export { projectsTranslations } from './i18n'
