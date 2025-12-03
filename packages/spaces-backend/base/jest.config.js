const base = require('../../../tools/testing/backend/jest.base.config.cjs')

module.exports = {
  ...base,
  displayName: 'spaces-backend',
  rootDir: __dirname,
  moduleNameMapper: {
    ...base.moduleNameMapper,
    '^@spaces/(.*)$': '<rootDir>/src/$1'
  }
}
