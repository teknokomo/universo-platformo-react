// Database - Entities
export { Credential } from './database/entities'

// Database - Migrations
export { credentialsMigrations } from './database/migrations/postgres'

// Services
export {
    createCredentialsService,
    CredentialsServiceError,
    createCredentialSchema,
    updateCredentialSchema,
    type ICredentialsService,
    type CredentialsServiceConfig,
    type IComponentCredentials,
    type CreateCredentialBody,
    type UpdateCredentialBody,
    type CredentialWithPlainData
} from './services'

// Routes
export {
    createCredentialsRouter,
    credentialsErrorHandler,
    CredentialsControllerError
} from './routes'
