module.exports = {
    overrides: [
        {
            files: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/__tests__/**/*.{ts,tsx}'],
            rules: {
                '@typescript-eslint/no-explicit-any': 'off',
                '@typescript-eslint/no-empty-function': 'off'
            }
        }
    ]
}