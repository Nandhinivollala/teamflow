import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/modules/auth/session";
import { objectStorage } from "@/modules/files/object-storage";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await context.params;
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: {
      task: { include: { projects: true } },
      rca: true,
    },
  });
  if (!attachment) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  const projectIds = new Set(user.memberships.map(({ project }) => project.id));
  const canRead = user.systemRole === "ADMIN"
    || attachment.task?.projects.some(({ projectId }) => projectIds.has(projectId))
    || (attachment.rca && projectIds.has(attachment.rca.projectId));
  if (!canRead) return NextResponse.json({ error: "Access denied." }, { status: 403 });

  try {
    const body = await objectStorage.get(attachment.storageKey);
    const responseBody = new Uint8Array(body.byteLength);
    responseBody.set(body);
    return new Response(responseBody.buffer, {
      headers: {
        "Content-Type": attachment.contentType,
        "Content-Length": String(attachment.sizeBytes),
        "Content-Disposition": `inline; filename="${attachment.fileName.replaceAll('"', "")}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Stored file is unavailable." }, { status: 404 });
  }
}
