import "server-only";

import { NextRequest } from "next/server";
import { db } from "./db";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getAnonymousUserId(request: NextRequest) {
  return ensureAnonymousUserId(request.headers.get("x-card-garden-user-id"));
}

export async function ensureAnonymousUserId(userId: string | null) {

  if (!userId || !uuidPattern.test(userId)) {
    throw new Error("A valid anonymous user ID is required.");
  }

  await db.query("INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [userId]);
  return userId;
}
