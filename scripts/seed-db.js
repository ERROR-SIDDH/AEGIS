// scripts/seed-db.js
// Script to initialize the MongoDB database with default administrative credentials.

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Configure dotenv to read from the project root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("Error: MONGODB_URI environment variable is missing.");
  console.error("Please configure your .env file. See .env.example for reference.");
  process.exit(1);
}

const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    console.log("Successfully connected to the MongoDB database.");

    const db = client.db();
    const usersCollection = db.collection('users');

    const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
    const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin_password_123';

    // Check if the default admin already exists to prevent duplication
    const existingAdmin = await usersCollection.findOne({ username: username });

    if (existingAdmin) {
      console.log(`Notice: Administrative user '${username}' already exists in the system. No action taken.`);
    } else {
      // Insert the default administrative user
      await usersCollection.insertOne({
        username: username,
        password: password, // Note: In a production environment, this should be a hashed password (e.g., using bcrypt)
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`Success: Default administrative user '${username}' has been created.`);
    }

  } catch (error) {
    console.error("Database seeding failed:", error);
  } finally {
    await client.close();
    process.exit(0);
  }
}

run();
