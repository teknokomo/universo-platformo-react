const base = require('../../tools/testing/backend/jest.base.config.cjs')

module.exports = {
    ...base,
    displayName: 'start-backend',
    rootDir: __dirname,
    moduleNameMapper: {
        ...base.moduleNameMapper,
        '^@universo-react/profile-backend$': '<rootDir>/../universo-react-profile-backend/src/index.ts'
    }
}
