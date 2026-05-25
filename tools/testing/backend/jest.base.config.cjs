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
        '^@universo/auth-backend$': path.join(repoRoot, 'packages/auth-backend/dist/index.js'),
        '^@universo/auth-backend/(.*)$': path.join(repoRoot, 'packages/auth-backend/dist/$1'),
        '^@universo/database$': path.join(repoRoot, 'packages/universo-database/src/index.ts'),
        '^@universo/database/(.*)$': path.join(repoRoot, 'packages/universo-database/src/$1'),
        '^@universo/types$': path.join(repoRoot, 'packages/universo-types/src/index.ts'),
        '^@universo/types/(.*)$': path.join(repoRoot, 'packages/universo-types/src/$1'),
        '^@universo/modules-engine$': path.join(repoRoot, 'packages/modules-engine/src/index.ts'),
        '^@universo/modules-engine/(.*)$': path.join(repoRoot, 'packages/modules-engine/src/$1'),
        '^@universo/utils$': path.join(repoRoot, 'packages/universo-utils/src/index.ts'),
        '^@universo/utils/database$': path.join(repoRoot, 'packages/universo-utils/src/database/index.ts'),
        '^@universo/utils/database/(.*)$': path.join(repoRoot, 'packages/universo-utils/src/database/$1'),
        '^@universo/utils/(.*)$': path.join(repoRoot, 'packages/universo-utils/src/$1'),
        '^@universo/migrations-core$': path.join(repoRoot, 'packages/universo-migrations-core/src/index.ts'),
        '^@universo/migrations-core/(.*)$': path.join(repoRoot, 'packages/universo-migrations-core/src/$1'),
        '^@universo/migrations-catalog$': path.join(repoRoot, 'packages/universo-migrations-catalog/src/index.ts'),
        '^@universo/migrations-catalog/(.*)$': path.join(repoRoot, 'packages/universo-migrations-catalog/src/$1')
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
    transformIgnorePatterns: ['node_modules/(?!@universo)', 'packages/.*/dist'],
    modulePathIgnorePatterns: ['<rootDir>/dist']
}
