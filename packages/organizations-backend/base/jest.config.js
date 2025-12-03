const base = require('../../../tools/testing/backend/jest.base.config.cjs')

module.exports = {
  ...base,
  displayName: 'clusters-backend',
  rootDir: __dirname,
  moduleNameMapper: {
    ...base.moduleNameMapper,
    '^@clusters/(.*)$': '<rootDir>/src/$1'
  }
}