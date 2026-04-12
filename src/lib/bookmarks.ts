import { getDatabase } from "./database";

export type BookmarkContentType = "book" | "article";

export interface BookmarkRow {
  id: number;
  child_id: number;
  content_type: BookmarkContentType;
  content_slug: string;
  created_at: number;
  updated_at: number;
  is_deleted: number;
  synced_at: number | null;
}

export async function isBookmarked(
  childId: number,
  contentType: BookmarkContentType,
  contentSlug: string
): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ is_deleted: number }>(
    "SELECT is_deleted FROM bookmarks WHERE child_id = ? AND content_type = ? AND content_slug = ?",
    childId,
    contentType,
    contentSlug
  );
  return !!row && row.is_deleted === 0;
}

export async function toggleBookmark(
  childId: number,
  contentType: BookmarkContentType,
  contentSlug: string
): Promise<boolean> {
  const db = await getDatabase();
  const now = Date.now();
  const existing = await db.getFirstAsync<{ id: number; is_deleted: number }>(
    "SELECT id, is_deleted FROM bookmarks WHERE child_id = ? AND content_type = ? AND content_slug = ?",
    childId,
    contentType,
    contentSlug
  );
  if (existing) {
    const next = existing.is_deleted === 0 ? 1 : 0;
    await db.runAsync(
      "UPDATE bookmarks SET is_deleted = ?, updated_at = ?, synced_at = NULL WHERE id = ?",
      next,
      now,
      existing.id
    );
    return next === 0;
  }
  await db.runAsync(
    "INSERT INTO bookmarks (child_id, content_type, content_slug, created_at, updated_at, is_deleted, synced_at) VALUES (?, ?, ?, ?, ?, 0, NULL)",
    childId,
    contentType,
    contentSlug,
    now,
    now
  );
  return true;
}

export async function listBookmarks(
  childId: number,
  contentType?: BookmarkContentType
): Promise<BookmarkRow[]> {
  const db = await getDatabase();
  if (contentType) {
    return db.getAllAsync<BookmarkRow>(
      "SELECT * FROM bookmarks WHERE child_id = ? AND content_type = ? AND is_deleted = 0 ORDER BY updated_at DESC",
      childId,
      contentType
    );
  }
  return db.getAllAsync<BookmarkRow>(
    "SELECT * FROM bookmarks WHERE child_id = ? AND is_deleted = 0 ORDER BY updated_at DESC",
    childId
  );
}

export async function getDirtyBookmarks(childId?: number): Promise<BookmarkRow[]> {
  const db = await getDatabase();
  if (childId != null) {
    return db.getAllAsync<BookmarkRow>(
      "SELECT * FROM bookmarks WHERE child_id = ? AND (synced_at IS NULL OR synced_at < updated_at)",
      childId
    );
  }
  return db.getAllAsync<BookmarkRow>(
    "SELECT * FROM bookmarks WHERE synced_at IS NULL OR synced_at < updated_at"
  );
}

export async function markBookmarksSynced(ids: number[], ts: number): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => "?").join(",");
  await db.runAsync(
    `UPDATE bookmarks SET synced_at = ? WHERE id IN (${placeholders})`,
    ts,
    ...ids
  );
}

export interface ServerBookmark {
  content_type: BookmarkContentType;
  content_slug: string;
  is_deleted: boolean;
  updated_at: string;
  created_at?: string;
}

export async function applyServerBookmarks(
  childId: number,
  rows: ServerBookmark[]
): Promise<void> {
  const db = await getDatabase();
  for (const r of rows) {
    const serverTs = Date.parse(r.updated_at) || Date.now();
    const existing = await db.getFirstAsync<{
      id: number;
      updated_at: number;
      synced_at: number | null;
    }>(
      "SELECT id, updated_at, synced_at FROM bookmarks WHERE child_id = ? AND content_type = ? AND content_slug = ?",
      childId,
      r.content_type,
      r.content_slug
    );
    if (!existing) {
      await db.runAsync(
        "INSERT INTO bookmarks (child_id, content_type, content_slug, created_at, updated_at, is_deleted, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        childId,
        r.content_type,
        r.content_slug,
        serverTs,
        serverTs,
        r.is_deleted ? 1 : 0,
        serverTs
      );
      continue;
    }
    // Never clobber locally dirty rows (pending push)
    const isClean =
      existing.synced_at !== null && existing.synced_at >= existing.updated_at;
    if (!isClean) continue;
    await db.runAsync(
      "UPDATE bookmarks SET is_deleted = ?, updated_at = ?, synced_at = ? WHERE id = ?",
      r.is_deleted ? 1 : 0,
      serverTs,
      serverTs,
      existing.id
    );
  }
}
