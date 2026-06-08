require('dotenv').config();
const fetch = require('node-fetch');

const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

/**
 * Sends fault description to Ollama (local) and returns diagnostic suggestions
 */
async function diagnose(description, deviceType = '', issueHistory = '') {
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

module.exports = { diagnose };
