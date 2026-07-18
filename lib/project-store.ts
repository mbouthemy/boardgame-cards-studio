import "server-only";

import { db } from "./db";

export type Card = {
  id: string;
  collectionId: string;
  title: string;
  cardType: string;
  description: string;
  gameEffect: string;
  artworkPath: string | null;
  position: number;
};

export type CardCollection = {
  id: string;
  name: string;
  description: string;
  position: number;
  cards: Card[];
};

export type Project = {
  id: string;
  name: string;
  description: string;
  mood: string | null;
  keywords: string[];
  status: "draft" | "ready" | "archived";
  createdAt: string;
  updatedAt: string;
  collections: CardCollection[];
};

type ProjectRow = Omit<Project, "collections" | "createdAt" | "updatedAt"> & { created_at: Date; updated_at: Date };
type CollectionRow = Omit<CardCollection, "cards"> & { project_id: string; collection_id: string };
type CardRow = Omit<Card, "collectionId" | "cardType" | "gameEffect" | "artworkPath"> & {
  collection_id: string;
  card_type: string;
  game_effect: string;
  artwork_path: string | null;
};

export async function getProjects(userId: string) {
  const { rows: projectRows } = await db.query<ProjectRow>(
    "SELECT id, name, description, mood, keywords, status, created_at, updated_at FROM projects WHERE owner_id = $1 ORDER BY updated_at DESC",
    [userId],
  );

  if (!projectRows.length) return [];

  const projectIds = projectRows.map((project) => project.id);
  const { rows: collectionRows } = await db.query<CollectionRow>(
    "SELECT id AS collection_id, project_id, name, description, position FROM card_collections WHERE project_id = ANY($1::uuid[]) ORDER BY position, created_at",
    [projectIds],
  );
  const collectionIds = collectionRows.map((collection) => collection.collection_id);
  const { rows: cardRows } = collectionIds.length
    ? await db.query<CardRow>(
        "SELECT id, collection_id, title, card_type, description, game_effect, artwork_path, position FROM cards WHERE collection_id = ANY($1::uuid[]) ORDER BY position, created_at",
        [collectionIds],
      )
    : { rows: [] as CardRow[] };

  const cardsByCollection = new Map<string, Card[]>();
  for (const row of cardRows) {
    const cards = cardsByCollection.get(row.collection_id) ?? [];
    cards.push({
      id: row.id, collectionId: row.collection_id, title: row.title, cardType: row.card_type,
      description: row.description, gameEffect: row.game_effect, artworkPath: row.artwork_path, position: row.position,
    });
    cardsByCollection.set(row.collection_id, cards);
  }

  const collectionsByProject = new Map<string, CardCollection[]>();
  for (const row of collectionRows) {
    const collections = collectionsByProject.get(row.project_id) ?? [];
    collections.push({ id: row.collection_id, name: row.name, description: row.description, position: row.position, cards: cardsByCollection.get(row.collection_id) ?? [] });
    collectionsByProject.set(row.project_id, collections);
  }

  return projectRows.map((row) => ({
    id: row.id, name: row.name, description: row.description, mood: row.mood, keywords: row.keywords,
    status: row.status, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
    collections: collectionsByProject.get(row.id) ?? [],
  }));
}

export async function getProject(userId: string, projectId: string) {
  return (await getProjects(userId)).find((project) => project.id === projectId) ?? null;
}

export async function userOwnsCard(userId: string, projectId: string, cardId: string) {
  const { rowCount } = await db.query(
    "SELECT 1 FROM cards c JOIN card_collections cc ON cc.id = c.collection_id JOIN projects p ON p.id = cc.project_id WHERE c.id = $1 AND p.id = $2 AND p.owner_id = $3",
    [cardId, projectId, userId],
  );
  return rowCount === 1;
}
