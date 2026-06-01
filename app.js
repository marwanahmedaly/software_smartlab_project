const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static Files (Frontend) ────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/devices',     require('./routes/devices'));
app.use('/api/issues',      require('./routes/issues'));
app.use('/api/alerts',      require('./routes/alerts'));
app.use('/api/reports',     require('./routes/reports'));
app.use('/api/ai',          require('./routes/ai'));
app.use('/api/users',       require('./routes/users'));
app.use('/qr',              require('./routes/qr'));

// ── Health Check ────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ── Catch-all: Redirect to frontend (SPA-like) ──────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/qr')) {
    return res.status(404).json({ error: 'Route not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Global Error Handler ────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
