/**
 * @flowise/leads-backend
 *
 * Backend package for Leads domain in Universo Platformo.
 * Extracted from flowise-server for better modularity.
 *
 * @packageDocumentation
 */

// Database - Entities
export { Lead } from './database/entities'

// Database - Migrations
export { leadsMigrations, AddLead1710832137905 } from './database/migrations/postgres'

// Interface
export type { ILead, CreateLeadPayload, CreateLeadBody, LeadsAnalytics } from './Interface'

// Services
export { createLeadsService, LeadsServiceError, createLeadSchema, type ILeadsService, type LeadsServiceConfig } from './services'

// Routes
export { createLeadsRouter, leadsErrorHandler, LeadsControllerError } from './routes'
