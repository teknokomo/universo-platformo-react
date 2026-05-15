const base = require('../../../tools/testing/backend/jest.base.config.cjs')

module.exports = {
    ...base,
    displayName: 'start-backend',
    rootDir: __dirname,
    moduleNameMapper: {
        ...base.moduleNameMapper,
        '^@universo/profile-backend$': '<rootDir>/../../profile-backend/base/src/index.ts'
    }
}
