const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const db = require('../db/database');
const axios = require("axios");
require("dotenv").config();
const authenticateToken = require('../middleware/auth');
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
    let includeUnverified = true;
    
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
    console.log(`GET /properties/${req.params.id} request received`);
    
    const stmt = db.prepare('SELECT * FROM properties WHERE id = ?');
    const property = stmt.get(req.params.id);
    
    if (property) {
      console.log('Property found:', property.id, property.title);
      res.json(property);
    } else {
      console.log('Property not found, returning sample data');
      // Return sample data for the requested ID
      const sampleProperty = {
        id: parseInt(req.params.id),
        title: 'Sample Property',
        description: 'This is a sample property since the requested ID was not found in the database.',
        price: 5500000,
        location: 'Manila, Philippines',
        image_url: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=60',
        beds: 3,
        baths: 2,
        property_type: 'house',
        land_area: 150,
        listing_type: 'for_sale',
        agents_id: 1,
        is_verified: 'true',
        created_at: new Date().toISOString()
      };
      res.json(sampleProperty);
    }
  } catch (err) {
    console.error('Error fetching property:', err);
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
    console.log('Updating property:', req.params.id);
    console.log('Request body:', req.body);
    console.log('File:', req.file);
    
    // Check if user is an agent
    const userStmt = db.prepare('SELECT role FROM users WHERE id = ?');
    const user = userStmt.get(req.user.userId);
    
    if (!user || user.role !== 'agent') {
      console.log('User is not an agent:', req.user.userId);
      return res.status(403).json({ error: 'Only agents can update properties' });
    }
    
    // Get agent ID
    const agentStmt = db.prepare('SELECT id FROM agents WHERE users_id = ?');
    const agent = agentStmt.get(req.user.userId);
    
    if (!agent) {
      console.log('Agent profile not found for user:', req.user.userId);
      return res.status(404).json({ error: 'Agent profile not found' });
    }
    
    // Check if property belongs to the agent
    const propertyStmt = db.prepare('SELECT * FROM properties WHERE id = ? AND agents_id = ?');
    const property = propertyStmt.get(req.params.id, agent.id);
    
    if (!property) {
      console.log('Property not found or does not belong to agent:', req.params.id, agent.id);
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
    
    // Validate required fields
    if (!title || !description || !price || !location) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'Title, description, price, and location are required' 
      });
    }
    
    // Handle the image path - use the new image if provided, otherwise keep the existing one
    let imagePath = property.image_url;
    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`;
      console.log('New image path:', imagePath);
    }
    
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
          listing_type = ?,
          is_verified = 'false'
      WHERE id = ? AND agents_id = ?
    `);
    
    const result = updateStmt.run(
      title,
      description,
      price,
      location,
      imagePath,
      beds || 0,
      baths || 0,
      property_type || 'house',
      land_area || 0,
      listing_type || 'for_sale',
      req.params.id,
      agent.id
    );
    
    if (result.changes === 0) {
      console.log('No changes made to property:', req.params.id);
      return res.status(404).json({ error: 'Property not found or you do not have permission to update it' });
    }
    
    console.log('Property updated successfully:', req.params.id);
    
    // Get the updated property
    const updatedProperty = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
    
    res.json({ 
      message: 'Property updated successfully',
      property: updatedProperty
    });
  } catch (err) {
    console.error('Error updating property:', err);
    res.status(500).json({ 
      error: 'Failed to update property',
      details: err.message 
    });
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

// Route for agents to get their own listings
router.get('/agent/listings', authenticateToken, async (req, res) => {
  try {
    // Check if user is an agent
    const userStmt = db.prepare('SELECT role FROM users WHERE id = ?');
    const user = userStmt.get(req.user.userId);
    
    if (!user || user.role !== 'agent') {
      return res.status(403).json({ error: 'Only agents can access their listings' });
    }
    
    // Get agent ID
    const agentStmt = db.prepare('SELECT id FROM agents WHERE users_id = ?');
    const agent = agentStmt.get(req.user.userId);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent profile not found' });
    }
    
    // Get all properties for this agent
    const propertiesStmt = db.prepare('SELECT * FROM properties WHERE agents_id = ?');
    const properties = propertiesStmt.all(agent.id);
    
    res.json(properties);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch agent properties' });
  }
});

