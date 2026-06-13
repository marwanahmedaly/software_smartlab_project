/**
 * @swagger
 * tags:
 *   name: AI
 *   description: AI-powered diagnostics (Ollama local only)
 */

const express   = require('express');
const db        = require('../db/database');
const { getAIService } = require('../services/ai_factory');
const { checkHealth } = require('../services/ollama');
const { authenticate, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

/**
 * @swagger
 * /api/v1/ai/diagnose:
 *   post:
 *     summary: AI fault diagnosis via local Ollama
 *     tags: [AI]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description: { type: string, minLength: 5 }
 *               device_id: { type: integer }
 *     responses:
 *       200: { description: AI suggestion text }
 *       400: { description: Validation error }
 *       502: { description: Ollama not running or model not available }
 */
// POST /api/ai/diagnose — AI fault diagnosis (all roles)
router.post('/diagnose', authenticate,
  body('description').trim().isLength({ min: 5 }).withMessage('Please enter a clearer fault description (at least 5 characters)'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { description, device_id } = req.body;
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
      const { diagnose } = getAIService();
      const suggestion = await diagnose(description.trim(), deviceType, issueHistory);
      res.json({ suggestion });
    } catch (err) {
      console.error('AI Diagnostics Error:', err.message);
      res.status(502).json({ error: err.message || 'Failed to connect to AI service, please try again' });
    }
  }
);

/**
 * @swagger
 * /api/v1/ai/health:
 *   get:
 *     summary: Check Ollama local AI health
 *     tags: [AI]
 *     responses:
 *       200: { description: Ollama is running and model is available }
 *       502: { description: Ollama not running or model not pulled }
 */
router.get('/health', async (_req, res) => {
  try {
    const health = await checkHealth();
    if (health.ok) {
      res.json({ status: 'ok', provider: 'ollama', model: health.model });
    } else {
      res.status(502).json({ status: 'error', error: health.error });
    }
  } catch (err) {
    res.status(502).json({ status: 'error', error: err.message });
  }
});

module.exports = router;
