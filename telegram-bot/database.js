// database.js
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

// This holds our database "connection"
let db;

// This function sets up the database and creates the tables
async function setupDatabase() {
  db = await open({
    filename: 'bot_database.db', // This is the file your DB will live in
    driver: sqlite3.Database
  });

  // 1. Users Table (Language settings)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      chatId INTEGER PRIMARY KEY,
      language TEXT DEFAULT 'en'
    );
  `);

  // 2. Medications Table (My Medicine Cabinet)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chatId INTEGER,
      drugName TEXT,
      drugId TEXT,
      UNIQUE(chatId, drugId) 
    );
  `);

  // 3. NEW: Feedback Table (Stores user messages)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chatId INTEGER,
      message TEXT,
      date TEXT
    );
  `);

  console.log('Database tables (Users, Meds, Feedback) are ready.');
  return db;
}

// This function gets our database connection.
function getDb() {
  if (!db) {
    throw new Error('Database not initialized! Call setupDatabase first.');
  }
  return db;
}

module.exports = { setupDatabase, getDb };