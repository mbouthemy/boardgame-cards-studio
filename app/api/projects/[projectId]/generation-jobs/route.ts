import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../lib/db";
import { getAnonymousUserId } from "../../../../../lib/api-user";
import { getProject } from "../../../../../lib/project-store";
import { runGenerationJob } from "../../../../../lib/run-generation";

export const maxDuration = 300;

type RouteContext = { params: { projectId: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await getAnonymousUserId(request);
    const { rows } = await db.query("SELECT id, status, provider, model, error_message, created_at, started_at, completed_at FROM generation_jobs WHERE project_id = $1 AND requester_id = $2 ORDER BY created_at DESC LIMIT 1", [params.projectId, userId]);
    if (!rows[0]) return NextResponse.json(null);
    const { rows: results } = await db.query("SELECT gr.card_id, gr.status, gr.storage_key, gr.error_message, c.title FROM generation_results gr JOIN cards c ON c.id = gr.card_id WHERE gr.job_id = $1 ORDER BY c.position", [rows[0].id]);
    return NextResponse.json({ ...rows[0], results });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load generation job." }, { status: 400 }); }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await getAnonymousUserId(request);
    const project = await getProject(userId, params.projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    if (!project.collections.some((collection) => collection.cards.length)) return NextResponse.json({ error: "Import cards before starting generation." }, { status: 400 });
    const body = await request.json(); const provider = body.provider === "gemini" ? "gemini" : "openai";
    const model = provider === "gemini" ? process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image" : process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
    const { rows } = await db.query("INSERT INTO generation_jobs (project_id, requester_id, provider, model) VALUES ($1, $2, $3, $4) RETURNING id", [params.projectId, userId, provider, model]);
    await runGenerationJob(rows[0].id);
    const { rows: jobRows } = await db.query("SELECT id, status, provider, model, error_message, created_at, started_at, completed_at FROM generation_jobs WHERE id = $1", [rows[0].id]);
    const { rows: results } = await db.query("SELECT gr.card_id, gr.status, gr.storage_key, gr.error_message, c.title FROM generation_results gr JOIN cards c ON c.id = gr.card_id WHERE gr.job_id = $1 ORDER BY c.position", [rows[0].id]);
    return NextResponse.json({ ...jobRows[0], results }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to queue generation." }, { status: 400 }); }
}
