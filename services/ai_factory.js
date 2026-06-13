// services/ai_factory.js
const PROVIDER = process.env.AI_PROVIDER || 'ollama';

/**
 * Returns the configured AI diagnostic service.
 * Only supports Ollama (local) — no cloud fallback.
 */
function getAIService() {
  if (PROVIDER === 'ollama') {
    return require('./ollama');
  }
  throw new Error(`Unsupported AI_PROVIDER: ${PROVIDER}. Only 'ollama' is supported.`);
}

module.exports = { getAIService };
