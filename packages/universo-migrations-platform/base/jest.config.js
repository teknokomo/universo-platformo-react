const base = require('../../../tools/testing/backend/jest.base.config.cjs')

module.exports = {
    ...base,
    displayName: 'migrations-platform',
    rootDir: __dirname,
    moduleNameMapper: {
        ...base.moduleNameMapper,
        '^@universo/metahubs-backend$': '<rootDir>/../../metahubs-backend/base/src/platform/migrations/index.ts',
        '^@universo/applications-backend$': '<rootDir>/../../applications-backend/base/src/platform/migrations/index.ts'
    }
}
