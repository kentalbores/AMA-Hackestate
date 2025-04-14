const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticateToken = require('../middleware/auth');

// Get user's notifications
router.get('/', authenticateToken, (req, res) => {
  const notifications = db.prepare(`
    SELECT * FROM notifications 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `).all(req.user.userId);
  res.json(notifications);
});

// Mark notifications as read
router.post('/mark-read', authenticateToken, (req, res) => {
  db.prepare(`
    UPDATE notifications 
    SET is_read = TRUE 
    WHERE user_id = ? AND is_read = FALSE
  `).run(req.user.userId);
  res.json({ message: 'Notifications marked as read' });
});

module.exports = router;