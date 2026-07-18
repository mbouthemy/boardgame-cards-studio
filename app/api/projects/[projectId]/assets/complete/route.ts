import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../lib/db";
import { getAnonymousUserId } from "../../../../../../lib/api-user";
import { getProject } from "../../../../../../lib/project-store";

type CompletedAsset = { key: string; originalFilename: string; cardId: string | null };
type RouteContext = { params: { projectId: string } };

function isCompletedAsset(asset: unknown): asset is CompletedAsset {
  if (!asset || typeof asset !== "object") return false;
  const item = asset as Record<string, unknown>;
  return typeof item.key === "string" && typeof item.originalFilename === "string" && item.originalFilename.length > 0 && (item.cardId === null || typeof item.cardId === "string");
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await getAnonymousUserId(request);
    const { assets } = await request.json();
    if (!Array.isArray(assets) || assets.length === 0 || assets.length > 20 || !assets.every(isCompletedAsset)) {
      return NextResponse.json({ error: "Invalid artwork upload completion." }, { status: 400 });
    }
    const project = await getProject(userId, params.projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const validCardIds = new Set(project.collections.flatMap((collection) => collection.cards).map((card) => card.id));
    const keyPrefix = `projects/${userId}/${params.projectId}/`;
    if (assets.some((asset) => !asset.key.startsWith(keyPrefix) || (asset.cardId !== null && !validCardIds.has(asset.cardId)))) {
      return NextResponse.json({ error: "Artwork does not belong to this project." }, { status: 400 });
    }
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      for (const asset of assets) {
        await client.query("INSERT INTO project_assets (project_id, card_id, storage_key, original_filename) VALUES ($1, $2, $3, $4) ON CONFLICT (storage_key) DO NOTHING", [params.projectId, asset.cardId, asset.key, asset.originalFilename]);
        if (asset.cardId) await client.query("UPDATE cards SET artwork_path = $1 WHERE id = $2", [asset.key, asset.cardId]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return NextResponse.json({ saved: assets.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save artwork." }, { status: 400 });
  }
}
