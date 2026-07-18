import { NextRequest, NextResponse } from "next/server";
import { ensureAnonymousUserId } from "../../../lib/api-user";
import { db } from "../../../lib/db";
import { createDownloadUrl } from "../../../lib/storage";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    const key = request.nextUrl.searchParams.get("key");
    const ownerId = await ensureAnonymousUserId(userId);
    if (!key) return NextResponse.json({ error: "Image key is required." }, { status: 400 });
    const { rowCount } = await db.query(
      "SELECT 1 FROM cards c JOIN card_collections cc ON cc.id = c.collection_id JOIN projects p ON p.id = cc.project_id WHERE c.artwork_path = $1 AND p.owner_id = $2",
      [key, ownerId],
    );
    if (!rowCount) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    return NextResponse.redirect(await createDownloadUrl(key));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load image." }, { status: 400 });
  }
}
