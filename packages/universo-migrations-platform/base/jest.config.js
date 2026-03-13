const base = require('../../../tools/testing/backend/jest.base.config.cjs')
const path = require('path')

module.exports = {
    ...base,
    displayName: 'migrations-platform',
    rootDir: __dirname,
    moduleNameMapper: {
        ...base.moduleNameMapper,
        '^@universo/types$': path.join(__dirname, '..', '..', 'universo-types', 'base', 'src', 'index.ts'),
        '^@universo/types/(.*)$': path.join(__dirname, '..', '..', 'universo-types', 'base', 'src', '$1'),
        '^@universo/migrations-core$': path.join(__dirname, '..', '..', 'universo-migrations-core', 'base', 'src', 'index.ts'),
        '^@universo/migrations-core/(.*)$': path.join(__dirname, '..', '..', 'universo-migrations-core', 'base', 'src', '$1'),
        '^@universo/migrations-catalog$': path.join(__dirname, '..', '..', 'universo-migrations-catalog', 'base', 'src', 'index.ts'),
        '^@universo/migrations-catalog/(.*)$': path.join(__dirname, '..', '..', 'universo-migrations-catalog', 'base', 'src', '$1'),
        '^@universo/admin-backend/platform-definition$': '<rootDir>/../../admin-backend/base/src/platform/systemAppDefinition.ts',
        '^@universo/admin-backend/platform-migrations$': '<rootDir>/../../admin-backend/base/src/platform/migrations/index.ts',
        '^@universo/profile-backend/platform-definition$': '<rootDir>/../../profile-backend/base/src/platform/systemAppDefinition.ts',
        '^@universo/profile-backend/platform-migrations$': '<rootDir>/../../profile-backend/base/src/platform/migrations/index.ts',
        '^@universo/metahubs-backend/platform-definition$': '<rootDir>/../../metahubs-backend/base/src/platform/systemAppDefinition.ts',
        '^@universo/metahubs-backend/platform-migrations$': '<rootDir>/../../metahubs-backend/base/src/platform/migrations/index.ts',
        '^@universo/applications-backend/platform-definition$':
            '<rootDir>/../../applications-backend/base/src/platform/systemAppDefinition.ts',
        '^@universo/applications-backend/platform-migrations$': '<rootDir>/../../applications-backend/base/src/platform/migrations/index.ts'
    }
}
