import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../lib/db";
import { getAnonymousUserId } from "../../../../../lib/api-user";
import { getProject } from "../../../../../lib/project-store";

type RouteContext = { params: { projectId: string } };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await getAnonymousUserId(request);
    const body = await request.json();
    const project = await getProject(userId, params.projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const collectionId = typeof body.collectionId === "string" ? body.collectionId : project.collections[0]?.id;
    if (!collectionId || !project.collections.some((collection) => collection.id === collectionId)) {
      return NextResponse.json({ error: "Card collection not found." }, { status: 400 });
    }
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Untitled card";
    const { rows } = await db.query(
      "INSERT INTO cards (collection_id, title, card_type, position) SELECT $1, $2, 'Character', COALESCE(MAX(position) + 1, 0) FROM cards WHERE collection_id = $1 RETURNING id",
      [collectionId, title],
    );
    const updatedProject = await getProject(userId, params.projectId);
    const card = updatedProject?.collections.flatMap((collection) => collection.cards).find((item) => item.id === rows[0].id);
    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create card." }, { status: 400 });
  }
}
