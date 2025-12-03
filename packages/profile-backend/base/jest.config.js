const base = require('../../../tools/testing/backend/jest.base.config.cjs')

module.exports = {
  ...base,
  displayName: 'profile-backend',
  rootDir: __dirname,
  moduleNameMapper: {
    ...base.moduleNameMapper,
    '^@profile/(.*)$': '<rootDir>/src/$1'
  }
}
