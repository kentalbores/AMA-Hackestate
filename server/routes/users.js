const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db/database');


const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};


router.get('/me', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, email, name FROM users WHERE id = ?');
    const user = stmt.get(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, email, name FROM users');
    const users = stmt.all();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const user = stmt.get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching user' });
  }
});

router.post('/', (req, res) => {
  const { name, email } = req.body;
  try {
    const stmt = db.prepare(`
      INSERT INTO users (name, email)
      VALUES (?, ?)
    `);
    const result = stmt.run(name, email);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
});

router.put('/:id', (req, res) => {
  const { name, email } = req.body;
  try {
    const stmt = db.prepare(`
      UPDATE users
      SET name = ?, email = ?
      WHERE id = ?
    `);
    const result = stmt.run(name, email, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
