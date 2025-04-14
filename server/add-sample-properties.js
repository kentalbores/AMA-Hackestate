const db = require('./db/database');

// First check if we have any properties
const existingProperties = db.prepare('SELECT COUNT(*) as count FROM properties').get();
console.log(`Current property count: ${existingProperties.count}`);

// Only add sample properties if there are none
if (existingProperties.count === 0) {
  console.log('Adding sample properties...');
  
  // Let's make sure we have at least one agent to reference
  const agentCount = db.prepare('SELECT COUNT(*) as count FROM agents').get();
  let agentId = 1;
  
  if (agentCount.count === 0) {
    // We need to create a user first
    const userInsert = db.prepare(`
      INSERT INTO users (name, email, password, phone_number, role)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const userResult = userInsert.run(
      'Sample Agent',
      'agent@example.com',
      '$2a$10$1234567890123456789012', // This is a dummy hashed password
      '555-123-4567',
      'agent'
    );
    
    const userId = userResult.lastInsertRowid;
    
    // Now create the agent
    const agentInsert = db.prepare('INSERT INTO agents (users_id, is_verified) VALUES (?, ?)');
    const agentResult = agentInsert.run(userId, 'true');
    agentId = agentResult.lastInsertRowid;
    
    console.log(`Created sample agent with ID: ${agentId}`);
  } else {
    // Get the first agent ID
    const firstAgent = db.prepare('SELECT id FROM agents LIMIT 1').get();
    agentId = firstAgent.id;
    console.log(`Using existing agent with ID: ${agentId}`);
  }
  
  // Now add sample properties
  const propertyInsert = db.prepare(`
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
  
  const sampleProperties = [
    {
      title: 'Modern Condominium in Cebu City',
      description: 'A beautiful and spacious condominium in the heart of Cebu City.',
      price: 2500000,
      location: 'Cebu City, Cebu',
      image_url: '/uploads/condo1.jpg',
      beds: 2,
      baths: 1,
      property_type: 'condominium',
      land_area: 65,
      listing_type: 'for_sale',
      agents_id: agentId
    },
    {
      title: 'Family House with Garden',
      description: 'Perfect family home with a spacious garden in a quiet neighborhood.',
      price: 8500000,
      location: 'Mandaue City, Cebu',
      image_url: '/uploads/house1.jpg',
      beds: 3,
      baths: 2,
      property_type: 'house',
      land_area: 150,
      listing_type: 'for_sale',
      agents_id: agentId
    },
    {
      title: 'Beachfront Lot in Mactan',
      description: 'Vacant lot with stunning beach views perfect for building your dream home.',
      price: 12000000,
      location: 'Mactan, Cebu',
      image_url: '/uploads/land1.jpg',
      beds: 0,
      baths: 0,
      property_type: 'land',
      land_area: 500,
      listing_type: 'for_sale',
      agents_id: agentId
    },
    {
      title: 'Studio Apartment for Rent',
      description: 'Cozy studio apartment fully furnished and ready for occupancy.',
      price: 25000,
      location: 'Lahug, Cebu City',
      image_url: '/uploads/studio1.jpg',
      beds: 1,
      baths: 1,
      property_type: 'condominium',
      land_area: 30,
      listing_type: 'for_rent',
      agents_id: agentId
    }
  ];
  
  // Create uploads directory if it doesn't exist
  const fs = require('fs');
  const path = require('path');
  const uploadsDir = path.join(__dirname, 'uploads');
  
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
    console.log('Created uploads directory');
  }
  
  // Insert all properties
  const propertyIds = [];
  for (const property of sampleProperties) {
    try {
      const result = propertyInsert.run(
        property.title,
        property.description,
        property.price,
        property.location,
        property.image_url,
        property.beds,
        property.baths,
        property.property_type,
        property.land_area,
        property.listing_type,
        property.agents_id
      );
      propertyIds.push(result.lastInsertRowid);
    } catch (error) {
      console.error(`Error inserting property "${property.title}":`, error.message);
    }
  }
  
  console.log(`Added ${propertyIds.length} sample properties with IDs: ${propertyIds.join(', ')}`);
} else {
  console.log('Properties already exist in the database. No sample data was added.');
}

// Display all properties
const allProperties = db.prepare('SELECT * FROM properties').all();
console.table(allProperties); 