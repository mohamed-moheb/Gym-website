const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database('gym.db');

// SQL to create tables
const createUserTable = `
CREATE TABLE IF NOT EXISTS USER (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  isAdmin BOOLEAN DEFAULT 0,
  invitationsLeft INTEGER DEFAULT 10
);
`;

const createClassTable = `
CREATE TABLE IF NOT EXISTS CLASS (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  coachName TEXT,
  dayOfWeek TEXT, 
  timeSlot TEXT, 
  duration INTEGER, 
  availableSlots INTEGER
);
`;

const createBookingsTable = `
CREATE TABLE IF NOT EXISTS BOOKINGS (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  classId INTEGER NOT NULL,
  bookingTime TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES USER(id),
  FOREIGN KEY (classId) REFERENCES CLASS(id)
);
`;

const createInvitationsTable = `
CREATE TABLE IF NOT EXISTS INVITATIONS (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  invitedName TEXT NOT NULL,
  invitedAge INTEGER NOT NULL,
  invitedEmail TEXT NOT NULL,
  invitedPhone TEXT NOT NULL,
  invitationTime TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES USER(id)
);
`;

module.exports = {
  db,
  createUserTable,
  createClassTable,
  createBookingsTable,
  createInvitationsTable,
};