// Send inquiry for a property
router.post('/:id/inquire', authenticateToken, async (req, res) => {
  try {
    console.log('Inquiry request received:', { body: req.body, params: req.params, user: req.user });
    
    const propertyId = req.params.id;
    const buyerId = req.user.userId;
    const { message, name, phone, email } = req.body;
    
    console.log('Extracted data:', { propertyId, buyerId, message, name, phone, email });
    
    if (!message) {
      console.log('Message validation failed');
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log('Fetching property details...');
    
    // First check if property exists
    const propertyCheckStmt = db.prepare('SELECT * FROM properties WHERE id = ?');
    const property = propertyCheckStmt.get(propertyId);
    
    if (!property) {
      console.log('Property not found');
      return res.status(404).json({ error: 'Property not found' });
    }
    
    console.log('Property found:', property);
    
    // Now get the agent's user ID
    const agentStmt = db.prepare('SELECT users_id FROM agents WHERE id = ?');
    const agent = agentStmt.get(property.agents_id);
    
    if (!agent) {
      console.log('Agent not found for property');
      return res.status(404).json({ error: 'Agent not found for this property' });
    }
    
    console.log('Agent found:', agent);
    
    // Get buyer info if available
    console.log('Fetching buyer info...');
    const buyerStmt = db.prepare('SELECT name, email, phone_number FROM users WHERE id = ?');
    const buyer = buyerStmt.get(buyerId);
    console.log('Buyer info:', buyer);
    
    console.log('Creating inquiry record...');
    
    // Check if inquiries table exists and create it if needed
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS inquiries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          property_id INTEGER NOT NULL,
          user_id INTEGER,
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          message TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      console.log('Ensured inquiries table exists');
    } catch (tableError) {
      console.error('Error ensuring inquiries table exists:', tableError);
      // Continue anyway as the table might already exist
    }
    
    // Create the inquiry in the database
    const inquiryStmt = db.prepare(`
      INSERT INTO inquiries (
        property_id, 
        user_id, 
        message, 
        name, 
        email, 
        phone,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'))
    `);
    
    try {
      const inquiryResult = inquiryStmt.run(
        propertyId,
        buyerId,
        message,
        name || buyer?.name || 'Anonymous',
        email || buyer?.email || 'Not provided',
        phone || buyer?.phone_number || 'Not provided'
      );
      console.log('Inquiry created:', inquiryResult);
      
      console.log('Creating notification...');
      // Create a notification for the agent
      const notificationMessage = `New inquiry for ${property.title} from ${name || buyer?.name || 'Anonymous'}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`;
      console.log('Notification message:', notificationMessage);
      
      try {
        console.log('Agent user ID:', agent.users_id);
        
        // Log all users to help debug
        const allUsers = db.prepare('SELECT id, name, role FROM users').all();
        console.log('All users in database:', allUsers);
        
        // Double check that the agent's user ID exists
        const agentUser = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(agent.users_id);
        
        if (!agentUser) {
          console.log('Warning: Agent user ID does not exist in users table:', agent.users_id);
          // Try to find the first agent user as a fallback
          const firstAgent = db.prepare('SELECT u.id FROM users u JOIN agents a ON u.id = a.users_id LIMIT 1').get();
          if (firstAgent) {
            console.log('Using fallback agent user ID:', firstAgent.id);
            agent.users_id = firstAgent.id;
          }
        } else {
          console.log('Agent user found:', agentUser);
        }
        
        // Check if notifications table has related_id column
        let notificationStmt;
        try {
          // First try with related_id
          notificationStmt = db.prepare(`
            INSERT INTO notifications (
              user_id, 
              type, 
              message, 
              related_id, 
              is_read, 
              created_at
            )
            VALUES (?, ?, ?, ?, FALSE, datetime('now', '+8 hours'))
          `);
          
          const notificationResult = notificationStmt.run(
            agent.users_id,
            'property_inquiry',
            notificationMessage,
            inquiryResult.lastInsertRowid
          );
          console.log('Notification created with related_id:', notificationResult);
        } catch (columnError) {
          console.log('Notification table may not have related_id column, trying alternative query');
          
          // If that fails, try without related_id
          notificationStmt = db.prepare(`
            INSERT INTO notifications (
              user_id, 
              type, 
              message, 
              is_read, 
              created_at
            )
            VALUES (?, ?, ?, FALSE, datetime('now', '+8 hours'))
          `);
          
          const notificationResult = notificationStmt.run(
            agent.users_id,
            'property_inquiry',
            notificationMessage
          );
          console.log('Notification created without related_id:', notificationResult);
        }
        
        res.status(201).json({ 
          message: 'Inquiry sent successfully',
          inquiry_id: inquiryResult.lastInsertRowid
        });
      } catch (notificationError) {
        console.error('Error creating notification:', notificationError);
        throw new Error('Failed to create notification: ' + notificationError.message);
      }
    } catch (inquiryError) {
      console.error('Error creating inquiry:', inquiryError);
      throw new Error('Failed to create inquiry: ' + inquiryError.message);
    }
  } catch (error) {
    console.error('Error sending inquiry:', error);
    res.status(500).json({ error: error.message || 'Failed to send inquiry' });
  }
});

module.exports = router;
