const base = require('../../tools/testing/backend/jest.base.config.cjs')

module.exports = {
    ...base,
    displayName: 'migrations-platform',
    rootDir: __dirname,
    moduleNameMapper: {
        ...base.moduleNameMapper,
        '^@universo/admin-backend/platform-definition$': '<rootDir>/../admin-backend/src/platform/systemAppDefinition.ts',
        '^@universo/admin-backend/platform-migrations$': '<rootDir>/../admin-backend/src/platform/migrations/index.ts',
        '^@universo/profile-backend/platform-definition$': '<rootDir>/../profile-backend/src/platform/systemAppDefinition.ts',
        '^@universo/profile-backend/platform-migrations$': '<rootDir>/../profile-backend/src/platform/migrations/index.ts',
        '^@universo/metahubs-backend/platform-definition$': '<rootDir>/../metahubs-backend/src/platform/systemAppDefinition.ts',
        '^@universo/metahubs-backend/platform-migrations$': '<rootDir>/../metahubs-backend/src/platform/migrations/index.ts',
        '^@universo/applications-backend/platform-definition$': '<rootDir>/../applications-backend/src/platform/systemAppDefinition.ts',
        '^@universo/applications-backend/platform-migrations$': '<rootDir>/../applications-backend/src/platform/migrations/index.ts',
        '^@universo/start-backend/platform-definition$': '<rootDir>/../start-backend/src/platform/systemAppDefinition.ts',
        '^@universo/start-backend/platform-migrations$': '<rootDir>/../start-backend/src/platform/migrations/index.ts'
    }
}
