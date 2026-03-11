export { createPlatformMigrationFromSqlDefinition } from './sqlAdapter'
export {
	diffRegisteredPlatformDefinitions,
	exportCatalogPlatformDefinitions,
	exportRegisteredPlatformDefinitions,
	planRegisteredPlatformMigrations,
	platformMigrations,
	runRegisteredPlatformMigrations,
	validateRegisteredPlatformMigrations
} from './platformMigrations'
export type { RegisteredPlatformDefinitionDiffEntry } from './platformMigrations'
