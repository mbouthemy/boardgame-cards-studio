import { NextRequest, NextResponse } from "next/server";
import { getAnonymousUserId } from "../../../lib/api-user";
import { userOwnsCard } from "../../../lib/project-store";
import { createUploadUrl } from "../../../lib/storage";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: NextRequest) {
  try {
    const userId = await getAnonymousUserId(request);
    const { projectId, cardId, fileName, contentType, size } = await request.json();
    if (typeof projectId !== "string" || typeof cardId !== "string" || typeof fileName !== "string" || !allowedTypes.has(contentType) || typeof size !== "number" || size <= 0 || size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Use a JPEG, PNG, WebP, or GIF image up to 10 MB." }, { status: 400 });
    }
    if (!(await userOwnsCard(userId, projectId, cardId))) return NextResponse.json({ error: "Card not found." }, { status: 404 });
    return NextResponse.json(await createUploadUrl(userId, projectId, fileName, contentType));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to prepare image upload." }, { status: 400 });
  }
}
