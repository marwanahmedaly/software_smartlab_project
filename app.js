const express = require('express');
const cors    = require('cors');
const path    = require('path');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app  = express();

// ── Swagger Setup ───────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Smart Lab API',
      version: '1.0.0',
      description: 'Computer Lab Management & Maintenance System API',
    },
    servers: [{ url: '/api/v1' }],
  },
  apis: ['./routes/*.js'],
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ── Rate Limiting ───────────────────────────────────────────
const isTest = process.env.NODE_ENV === 'test';
const authLimiter = isTest ? (req, res, next) => next() : rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, message: { error: 'Too many requests, please try again later' } });
const aiLimiter = isTest ? (req, res, next) => next() : rateLimit({ windowMs: 60 * 1000, max: 5, message: { error: 'Too many AI requests, please slow down' } });

// ── Static Files (Frontend) ────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Documentation ───────────────────────────────────────
app.get('/api/docs.json', (req, res) => { res.json(swaggerSpec); });
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── API v1 Routes ───────────────────────────────────────────
app.use('/api/v1/auth',        authLimiter, require('./routes/auth'));
app.use('/api/v1/devices',     require('./routes/devices'));
app.use('/api/v1/issues',      require('./routes/issues'));
app.use('/api/v1/alerts',      require('./routes/alerts'));
app.use('/api/v1/reports',     require('./routes/reports'));
app.use('/api/v1/ai',          aiLimiter, require('./routes/ai'));
app.use('/api/v1/users',       require('./routes/users'));
app.use('/api/v1/export',      require('./routes/export'));
app.use('/api/v1/inventory',   require('./routes/inventory'));
app.use('/api/v1/search',      require('./routes/search'));
app.use('/api/v1/calendar',    require('./routes/calendar'));
app.use('/qr',                 require('./routes/qr'));

// ── Backward Compatibility (legacy /api/* routes) ─────────────
app.use('/api/auth',        authLimiter, require('./routes/auth'));
app.use('/api/devices',     require('./routes/devices'));
app.use('/api/issues',      require('./routes/issues'));
app.use('/api/alerts',      require('./routes/alerts'));
app.use('/api/reports',     require('./routes/reports'));
app.use('/api/ai',          aiLimiter, require('./routes/ai'));
app.use('/api/users',       require('./routes/users'));
app.use('/api/export',      require('./routes/export'));
app.use('/api/inventory',   require('./routes/inventory'));
app.use('/api/search',      require('./routes/search'));
app.use('/api/calendar',    require('./routes/calendar'));

// ── Health Check ────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', version: '1.0.0' });
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
