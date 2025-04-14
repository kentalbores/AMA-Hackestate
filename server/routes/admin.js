const express = require('express');
const router = express.Router();
const db = require('../db/database');
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

// Get admin dashboard stats
router.get('/dashboard', authenticateToken, isAdmin, (req, res) => {
  try {
    // Get total users count
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    
    // Get total agents count
    const totalAgents = db.prepare('SELECT COUNT(*) as count FROM agents').get().count;
    
    // Get total buyers count
    const totalBuyers = db.prepare('SELECT COUNT(*) as count FROM buyers').get().count;
    
    // Get total properties count
    const totalProperties = db.prepare('SELECT COUNT(*) as count FROM properties').get().count;
    
    // Get total contracts count
    const totalContracts = db.prepare('SELECT COUNT(*) as count FROM contracts').get().count;
    
    // Get pending verifications
    const pendingAgentVerifications = db.prepare('SELECT COUNT(*) as count FROM agents WHERE is_verified = ?').get('false').count;
    const pendingBuyerVerifications = db.prepare('SELECT COUNT(*) as count FROM buyers WHERE is_verified = ?').get('false').count;
    
    res.json({
      totalUsers,
      totalAgents,
      totalBuyers,
      totalProperties,
      totalContracts,
      pendingAgentVerifications,
      pendingBuyerVerifications
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all pending agent verifications
router.get('/pending-agents', authenticateToken, isAdmin, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT a.id, a.is_verified, u.name, u.email, u.phone_number
      FROM agents a
      JOIN users u ON a.users_id = u.id
      WHERE a.is_verified = ?
    `);
    const pendingAgents = stmt.all('false');
    res.json(pendingAgents);
  } catch (error) {
    console.error('Error fetching pending agents:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all pending buyer verifications
router.get('/pending-buyers', authenticateToken, isAdmin, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT b.id, b.is_verified, u.name, u.email, u.phone_number
      FROM buyers b
      JOIN users u ON b.users_id = u.id
      WHERE b.is_verified = ?
    `);
    const pendingBuyers = stmt.all('false');
    res.json(pendingBuyers);
  } catch (error) {
    console.error('Error fetching pending buyers:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify agent
router.put('/verify-agent/:id', authenticateToken, isAdmin, (req, res) => {
  try {
    const agentId = req.params.id;
    
    // Check if agent exists
    const agent = db.prepare('SELECT id FROM agents WHERE id = ?').get(agentId);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Update agent verification status
    db.prepare('UPDATE agents SET is_verified = ? WHERE id = ?').run('true', agentId);
    
    res.json({ message: 'Agent verified successfully' });
  } catch (error) {
    console.error('Error verifying agent:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify buyer
router.put('/verify-buyer/:id', authenticateToken, isAdmin, (req, res) => {
  try {
    const buyerId = req.params.id;
    
    // Check if buyer exists
    const buyer = db.prepare('SELECT id FROM buyers WHERE id = ?').get(buyerId);
    
    if (!buyer) {
      return res.status(404).json({ error: 'Buyer not found' });
    }
    
    // Update buyer verification status
    db.prepare('UPDATE buyers SET is_verified = ? WHERE id = ?').run('true', buyerId);
    
    res.json({ message: 'Buyer verified successfully' });
  } catch (error) {
    console.error('Error verifying buyer:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify property
router.put('/verify-property/:id', authenticateToken, isAdmin, (req, res) => {
  try {
    const propertyId = req.params.id;
    
    // Check if property exists
    const property = db.prepare('SELECT id FROM properties WHERE id = ?').get(propertyId);
    
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    // Update property verification status
    db.prepare('UPDATE properties SET is_verified = ? WHERE id = ?').run('true', propertyId);
    
    res.json({ message: 'Property verified successfully' });
  } catch (error) {
    console.error('Error verifying property:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all files
router.get('/files', authenticateToken, isAdmin, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT f.*, u.name as user_name, u.role as user_role
      FROM files f
      JOIN users u ON f.user_id = u.id
    `);
    const files = stmt.all();
    res.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all pending property verifications
router.get('/pending-properties', authenticateToken, isAdmin, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT p.id, p.title, p.price, p.location, p.is_verified, a.id as agent_id, u.name as agent_name
      FROM properties p
      JOIN agents a ON p.agents_id = a.id
      JOIN users u ON a.users_id = u.id
      WHERE p.is_verified = ?
    `);
    const pendingProperties = stmt.all('false');
    res.json(pendingProperties);
  } catch (error) {
    console.error('Error fetching pending properties:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 