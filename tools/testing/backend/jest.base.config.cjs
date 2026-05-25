const path = require('path')

const repoRoot = path.resolve(__dirname, '..', '..', '..')

/**
 * Shared Jest configuration for backend services.
 * Individual apps can import and extend this base configuration
 * to keep testing behaviour consistent across the monorepo.
 */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
    setupFiles: [path.join(__dirname, 'setupFiles.ts')],
    setupFilesAfterEnv: [path.join(__dirname, 'setupAfterEnv.ts')],
    testMatch: ['**/__tests__/**/*.test.[tj]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],
    moduleNameMapper: {
        '^@testing/backend/(.*)$': path.join(__dirname, '$1'),
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@universo-react/auth-backend$': path.join(repoRoot, 'packages/universo-react-auth-backend/dist/index.js'),
        '^@universo-react/auth-backend/(.*)$': path.join(repoRoot, 'packages/universo-react-auth-backend/dist/$1'),
        '^@universo-react/database$': path.join(repoRoot, 'packages/universo-react-database/src/index.ts'),
        '^@universo-react/database/(.*)$': path.join(repoRoot, 'packages/universo-react-database/src/$1'),
        '^@universo-react/types$': path.join(repoRoot, 'packages/universo-react-types/src/index.ts'),
        '^@universo-react/types/(.*)$': path.join(repoRoot, 'packages/universo-react-types/src/$1'),
        '^@universo-react/modules-engine$': path.join(repoRoot, 'packages/universo-react-modules-engine/src/index.ts'),
        '^@universo-react/modules-engine/(.*)$': path.join(repoRoot, 'packages/universo-react-modules-engine/src/$1'),
        '^@universo-react/utils$': path.join(repoRoot, 'packages/universo-react-utils/src/index.ts'),
        '^@universo-react/utils/database$': path.join(repoRoot, 'packages/universo-react-utils/src/database/index.ts'),
        '^@universo-react/utils/database/(.*)$': path.join(repoRoot, 'packages/universo-react-utils/src/database/$1'),
        '^@universo-react/utils/(.*)$': path.join(repoRoot, 'packages/universo-react-utils/src/$1'),
        '^@universo-react/migrations-core$': path.join(repoRoot, 'packages/universo-react-migrations-core/src/index.ts'),
        '^@universo-react/migrations-core/(.*)$': path.join(repoRoot, 'packages/universo-react-migrations-core/src/$1'),
        '^@universo-react/migrations-catalog$': path.join(repoRoot, 'packages/universo-react-migrations-catalog/src/index.ts'),
        '^@universo-react/migrations-catalog/(.*)$': path.join(repoRoot, 'packages/universo-react-migrations-catalog/src/$1')
    },
    collectCoverageFrom: [
        '<rootDir>/src/**/*.{ts,tsx}',
        '!<rootDir>/src/**/*.d.ts',
        '!<rootDir>/src/**/__tests__/**',
        '!<rootDir>/src/**/tests/**'
    ],
    coverageDirectory: '<rootDir>/coverage',
    coverageReporters: ['text', 'lcov', 'cobertura'],
    transform: {
        '^.+\\.(ts|tsx)$': [
            'ts-jest',
            {
                tsconfig: path.join(repoRoot, 'tsconfig.test.json')
            }
        ]
    },
    transformIgnorePatterns: ['node_modules/(?!@universo-react)', 'packages/.*/dist'],
    modulePathIgnorePatterns: ['<rootDir>/dist']
}
