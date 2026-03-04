const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

let db;

async function setupDatabase() {
  db = await open({
    filename: 'web_database.db',
    driver: sqlite3.Database
  });

  // Users table (Stores user ID and generated name)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      userId TEXT PRIMARY KEY, 
      username TEXT
    );
  `);

  // Cabinet table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS cabinet (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT,
      drugName TEXT,
      drugId TEXT,
      UNIQUE(userId, drugId)
    );
  `);

  console.log('✅ Database connected.');
  return db;
}

function getDb() {
  if (!db) throw new Error('DB not initialized');
  return db;
}

module.exports = { setupDatabase, getDb };