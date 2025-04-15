const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticateToken = require('../middleware/auth');

// Helper function to ensure consistent date formatting
const getFormattedDate = () => {
  // Create a date with Philippines timezone offset (+8 hours)
  const now = new Date();
  // Adjust for PHP timezone (UTC+8)
  now.setTime(now.getTime() + (8 * 60 * 60 * 1000));
  return now.toISOString();
};

// Helper function to format SQLite date to standard ISO format
const formatSQLiteDate = (sqliteDate) => {
  if (!sqliteDate) return null;
  try {
    // Create a new Date object from the SQLite date string
    const date = new Date(sqliteDate);
    // Return ISO string if valid, otherwise return original
    return !isNaN(date.getTime()) ? date.toISOString() : sqliteDate;
  } catch (error) {
    console.error('Error formatting SQLite date:', error);
    return sqliteDate;
  }
};

// Get user's notifications
router.get('/', authenticateToken, (req, res) => {
  const notifications = db.prepare(`
    SELECT * FROM notifications 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `).all(req.user.userId);
  
  // Ensure consistent timestamp format
  const formattedNotifications = notifications.map(notification => {
    try {
      notification.created_at = formatSQLiteDate(notification.created_at);
    } catch (error) {
      console.error('Error formatting notification timestamp:', error);
    }
    return notification;
  });
  
  res.json(formattedNotifications);
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
    
    // Use the helper function for consistent date formatting
    const now = getFormattedDate();
    
    const stmt = db.prepare(`
      INSERT INTO notifications (user_id, type, message, related_id, is_read, created_at)
      VALUES (?, ?, ?, ?, FALSE, ?)
    `);
    
    const result = stmt.run(recipient_id, type, message, related_id || null, now);
    
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