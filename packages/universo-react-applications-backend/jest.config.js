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
    },
    // The real Colyseus server stack (integration suites) pulls in `rou3`, which is
    // published ESM-only; convert it to CJS so Jest's CommonJS runtime can require it.
    transform: {
        ...base.transform,
        'rou3/dist/index\\.mjs$': [
            'babel-jest',
            {
                plugins: [require.resolve('@babel/plugin-transform-modules-commonjs', { paths: [repoRoot] })]
            }
        ]
    },
    transformIgnorePatterns: ['node_modules/(?!.*(@universo-react|rou3))', 'packages/.*/dist']
}
