import { eq } from "drizzle-orm";
import { db } from "@/db";
import { submissionEvidence } from "@/db/schema";

function toRouteErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numericId = Number(id);

    if (!Number.isInteger(numericId) || numericId <= 0) {
      return Response.json({ error: "Invalid file ID." }, { status: 400 });
    }

    const [file] = await db
      .select()
      .from(submissionEvidence)
      .where(eq(submissionEvidence.id, numericId))
      .limit(1);

    if (!file) {
      return Response.json({ error: "File not found." }, { status: 404 });
    }

    // Blob URL (Vercel private store) → proxy through our route so auth is required to download
    if (file.r2Key.startsWith("http://") || file.r2Key.startsWith("https://")) {
      const upstream = await fetch(file.r2Key, {
        headers: process.env.BLOB_READ_WRITE_TOKEN
          ? { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
          : {},
      });
      if (!upstream.ok) {
        return Response.json({ error: "File not accessible." }, { status: 502 });
      }
      return new Response(upstream.body, {
        headers: {
          "content-type": file.contentType,
          "content-length": String(file.sizeBytes),
          "content-disposition": `attachment; filename="${file.fileName.replaceAll('"', "")}"`,
        },
      });
    }

    const { default: fs } = await import("fs");
    if (!fs.existsSync(file.r2Key)) {
      return Response.json({ error: "Stored file not found." }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(file.r2Key);
    return new Response(fileBuffer, {
      headers: {
        "content-type": file.contentType,
        "content-length": String(file.sizeBytes),
        "content-disposition": `attachment; filename="${file.fileName.replaceAll('"', "")}"`,
      },
    });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
