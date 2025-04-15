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

// Create a new notification
router.post('/', authenticateToken, (req, res) => {
  try {
    const { recipient_id, type, message, related_id } = req.body;
    
    if (!recipient_id || !type || !message) {
      return res.status(400).json({ error: 'Recipient ID, type, and message are required' });
    }
    
    const stmt = db.prepare(`
      INSERT INTO notifications (user_id, type, message, related_id, is_read, created_at)
      VALUES (?, ?, ?, ?, FALSE, datetime('now'))
    `);
    
    const result = stmt.run(recipient_id, type, message, related_id || null);
    
    res.status(201).json({ 
      id: result.lastInsertRowid,
      message: 'Notification created successfully' 
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// Get unread notification count
router.get('/unread-count', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM notifications 
      WHERE user_id = ? AND is_read = FALSE
    `);
    
    const result = stmt.get(req.user.userId);
    res.json({ count: result.count });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ error: 'Failed to get unread notification count' });
  }
});

module.exports = router;