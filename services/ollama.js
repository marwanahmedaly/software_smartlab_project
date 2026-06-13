require('dotenv').config();
const fetch = require('node-fetch');

const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

/**
 * Check if Ollama is running and the model is available
 */
async function checkHealth() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { method: 'GET', timeout: 3000 });
    if (!res.ok) return { ok: false, error: `Ollama returned HTTP ${res.status}` };
    const data = await res.json();
    const models = data.models || [];
    const hasModel = models.some(m => m.name && m.name.includes(OLLAMA_MODEL));
    if (!hasModel) {
      return { ok: false, error: `Model '${OLLAMA_MODEL}' not found. Pull it with: ollama pull ${OLLAMA_MODEL}` };
    }
    return { ok: true, model: OLLAMA_MODEL };
  } catch (err) {
    return { ok: false, error: `Ollama is not running at ${OLLAMA_URL}. Start it with: ollama serve` };
  }
}

/**
 * Sends fault description to Ollama (local) and returns diagnostic suggestions
 */
async function diagnose(description, deviceType = '', issueHistory = '') {
  const health = await checkHealth();
  if (!health.ok) {
    throw new Error(health.error);
  }

  const prompt = `You are an intelligent assistant specialized in computer maintenance in computer labs.
Respond in English only in short, practical bullet points.
Provide: 1) Possible causes 2) Inspection steps 3) Recommended solution.

Device type: ${deviceType || 'Not specified'}
Previous fault history: ${issueHistory || 'None'}
Current fault description: ${description}`;

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama Error: ${res.status} — ${body}`);
  }

  const data = await res.json();
  return data.response?.trim() || 'The system was unable to generate suggestions';
}

module.exports = { diagnose, checkHealth };
