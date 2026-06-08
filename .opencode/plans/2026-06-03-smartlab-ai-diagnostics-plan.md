# AI Provider & Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pluggable AI diagnostics system with OpenRouter (cloud Llama 3.2) and Ollama (local fallback) providers, context-aware prompts, a chat UI, and auto-suggestions on the issue form.

**Architecture:** Factory pattern abstracts provider selection via environment variable. Both providers implement the same `diagnose(description, deviceType, issueHistory)` async interface. The route enriches prompts with device metadata and resolved issue history from SQLite. Frontend uses vanilla JS with debounced auto-fetch and quick suggestion chips.

**Tech Stack:** Node.js, Express, node-fetch, dotenv. Frontend: vanilla HTML/JS/CSS.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `services/ai_factory.js` | Factory that returns the configured AI provider based on `AI_PROVIDER` env var |
| `services/openrouter.js` | OpenRouter REST client — Llama 3.2 via chat completions API |
| `services/ollama.js` | Ollama REST client — local LLM via generate endpoint |
| `routes/ai.js` | Express route: `POST /api/ai/diagnose` with context enrichment |
| `public/ai.html` | Standalone AI chat page with device selector and quick chips |
| `public/issues.html` | Issue form with debounced AI suggestion auto-fetch |
| `.env.example` | Document all AI-related environment variables |
| `tests/ai.test.js` | Unit tests for the AI diagnostics route |

---

### Task 1: Create AI Provider Factory

**Files:**
- Create: `services/ai_factory.js`
- Modify: `.env.example`
- Test: `tests/ai.test.js` (prepared in Task 4)

- [ ] **Step 1: Write the factory module**

Create `services/ai_factory.js`:

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

- [ ] **Step 2: Add AI provider env vars to `.env.example`**

Append to `.env.example`:

```bash
# ── AI Provider Selection ────────────────────────────────────
# Options: 'openrouter' or 'ollama'
AI_PROVIDER=openrouter

# ── AI Diagnostics (OpenRouter) ───────────────────────────────
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=meta-llama/llama-3.2-3b-instruct:free
OPENROUTER_URL=https://openrouter.ai/api/v1/chat/completions

# ── AI Diagnostics (Ollama — local, for demo) ─────────────────
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
```

- [ ] **Step 3: Verify factory loads without error**

Run:
```bash
node -e "const { getAIService } = require('./services/ai_factory'); console.log('Factory loaded:', typeof getAIService())"
```

Expected:
```
Factory loaded: object
```

- [ ] **Step 4: Commit**

```bash
git add services/ai_factory.js .env.example
git commit -m "feat: add AI provider factory with env-based switching"
```

---

### Task 2: Implement OpenRouter Provider

**Files:**
- Create: `services/openrouter.js`
- Test: `tests/setup.js`

- [ ] **Step 1: Write the OpenRouter provider**

Create `services/openrouter.js`:

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

- [ ] **Step 2: Add test env vars to `tests/setup.js`**

Ensure `tests/setup.js` contains:

```javascript
process.env.AI_PROVIDER = 'openrouter';
process.env.OPENROUTER_API_KEY = 'test-key';
```

- [ ] **Step 3: Verify provider loads**

Run:
```bash
node -e "const { diagnose } = require('./services/openrouter'); console.log('OpenRouter loaded:', typeof diagnose)"
```

Expected:
```
OpenRouter loaded: function
```

- [ ] **Step 4: Commit**

```bash
git add services/openrouter.js tests/setup.js
git commit -m "feat: implement OpenRouter AI provider for Llama 3.2 diagnostics"
```

---

### Task 3: Implement Ollama Provider

**Files:**
- Create: `services/ollama.js`

- [ ] **Step 1: Write the Ollama provider**

Create `services/ollama.js`:

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

- [ ] **Step 2: Verify provider loads**

