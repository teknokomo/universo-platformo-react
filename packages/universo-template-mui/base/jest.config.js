module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/src'],
    testMatch: [
        '**/__tests__/**/*.+(ts|tsx|js)',
        '**/*.(test|spec).+(ts|tsx|js)'
    ],
    transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
            tsconfig: {
                jsx: 'react-jsx'
            }
        }]
    },
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/__tests__/**/*',
        '!src/templates/**/*'
    ],
    setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/templates/'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: [
        'text',
        'lcov',
        'html'
    ],
    testEnvironmentOptions: {
        customExportConditions: [''],
    },
    coverageThreshold: {
        global: {
            branches: 50,
            functions: 50,
            lines: 50,
            statements: 50
        }
    },
    moduleNameMapper: {
        '\\.(json)$': 'identity-obj-proxy',
        '^@emotion/react$': '<rootDir>/node_modules/@emotion/react',
        '^@emotion/styled$': '<rootDir>/node_modules/@emotion/styled'
    }
};