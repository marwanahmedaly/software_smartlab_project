// services/ai_factory.js
const PROVIDER = process.env.AI_PROVIDER || 'openrouter';

/**
 * Returns the configured AI diagnostic service
 * @returns {{diagnose: Function}} Object with diagnose method
 */
function getAIService() {
  if (PROVIDER === 'ollama') {
    return require('./ollama');
  }
  // Default to OpenRouter
  return require('./openrouter');
}

module.exports = { getAIService };