Run:
```bash
node -e "const { diagnose } = require('./services/ollama'); console.log('Ollama loaded:', typeof diagnose)"
```

Expected:
```
Ollama loaded: function
```

- [ ] **Step 3: Commit**

```bash
git add services/ollama.js
git commit -m "feat: implement Ollama local LLM fallback provider"
```

---

### Task 4: Create AI Diagnostics Route

**Files:**
- Create: `routes/ai.js`
- Modify: `app.js`
- Test: `tests/ai.test.js`

- [ ] **Step 1: Write the AI diagnostics route**

Create `routes/ai.js`:

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

- [ ] **Step 2: Wire route into `app.js`**

Add to `app.js` in the API Routes section (after `/api/reports`):

```javascript
app.use('/api/ai',          require('./routes/ai'));
```

- [ ] **Step 3: Write tests for AI route**

Create `tests/ai.test.js`:

```javascript
jest.mock('../services/ai_factory', () => ({
  getAIService: () => ({
    diagnose: jest.fn().mockResolvedValue('1) Faulty HDMI cable\n2) Check connection cable\n3) Replace the cable')
  })
}));

const request = require('supertest');
const app = require('../app');
const { clearDatabase, seedUsers, createDevice, authHeader } = require('./helpers');

describe('AI Diagnosis Routes', () => {
  let user;

  beforeEach(() => {
    clearDatabase();
    const users = seedUsers();
    user = users.user;
  });

  describe('POST /api/ai/diagnose', () => {
    it('should return AI suggestion with device context', async () => {
      const device = createDevice({ name: 'PC-Test', type: 'desktop' });

      const res = await request(app)
        .post('/api/ai/diagnose')
        .set(authHeader(user))
        .send({
          description: 'Screen not working',
          device_id: device.id,
        });

      expect(res.status).toBe(200);
      expect(res.body.suggestion).toBeDefined();
      expect(res.body.suggestion).toContain('HDMI cable');
    });

    it('should work without device_id', async () => {
      const res = await request(app)
        .post('/api/ai/diagnose')
        .set(authHeader(user))
        .send({
          description: 'Screen not working',
        });

      expect(res.status).toBe(200);
      expect(res.body.suggestion).toBeDefined();
      expect(res.body.suggestion).toContain('HDMI cable');
    });

    it('should reject short description (< 5 chars)', async () => {
      const res = await request(app)
        .post('/api/ai/diagnose')
        .set(authHeader(user))
        .send({
          description: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject missing description', async () => {
      const res = await request(app)
        .post('/api/ai/diagnose')
        .set(authHeader(user))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/ai/diagnose')
        .send({
          description: 'Screen not working',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });
  });
});
```

- [ ] **Step 4: Run AI tests**

Run:
```bash
npm test -- tests/ai.test.js
```

Expected:
```
PASS  tests/ai.test.js
  AI Diagnosis Routes
    POST /api/ai/diagnose
      ✓ should return AI suggestion with device context
      ✓ should work without device_id
      ✓ should reject short description (< 5 chars)
      ✓ should reject missing description
      ✓ should reject unauthenticated request
```

- [ ] **Step 5: Commit**

```bash
git add routes/ai.js app.js tests/ai.test.js
git commit -m "feat: add AI diagnostics route with context-aware prompts and tests"
```

---

### Task 5: Build AI Chat Page

**Files:**
- Create: `public/ai.html`

- [ ] **Step 1: Create the AI chat page**

Create `public/ai.html` with the complete chat interface (device selector, quick chips, message history, typing indicator):

