const base = require('../../../tools/testing/backend/jest.base.config.cjs')

module.exports = {
    ...base,
    displayName: 'schema-ddl',
    rootDir: __dirname,
    moduleNameMapper: {
        ...base.moduleNameMapper
    }
}
