// Register i18n namespace (side-effect import must come first)
import './i18n'

// Main page exports
export { default as CampaignList } from './pages/CampaignList'
export { default as CampaignBoard } from './pages/CampaignBoard'
export { default as EventList } from './pages/EventList'
export { default as ActivityList } from './pages/ActivityList'
export { default as CampaignMembers } from './pages/CampaignMembers'

// Removed exports (files deleted during cleanup - 2025-01-18):
// - CampaignDetail (old implementation, will be recreated with new architecture)
// - CampaignAccess (old access control pattern)
// - EventDetail (old implementation, will be recreated as part of new architecture)
// - EventsList (replaced by old ActivityList pattern, recreated as EventList)
// - ActivityDetail (old implementation, will be recreated as part of new architecture)
// - Old ActivityList (replaced by new CampaignList pattern, recreated with new architecture)

export { default as campaignsDashboard } from './menu-items/campaignDashboard'
export { campaignsTranslations } from './i18n'
