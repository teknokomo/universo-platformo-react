module.exports = {
    preset: 'ts-jest',
    testEnvironment: '@happy-dom/jest-environment',
    roots: ['<rootDir>/src'],
    testMatch: [
        '**/__tests__/**/*.+(ts|tsx|js)',
        '**/*.(test|spec).+(ts|tsx|js)'
    ],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest'
    },
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/__tests__/**/*',
        '!src/templates/**/*' // Exclude copied MUI templates from coverage
    ],
    setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/templates/' // Ignore MUI template tests
    ],
    coverageDirectory: 'coverage',
    coverageReporters: [
        'text',
        'lcov',
        'html'
    ],
    globals: {
        'ts-jest': {
            tsconfig: {
                jsx: 'react-jsx'
            }
        }
    },
    moduleNameMapper: {
        // Handle JSON imports
        '\\.(json)$': 'identity-obj-proxy',
        // Handle MUI emotion styles
        '^@emotion/react$': '<rootDir>/node_modules/@emotion/react',
        '^@emotion/styled$': '<rootDir>/node_modules/@emotion/styled',
        // CSS modules
        '\\.(css|less|sass|scss)$': 'identity-obj-proxy'
    }
};