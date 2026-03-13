import { getDatabase } from "./database";
import { playGame, endGameSession } from "./api";

export interface LocalGameSession {
  childId: number;
  gameSlug: string;
  expiresAt: number; // unix ms
  serverSessionId: number | null;
}

export async function getActiveSession(
  childId: number,
  gameSlug: string,
  now: number = Date.now()
): Promise<LocalGameSession | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    child_id: number;
    game_slug: string;
    expires_at: number;
    server_session_id: number | null;
  }>(
    `SELECT child_id, game_slug, expires_at, server_session_id
     FROM game_sessions
     WHERE child_id = ? AND game_slug = ? AND expires_at > ? AND ended = 0`,
    childId,
    gameSlug,
    now
  );
  if (!row) return null;
  return {
    childId: row.child_id,
    gameSlug: row.game_slug,
    expiresAt: row.expires_at,
    serverSessionId: row.server_session_id,
  };
}

export async function createSession(
  childId: number,
  gameSlug: string,
  durationMinutes: number
): Promise<LocalGameSession> {
  const db = await getDatabase();
  let serverSessionId: number | null = null;
  let expiresAt = Date.now() + durationMinutes * 60 * 1000;

  try {
    const session = await playGame(gameSlug, childId);
    serverSessionId = session.id;
    // Use server's expires_at (authoritative)
    expiresAt = new Date(session.expires_at).getTime();
  } catch {
    // Offline — use local calculation
  }

  await db.runAsync(
    `INSERT INTO game_sessions (child_id, game_slug, expires_at, server_session_id, ended)
     VALUES (?, ?, ?, ?, 0)`,
    childId,
    gameSlug,
    expiresAt,
    serverSessionId
  );

  return { childId, gameSlug, expiresAt, serverSessionId };
}

export async function endSession(
  childId: number,
  gameSlug: string
): Promise<void> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ server_session_id: number | null }>(
    `SELECT server_session_id FROM game_sessions
     WHERE child_id = ? AND game_slug = ? AND ended = 0`,
    childId,
    gameSlug
  );

  await db.runAsync(
    `UPDATE game_sessions SET ended = 1
     WHERE child_id = ? AND game_slug = ? AND ended = 0`,
    childId,
    gameSlug
  );

  if (row?.server_session_id) {
    try {
      await endGameSession(row.server_session_id);
    } catch {
      // Offline — silently fail
    }
  }
}
