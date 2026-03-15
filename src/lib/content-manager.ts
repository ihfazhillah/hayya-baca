/**
 * Content Manager — manifest-driven content download.
 *
 * Handles: fetch manifest → diff → download queue → local cache.
 * Content resolution: downloaded → bundled → null.
 */

export interface ManifestItem {
  slug: string;
  type: "book" | "article";
  version: number;
  content_hash?: string;
  title?: string;
  min_age?: number;
  categories?: string[];
  quiz_version?: number;
  cover_url?: string;
}

export interface ManifestDiff {
  toDownload: ManifestItem[];
  toRemove: ManifestItem[];
  unchanged: ManifestItem[];
}

/**
 * Compare server manifest items against local manifest.
 * Returns items to download (new or updated), remove, or skip.
 */
export function diffManifest(
  serverItems: ManifestItem[],
  localItems: ManifestItem[]
): ManifestDiff {
  const localMap = new Map<string, ManifestItem>();
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
      // New item
      toDownload.push(serverItem);
    } else if (local.version < serverItem.version) {
      // Updated
      toDownload.push(serverItem);
    } else {
      unchanged.push(serverItem);
    }
  }

  // Items in local but not in server → removed
  const toRemove: ManifestItem[] = [];
  for (const local of localItems) {
    if (!serverSlugs.has(local.slug)) {
      toRemove.push(local);
    }
  }

  return { toDownload, toRemove, unchanged };
}

/**
 * Resolve content for a given slug.
 * Priority: downloaded → bundled → null.
 */
export function resolveContent<T>(
  slug: string,
  downloaded: T | null,
  bundled: T | null
): T | null {
  return downloaded ?? bundled ?? null;
}
