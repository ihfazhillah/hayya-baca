import { getDatabase } from "./database";
import { isLoggedIn, createChildOnServer } from "./api";
import type { Child } from "../types";

const AVATAR_COLORS = [
  "#E91E63", "#9C27B0", "#3F51B5", "#009688",
  "#FF9800", "#795548", "#607D8B", "#4CAF50",
];

export async function getChildren(): Promise<Child[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    name: string;
    avatar_color: string;
    coins: number;
    stars: number;
    age: number | null;
    server_id: number | null;
  }>("SELECT * FROM children ORDER BY id");

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    avatarColor: r.avatar_color,
    coins: r.coins,
    stars: r.stars,
    age: r.age ?? undefined,
  }));
}

export async function getUnsyncedChildren(): Promise<{ id: number; name: string; age: number | null; avatar_color: string }[]> {
  const db = await getDatabase();
  return db.getAllAsync(
    "SELECT id, name, age, avatar_color FROM children WHERE server_id IS NULL"
  );
}

export async function linkChildToServer(localId: number, serverId: number): Promise<void> {
  if (localId === serverId) {
    // IDs match — just mark as synced
    const db = await getDatabase();
    await db.runAsync("UPDATE children SET server_id = ? WHERE id = ?", serverId, localId);
    return;
  }

  // Remap local ID to server ID across all tables
  const db = await getDatabase();
  await db.execAsync(`
    BEGIN;
    UPDATE reading_progress SET child_id = ${serverId} WHERE child_id = ${localId};
    UPDATE reward_history SET child_id = ${serverId} WHERE child_id = ${localId};
    UPDATE game_sessions SET child_id = ${serverId} WHERE child_id = ${localId};
    DELETE FROM children WHERE id = ${serverId};
    UPDATE children SET id = ${serverId}, server_id = ${serverId} WHERE id = ${localId};
    COMMIT;
  `);
}

export async function addChild(
  name: string,
  age?: number
): Promise<Child> {
  const db = await getDatabase();
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  // If logged in, create on server first so other devices can sync
  const loggedIn = await isLoggedIn();
  if (loggedIn) {
    const serverChild = await createChildOnServer(name, age, color);
    await db.runAsync(
      "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      serverChild.id,
      serverChild.name,
      serverChild.avatar_color,
      serverChild.coins,
      serverChild.stars,
      serverChild.age,
      serverChild.id
    );
    return {
      id: serverChild.id,
      name: serverChild.name,
      avatarColor: serverChild.avatar_color,
      coins: serverChild.coins,
      stars: serverChild.stars,
      age: serverChild.age ?? undefined,
    };
  }

  // Offline — create locally only
  const result = await db.runAsync(
    "INSERT INTO children (name, avatar_color, age) VALUES (?, ?, ?)",
    name,
    color,
    age ?? null
  );

  return {
    id: result.lastInsertRowId,
    name,
    avatarColor: color,
    coins: 0,
    stars: 0,
    age,
  };
}

export async function updateChildCoins(
  childId: number,
  delta: number
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE children SET coins = coins + ? WHERE id = ?",
    delta,
    childId
  );
}

export async function upsertChildFromServer(child: {
  id: number;
  name: string;
  age: number | null;
  avatar_color: string;
  coins: number;
  stars: number;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    child.id,
    child.name,
    child.avatar_color,
    child.coins,
    child.stars,
    child.age,
    child.id
  );
}

export async function deleteChildrenNotIn(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => "?").join(",");
  await db.runAsync(
    `DELETE FROM children WHERE server_id IS NOT NULL AND id NOT IN (${placeholders})`,
    ...ids
  );
}
