module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
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
    testEnvironmentOptions: {
        url: 'http://localhost'
    },
    moduleNameMapping: {
        // Handle JSON imports
        '\\.(json)$': 'identity-obj-proxy',
        // Handle MUI emotion styles
        '^@emotion/react$': '<rootDir>/node_modules/@emotion/react',
        '^@emotion/styled$': '<rootDir>/node_modules/@emotion/styled',
        // Mock canvas for jsdom
        '^canvas$': 'identity-obj-proxy'
    },
    // Ignore canvas-related modules
    transformIgnorePatterns: [
        'node_modules/(?!(canvas)/)'
    ]
};