const Database = require('better-sqlite3');

const db = new Database('./database.db');


db.prepare(`
    CREATE TABLE IF NOT EXISTS properties(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      location TEXT NOT NULL,
      price INTEGER NOT NULL,
      image_url TEXT
    )
  `).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
`).run();


// const insert = db.prepare(`
//   INSERT INTO properties (title, location, price, image)
//   VALUES (?, ?, ?, ?)
// `);

// const sampleData = [
//   ['Modern Studio Apartment', 'Makati, Metro Manila', 50000, 'https://via.placeholder.com/300x200?text=Studio'],
//   ['2-Bedroom Condo', 'Cebu City', 75000, 'https://via.placeholder.com/300x200?text=Condo'],
//   ['House with Garden', 'Davao City', 120000, 'https://via.placeholder.com/300x200?text=House'],
// ];

// sampleData.forEach(property => insert.run(...property));

console.log('Database initialized with sample properties.');
