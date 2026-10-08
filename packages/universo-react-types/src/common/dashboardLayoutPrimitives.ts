export const DASHBOARD_VIEW_MODES = ['table', 'card'] as const
export type DashboardViewMode = (typeof DASHBOARD_VIEW_MODES)[number]
