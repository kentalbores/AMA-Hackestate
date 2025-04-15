const sqlite3 = require('sqlite3').verbose();

// Open the database
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    return;
  }
  console.log('Connected to the database.sqlite database.');
});

// Query to get all tables
db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
  if (err) {
    console.error('Error getting tables:', err.message);
    return;
  }
  
  console.log('Tables in database:');
  tables.forEach(table => {
    console.log(` - ${table.name}`);
    
    // For each table, get its schema
    db.all(`PRAGMA table_info(${table.name})`, [], (err, columns) => {
      if (err) {
        console.error(`Error getting schema for ${table.name}:`, err.message);
        return;
      }
      
      console.log(`   Columns in ${table.name}:`);
      columns.forEach(col => {
        console.log(`    - ${col.name} (${col.type})`);
      });
      
      console.log(''); // Add a blank line for readability
    });
  });
  
  // Specifically check the inquiries table
  console.log('Checking inquiries table content...');
  db.all("SELECT * FROM inquiries LIMIT 3", [], (err, rows) => {
    if (err) {
      console.error('Error querying inquiries:', err.message);
      return;
    }
    
    console.log('Sample inquiries:');
    console.log(JSON.stringify(rows, null, 2));
    
    // Close the database connection when we're done
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
        return;
      }
      console.log('Database connection closed.');
    });
  });
}); 