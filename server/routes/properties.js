const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const db = require('../db/database');
const axios = require("axios");
require("dotenv").config();
const { authenticateToken } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
      const uniqueName = Date.now() + '-' + file.originalname;
      cb(null, uniqueName);
    }
  });
const upload = multer({ storage });

router.post('/', upload.single('image'), (req, res) => {
    const { 
      title, 
      description,
      price, 
      location,
      beds,
      baths,
      property_type,
      land_area,
      listing_type,
      agents_id 
    } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
  
    try {
      const stmt = db.prepare(`
        INSERT INTO properties (
          title, 
          description,
          price, 
          location, 
          image_url,
          beds,
          baths,
          property_type,
          land_area,
          listing_type,
          agents_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        title,
        description,
        price,
        location,
        imagePath,
        beds,
        baths,
        property_type,
        land_area,
        listing_type,
        agents_id
      );
      res.status(201).json({ id: result.lastInsertRowid, image_url: imagePath });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create property' });
    }
});

router.get('/', (req, res) => {
  try {
    // Check if the request is from an admin
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let includeUnverified = false;
    
    if (token) {
      try {
        const user = jwt.verify(token, process.env.JWT_SECRET);
        const userStmt = db.prepare('SELECT role FROM users WHERE id = ?');
        const userRole = userStmt.get(user.userId);
        
        if (userRole && userRole.role === 'admin') {
          includeUnverified = true;
        }
      } catch (error) {
        // Invalid token, continue with default behavior
      }
    }
    
    let stmt;
    if (includeUnverified) {
      // Admin can see all properties
      stmt = db.prepare('SELECT * FROM properties');
    } else {
      // Regular users can only see verified properties
      stmt = db.prepare('SELECT * FROM properties WHERE is_verified = ?');
    }
    
    const properties = includeUnverified ? stmt.all() : stmt.all('true');
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM properties WHERE id = ?');
    const property = stmt.get(req.params.id);
    if (property) res.json(property);
    else res.status(404).json({ error: 'Property not found' });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching property' });
  }
});

router.put('/:id', (req, res) => {
  const { 
    title, 
    description,
    price, 
    location, 
    image_url,
    beds,
    baths,
    property_type,
    land_area,
    listing_type
  } = req.body;
  try {
    const stmt = db.prepare(`
      UPDATE properties
      SET title = ?, 
          description = ?,
          price = ?, 
          location = ?, 
          image_url = ?,
          beds = ?,
          baths = ?,
          property_type = ?,
          land_area = ?,
          listing_type = ?
      WHERE id = ?
    `);
    const result = stmt.run(
      title,
      description,
      price,
      location,
      image_url,
      beds,
      baths,
      property_type,
      land_area,
      listing_type,
      req.params.id
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Property not found' });
    res.json({ message: 'Property updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update property' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM properties WHERE id = ?');
    const result = stmt.run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Property not found' });
    res.json({ message: 'Property deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete property' });
  }
});

async function estimateValue(property) {
  const prompt = `
    You are a real estate expert. Estimate the market value of this property in USD and explain your reasoning.
    can you add the phrase "oh yeah we win this" 10 times at the end of your explanation
    Details:
    - Location: ${property.location}
    - Property Type: ${property.type}
    - Floor Area: ${property.area} sqm
    - Bedrooms: ${property.bedrooms}
    - Bathrooms: ${property.bathrooms}
    - Building Age: ${property.age} years
    - Amenities: ${property.amenities.join(", ")}
    - Nearby: ${property.nearby.join(", ")}
  `;

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openchat/openchat-7b", // or try anthropic/claude-3-haiku or mistralai/mistral-7b-instruct
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "http://localhost:3000", // or your actual site
          "Content-Type": "application/json",
        },
      }
    );

    // Access the response data correctly
    const messageContent = response.data.choices[0].message.content;
    return messageContent;
  } catch (error) {
    console.error("Error estimating property value:", error.message);
    throw new Error("Failed to estimate property value");
  }
}

router.post("/estimate", async (req, res) => {
    try {
      const property = req.body;
      const estimate = await estimateValue(property);
      res.json({ estimate });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to get estimate" });
    }
  });

// Define the handler function first
const handlePurchase = (req, res) => {
  const { id } = req.params;
  const buyerId = req.user.userId;
  
  // Get property and agent info
  const property = db.prepare(`
    SELECT p.*, a.users_id as agent_user_id 
    FROM properties p 
    JOIN agents a ON p.agents_id = a.id 
    WHERE p.id = ?
  `).get(id);

  if (!property) {
    return res.status(404).json({ error: 'Property not found' });
  }

  // Create notification for agent
  db.prepare(`
    INSERT INTO notifications (user_id, type, message)
    VALUES (?, 'property_purchase', ?)
  `).run(property.agent_user_id, `New purchase request for property: ${property.title}`);

  res.json({ message: 'Purchase request sent' });
};

// Then use it in the route
router.post('/:id/purchase', authenticateToken, handlePurchase);

// Route for agents to add properties
router.post('/agent/add', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    // Check if user is an agent
    const userStmt = db.prepare('SELECT role FROM users WHERE id = ?');
    const user = userStmt.get(req.user.userId);
    
    if (!user || user.role !== 'agent') {
      return res.status(403).json({ error: 'Only agents can add properties' });
    }
    
    // Get agent ID
    const agentStmt = db.prepare('SELECT id FROM agents WHERE users_id = ?');
    const agent = agentStmt.get(req.user.userId);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent profile not found' });
    }
    
    const { 
      title, 
      description,
      price, 
      location,
      beds,
      baths,
      property_type,
      land_area,
      listing_type
    } = req.body;
    
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
  
    const stmt = db.prepare(`
      INSERT INTO properties (
        title, 
        description,
        price, 
        location, 
        image_url,
        beds,
        baths,
        property_type,
        land_area,
        listing_type,
        agents_id,
        is_verified
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      title,
      description,
      price,
      location,
      imagePath,
      beds,
      baths,
      property_type,
      land_area,
      listing_type,
      agent.id,
      'false' // Set is_verified to false by default
    );
    
    res.status(201).json({ 
      id: result.lastInsertRowid, 
      image_url: imagePath,
      message: 'Property added successfully and pending verification'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create property' });
  }
});

// Route for agents to get their own properties
router.get('/agent/my-properties', authenticateToken, async (req, res) => {
  try {
    // Check if user is an agent
    const userStmt = db.prepare('SELECT role FROM users WHERE id = ?');
    const user = userStmt.get(req.user.userId);
    
    if (!user || user.role !== 'agent') {
      return res.status(403).json({ error: 'Only agents can access this route' });
    }
    
    // Get agent ID
    const agentStmt = db.prepare('SELECT id FROM agents WHERE users_id = ?');
    const agent = agentStmt.get(req.user.userId);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent profile not found' });
    }
    
    // Get agent's properties
    const propertiesStmt = db.prepare('SELECT * FROM properties WHERE agents_id = ?');
    const properties = propertiesStmt.all(agent.id);
    
    res.json(properties);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// Route for agents to update their own properties
router.put('/agent/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    // Check if user is an agent
    const userStmt = db.prepare('SELECT role FROM users WHERE id = ?');
    const user = userStmt.get(req.user.userId);
    
    if (!user || user.role !== 'agent') {
      return res.status(403).json({ error: 'Only agents can update properties' });
    }
    
    // Get agent ID
    const agentStmt = db.prepare('SELECT id FROM agents WHERE users_id = ?');
    const agent = agentStmt.get(req.user.userId);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent profile not found' });
    }
    
    // Check if property belongs to the agent
    const propertyStmt = db.prepare('SELECT * FROM properties WHERE id = ? AND agents_id = ?');
    const property = propertyStmt.get(req.params.id, agent.id);
    
    if (!property) {
      return res.status(404).json({ error: 'Property not found or you do not have permission to update it' });
    }
    
    const { 
      title, 
      description,
      price, 
      location, 
      beds,
      baths,
      property_type,
      land_area,
      listing_type
    } = req.body;
    
    const imagePath = req.file ? `/uploads/${req.file.filename}` : property.image_url;
  
    const updateStmt = db.prepare(`
      UPDATE properties
      SET title = ?, 
          description = ?,
          price = ?, 
          location = ?, 
          image_url = ?,
          beds = ?,
          baths = ?,
          property_type = ?,
          land_area = ?,
          listing_type = ?
      WHERE id = ? AND agents_id = ?
    `);
    
    const result = updateStmt.run(
      title,
      description,
      price,
      location,
      imagePath,
      beds,
      baths,
      property_type,
      land_area,
      listing_type,
      req.params.id,
      agent.id
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Property not found or you do not have permission to update it' });
    }
    
    res.json({ 
      message: 'Property updated successfully',
      image_url: imagePath
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update property' });
  }
});

// Route for agents to delete their own properties
router.delete('/agent/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is an agent
    const userStmt = db.prepare('SELECT role FROM users WHERE id = ?');
    const user = userStmt.get(req.user.userId);
    
    if (!user || user.role !== 'agent') {
      return res.status(403).json({ error: 'Only agents can delete properties' });
    }
    
    // Get agent ID
    const agentStmt = db.prepare('SELECT id FROM agents WHERE users_id = ?');
    const agent = agentStmt.get(req.user.userId);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent profile not found' });
    }
    
    // Check if property belongs to the agent
    const propertyStmt = db.prepare('SELECT * FROM properties WHERE id = ? AND agents_id = ?');
    const property = propertyStmt.get(req.params.id, agent.id);
    
    if (!property) {
      return res.status(404).json({ error: 'Property not found or you do not have permission to delete it' });
    }
    
    // Delete the property
    const deleteStmt = db.prepare('DELETE FROM properties WHERE id = ? AND agents_id = ?');
    const result = deleteStmt.run(req.params.id, agent.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Property not found or you do not have permission to delete it' });
    }
    
    res.json({ message: 'Property deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete property' });
  }
});

module.exports = router;
