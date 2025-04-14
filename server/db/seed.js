const bcrypt = require('bcryptjs');
const db = require('./database');

// Function to seed the database
async function seedDatabase() {
  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Insert a test user
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO users (email, password, name, phone_number, role)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run('test@example.com', hashedPassword, 'Test User', '1234567890', 'admin');

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    // Close the database connection
    db.close();
  }
}

// Run the seed function
seedDatabase(); 