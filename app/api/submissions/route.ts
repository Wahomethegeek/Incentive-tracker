import { desc, eq, inArray, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { incentiveSubmissions, submissionEvidence } from "@/db/schema";
import {
  getIncentive,
  SUBMISSION_STATUSES,
  type IncentiveItem,
} from "@/lib/incentives";

type EvidenceRow = typeof submissionEvidence.$inferSelect;
type SubmissionRow = typeof incentiveSubmissions.$inferSelect;

function toRouteErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseKes(value: string) {
  const numeric = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
}

function createTrackingId() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `INC-${stamp}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function isUpload(value: FormDataEntryValue): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "size" in value &&
    "stream" in value
  );
}

function displayFileName(file: File) {
  const relativePath = (file as File & { webkitRelativePath?: string })
    .webkitRelativePath;
  return relativePath?.trim() || file.name || "evidence-file";
}

function safeKeyPart(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function serializeSubmission(row: SubmissionRow, evidence: EvidenceRow[]) {
  return {
    id: row.id,
    trackingId: row.trackingId,
    employeeName: row.employeeName,
    employeeEmail: row.employeeEmail,
    department: row.department,
    role: row.role,
    incentiveCode: row.incentiveCode,
    incentiveTitle: row.incentiveTitle,
    incentiveSection: row.incentiveSection,
    amountLabel: row.amountLabel,
    claimedAmount: row.claimedAmount,
    period: row.period,
    completedOn: row.completedOn,
    clientOrProject: row.clientOrProject,
    notes: row.notes,
    status: row.status,
    managerNotes: row.managerNotes,
    submittedByEmail: row.submittedByEmail,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    evidence: evidence.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      sizeBytes: f.sizeBytes,
      contentType: f.contentType,
      uploadedAt: f.uploadedAt,
      url: `/api/evidence/${f.id}`,
    })),
  };
}

function defaultAmount(incentive: IncentiveItem, submittedAmount: number) {
  if (submittedAmount > 0) return submittedAmount;
  return incentive.amountKes ?? 0;
}

function getRole(session: { user?: { role?: string } } | null) {
  return session?.user?.role ?? "employee";
}

async function saveFile(
  file: File,
  trackingId: string,
  fileName: string
): Promise<{ storageKey: string }> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = await put(
      `submissions/${trackingId}/${crypto.randomUUID()}-${safeKeyPart(fileName) || "evidence"}`,
      file,
      { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN } as any
    );
    return { storageKey: blob.url };
  }

  // Local filesystem fallback
  const { default: fs } = await import("fs");
  const { default: path } = await import("path");
  const uploadsDir = path.join(process.cwd(), "uploads", "submissions", trackingId);
  fs.mkdirSync(uploadsDir, { recursive: true });
  const localPath = path.join(
    uploadsDir,
    `${crypto.randomUUID()}-${safeKeyPart(fileName) || "evidence"}`
  );
  fs.writeFileSync(localPath, Buffer.from(await file.arrayBuffer()));
  return { storageKey: localPath };
}

async function deleteFile(storageKey: string) {
  if (storageKey.startsWith("http://") || storageKey.startsWith("https://")) {
    const { del } = await import("@vercel/blob");
    await del(storageKey);
  } else {
    const { default: fs } = await import("fs");
    try { fs.unlinkSync(storageKey); } catch { /* already gone */ }
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    const isManager = getRole(session as { user?: { role?: string } }) === "manager";
    const userEmail = session.user.email ?? "";

    const rows = isManager
      ? await db
          .select()
          .from(incentiveSubmissions)
          .orderBy(desc(incentiveSubmissions.createdAt), desc(incentiveSubmissions.id))
          .limit(200)
      : await db
          .select()
          .from(incentiveSubmissions)
          .where(eq(incentiveSubmissions.employeeEmail, userEmail))
          .orderBy(desc(incentiveSubmissions.createdAt), desc(incentiveSubmissions.id))
          .limit(200);

    const ids = rows.map((r) => r.id);
    const files = ids.length > 0
      ? await db
          .select()
          .from(submissionEvidence)
          .where(inArray(submissionEvidence.submissionId, ids))
          .orderBy(desc(submissionEvidence.uploadedAt), desc(submissionEvidence.id))
      : [];

    const filesBySubmission = files.reduce<Record<number, EvidenceRow[]>>(
      (grouped, file) => {
        grouped[file.submissionId] ??= [];
        grouped[file.submissionId].push(file);
        return grouped;
      },
      {}
    );

    return Response.json({
      submissions: rows.map((row) =>
        serializeSubmission(row, filesBySubmission[row.id] ?? [])
      ),
    });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    const isManager = getRole(session as { user?: { role?: string } }) === "manager";
    const formData = await request.formData();
    const incentiveCode = cleanText(formData.get("incentiveCode"));
    const incentive = getIncentive(incentiveCode);

    const employeeName = isManager
      ? cleanText(formData.get("employeeName")) || (session.user.name ?? "")
      : (session.user.name ?? "");
    const employeeEmail = isManager
      ? cleanText(formData.get("employeeEmail")) || (session.user.email ?? "")
      : (session.user.email ?? "");

    const department = cleanText(formData.get("department"));
    const role = cleanText(formData.get("role"));
    const period = cleanText(formData.get("period"));
    const completedOn = cleanText(formData.get("completedOn"));
    const clientOrProject = cleanText(formData.get("clientOrProject"));
    const notes = cleanText(formData.get("notes"));
    const submittedAmount = parseKes(cleanText(formData.get("claimedAmount")));
    const files = formData
      .getAll("evidence")
      .filter((entry): entry is File => isUpload(entry) && entry.size > 0);

    if (!incentive) {
      return Response.json({ error: "Select a valid incentive." }, { status: 400 });
    }
    if (!employeeName || !employeeEmail || !department || !period || !completedOn) {
      return Response.json(
        { error: "Employee, department, period, and completion date are required." },
        { status: 400 }
      );
    }
    if (files.length === 0) {
      return Response.json(
        { error: "Upload at least one evidence file or directory." },
        { status: 400 }
      );
    }

    const trackingId = createTrackingId();
    const submittedByEmail = session.user.email ?? employeeEmail;

    const [submission] = await db
      .insert(incentiveSubmissions)
      .values({
        trackingId,
        employeeName,
        employeeEmail,
        department,
        role,
        incentiveCode: incentive.code,
        incentiveTitle: incentive.title,
        incentiveSection: incentive.section,
        amountLabel: incentive.amountLabel,
        claimedAmount: defaultAmount(incentive, submittedAmount),
        period,
        completedOn,
        clientOrProject,
        notes,
        submittedByEmail,
      })
      .returning();

    const evidenceRows: EvidenceRow[] = [];

    for (const file of files) {
      const fileName = displayFileName(file);
      const { storageKey } = await saveFile(file, trackingId, fileName);

      const [evidence] = await db
        .insert(submissionEvidence)
        .values({
          submissionId: submission.id,
          fileName,
          r2Key: storageKey,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        })
        .returning();

      evidenceRows.push(evidence);
    }

    return Response.json(
      { submission: serializeSubmission(submission, evidenceRows) },
      { status: 201 }
    );
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || getRole(session as { user?: { role?: string } }) !== "manager") {
      return Response.json({ error: "Manager access required." }, { status: 403 });
    }

    const payload = (await request.json()) as {
      trackingId?: string;
      status?: string;
      managerNotes?: string;
    };
    const trackingId = payload.trackingId?.trim() ?? "";
    const status = payload.status?.trim() ?? "";
    const managerNotes = payload.managerNotes?.trim() ?? "";

    if (!trackingId || !(SUBMISSION_STATUSES as readonly string[]).includes(status)) {
      return Response.json(
        { error: "Tracking ID and valid status are required." },
        { status: 400 }
      );
    }

    const [submission] = await db
      .update(incentiveSubmissions)
      .set({ status, managerNotes, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(incentiveSubmissions.trackingId, trackingId))
      .returning();

    if (!submission) {
      return Response.json({ error: "Submission not found." }, { status: 404 });
    }

    const evidence = await db
      .select()
      .from(submissionEvidence)
      .where(eq(submissionEvidence.submissionId, submission.id))
      .orderBy(desc(submissionEvidence.uploadedAt), desc(submissionEvidence.id));

    return Response.json({ submission: serializeSubmission(submission, evidence) });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || getRole(session as { user?: { role?: string } }) !== "manager") {
      return Response.json({ error: "Manager access required." }, { status: 403 });
    }

    const { trackingId } = (await request.json()) as { trackingId?: string };
    if (!trackingId?.trim()) {
      return Response.json({ error: "Tracking ID required." }, { status: 400 });
    }

    const [submission] = await db
      .select()
      .from(incentiveSubmissions)
      .where(eq(incentiveSubmissions.trackingId, trackingId.trim()))
      .limit(1);

    if (!submission) {
      return Response.json({ error: "Submission not found." }, { status: 404 });
    }

    const evidence = await db
      .select()
      .from(submissionEvidence)
      .where(eq(submissionEvidence.submissionId, submission.id));

    await Promise.all(evidence.map((f) => deleteFile(f.r2Key)));

    await db
      .delete(incentiveSubmissions)
      .where(eq(incentiveSubmissions.trackingId, trackingId.trim()));

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
