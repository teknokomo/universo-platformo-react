const base = require('../../../tools/testing/backend/jest.base.config.cjs')
const path = require('path')

module.exports = {
    ...base,
    displayName: 'migrations-catalog',
    rootDir: __dirname,
    moduleNameMapper: {
        ...base.moduleNameMapper,
        '^@universo/migrations-core$': path.join(__dirname, '..', '..', 'universo-migrations-core', 'base', 'src', 'index.ts'),
        '^@universo/migrations-core/(.*)$': path.join(__dirname, '..', '..', 'universo-migrations-core', 'base', 'src', '$1')
    }
}
