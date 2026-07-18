import "server-only";

import { randomUUID } from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { db } from "./db";

export async function runGenerationJob(jobId: string) {
  const { rows: jobs } = await db.query("SELECT * FROM generation_jobs WHERE id = $1", [jobId]);
  const job = jobs[0];
  if (!job) throw new Error("Generation job not found.");
  if (!process.env.OPENAI_API_KEY || !process.env.S3_BUCKET || !process.env.S3_REGION) throw new Error("OPENAI_API_KEY, S3_BUCKET, and S3_REGION are required.");
  await db.query("UPDATE generation_jobs SET status = 'running', started_at = NOW() WHERE id = $1", [jobId]);
  const { rows: cards } = await db.query("SELECT c.id, c.title, c.description, c.image_description, c.artwork_path, p.name project_name, p.description project_description FROM cards c JOIN card_collections cc ON cc.id = c.collection_id JOIN projects p ON p.id = cc.project_id WHERE p.id = $1 ORDER BY c.position", [job.project_id]);
  const s3 = new S3Client({ region: process.env.S3_REGION });
  for (const card of cards) {
    if (card.artwork_path) { await db.query("INSERT INTO generation_results (job_id, card_id, status, storage_key) VALUES ($1, $2, 'supplied', $3)", [jobId, card.id, card.artwork_path]); continue; }
    const prompt = `Create polished board-game card artwork for ${card.title}. Game: ${card.project_name}. ${card.project_description} Card description: ${card.description}. Visual direction: ${card.image_description || card.description}. No text, numbers, borders, or card frame.`;
    try {
      const response = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: job.model, prompt, size: "1024x1024", quality: "medium", output_format: "png" }) });
      const payload = await response.json(); if (!response.ok || !payload.data?.[0]?.b64_json) throw new Error(payload.error?.message || "Image generation failed.");
      const key = `generated/${job.project_id}/${card.id}/${randomUUID()}.png`;
      await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: Buffer.from(payload.data[0].b64_json, "base64"), ContentType: "image/png" }));
      await db.query("UPDATE cards SET artwork_path = $1 WHERE id = $2", [key, card.id]); await db.query("INSERT INTO generation_results (job_id, card_id, status, storage_key, prompt) VALUES ($1, $2, 'generated', $3, $4)", [jobId, card.id, key, prompt]);
    } catch (error) { await db.query("INSERT INTO generation_results (job_id, card_id, status, error_message) VALUES ($1, $2, 'failed', $3)", [jobId, card.id, error instanceof Error ? error.message : "Generation failed."]); }
  }
  await db.query("UPDATE generation_jobs SET status = 'completed', completed_at = NOW() WHERE id = $1", [jobId]);
}
