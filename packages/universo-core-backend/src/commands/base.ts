import { Command, Flags } from '@oclif/core'
import logger from '../utils/logger'
import { loadBackendEnv } from '../utils/env'

loadBackendEnv()

enum EXIT_CODE {
    SUCCESS = 0,
    FAILED = 1
}

export abstract class BaseCommand extends Command {
    static flags = {
        FILE_SIZE_LIMIT: Flags.string(),
        PORT: Flags.string(),
        SESSION_SECRET: Flags.string(),
        SUPABASE_URL: Flags.string(),
        SUPABASE_PUBLISHABLE_DEFAULT_KEY: Flags.string(),
        SUPABASE_ANON_KEY: Flags.string(),
        SERVICE_ROLE_KEY: Flags.string(),
        SUPABASE_JWT_SECRET: Flags.string(),
        SUPABASE_JWKS_URL: Flags.string(),
        SUPABASE_JWT_ISSUER: Flags.string(),
        SUPABASE_JWT_AUDIENCE: Flags.string(),
        BOOTSTRAP_SUPERUSER_ENABLED: Flags.string(),
        BOOTSTRAP_SUPERUSER_EMAIL: Flags.string(),
        BOOTSTRAP_SUPERUSER_PASSWORD: Flags.string(),
        SESSION_COOKIE_NAME: Flags.string(),
        SESSION_COOKIE_MAXAGE: Flags.string(),
        SESSION_COOKIE_SAMESITE: Flags.string(),
        SESSION_COOKIE_SECURE: Flags.string(),
        CORS_ORIGINS: Flags.string(),
        IFRAME_ORIGINS: Flags.string(),
        LOG_PATH: Flags.string(),
        LOG_LEVEL: Flags.string(),
        NUMBER_OF_PROXIES: Flags.string(),
        DATABASE_PORT: Flags.string(),
        DATABASE_HOST: Flags.string(),
        DATABASE_NAME: Flags.string(),
        DATABASE_USER: Flags.string(),
        DATABASE_PASSWORD: Flags.string(),
        DATABASE_SSL: Flags.string(),
        DATABASE_SSL_KEY_BASE64: Flags.string(),
        STORAGE_TYPE: Flags.string(),
        S3_STORAGE_BUCKET_NAME: Flags.string(),
        S3_STORAGE_ACCESS_KEY_ID: Flags.string(),
        S3_STORAGE_SECRET_ACCESS_KEY: Flags.string(),
        S3_STORAGE_REGION: Flags.string(),
        S3_ENDPOINT_URL: Flags.string(),
        S3_FORCE_PATH_STYLE: Flags.string(),
        GOOGLE_CLOUD_STORAGE_CREDENTIAL: Flags.string(),
        GOOGLE_CLOUD_STORAGE_PROJ_ID: Flags.string(),
        REDIS_URL: Flags.string(),
        UPL_GLOBAL_MIGRATION_CATALOG_ENABLED: Flags.string()
    }

    protected async stopProcess() {
        // Overridden method by child class
    }

    protected onTerminate() {
        return async () => {
            try {
                // Shut down the app after timeout if it ever stuck removing pools
                setTimeout(async () => {
                    logger.info('Server was forced to shut down after 30 secs')
                    await this.failExit()
                }, 30000)

                await this.stopProcess()
            } catch (error) {
                logger.error('There was an error shutting down the server...', error)
            }
        }
    }

    protected async gracefullyExit() {
        process.exit(EXIT_CODE.SUCCESS)
    }

    protected async failExit() {
        process.exit(EXIT_CODE.FAILED)
    }

