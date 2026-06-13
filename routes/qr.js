/**
 * @swagger
 * tags:
 *   name: QR
 *   description: QR code access to devices
 */

const express = require('express');
const db      = require('../db/database');

const router = express.Router();

/**
 * @swagger
 * /qr/{token}:
 *   get:
 *     summary: Redirect to device page via QR token
 *     tags: [QR]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       302: { description: Redirects to device page }
 *       404: { description: Invalid token }
 */
// GET /qr/:token — Open device page via QR code (no login required)
router.get('/:token', (req, res) => {
  const device = db.prepare('SELECT id FROM devices WHERE qr_token = ?').get(req.params.token);
  if (!device) return res.status(404).send('Invalid or expired token');
  res.redirect(`/device.html?token=${req.params.token}`);
});

/**
 * @swagger
 * /api/qr/{token}/data:
 *   get:
 *     summary: Get device data via QR token
 *     tags: [QR]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Device data with issues }
 *       404: { description: Device not found }
 */
// GET /api/qr/:token/data — Device data via token (for device.html)
router.get('/:token/data', (req, res) => {
  const device = db.prepare('SELECT * FROM devices WHERE qr_token = ?').get(req.params.token);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const issues = db.prepare(`
    SELECT i.id, i.issue_type, i.description, i.status, i.priority, i.created_at
    FROM issues i
    WHERE i.device_id = ?
    ORDER BY i.created_at DESC
    LIMIT 10
  `).all(device.id);

  res.json({ device, issues });
});

module.exports = router;
