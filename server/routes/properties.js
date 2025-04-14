const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const db = require('../db/database');
const axios = require("axios");
require("dotenv").config();

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
    const stmt = db.prepare('SELECT * FROM properties');
    const properties = stmt.all();
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


router.post('/:id/purchase', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const buyerId = req.user.userId;
  
  // Get property and agent info
  const property = db.prepare(`
    SELECT p.*, a.users_id as agent_user_id 
    FROM properties p 
    JOIN agents a ON p.agents_id = a.id 
    WHERE p.id = ?
  `).get(id);

  // Create notification for agent
  db.prepare(`
    INSERT INTO notifications (user_id, type, message)
    VALUES (?, 'property_purchase', ?)
  `).run(property.agent_user_id, `New purchase request for property: ${property.title}`);

  res.json({ message: 'Purchase request sent' });
});

module.exports = router;
