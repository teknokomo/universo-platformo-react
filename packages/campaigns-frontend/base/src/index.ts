// Register i18n namespace (side-effect import must come first)
import './i18n'

// Main page exports
export { default as CampaignList } from './pages/CampaignList'
export { default as CampaignBoard } from './pages/CampaignBoard'
export { default as EventList } from './pages/EventList'
export { default as ActivityList } from './pages/ActivityList'
export { default as CampaignMembers } from './pages/CampaignMembers'

export { default as campaignsDashboard } from './menu-items/campaignDashboard'
export { campaignsTranslations } from './i18n'
