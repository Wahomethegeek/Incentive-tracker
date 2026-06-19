import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("employee"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const incentiveSubmissions = sqliteTable("incentive_submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trackingId: text("tracking_id").notNull().unique(),
  employeeName: text("employee_name").notNull(),
  employeeEmail: text("employee_email").notNull(),
  department: text("department").notNull(),
  role: text("role").notNull().default(""),
  incentiveCode: text("incentive_code").notNull(),
  incentiveTitle: text("incentive_title").notNull(),
  incentiveSection: text("incentive_section").notNull(),
  amountLabel: text("amount_label").notNull(),
  claimedAmount: integer("claimed_amount").notNull().default(0),
  period: text("period").notNull(),
  completedOn: text("completed_on").notNull(),
  clientOrProject: text("client_or_project").notNull().default(""),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("Submitted"),
  managerNotes: text("manager_notes").notNull().default(""),
  submittedByEmail: text("submitted_by_email").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const submissionEvidence = sqliteTable("submission_evidence", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  submissionId: integer("submission_id")
    .notNull()
    .references(() => incentiveSubmissions.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  r2Key: text("r2_key").notNull(),
  contentType: text("content_type").notNull().default("application/octet-stream"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  uploadedAt: text("uploaded_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
