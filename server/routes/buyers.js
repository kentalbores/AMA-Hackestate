const express = require('express');
const router = express.Router();
const db = require('../db/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

// Middleware to check if user is authenticated
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

// Get all buyers (admin only)
router.get('/', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT b.id, b.is_verified, u.name, u.email, u.phone_number
      FROM buyers b
      JOIN users u ON b.users_id = u.id
    `);
    const buyers = stmt.all();
    res.json(buyers);
  } catch (error) {
    console.error('Error fetching buyers:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get buyer by ID
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT b.id, b.is_verified, u.name, u.email, u.phone_number
      FROM buyers b
      JOIN users u ON b.users_id = u.id
      WHERE b.id = ?
    `);
    const buyer = stmt.get(req.params.id);
    
    if (!buyer) {
      return res.status(404).json({ error: 'Buyer not found' });
    }
    
    res.json(buyer);
  } catch (error) {
    console.error('Error fetching buyer:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get buyer's contracts
router.get('/:id/contracts', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT c.*, p.title as property_title, u.name as agent_name
      FROM contracts c
      JOIN properties p ON c.property_id = p.id
      JOIN agents a ON c.agents_id = a.id
      JOIN users u ON a.users_id = u.id
      WHERE c.buyer_id = ?
    `);
    const contracts = stmt.all(req.params.id);
    res.json(contracts);
  } catch (error) {
    console.error('Error fetching buyer contracts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get buyer profile (for logged-in buyer)
router.get('/profile', authenticateToken, isBuyer, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT b.id, b.is_verified, u.name, u.email, u.phone_number
      FROM buyers b
      JOIN users u ON b.users_id = u.id
      WHERE b.users_id = ?
    `);
    const buyer = stmt.get(req.user.userId);
    
    if (!buyer) {
      return res.status(404).json({ error: 'Buyer profile not found' });
    }
    
    res.json(buyer);
  } catch (error) {
    console.error('Error fetching buyer profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update buyer profile (for logged-in buyer)
router.put('/profile', authenticateToken, isBuyer, (req, res) => {
  const { name, email, phone_number } = req.body;
  
  try {
    const stmt = db.prepare(`
      UPDATE users
      SET name = ?, email = ?, phone_number = ?
      WHERE id = ?
    `);
    const result = stmt.run(name, email, phone_number, req.user.userId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Buyer profile not found' });
    }
    
    res.json({ message: 'Buyer profile updated successfully' });
  } catch (error) {
    console.error('Error updating buyer profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload buyer documents
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'server/uploads/buyers';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

router.post('/upload-document', authenticateToken, isBuyer, upload.single('document'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    
    // Save file reference in the database
    const stmt = db.prepare(`
      INSERT INTO files (user_id, file_url)
      VALUES (?, ?)
    `);
    const result = stmt.run(req.user.userId, filePath);
    
    res.status(201).json({ 
      message: 'Document uploaded successfully',
      fileId: result.lastInsertRowid,
      filePath: filePath
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 