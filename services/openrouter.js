require('dotenv').config();
const fetch = require('node-fetch');

const OPENROUTER_URL   = process.env.OPENROUTER_URL || 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_KEY   = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.2-3b-instruct:free';

/**
 * Sends fault description to OpenRouter (Llama 3.2) and returns diagnostic suggestions
 */
async function diagnose(description, deviceType = '', issueHistory = '') {
  if (!OPENROUTER_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const prompt = `You are an intelligent assistant specialized in computer maintenance in computer labs.
Respond in English only in short, practical bullet points.
Provide: 1) Possible causes 2) Inspection steps 3) Recommended solution.

Device type: ${deviceType || 'Not specified'}
Previous fault history: ${issueHistory || 'None'}
Current fault description: ${description}`;

  const res = await fetch(OPENROUTER_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'HTTP-Referer':  process.env.APP_URL || 'http://localhost:3000',
      'X-Title':       'Smart Lab AI Diagnostics',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: 'You are a helpful computer lab maintenance assistant. Always respond in English.' },
        { role: 'user',   content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 600,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter Error: ${res.status} — ${body}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || 'The system was unable to generate suggestions';
}

module.exports = { diagnose };
