const base = require('../../../tools/testing/backend/jest.base.config.cjs')

module.exports = {
    ...base,
    displayName: 'profile-backend',
    rootDir: __dirname,
    moduleNameMapper: {
        ...base.moduleNameMapper,
        '^@universo/migrations-core$': '<rootDir>/../../universo-migrations-core/base/src/index.ts',
        '^@universo/migrations-core/(.*)$': '<rootDir>/../../universo-migrations-core/base/src/$1',
        '^@profile/(.*)$': '<rootDir>/src/$1'
    }
}
