#!/usr/bin/env node
// Creates all tables in a fresh Turso database.
// Usage: TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="eyJ..." node scripts/init-turso.js

const { createClient } = require("@libsql/client");

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Missing env vars. Run with:");
  console.error('  TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="eyJ..." node scripts/init-turso.js');
  process.exit(1);
}

const client = createClient({ url, authToken });

async function init() {
  await client.batch(
    [
      {
        sql: `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'employee',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS incentive_submissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          tracking_id TEXT NOT NULL UNIQUE,
          employee_name TEXT NOT NULL,
          employee_email TEXT NOT NULL,
          department TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT '',
          incentive_code TEXT NOT NULL,
          incentive_title TEXT NOT NULL,
          incentive_section TEXT NOT NULL,
          amount_label TEXT NOT NULL,
          claimed_amount INTEGER NOT NULL DEFAULT 0,
          period TEXT NOT NULL,
          completed_on TEXT NOT NULL,
          client_or_project TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'Submitted',
          manager_notes TEXT NOT NULL DEFAULT '',
          submitted_by_email TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS submission_evidence (
          id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          submission_id INTEGER NOT NULL REFERENCES incentive_submissions(id) ON DELETE CASCADE,
          file_name TEXT NOT NULL,
          r2_key TEXT NOT NULL,
          content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
          size_bytes INTEGER NOT NULL DEFAULT 0,
          uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        args: [],
      },
    ],
    "write"
  );

  console.log("✓ users table ready");
  console.log("✓ incentive_submissions table ready");
  console.log("✓ submission_evidence table ready");
  console.log("Database initialised successfully.");
}

init().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
