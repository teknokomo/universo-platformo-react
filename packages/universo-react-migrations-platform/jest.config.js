const base = require('../../tools/testing/backend/jest.base.config.cjs')

module.exports = {
    ...base,
    displayName: 'migrations-platform',
    rootDir: __dirname,
    moduleNameMapper: {
        ...base.moduleNameMapper,
        '^@universo-react/admin-backend/platform-definition$':
            '<rootDir>/../universo-react-admin-backend/src/platform/systemAppDefinition.ts',
        '^@universo-react/admin-backend/platform-migrations$': '<rootDir>/../universo-react-admin-backend/src/platform/migrations/index.ts',
        '^@universo-react/profile-backend/platform-definition$':
            '<rootDir>/../universo-react-profile-backend/src/platform/systemAppDefinition.ts',
        '^@universo-react/profile-backend/platform-migrations$':
            '<rootDir>/../universo-react-profile-backend/src/platform/migrations/index.ts',
        '^@universo-react/metahubs-backend/platform-definition$':
            '<rootDir>/../universo-react-metahubs-backend/src/platform/systemAppDefinition.ts',
        '^@universo-react/metahubs-backend/platform-migrations$':
            '<rootDir>/../universo-react-metahubs-backend/src/platform/migrations/index.ts',
        '^@universo-react/applications-backend/platform-definition$':
            '<rootDir>/../universo-react-applications-backend/src/platform/systemAppDefinition.ts',
        '^@universo-react/applications-backend/platform-migrations$':
            '<rootDir>/../universo-react-applications-backend/src/platform/migrations/index.ts',
        '^@universo-react/start-backend/platform-definition$':
            '<rootDir>/../universo-react-start-backend/src/platform/systemAppDefinition.ts',
        '^@universo-react/start-backend/platform-migrations$': '<rootDir>/../universo-react-start-backend/src/platform/migrations/index.ts'
    }
}
