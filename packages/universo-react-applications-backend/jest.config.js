const base = require('../../tools/testing/backend/jest.base.config.cjs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..', '..')

module.exports = {
    ...base,
    displayName: 'applications-backend',
    rootDir: __dirname,
    moduleNameMapper: {
        ...base.moduleNameMapper,
        '^@universo-react/colyseus-server$': path.join(repoRoot, 'packages/universo-react-colyseus-server/src/index.ts'),
        '^@universo-react/colyseus-server/movement$': path.join(repoRoot, 'packages/universo-react-colyseus-server/src/movement.ts'),
        '^@applications/(.*)$': '<rootDir>/src/$1'
    }
}
