import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../lib/db";
import { getAnonymousUserId } from "../../../../../../lib/api-user";
import { getProject } from "../../../../../../lib/project-store";

type ImportedCard = {
  number: number;
  title: string;
  description: string;
  imageDescription: string;
};

type RouteContext = { params: { projectId: string } };

function validateCards(value: unknown): ImportedCard[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 500) return null;
  const numbers = new Set<number>();
  const cards: ImportedCard[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const number = typeof row.number === "number" ? row.number : Number(row.number);
    if (!Number.isInteger(number) || number < 1 || numbers.has(number) || typeof row.title !== "string" || !row.title.trim() || typeof row.description !== "string" || !row.description.trim() || typeof row.imageDescription !== "string") return null;
    numbers.add(number);
    cards.push({ number, title: row.title.trim(), description: row.description.trim(), imageDescription: row.imageDescription.trim() });
  }

  return cards;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await getAnonymousUserId(request);
    const cards = validateCards((await request.json()).cards);
    if (!cards) return NextResponse.json({ error: "Upload 1 to 500 valid CSV rows with unique positive numbers, titles, and descriptions." }, { status: 400 });
    const project = await getProject(userId, params.projectId);
    const collectionId = project?.collections[0]?.id;
    if (!collectionId) return NextResponse.json({ error: "Project collection not found." }, { status: 404 });

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      for (const card of cards) {
        await client.query(
          "INSERT INTO cards (collection_id, title, card_type, description, image_description, position) VALUES ($1, $2, 'Imported card', $3, $4, $5)",
          [collectionId, card.title, card.description, card.imageDescription, card.number],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return NextResponse.json({ imported: cards.length }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to import cards." }, { status: 400 });
  }
}
