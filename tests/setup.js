// tests/setup.js
// This runs BEFORE any test files or modules are loaded
process.env.DB_PATH = './test.db';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = 'openrouter';
process.env.OPENROUTER_API_KEY = 'test-key';