```html
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI Assistant — Smart Lab</title>
  <link rel="stylesheet" href="/css/style.css" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
  <style>
    .chat-wrap {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 130px);
      max-width: 860px;
      margin: 0 auto;
    }
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: .85rem;
      padding: 1.25rem;
      background: #f8fafc;
      border-radius: 14px 14px 0 0;
      border: 1px solid var(--border);
      border-bottom: none;
    }
    .msg {
      display: flex;
      gap: .75rem;
      align-items: flex-start;
      animation: fadeIn .25s ease;
    }
    @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    .msg.user  { flex-direction: row-reverse; }
    .msg-avatar {
      width: 38px; height: 38px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.1rem; flex-shrink: 0;
    }
    .msg.ai   .msg-avatar { background: linear-gradient(135deg,#3b82f6,#6366f1); color:#fff; }
    .msg.user .msg-avatar { background: var(--sidebar-bg); color:#fff; }
    .msg-bubble {
      max-width: 72%;
      padding: .85rem 1.1rem;
      border-radius: 14px;
      font-size: .93rem;
      line-height: 1.7;
      white-space: pre-wrap;
    }
    .msg.ai   .msg-bubble { background: #fff; border: 1px solid var(--border); border-top-right-radius: 4px; }
    .msg.user .msg-bubble { background: var(--primary); color: #fff; border-top-left-radius: 4px; }
    .msg.ai .msg-bubble code { background: #f1f5f9; padding:.1rem .35rem; border-radius:4px; font-size:.85rem; }
    .chat-form {
      display: flex;
      gap: .6rem;
      padding: .85rem 1rem;
      background: #fff;
      border: 1px solid var(--border);
      border-top: none;
      border-radius: 0 0 14px 14px;
    }
    .chat-input {
      flex: 1;
      border: 1.5px solid var(--border);
      border-radius: 10px;
      padding: .65rem 1rem;
      font-family: 'Cairo', sans-serif;
      font-size: .93rem;
      resize: none;
      min-height: 44px;
      max-height: 120px;
      outline: none;
      transition: border-color .2s;
      direction: rtl;
    }
    .chat-input:focus { border-color: var(--primary); }
    .chat-send {
      padding: .65rem 1.1rem;
      background: var(--primary);
      color: #fff;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-size: 1.1rem;
      transition: background .2s;
      align-self: flex-end;
    }
    .chat-send:hover { background: #2563eb; }
    .chat-send:disabled { background: #93c5fd; cursor: not-allowed; }
    .device-select-bar {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: .6rem 1rem;
      display: flex;
      gap: .75rem;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: .75rem;
      font-size: .88rem;
    }
    .typing-dots span {
      display: inline-block;
      width: 7px; height: 7px;
      border-radius: 50%;
      background: var(--primary);
      animation: blink 1.2s infinite;
      margin: 0 2px;
    }
    .typing-dots span:nth-child(2) { animation-delay:.2s }
    .typing-dots span:nth-child(3) { animation-delay:.4s }
    @keyframes blink { 0%,80%,100%{opacity:.2} 40%{opacity:1} }
    .quick-chips { display:flex; gap:.5rem; flex-wrap:wrap; margin-bottom:.5rem; }
    .chip { padding:.35rem .85rem; border-radius:20px; border:1px solid var(--border); cursor:pointer; font-size:.82rem; background:#fff; transition:.15s; }
    .chip:hover { background:var(--primary); color:#fff; border-color:var(--primary); }
    .lang-switch-top {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text);
      padding: .35rem .85rem;
      border-radius: 8px;
      cursor: pointer;
      font-family: 'Cairo', sans-serif;
      font-size: .85rem;
      transition: background .2s;
    }
    .lang-switch-top:hover { background: var(--sidebar-bg); color: #fff; }
  </style>
</head>
<body>
  <aside class="sidebar">
    <div class="sidebar-brand"><i class="fas fa-laptop-code"></i><span data-i18n="appName">Smart Lab</span></div>
    <nav class="sidebar-nav">
      <a href="/dashboard.html"   class="nav-item" data-page="dashboard.html"   data-roles="admin,technician">        <i class="fas fa-gauge-high"></i>           <span data-i18n="dashboard">Dashboard</span></a>
      <a href="/devices.html"     class="nav-item" data-page="devices.html"     data-roles="admin,technician">        <i class="fas fa-desktop"></i>             <span data-i18n="devices">Devices</span></a>
      <a href="/issues.html"      class="nav-item" data-page="issues.html"      data-roles="admin,technician,user">   <i class="fas fa-triangle-exclamation"></i> <span data-i18n="issues">My Issues</span></a>
      <a href="/maintenance.html" class="nav-item" data-page="maintenance.html" data-roles="admin,technician">        <i class="fas fa-screwdriver-wrench"></i>   <span data-i18n="maintenance">Maintenance</span></a>
      <a href="/map.html"         class="nav-item" data-page="map.html"         data-roles="admin,technician">        <i class="fas fa-map"></i>                 <span data-i18n="map">Map</span></a>
      <a href="/alerts.html"      class="nav-item" data-page="alerts.html"      data-roles="admin,technician">        <i class="fas fa-bell"></i>                <span data-i18n="alerts">Alerts</span></a>
      <a href="/ai.html"          class="nav-item" data-page="ai.html"          data-roles="admin,technician,user">   <i class="fas fa-robot"></i>               <span data-i18n="aiAssistant">AI Assistant</span></a>
      <a href="/reports.html"     class="nav-item" data-page="reports.html"     data-roles="admin,technician">        <i class="fas fa-chart-bar"></i>           <span data-i18n="reports">Reports</span></a>
      <a href="/admin.html"       class="nav-item" data-page="admin.html" id="admin-link" data-roles="admin">         <i class="fas fa-users-cog"></i> <span data-i18n="users">Users</span></a>
    </nav>
    <div class="sidebar-footer" data-i18n="copyright">Smart Lab &copy; 2026</div>
  </aside>

  <header class="topbar">
    <span class="topbar-title" data-i18n="aiAssistant">AI Assistant</span>
    <div class="topbar-actions">
      <button class="lang-switch-top" id="lang-switcher" data-i18n="langBtn">English</button>
      <div class="alert-bell" onclick="window.location='/alerts.html'"><i class="fas fa-bell"></i><span class="badge-count" id="unread-count" style="display:none">0</span></div>
      <div class="topbar-user"><div class="avatar" id="user-avatar">U</div><span id="user-name">User</span></div>
      <button class="btn btn-outline btn-sm" id="logout-btn"><i class="fas fa-sign-out-alt"></i> <span data-i18n="logout">Logout</span></button>
    </div>
  </header>

  <main class="main-content" style="padding-bottom:.5rem">
    <div class="chat-wrap">

      <!-- Device selection -->
      <div class="device-select-bar">
        <i class="fas fa-desktop" style="color:var(--primary)"></i>
        <label style="font-weight:600;white-space:nowrap" data-i18n="linkToDevice">Link to device (optional):</label>
        <select id="device-select" class="form-control" style="max-width:200px;font-size:.85rem">
          <option value="" data-i18n="noDeviceSelected">— No device selected —</option>
        </select>
        <button class="btn btn-outline btn-sm" id="clear-btn"><i class="fas fa-rotate-right"></i> <span data-i18n="newChat">New Chat</span></button>
      </div>

      <!-- Quick suggestions -->
      <div class="quick-chips" id="chips">
        <span class="chip" data-q="Device won't turn on when pressing the power button">🔴 <span data-i18n="deviceWontTurnOn">Device won't turn on</span></span>
        <span class="chip" data-q="Screen shows colored lines and abnormal colors">📺 <span data-i18n="screenIssueQuick">Screen issue</span></span>
        <span class="chip" data-q="Device is very slow when running programs">🐢 <span data-i18n="deviceIsSlow">Device is slow</span></span>
        <span class="chip" data-q="Keyboard doesn't respond to some keys">⌨️ <span data-i18n="keyboardIssueQuick">Keyboard issue</span></span>
        <span class="chip" data-q="Device won't connect to the internet">🌐 <span data-i18n="networkIssueQuick">Network issue</span></span>
        <span class="chip" data-q="Device makes repeated beeping sound on startup">🔔 <span data-i18n="beepingSound">Beeping sound</span></span>
      </div>

      <!-- Chat -->
      <div class="chat-messages" id="chat-messages">
        <div class="msg ai">
          <div class="msg-avatar"><i class="fas fa-robot"></i></div>
          <div class="msg-bubble" data-i18n="welcomeMessage">Hello! I'm your smart assistant for diagnosing computer issues. 🖥️

Describe the problem you're facing and I'll help you diagnose it and find the right solution. You can also select the affected device from the menu above for a more accurate diagnosis.</div>
        </div>
      </div>

      <!-- Input box -->
      <div class="chat-form">
        <textarea class="chat-input" id="chat-input" data-i18n-placeholder="describeIssuePlaceholder" placeholder="Describe the issue..." rows="1"></textarea>
        <button class="chat-send" id="send-btn" data-i18n-title="send" title="Send"><i class="fas fa-paper-plane"></i></button>
      </div>
    </div>
  </main>

  <script type="module">
    import { requireAuth, apiGet, apiPost, fillTopbar, setActiveNav, logout, toast, filterSidebar } from '/js/api.js';
    import { setLanguage, getLang, t, applyTranslations } from '/js/i18n.js';

    const user = requireAuth(); if (!user) throw new Error('stop');
    fillTopbar(); setActiveNav();
    applyTranslations();
    filterSidebar();
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('lang-switcher').addEventListener('click', () => {
      const next = getLang() === 'ar' ? 'en' : 'ar';
      setLanguage(next);
    });

    // Unread alerts badge
    apiGet('/api/alerts?is_read=0').then(a => { if(a?.unread>0){const el=document.getElementById('unread-count');el.textContent=a.unread;el.style.display='flex';} }).catch(()=>{});

    // Load devices
    const deviceSel = document.getElementById('device-select');
    apiGet('/api/devices?limit=100').then(res => {
      res.devices.forEach(d => deviceSel.appendChild(new Option(`${d.name} — ${d.type}`, d.id)));
    }).catch(() => {});

    // Chips — quick suggestions
    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.getElementById('chat-input').value = chip.dataset.q;
        send();
      });
    });

    const messagesEl = document.getElementById('chat-messages');
    const inputEl    = document.getElementById('chat-input');
    const sendBtn    = document.getElementById('send-btn');

    // Auto-resize textarea
    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
    });

    // Enter to send (Shift+Enter for new line)
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });

    sendBtn.addEventListener('click', send);
    document.getElementById('clear-btn').addEventListener('click', clearChat);

    function addMsg(role, text) {
      const isAI   = role === 'ai';
      const div    = document.createElement('div');
      div.className = `msg ${role}`;
      div.innerHTML = `
        <div class="msg-avatar"><i class="fas fa-${isAI ? 'robot' : 'user'}"></i></div>
        <div class="msg-bubble">${escHtml(text)}</div>`;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    function addTyping() {
      const div    = document.createElement('div');
      div.className = 'msg ai';
      div.id        = 'typing-indicator';
      div.innerHTML = `<div class="msg-avatar"><i class="fas fa-robot"></i></div>
        <div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function removeTyping() {
      document.getElementById('typing-indicator')?.remove();
    }

    function escHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    }

    async function send() {
      const text = inputEl.value.trim();
      if (!text) return;

      // Check minimum length before sending
      if (text.length < 5) {
        toast(t('pleaseEnterDescription'), 'error');
        inputEl.focus();
        return;
      }

      inputEl.value = '';
      inputEl.style.height = 'auto';
      sendBtn.disabled = true;

      // Hide chips after first message
      document.getElementById('chips').style.display = 'none';

      addMsg('user', text);
      addTyping();

      try {
        const deviceId = deviceSel.value || null;
        const res = await apiPost('/api/ai/diagnose', { description: text, device_id: deviceId });
        removeTyping();
        addMsg('ai', res.suggestion);
      } catch (e) {
        removeTyping();
        console.error('AI Chat Error:', e);
        const errMsg = e.message || t('unableToConnectAI');
        addMsg('ai', `⚠️ ${errMsg}`);
      } finally {
        sendBtn.disabled = false;
        inputEl.focus();
      }
    }

    function clearChat() {
      messagesEl.innerHTML = `
        <div class="msg ai">
          <div class="msg-avatar"><i class="fas fa-robot"></i></div>
          <div class="msg-bubble" data-i18n="welcomeMessage">Hello! I'm your smart assistant for diagnosing computer issues. 🖥️\n\nDescribe the problem you're facing and I'll help you diagnose it and find the right solution.</div>
        </div>`;
      document.getElementById('chips').style.display = 'flex';
      deviceSel.value = '';
    }

    window.addEventListener('languagechange', () => {
      applyTranslations();
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify page renders without errors**

Start the server and open `http://localhost:3000/ai.html` in a browser. The page should show:
- Sidebar with "AI Assistant" active
- Device selector dropdown
- 6 quick suggestion chips
- Welcome message from AI
- Text input with send button

- [ ] **Step 3: Commit**

```bash
git add public/ai.html
git commit -m "feat: build AI chat page with quick suggestion chips and device linking"
```

---

### Task 6: Add AI Suggestion Auto-Fetch on Issue Form

**Files:**
- Modify: `public/issues.html`

- [ ] **Step 1: Add AI suggestion box to issue form**

Inside the `<form id="issue-form">` in `public/issues.html`, after the image upload field and before the submit button, insert:

```html
<!-- AI Suggestion Box -->
<div class="ai-box hidden" id="ai-box">
  <div class="ai-box-header"><i class="fas fa-robot"></i> <span data-i18n="geminiSuggestions">Gemini AI Suggestions</span></div>
  <pre id="ai-text" data-i18n="analyzing">Analyzing...</pre>
</div>
```

Add the CSS to the `<style>` block in `issues.html` (or to `public/css/style.css` if shared):

```css
.ai-box {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  padding: .85rem 1rem;
  margin-bottom: .75rem;
}
.ai-box.hidden { display: none; }
.ai-box-header {
  font-weight: 600;
  color: var(--primary);
  margin-bottom: .4rem;
  display: flex;
  align-items: center;
  gap: .4rem;
}
.ai-box pre {
  white-space: pre-wrap;
  font-family: 'Cairo', sans-serif;
  font-size: .88rem;
  line-height: 1.7;
  margin: 0;
  color: var(--text);
}
```

- [ ] **Step 2: Add debounced AI auto-fetch logic**

In the `<script type="module">` of `public/issues.html`, after the device loading code and before the form submit handler, add:

```javascript
// AI Debounce
const canAI = ['admin','technician'].includes(user.role);
const descEl  = document.getElementById('f-desc');
const aiBox   = document.getElementById('ai-box');
const aiText  = document.getElementById('ai-text');

if (canAI) {
  descEl.addEventListener('input', debounce(async () => {
    const desc = descEl.value.trim();
    if (desc.length < 10) return;
    aiBox.classList.remove('hidden');
    aiText.textContent = t('analyzingWithGemini');
    try {
      const res = await apiPost('/api/ai/diagnose', { description: desc, device_id: deviceSel.value || null });
      aiText.textContent = res.suggestion;
    } catch(e) { aiText.textContent = t('couldNotGetSuggestions'); }
  }, 1200));
}
```

Also update the form submit handler to save AI suggestions. In the submit handler, after `const res = await apiForm('/api/issues', fd);` and before `toast(t('issueSubmittedSuccessfully'), 'success');`, add:

```javascript
// Save AI suggestion in issue
if (canAI && aiText.textContent.length > 10 && aiText.textContent !== t('analyzingWithGemini')) {
  await apiPatch(`/api/issues/${res.issue.id}/ai`, { ai_suggestions: aiText.textContent });
}
```

Ensure `ai_suggestions` is displayed in the issue detail modal. In the `openDetail` function, add after the resolution notes block:

```javascript
${i.ai_suggestions ? `<div style="margin-bottom:1rem"><label class="form-label"><i class="fas fa-robot" style="color:var(--primary)"></i> <span data-i18n="aiSuggestions">AI Suggestions</span></label><div style="background:#eff6ff;padding:.75rem;border-radius:8px;border:1px solid #bfdbfe;line-height:1.7;white-space:pre-wrap">${i.ai_suggestions}</div></div>` : ''}
```

- [ ] **Step 3: Verify auto-fetch works**

1. Open `http://localhost:3000/issues.html` as admin/technician
2. Select a device and type "screen not working" in the description
3. Wait 1.2 seconds — the AI box should appear with "Analyzing..."
4. After the API response, suggestions should appear in the box

- [ ] **Step 4: Commit**

```bash
git add public/issues.html
git commit -m "feat: add AI suggestion auto-fetch on issue form with debounce"
```

---

### Task 7: Implement Provider Switching via Environment Configuration

**Files:**
- Modify: `.env`
- Modify: `.env.example`
- Test: `tests/setup.js`

- [ ] **Step 1: Add AI provider selection to `.env`**

Ensure `.env` contains:

```bash
# ── AI Provider Selection ────────────────────────────────────
AI_PROVIDER=openrouter

# ── AI Diagnostics (OpenRouter) ───────────────────────────────
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=meta-llama/llama-3.2-3b-instruct:free
OPENROUTER_URL=https://openrouter.ai/api/v1/chat/completions

# ── AI Diagnostics (Ollama — local, for demo) ─────────────────
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
```

- [ ] **Step 2: Verify switching works**

Test OpenRouter (default):
```bash
node -e "const { getAIService } = require('./services/ai_factory'); const svc = getAIService(); console.log('Provider:', svc === require('./services/openrouter') ? 'openrouter' : 'ollama')"
```

Expected:
```
Provider: openrouter
```

Test Ollama switch:
```bash
AI_PROVIDER=ollama node -e "const { getAIService } = require('./services/ai_factory'); const svc = getAIService(); console.log('Provider:', svc === require('./services/ollama') ? 'ollama' : 'openrouter')"
```

Expected:
```
Provider: ollama
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected:
```
PASS  tests/ai.test.js
  AI Diagnosis Routes
    POST /api/ai/diagnose
      ✓ should return AI suggestion with device context
      ✓ should work without device_id
      ✓ should reject short description (< 5 chars)
      ✓ should reject missing description
      ✓ should reject unauthenticated request
```

- [ ] **Step 4: Commit**

```bash
git add .env .env.example tests/setup.js
git commit -m "feat: implement AI provider switching via environment configuration"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ AI Provider Factory — Task 1
- ✅ OpenRouter provider — Task 2
- ✅ Ollama provider — Task 3
- ✅ Context-aware prompts — Task 4 (device type + history enrichment)
- ✅ AI chat page — Task 5
- ✅ AI suggestion auto-fetch — Task 6
- ✅ Provider switching — Task 7

**2. Placeholder scan:** No TBD, TODO, or placeholders found. All code blocks are complete.

**3. Type consistency:**
- `diagnose()` signature consistent across `openrouter.js`, `ollama.js`, and `ai.js`: `diagnose(description, deviceType, issueHistory)`
- Factory returns object with `diagnose` method in all cases
- Route validates `description.trim().length < 5` consistently

**Plan complete and saved to `.opencode/plans/2026-06-03-smartlab-ai-diagnostics-plan.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
