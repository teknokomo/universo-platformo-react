module.exports = {
    extends: [
        'eslint:recommended',
        'plugin:markdown/recommended',
        'plugin:react/recommended',
        'plugin:react/jsx-runtime',
        'plugin:react-hooks/recommended',
        'plugin:jsx-a11y/recommended',
        'plugin:prettier/recommended'
    ],
    settings: {
        react: {
            version: 'detect'
        }
    },
    parser: '@typescript-eslint/parser',
    ignorePatterns: ['**/node_modules', '**/dist', '**/build', '**/package-lock.json'],
    plugins: ['@typescript-eslint', 'unused-imports'],
    overrides: [
        {
            files: ['**/*.ts', '**/*.tsx'],
            parser: '@typescript-eslint/parser',
            plugins: ['@typescript-eslint', 'unused-imports'],
            rules: {
                // TypeScript-specific rules
                '@typescript-eslint/no-unused-vars': ['warn', { 
                    vars: 'all', 
                    varsIgnorePattern: '^_', 
                    args: 'after-used', 
                    argsIgnorePattern: '^_' 
                }],
                '@typescript-eslint/explicit-module-boundary-types': 'off',
                '@typescript-eslint/no-explicit-any': 'warn',
                '@typescript-eslint/no-inferrable-types': 'warn',
                '@typescript-eslint/no-empty-function': 'warn',
                // Disable conflicting ESLint rules
                'no-unused-vars': 'off',
                'no-undef': 'off',
                // Unused imports
                'unused-imports/no-unused-imports': 'warn',
                'unused-imports/no-unused-vars': 'off' // Use TypeScript version instead
            }
        }
    ],
    rules: {
        'no-unused-vars': 'warn',
        'unused-imports/no-unused-imports': 'warn',
        'unused-imports/no-unused-vars': ['warn', { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' }],
        'no-undef': 'off',
        'no-console': [process.env.CI ? 'error' : 'warn', { allow: ['warn', 'error', 'info'] }],
        'prettier/prettier': 'error'
    }
}
