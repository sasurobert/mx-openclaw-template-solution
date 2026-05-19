module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/*.test.ts'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.test.ts',
        '!src/mx/**',
        // External-service adapters — covered by integration/e2e, not unit tests
        '!src/llm/**',
        '!src/mcp/**',
        '!src/agent/tools/index.ts',
    ],
    coverageReporters: ['text', 'lcov', 'json-summary'],
    coverageThreshold: {
        global: {
            lines: 80,
        },
    },
};
