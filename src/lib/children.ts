import { getDatabase } from "./database";
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

export async function addChild(
  name: string,
  age?: number
): Promise<Child> {
  const db = await getDatabase();
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
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
