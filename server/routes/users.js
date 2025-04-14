const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const bcrypt = require('bcrypt');


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

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.userId);
    if (user && user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ message: 'Admin access required' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Middleware to check if user is agent
const isAgent = async (req, res, next) => {
  try {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.userId);
    if (user && user.role === 'agent') {
      next();
    } else {
      res.status(403).json({ message: 'Agent access required' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Middleware to check if user is buyer
const isBuyer = async (req, res, next) => {
  try {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.userId);
    if (user && user.role === 'buyer') {
      next();
    } else {
      res.status(403).json({ message: 'Buyer access required' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

router.get('/me', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, email, name, phone_number, role FROM users WHERE id = ?');
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

// Get all users (admin only)
router.get('/', authenticateToken, isAdmin, (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, email, name, phone_number, role FROM users');
    const users = stmt.all();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user by ID (admin only)
router.get('/:id', authenticateToken, isAdmin, (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, email, name, phone_number, role FROM users WHERE id = ?');
    const user = stmt.get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching user' });
  }
});

// Register a new user
router.post('/', async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
    // Check if user exists
    const checkStmt = db.prepare('SELECT email FROM users WHERE email = ?');
    const existingUser = checkStmt.get(email);

    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    
    // Hash the password with a salt round of 10
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const stmt = db.prepare(`
      INSERT INTO users (name, email, password)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(name, email, hashedPassword);
    
    // Return user info without password
    res.status(201).json({ 
      id: result.lastInsertRowid,
      name,
      email
    });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Find user by email
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Return user info and token
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone_number: user.phone_number,
      role: user.role,
      token
    });
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// Update user (admin only)
router.put('/:id', authenticateToken, isAdmin, (req, res) => {
  const { name, email, phone_number, role } = req.body;
  try {
    const stmt = db.prepare(`
      UPDATE users
      SET name = ?, email = ?, phone_number = ?, role = ?
      WHERE id = ?
    `);
    const result = stmt.run(name, email, phone_number, role, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, isAdmin, (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Verify agent (admin only)
router.put('/agent/:id/verify', authenticateToken, isAdmin, (req, res) => {
  try {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id);
    
    if (!user || user.role !== 'agent') {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    const agent = db.prepare('SELECT id FROM agents WHERE users_id = ?').get(req.params.id);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent record not found' });
    }
    
    db.prepare('UPDATE agents SET is_verified = ? WHERE users_id = ?').run('true', req.params.id);
    
    res.json({ message: 'Agent verified successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify agent' });
  }
});

// Verify buyer (admin only)
router.put('/buyer/:id/verify', authenticateToken, isAdmin, (req, res) => {
  try {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id);
    
    if (!user || user.role !== 'buyer') {
      return res.status(404).json({ error: 'Buyer not found' });
    }
    
    const buyer = db.prepare('SELECT id FROM buyers WHERE users_id = ?').get(req.params.id);
    
    if (!buyer) {
      return res.status(404).json({ error: 'Buyer record not found' });
    }
    
    db.prepare('UPDATE buyers SET is_verified = ? WHERE users_id = ?').run('true', req.params.id);
    
    res.json({ message: 'Buyer verified successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify buyer' });
  }
});

module.exports = router;
