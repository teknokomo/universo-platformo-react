/**
 * @flowise/leads-frt
 *
 * Frontend module for Leads management in Universo Platformo.
 *
 * This is a minimal package that provides namespace exports.
 * The actual UI components (ViewLeadsDialog, Leads) remain in
 * @flowise/template-mui for now and will be migrated in future iterations.
 *
 * @packageDocumentation
 */

/**
 * Package namespace for leads functionality.
 * Components are currently in @flowise/template-mui:
 * - ViewLeadsDialog: Dialog for viewing all leads for a canvas
 * - Leads: Configuration component for lead capture settings
 *
 * i18n namespaces (in @universo/i18n):
 * - viewLeads: Dialog translations
 * - canvas:configuration.leads: Configuration translations
 */
export const LEADS_NAMESPACE = 'leads'

/**
 * Re-export types from API client for convenience
 */
export type { ILead, CreateLeadBody } from '@flowise/leads-srv'
