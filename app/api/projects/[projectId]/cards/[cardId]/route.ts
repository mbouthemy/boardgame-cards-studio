import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../lib/db";
import { getAnonymousUserId } from "../../../../../../lib/api-user";
import { getProject, userOwnsCard } from "../../../../../../lib/project-store";

type RouteContext = { params: { projectId: string; cardId: string } };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await getAnonymousUserId(request);
    if (!(await userOwnsCard(userId, params.projectId, params.cardId))) return NextResponse.json({ error: "Card not found." }, { status: 404 });
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : undefined;
    const cardType = typeof body.cardType === "string" ? body.cardType.trim() : undefined;
    const description = typeof body.description === "string" ? body.description.trim() : undefined;
    const gameEffect = typeof body.gameEffect === "string" ? body.gameEffect.trim() : undefined;
    const imageDescription = typeof body.imageDescription === "string" ? body.imageDescription.trim() : undefined;
    const artworkPath = typeof body.artworkPath === "string" ? body.artworkPath : undefined;
    await db.query(
      "UPDATE cards SET title = COALESCE($1, title), card_type = COALESCE($2, card_type), description = COALESCE($3, description), game_effect = COALESCE($4, game_effect), image_description = COALESCE($5, image_description), artwork_path = COALESCE($6, artwork_path) WHERE id = $7",
      [title || undefined, cardType || undefined, description, gameEffect, imageDescription, artworkPath, params.cardId],
    );
    const project = await getProject(userId, params.projectId);
    return NextResponse.json(project?.collections.flatMap((collection) => collection.cards).find((card) => card.id === params.cardId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update card." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await getAnonymousUserId(request);
    const { rowCount } = await db.query(
      "DELETE FROM cards WHERE id = $1 AND EXISTS (SELECT 1 FROM card_collections cc JOIN projects p ON p.id = cc.project_id WHERE cc.id = cards.collection_id AND p.id = $2 AND p.owner_id = $3)",
      [params.cardId, params.projectId, userId],
    );
    return rowCount ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Card not found." }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete card." }, { status: 400 });
  }
}