    async init(): Promise<void> {
        await super.init()

        process.on('SIGTERM', this.onTerminate())
        process.on('SIGINT', this.onTerminate())

        // Prevent throw new Error from crashing the app
        // TODO: Get rid of this and send proper error message to ui
        process.on('uncaughtException', (err) => {
            logger.error('uncaughtException: ', err)
        })

        process.on('unhandledRejection', (err) => {
            logger.error('unhandledRejection: ', err)
        })

        const { flags } = await this.parse(BaseCommand)

        if (flags.PORT) process.env.PORT = flags.PORT
        if (flags.CORS_ORIGINS) process.env.CORS_ORIGINS = flags.CORS_ORIGINS
        if (flags.IFRAME_ORIGINS) process.env.IFRAME_ORIGINS = flags.IFRAME_ORIGINS
        if (flags.NUMBER_OF_PROXIES) process.env.NUMBER_OF_PROXIES = flags.NUMBER_OF_PROXIES

        // Session configuration
        if (flags.SESSION_SECRET) process.env.SESSION_SECRET = flags.SESSION_SECRET
        if (flags.SUPABASE_URL) process.env.SUPABASE_URL = flags.SUPABASE_URL
        if (flags.SUPABASE_PUBLISHABLE_DEFAULT_KEY) process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY = flags.SUPABASE_PUBLISHABLE_DEFAULT_KEY
        if (flags.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = flags.SUPABASE_ANON_KEY
        if (flags.SERVICE_ROLE_KEY) process.env.SERVICE_ROLE_KEY = flags.SERVICE_ROLE_KEY
        if (flags.SUPABASE_JWT_SECRET) process.env.SUPABASE_JWT_SECRET = flags.SUPABASE_JWT_SECRET
        if (flags.SUPABASE_JWKS_URL) process.env.SUPABASE_JWKS_URL = flags.SUPABASE_JWKS_URL
        if (flags.SUPABASE_JWT_ISSUER) process.env.SUPABASE_JWT_ISSUER = flags.SUPABASE_JWT_ISSUER
        if (flags.SUPABASE_JWT_AUDIENCE) process.env.SUPABASE_JWT_AUDIENCE = flags.SUPABASE_JWT_AUDIENCE
        if (flags.BOOTSTRAP_SUPERUSER_ENABLED) process.env.BOOTSTRAP_SUPERUSER_ENABLED = flags.BOOTSTRAP_SUPERUSER_ENABLED
        if (flags.BOOTSTRAP_SUPERUSER_EMAIL) process.env.BOOTSTRAP_SUPERUSER_EMAIL = flags.BOOTSTRAP_SUPERUSER_EMAIL
        if (flags.BOOTSTRAP_SUPERUSER_PASSWORD) process.env.BOOTSTRAP_SUPERUSER_PASSWORD = flags.BOOTSTRAP_SUPERUSER_PASSWORD
        if (flags.SESSION_COOKIE_NAME) process.env.SESSION_COOKIE_NAME = flags.SESSION_COOKIE_NAME
        if (flags.SESSION_COOKIE_MAXAGE) process.env.SESSION_COOKIE_MAXAGE = flags.SESSION_COOKIE_MAXAGE
        if (flags.SESSION_COOKIE_SAMESITE) process.env.SESSION_COOKIE_SAMESITE = flags.SESSION_COOKIE_SAMESITE
        if (flags.SESSION_COOKIE_SECURE) process.env.SESSION_COOKIE_SECURE = flags.SESSION_COOKIE_SECURE

        // API configuration
        if (flags.FILE_SIZE_LIMIT) process.env.FILE_SIZE_LIMIT = flags.FILE_SIZE_LIMIT

        // Logs
        if (flags.LOG_PATH) process.env.LOG_PATH = flags.LOG_PATH
        if (flags.LOG_LEVEL) process.env.LOG_LEVEL = flags.LOG_LEVEL

        // Database config
        if (flags.DATABASE_PORT) process.env.DATABASE_PORT = flags.DATABASE_PORT
        if (flags.DATABASE_HOST) process.env.DATABASE_HOST = flags.DATABASE_HOST
        if (flags.DATABASE_NAME) process.env.DATABASE_NAME = flags.DATABASE_NAME
        if (flags.DATABASE_USER) process.env.DATABASE_USER = flags.DATABASE_USER
        if (flags.DATABASE_PASSWORD) process.env.DATABASE_PASSWORD = flags.DATABASE_PASSWORD
        if (flags.DATABASE_SSL) process.env.DATABASE_SSL = flags.DATABASE_SSL
        if (flags.DATABASE_SSL_KEY_BASE64) process.env.DATABASE_SSL_KEY_BASE64 = flags.DATABASE_SSL_KEY_BASE64

        // Storage
        if (flags.STORAGE_TYPE) process.env.STORAGE_TYPE = flags.STORAGE_TYPE
        if (flags.S3_STORAGE_BUCKET_NAME) process.env.S3_STORAGE_BUCKET_NAME = flags.S3_STORAGE_BUCKET_NAME
        if (flags.S3_STORAGE_ACCESS_KEY_ID) process.env.S3_STORAGE_ACCESS_KEY_ID = flags.S3_STORAGE_ACCESS_KEY_ID
        if (flags.S3_STORAGE_SECRET_ACCESS_KEY) process.env.S3_STORAGE_SECRET_ACCESS_KEY = flags.S3_STORAGE_SECRET_ACCESS_KEY
        if (flags.S3_STORAGE_REGION) process.env.S3_STORAGE_REGION = flags.S3_STORAGE_REGION
        if (flags.S3_ENDPOINT_URL) process.env.S3_ENDPOINT_URL = flags.S3_ENDPOINT_URL
        if (flags.S3_FORCE_PATH_STYLE) process.env.S3_FORCE_PATH_STYLE = flags.S3_FORCE_PATH_STYLE
        if (flags.GOOGLE_CLOUD_STORAGE_CREDENTIAL) process.env.GOOGLE_CLOUD_STORAGE_CREDENTIAL = flags.GOOGLE_CLOUD_STORAGE_CREDENTIAL
        if (flags.GOOGLE_CLOUD_STORAGE_PROJ_ID) process.env.GOOGLE_CLOUD_STORAGE_PROJ_ID = flags.GOOGLE_CLOUD_STORAGE_PROJ_ID

        // Redis-backed rate limiting
        if (flags.REDIS_URL) process.env.REDIS_URL = flags.REDIS_URL

        // Platform migration catalog
        if (flags.UPL_GLOBAL_MIGRATION_CATALOG_ENABLED) {
            process.env.UPL_GLOBAL_MIGRATION_CATALOG_ENABLED = flags.UPL_GLOBAL_MIGRATION_CATALOG_ENABLED
        }
    }
}
