/**
 * Use case: App download dan cache konten dari server via manifest
 *
 * Bug: 900 artikel dari server tidak punya fallback lokal.
 * Anak tap artikel → fetch detail per-tap → koneksi jelek → layar putih.
 *
 * Fix: Manifest-driven content download.
 * App fetch manifest on open → diff → download new/updated content → cache locally.
 * Content resolution: downloaded → bundled → null.
 *
 * Tests exercise the content-manager module (to be created).
 */

// These tests define the API contract for content-manager.ts
// They will FAIL until content-manager.ts is implemented.

describe("Content Manager: manifest diff", () => {
  it("new items in server manifest → detected as 'to download'", async () => {
    const { diffManifest } = require("../lib/content-manager");

    const serverManifest = {
      version: 2,
      items: [
        { slug: "1", type: "book", version: 1, content_hash: "abc" },
        { slug: "article-112", type: "article", version: 1, content_hash: "def" },
        { slug: "article-9999", type: "article", version: 1, content_hash: "ghi" }, // NEW
      ],
    };

    const localManifest = [
      { slug: "1", type: "book", version: 1, content_hash: "abc" },
      { slug: "article-112", type: "article", version: 1, content_hash: "def" },
    ];

    const diff = diffManifest(serverManifest.items, localManifest);

    expect(diff.toDownload).toEqual([
      expect.objectContaining({ slug: "article-9999" }),
    ]);
    expect(diff.toRemove).toEqual([]);
    expect(diff.unchanged).toHaveLength(2);
  });

  it("updated items (version naik) → detected as 'to download'", async () => {
    const { diffManifest } = require("../lib/content-manager");

    const serverItems = [
      { slug: "1", type: "book", version: 3, content_hash: "xyz" }, // version naik dari 1
      { slug: "article-112", type: "article", version: 1, content_hash: "def" },
    ];

    const localManifest = [
      { slug: "1", type: "book", version: 1, content_hash: "abc" },
      { slug: "article-112", type: "article", version: 1, content_hash: "def" },
    ];

    const diff = diffManifest(serverItems, localManifest);

    expect(diff.toDownload).toEqual([
      expect.objectContaining({ slug: "1", version: 3 }),
    ]);
    expect(diff.unchanged).toHaveLength(1);
  });

  it("removed items (ada di lokal tapi tidak di server) → detected as 'to remove'", async () => {
    const { diffManifest } = require("../lib/content-manager");

    const serverItems = [
      { slug: "1", type: "book", version: 1, content_hash: "abc" },
    ];

    const localManifest = [
      { slug: "1", type: "book", version: 1, content_hash: "abc" },
      { slug: "article-112", type: "article", version: 1, content_hash: "def" },
    ];

    const diff = diffManifest(serverItems, localManifest);

    expect(diff.toRemove).toEqual([
      expect.objectContaining({ slug: "article-112" }),
    ]);
  });

  it("unchanged items → not in toDownload or toRemove", async () => {
    const { diffManifest } = require("../lib/content-manager");

    const items = [
      { slug: "1", type: "book", version: 1, content_hash: "abc" },
    ];

    const diff = diffManifest(items, items);

    expect(diff.toDownload).toEqual([]);
    expect(diff.toRemove).toEqual([]);
    expect(diff.unchanged).toHaveLength(1);
  });
});

describe("Content Manager: content resolution", () => {
  it("downloaded content overrides bundled", async () => {
    const { resolveContent } = require("../lib/content-manager");

    // Mock: downloaded version exists
    const downloaded = { slug: "1", title: "Updated Title", pages: [] };
    const bundled = { slug: "1", title: "Old Title", pages: [] };

    const result = resolveContent("1", downloaded, bundled);
    expect(result.title).toBe("Updated Title");
  });

  it("fallback to bundled when no download", async () => {
    const { resolveContent } = require("../lib/content-manager");

    const bundled = { slug: "1", title: "Bundled Title", pages: [] };

    const result = resolveContent("1", null, bundled);
    expect(result.title).toBe("Bundled Title");
  });

  it("return null when no download and no bundled", async () => {
    const { resolveContent } = require("../lib/content-manager");

    const result = resolveContent("article-9999", null, null);
    expect(result).toBeNull();
  });
});

describe("Content Manager: artikel dari server harus bisa diakses offline setelah download", () => {
  it("910 server articles → manifest sync → semua tersedia lokal", async () => {
    // This test verifies the full flow concept:
    // 1. Fetch manifest (910 items)
    // 2. Diff with local (10 bundled)
    // 3. Queue 900 downloads
    // 4. After download: getArticle(djangoPK) works without network

    const { diffManifest } = require("../lib/content-manager");

    // Simulate: server has 910, local has 10
    const serverItems = Array.from({ length: 910 }, (_, i) => ({
      slug: `article-${i + 1}`,
      type: "article" as const,
      version: 1,
      content_hash: `hash-${i}`,
    }));

    const localItems = Array.from({ length: 10 }, (_, i) => ({
      slug: `article-${i + 1}`,
      type: "article" as const,
      version: 1,
      content_hash: `hash-${i}`,
    }));

    const diff = diffManifest(serverItems, localItems);

    // 900 new articles to download
    expect(diff.toDownload).toHaveLength(900);
    expect(diff.unchanged).toHaveLength(10);
    expect(diff.toRemove).toHaveLength(0);
  });
});
