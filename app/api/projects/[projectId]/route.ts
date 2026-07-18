import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { getAnonymousUserId } from "../../../../lib/api-user";
import { getProject } from "../../../../lib/project-store";

type RouteContext = { params: { projectId: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const project = await getProject(await getAnonymousUserId(request), params.projectId);
    return project ? NextResponse.json(project) : NextResponse.json({ error: "Project not found." }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load project." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await getAnonymousUserId(request);
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const description = typeof body.description === "string" ? body.description.trim() : undefined;
    const mood = typeof body.mood === "string" ? body.mood.trim() || null : undefined;
    const keywords = Array.isArray(body.keywords) ? body.keywords.filter((item: unknown) => typeof item === "string").map((item: string) => item.trim()).filter(Boolean) : undefined;
    const { rowCount } = await db.query(
      "UPDATE projects SET name = COALESCE($1, name), description = COALESCE($2, description), mood = COALESCE($3, mood), keywords = COALESCE($4, keywords) WHERE id = $5 AND owner_id = $6",
      [name || undefined, description, mood, keywords, params.projectId, userId],
    );
    if (!rowCount) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json(await getProject(userId, params.projectId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update project." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await getAnonymousUserId(request);
    const { rowCount } = await db.query("DELETE FROM projects WHERE id = $1 AND owner_id = $2", [params.projectId, userId]);
    return rowCount ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Project not found." }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete project." }, { status: 400 });
  }
}
