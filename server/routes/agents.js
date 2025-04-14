const express = require('express');
const router = express.Router();
const db = require('../db/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

// Get all agents (admin only)
router.get('/', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT a.id, a.is_verified, u.name, u.email, u.phone_number
      FROM agents a
      JOIN users u ON a.users_id = u.id
    `);
    const agents = stmt.all();
    res.json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get agent by ID
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT a.id, a.is_verified, u.name, u.email, u.phone_number
      FROM agents a
      JOIN users u ON a.users_id = u.id
      WHERE a.id = ?
    `);
    const agent = stmt.get(req.params.id);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    res.json(agent);
  } catch (error) {
    console.error('Error fetching agent:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get agent's properties
router.get('/:id/properties', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT p.*
      FROM properties p
      WHERE p.agents_id = ?
    `);
    const properties = stmt.all(req.params.id);
    res.json(properties);
  } catch (error) {
    console.error('Error fetching agent properties:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get agent's contracts
router.get('/:id/contracts', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT c.*, p.title as property_title, u.name as buyer_name
      FROM contracts c
      JOIN properties p ON c.property_id = p.id
      JOIN buyers b ON c.buyer_id = b.id
      JOIN users u ON b.users_id = u.id
      WHERE c.agents_id = ?
    `);
    const contracts = stmt.all(req.params.id);
    res.json(contracts);
  } catch (error) {
    console.error('Error fetching agent contracts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get agent profile (for logged-in agent)
router.get('/profile', authenticateToken, isAgent, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT a.id, a.is_verified, u.name, u.email, u.phone_number
      FROM agents a
      JOIN users u ON a.users_id = u.id
      WHERE a.users_id = ?
    `);
    const agent = stmt.get(req.user.userId);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent profile not found' });
    }
    
    res.json(agent);
  } catch (error) {
    console.error('Error fetching agent profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update agent profile (for logged-in agent)
router.put('/profile', authenticateToken, isAgent, (req, res) => {
  const { name, email, phone_number } = req.body;
  
  try {
    const stmt = db.prepare(`
      UPDATE users
      SET name = ?, email = ?, phone_number = ?
      WHERE id = ?
    `);
    const result = stmt.run(name, email, phone_number, req.user.userId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Agent profile not found' });
    }
    
    res.json({ message: 'Agent profile updated successfully' });
  } catch (error) {
    console.error('Error updating agent profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload agent documents
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'server/uploads/agents';
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

router.post('/upload-document', authenticateToken, isAgent, upload.single('document'), (req, res) => {
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