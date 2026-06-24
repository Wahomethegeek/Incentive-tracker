#!/usr/bin/env node
// Usage: npm run delete-user -- "email@company.com"

const { createClient } = require("@libsql/client");
const path = require("path");

const [, , email] = process.argv;

if (!email) {
  console.error('Usage: npm run delete-user -- "email@company.com"');
  process.exit(1);
}

const url = process.env.TURSO_DATABASE_URL ?? `file:${path.join(__dirname, "..", ".data", "tracker.db")}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({ url, authToken });

async function run() {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await client.execute({
    sql: "SELECT id, name, role FROM users WHERE email = ?",
    args: [normalizedEmail],
  });

  if (existing.rows.length === 0) {
    console.error(`No user found with email: ${normalizedEmail}`);
    process.exit(1);
  }

  const user = existing.rows[0];
  console.log(`Found: ${user.name} (${normalizedEmail}) — role: ${user.role}`);

  await client.execute({
    sql: "DELETE FROM users WHERE email = ?",
    args: [normalizedEmail],
  });

  console.log(`✓ Deleted user: ${normalizedEmail}`);
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
