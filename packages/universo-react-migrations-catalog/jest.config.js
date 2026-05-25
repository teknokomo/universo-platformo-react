const base = require('../../tools/testing/backend/jest.base.config.cjs')

module.exports = {
    ...base,
    displayName: 'migrations-catalog',
    rootDir: __dirname,
    moduleNameMapper: {
        ...base.moduleNameMapper
    }
}
