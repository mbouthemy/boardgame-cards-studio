import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { getAnonymousUserId } from "../../../lib/api-user";
import { getProjects } from "../../../lib/project-store";

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await getProjects(await getAnonymousUserId(request)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load projects." }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAnonymousUserId(request);
    const body = await request.json();
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Untitled garden";
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query("INSERT INTO projects (owner_id, name) VALUES ($1, $2) RETURNING id", [userId, name]);
      await client.query("INSERT INTO card_collections (project_id, name) VALUES ($1, 'Card collection')", [rows[0].id]);
      await client.query("COMMIT");
      const project = (await getProjects(userId)).find((item) => item.id === rows[0].id);
      return NextResponse.json(project, { status: 201 });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create project." }, { status: 400 });
  }
}
