import { NextRequest, NextResponse } from "next/server";
import { getAnonymousUserId } from "../../../../../../lib/api-user";
import { getProject } from "../../../../../../lib/project-store";
import { createUploadUrl } from "../../../../../../lib/storage";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

type UploadFile = { name: string; contentType: string; size: number; number: number | null };
type RouteContext = { params: { projectId: string } };

function isValidFile(file: unknown): file is UploadFile {
  if (!file || typeof file !== "object") return false;
  const item = file as Record<string, unknown>;
  return typeof item.name === "string" && item.name.length > 0 && item.name.length <= 255 && typeof item.contentType === "string" && allowedTypes.has(item.contentType) && typeof item.size === "number" && item.size > 0 && item.size <= 10 * 1024 * 1024 && (item.number === null || (typeof item.number === "number" && Number.isInteger(item.number) && item.number > 0));
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await getAnonymousUserId(request);
    const { files } = await request.json();
    if (!Array.isArray(files) || files.length === 0 || files.length > 20 || !files.every(isValidFile)) {
      return NextResponse.json({ error: "Upload between 1 and 20 JPEG, PNG, WebP, or GIF images, up to 10 MB each." }, { status: 400 });
    }
    const project = await getProject(userId, params.projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const cards = project.collections.flatMap((collection) => collection.cards);
    const uploads = await Promise.all(files.map(async (file, index) => {
      const cardId = file.number === null ? null : cards.find((card) => card.position === file.number)?.id ?? null;
      return { index, cardId, ...(await createUploadUrl(userId, params.projectId, file.name, file.contentType)) };
    }));
    return NextResponse.json({ uploads });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to prepare artwork uploads." }, { status: 400 });
  }
}
