#!/usr/bin/env node
// Usage: npm run create-manager -- "Full Name" "email@company.com" "password123"
// Works against local SQLite file or Turso (reads TURSO_DATABASE_URL / TURSO_AUTH_TOKEN from env).

const { createClient } = require("@libsql/client");
const bcrypt = require("bcryptjs");
const path = require("path");

const [, , name, email, password] = process.argv;

if (!name || !email || !password) {
  console.error('Usage: npm run create-manager -- "Full Name" "email@company.com" "password123"');
  process.exit(1);
}

if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const url = process.env.TURSO_DATABASE_URL ?? `file:${path.join(__dirname, "..", ".data", "tracker.db")}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({ url, authToken });

async function run() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = bcrypt.hashSync(password, 10);

  const existing = await client.execute({
    sql: "SELECT id FROM users WHERE email = ?",
    args: [normalizedEmail],
  });

  if (existing.rows.length > 0) {
    await client.execute({
      sql: "UPDATE users SET name = ?, password_hash = ?, role = 'manager' WHERE email = ?",
      args: [name.trim(), passwordHash, normalizedEmail],
    });
    console.log(`✓ ${normalizedEmail} promoted to manager.`);
  } else {
    await client.execute({
      sql: "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'manager')",
      args: [name.trim(), normalizedEmail, passwordHash, "manager"],
    });
    console.log(`✓ Manager account created: ${normalizedEmail}`);
  }
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
