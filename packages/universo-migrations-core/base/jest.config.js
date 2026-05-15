const base = require('../../../tools/testing/backend/jest.base.config.cjs')

module.exports = {
    ...base,
    displayName: 'migrations-core',
    rootDir: __dirname,
    moduleNameMapper: {
        ...base.moduleNameMapper
    }
}
