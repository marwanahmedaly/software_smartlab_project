/**
 * @swagger
 * tags:
 *   name: Inventory
 *   description: Spare parts and inventory management
 */

const express = require('express');
const db = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();

/**
 * @swagger
 * /api/v1/inventory:
 *   get:
 *     summary: List inventory parts
 *     tags: [Inventory]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: low_stock
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Paginated list of parts }
 *       403: { description: Forbidden }
 */
// GET /api/inventory — List parts
router.get('/', authenticate, authorize('admin', 'technician'), (req, res) => {
  const { category, low_stock, page = 1, limit = 10 } = req.query;
  let where = '1=1';
  const params = [];
  if (category) { where += ' AND category = ?'; params.push(category); }
  if (low_stock === '1') { where += ' AND quantity <= min_stock'; }

  const total = db.prepare(`SELECT COUNT(*) as c FROM inventory_parts WHERE ${where}`).get(...params).c;
  const parts = db.prepare(`
    SELECT * FROM inventory_parts WHERE ${where}
    ORDER BY quantity ASC, name ASC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), (Number(page) - 1) * Number(limit));

  res.json({ parts, total, page: Number(page), limit: Number(limit) });
});

// GET /api/inventory/:id — Part details
router.get('/:id', authenticate, authorize('admin', 'technician'), (req, res) => {
  const part = db.prepare('SELECT * FROM inventory_parts WHERE id = ?').get(req.params.id);
  if (!part) return res.status(404).json({ error: 'Part not found' });
  res.json({ part });
});

/**
 * @swagger
 * /api/v1/inventory:
 *   post:
 *     summary: Add a new part
 *     tags: [Inventory]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, category]
 *             properties:
 *               name: { type: string }
 *               category: { type: string }
 *               quantity: { type: integer }
 *               min_stock: { type: integer }
 *               unit_cost: { type: number }
 *               supplier: { type: string }
 *               location: { type: string }
 *               notes: { type: string }
 *     responses:
 *       201: { description: Part created }
 *       400: { description: Validation error }
 *       403: { description: Forbidden }
 */
// POST /api/inventory — Add part
router.post('/', authenticate, authorize('admin'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { name, category, quantity, min_stock, unit_cost, supplier, location, notes } = req.body;
    const info = db.prepare(`
      INSERT INTO inventory_parts (name, category, quantity, min_stock, unit_cost, supplier, location, notes)
      VALUES (@name, @category, @quantity, @min_stock, @unit_cost, @supplier, @location, @notes)
    `).run({
      name, category, quantity: Number(quantity), min_stock: Number(min_stock) || 5,
      unit_cost: unit_cost || 0, supplier: supplier || null, location: location || null, notes: notes || null,
    });
    const part = db.prepare('SELECT * FROM inventory_parts WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ part });
  }
);

// PUT /api/inventory/:id — Update part
router.put('/:id', authenticate, authorize('admin'),
  param('id').isInt(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const part = db.prepare('SELECT * FROM inventory_parts WHERE id = ?').get(req.params.id);
    if (!part) return res.status(404).json({ error: 'Part not found' });

    const { name, category, quantity, min_stock, unit_cost, supplier, location, notes } = req.body;
    db.prepare(`
      UPDATE inventory_parts SET
        name=@name, category=@category, quantity=@quantity, min_stock=@min_stock,
        unit_cost=@unit_cost, supplier=@supplier, location=@location, notes=@notes
      WHERE id=@id
    `).run({
      name: name || part.name, category: category || part.category,
      quantity: quantity !== undefined ? Number(quantity) : part.quantity,
      min_stock: min_stock !== undefined ? Number(min_stock) : part.min_stock,
      unit_cost: unit_cost !== undefined ? unit_cost : part.unit_cost,
      supplier: supplier ?? part.supplier, location: location ?? part.location, notes: notes ?? part.notes,
      id: req.params.id,
    });
    res.json({ part: db.prepare('SELECT * FROM inventory_parts WHERE id = ?').get(req.params.id) });
  }
);

// DELETE /api/inventory/:id
router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  const part = db.prepare('SELECT id FROM inventory_parts WHERE id = ?').get(req.params.id);
  if (!part) return res.status(404).json({ error: 'Part not found' });
  db.prepare('DELETE FROM inventory_parts WHERE id = ?').run(req.params.id);
  res.json({ message: 'Part deleted' });
});

/**
 * @swagger
 * /api/v1/inventory/meta/categories:
 *   get:
 *     summary: List distinct inventory categories
 *     tags: [Inventory]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: Array of categories }
 */
// GET /api/inventory/categories — List distinct categories
router.get('/meta/categories', authenticate, authorize('admin', 'technician'), (_req, res) => {
  const rows = db.prepare('SELECT DISTINCT category FROM inventory_parts ORDER BY category').all();
  res.json({ categories: rows.map(r => r.category) });
});

module.exports = router;