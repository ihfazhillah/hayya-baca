/**
 * Content Manager — manifest-driven content download.
 *
 * Flow:
 *   App open → fetchManifest → diffManifest → downloadQueue → save locally
 *   Content resolution: downloaded (SQLite) → bundled → null
 */

import { getDatabase } from "./database";
import { emitDataChange } from "./db-events";

// --- Types ---

export interface ManifestItem {
  slug: string;
  type: "book" | "article";
  title: string;
  version: number;
  content_hash?: string;
  min_age?: number;
  categories?: string[];
  quiz_version?: number;
  cover_url?: string;
  reward_coins?: number;
}

export interface ServerManifest {
  version: number;
  updated_at: string;
  items: ManifestItem[];
}

export interface ManifestDiff {
  toDownload: ManifestItem[];
  toRemove: ManifestItem[];
  unchanged: ManifestItem[];
}

export interface LocalManifestEntry {
  slug: string;
  type: string;
  title: string;
  version: number;
  content_hash: string;
  is_bundled: number;
  removed: number;
}

// --- Pure functions (no side effects) ---

/**
 * Compare server manifest items against local manifest.
 */
export function diffManifest(
  serverItems: ManifestItem[],
  localItems: Pick<ManifestItem, "slug" | "type" | "version">[]
): ManifestDiff {
  const localMap = new Map<string, Pick<ManifestItem, "slug" | "type" | "version">>();
  for (const item of localItems) {
    localMap.set(item.slug, item);
  }

  const serverSlugs = new Set<string>();
  const toDownload: ManifestItem[] = [];
  const unchanged: ManifestItem[] = [];

  for (const serverItem of serverItems) {
    serverSlugs.add(serverItem.slug);
    const local = localMap.get(serverItem.slug);

    if (!local) {
      toDownload.push(serverItem);
    } else if (local.version < serverItem.version) {
      toDownload.push(serverItem);
    } else {
      unchanged.push(serverItem);
    }
  }

  const toRemove: ManifestItem[] = [];
  for (const local of localItems) {
    if (!serverSlugs.has(local.slug)) {
      toRemove.push(local as ManifestItem);
    }
  }

  return { toDownload, toRemove, unchanged };
}

/**
 * Resolve content: downloaded → bundled → null.
 */
export function resolveContent<T>(
  _slug: string,
  downloaded: T | null,
  bundled: T | null
): T | null {
  return downloaded ?? bundled ?? null;
}

// --- Database operations ---

async function ensureManifestTable(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS content_manifest (
      slug TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 0,
      content_hash TEXT DEFAULT '',
      content_data TEXT,
      is_bundled INTEGER NOT NULL DEFAULT 0,
      downloaded_at TEXT,
      removed INTEGER NOT NULL DEFAULT 0
    )
  `);
}

export async function getLocalManifest(): Promise<LocalManifestEntry[]> {
  await ensureManifestTable();
  const db = await getDatabase();
  return db.getAllAsync<LocalManifestEntry>(
    "SELECT slug, type, title, version, content_hash, is_bundled, removed FROM content_manifest WHERE removed = 0"
  );
}

export async function saveDownloadedContent(
  item: ManifestItem,
  contentJson: string
): Promise<void> {
  await ensureManifestTable();
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO content_manifest (slug, type, title, version, content_hash, content_data, is_bundled, downloaded_at, removed)
     VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), 0)`,
    item.slug,
    item.type,
    item.title,
    item.version,
    item.content_hash ?? "",
    contentJson
  );
}

export async function markRemoved(slugs: string[]): Promise<void> {
  if (slugs.length === 0) return;
  await ensureManifestTable();
  const db = await getDatabase();
  const placeholders = slugs.map(() => "?").join(",");
  await db.runAsync(
    `UPDATE content_manifest SET removed = 1 WHERE slug IN (${placeholders})`,
    ...slugs
  );
}

export async function getDownloadedContent(slug: string): Promise<any | null> {
  await ensureManifestTable();
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ content_data: string }>(
    "SELECT content_data FROM content_manifest WHERE slug = ? AND removed = 0 AND content_data IS NOT NULL",
    slug
  );
  if (!row) return null;
  try {
    return JSON.parse(row.content_data);
  } catch {
    return null;
  }
}

export async function getAllDownloadedByType(type: "book" | "article"): Promise<any[]> {
  await ensureManifestTable();
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ content_data: string }>(
    "SELECT content_data FROM content_manifest WHERE type = ? AND removed = 0 AND content_data IS NOT NULL",
    type
  );
  return rows.map(r => {
    try { return JSON.parse(r.content_data); }
    catch { return null; }
  }).filter(Boolean);
}

// --- Network operations ---

const MANIFEST_URL = "https://hayyabaca.ihfazh.com/media/published/manifest.json";
const CONTENT_BASE = "https://hayyabaca.ihfazh.com/media/published";

export async function fetchManifest(): Promise<ServerManifest> {
  const res = await fetch(MANIFEST_URL);
  if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status}`);
  return res.json();
}

export async function downloadContent(item: ManifestItem): Promise<string> {
  const url = `${CONTENT_BASE}/${item.type === "article" ? "articles" : "books"}/${item.slug}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${item.slug} (${res.status})`);
  return res.text();
}

// --- Sync orchestration ---

let syncing = false;

export async function syncContent(
  onProgress?: (done: number, total: number) => void
): Promise<{ downloaded: number; removed: number; errors: number }> {
  if (syncing) return { downloaded: 0, removed: 0, errors: 0 };
  syncing = true;

  try {
    // 1. Fetch server manifest
    const manifest = await fetchManifest();

    // 2. Get local manifest
    const local = await getLocalManifest();

    // 3. Diff
    const diff = diffManifest(manifest.items, local);

    // 4. Download new/updated
    let downloaded = 0;
    let errors = 0;
    const total = diff.toDownload.length;

    for (const item of diff.toDownload) {
      try {
        const content = await downloadContent(item);
        await saveDownloadedContent(item, content);
        downloaded++;
        onProgress?.(downloaded, total);
      } catch (e) {
        console.warn(`Download failed: ${item.slug}`, e);
        errors++;
      }
    }

    // 5. Mark removed
    if (diff.toRemove.length > 0) {
      await markRemoved(diff.toRemove.map(i => i.slug));
    }

    if (downloaded > 0 || diff.toRemove.length > 0) {
      emitDataChange("content");
    }

    return { downloaded, removed: diff.toRemove.length, errors };
  } finally {
    syncing = false;
  }
}
