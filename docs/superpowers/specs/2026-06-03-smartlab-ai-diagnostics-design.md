# SmartLab AI Provider & Diagnostics Design

**Date:** 2026-06-03  
**Project:** SmartLab — Smart Computer Lab Management & Maintenance System  
**Version:** 1.0.0  
**File:** `docs/superpowers/specs/2026-06-03-smartlab-ai-diagnostics-design.md`

---

## Overview

SmartLab integrates AI-powered fault diagnosis to assist lab technicians in identifying, troubleshooting, and resolving device issues faster. The system supports multiple AI providers (OpenRouter cloud API and Ollama local inference) via a factory pattern, allowing environment-based switching without code changes. The AI diagnostics endpoint enriches prompts with device context (type and recent resolved issue history) to generate more accurate, context-aware suggestions. All roles (admin, technician, viewer) can access the AI diagnosis feature through the chat interface.

---

## 1. AI Provider Factory Pattern

**File:** `services/ai_factory.js`

The factory reads `AI_PROVIDER` from environment variables and returns the appropriate diagnostic service module. Defaults to OpenRouter when not specified.

```javascript
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
```

**Environment Variable:**
- `AI_PROVIDER` — Set to `'openrouter'` or `'ollama'`

---

## 2. OpenRouter Integration

**File:** `services/openrouter.js`

Cloud-based AI diagnosis using OpenRouter's API with the free Llama 3.2 3B instruct model. Requires an API key. Includes referer and title headers for OpenRouter attribution.

```javascript
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
```

**Environment Variables:**
- `OPENROUTER_API_KEY` — Required. Your OpenRouter API key.
- `OPENROUTER_URL` — Optional. Defaults to `https://openrouter.ai/api/v1/chat/completions`.
- `OPENROUTER_MODEL` — Optional. Defaults to `meta-llama/llama-3.2-3b-instruct:free`.
- `APP_URL` — Optional. Used for the `HTTP-Referer` header.

---

## 3. Ollama Integration

**File:** `services/ollama.js`

Local AI diagnosis using a self-hosted Ollama instance. No API key required. Communicates with the Ollama generate API endpoint.

```javascript
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
```

**Environment Variables:**
- `OLLAMA_URL` — Optional. Defaults to `http://127.0.0.1:11434`.
- `OLLAMA_MODEL` — Optional. Defaults to `llama3.2`.

---

## 4. Context-Aware Prompt Engineering

The AI prompt is dynamically constructed with three levels of context to improve diagnostic relevance:

1. **System Prompt:** Establishes the AI's role as a computer lab maintenance assistant, constraining responses to English and a structured bullet-point format covering possible causes, inspection steps, and recommended solutions.

2. **Device Context:** When a `device_id` is provided, the system queries the `devices` table to inject the device name and type into the prompt.

3. **Issue History Context:** The system retrieves up to 3 most recent resolved issues for the device from the `issues` table, formatting them as a bullet list of `issue_type: description` pairs.

This context enrichment allows the AI to give more targeted advice (e.g., "This printer had 2 paper jam issues last month—check the pickup roller").

---

## 5. AI Diagnostics Endpoint

**File:** `routes/ai.js`

Express route handling POST requests for AI diagnosis. Authenticates all users, validates input, enriches the prompt with device context, and returns the AI suggestion.

```javascript
const express   = require('express');
const db        = require('../db/database');
const { getAIService } = require('../services/ai_factory');
const { diagnose } = getAIService();
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// POST /api/ai/diagnose — AI fault diagnosis (all roles)
router.post('/diagnose', authenticate, async (req, res) => {
  const { description, device_id } = req.body;
  if (!description || description.trim().length < 5) {
    return res.status(400).json({ error: 'Please enter a clearer fault description (at least 5 characters)' });
  }

  let deviceType    = '';
  let issueHistory  = '';

  if (device_id) {
    const device = db.prepare('SELECT name, type FROM devices WHERE id = ?').get(device_id);
    if (device) deviceType = `${device.name} (${device.type})`;

    const history = db.prepare(`
      SELECT issue_type, description FROM issues
      WHERE device_id = ? AND status = 'resolved'
      ORDER BY created_at DESC LIMIT 3
    `).all(device_id);

    if (history.length) {
      issueHistory = history.map(h => `• ${h.issue_type}: ${h.description}`).join('\n');
    }
  }

  try {
    const suggestion = await diagnose(description.trim(), deviceType, issueHistory);
    res.json({ suggestion });
  } catch (err) {
    console.error('AI Diagnostics Error:', err.message);
    res.status(502).json({ error: 'Failed to connect to AI service, please try again' });
  }
});

module.exports = router;
```

**Endpoint:** `POST /api/ai/diagnose`  
**Authentication:** Required (all roles)  
**Request Body:**
```json
{
  "description": "string (min 5 chars)",
  "device_id": "number (optional)"
}
```
**Response:**
```json
{
  "suggestion": "string"
}
```

---

## 6. AI Chat Interface Description

The AI diagnosis feature is exposed through a chat-style UI component:

- **Input:** A text area where the user describes the fault. Minimum 5 characters enforced client-side and server-side.
- **Device Link:** Optional dropdown to associate the diagnosis with a specific device. When selected, device type and recent resolved issue history are included in the AI prompt.
- **Send:** Submits the description to `POST /api/ai/diagnose`.
- **Response Display:** The AI's suggestion is rendered as formatted text (bullet points) in a chat bubble or panel.
- **Error Handling:** Displays user-friendly messages for network failures, AI service unavailability (502), or invalid input (400).

The interface is accessible to all authenticated users regardless of role.

---

## 7. Provider Configuration Summary

| Variable | Default | Used By | Required |
|----------|---------|---------|----------|
| `AI_PROVIDER` | `openrouter` | Factory | No |
| `OPENROUTER_API_KEY` | — | OpenRouter | Yes (if provider=openrouter) |
| `OPENROUTER_URL` | `https://openrouter.ai/api/v1/chat/completions` | OpenRouter | No |
| `OPENROUTER_MODEL` | `meta-llama/llama-3.2-3b-instruct:free` | OpenRouter | No |
| `APP_URL` | `http://localhost:3000` | OpenRouter | No |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama | No |
| `OLLAMA_MODEL` | `llama3.2` | Ollama | No |

Switching providers is a zero-code operation: change `AI_PROVIDER` in the environment and restart the server.
