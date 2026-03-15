import type { Book, BookContent, BookPage } from "../types";
import { getDownloadedContent, getAllDownloadedByType } from "./content-manager";

// Bundled books (fallback when offline and no download)
import book01 from "../../content/books/01-sahabat-yang-disebut-namanya-di-langit/raw.json";
import book03 from "../../content/books/03-terbunuhnya-singa-alloh/raw.json";
import book04 from "../../content/books/04-jarir-bin-abdillah-menghancurkan-ka-bah-yaman/raw.json";
import book05 from "../../content/books/05-keberanian-az-zubair-di-negri-habasyah/raw.json";
import book06 from "../../content/books/06-kisah-buhairo-sang-pendeta/raw.json";
import book07 from "../../content/books/07-bangganya-ummu-habibah-dengan-islam/raw.json";
import book08 from "../../content/books/08-amr-bin-salamah-si-imam-kecil/raw.json";
import book09 from "../../content/books/09-sahabat-cilik-nabi-yang-cerdas-1/raw.json";
import book10 from "../../content/books/10-nabi-muhammad/raw.json";
import book11 from "../../content/books/11-keberanian-umar-menampakkan-keislaman/raw.json";
import book12 from "../../content/books/12-al-asyaj-sang-pemilik-perangai-yang-alloh-cintai/raw.json";
import book13 from "../../content/books/13-sahabat-yang-tak-dihiraukan-oleh-orang-orang/raw.json";
import book15 from "../../content/books/15-keberanian-al-barro-bin-malik/raw.json";
import book16 from "../../content/books/16-keberanian-habib-bin-zaid/raw.json";
import book17 from "../../content/books/17-adab-abu-ayyub-al-anshori/raw.json";
import book20 from "../../content/books/20-kemuliaan-ammar-bin-yasir/raw.json";
import book21 from "../../content/books/21-kholid-bin-al-walid/raw.json";
import book22 from "../../content/books/22-sahabat-yang-tidak-ingin-ketinggalan-berperang/raw.json";
import book23 from "../../content/books/23-sahabat-yang-punya-2-sayap/raw.json";
import book24 from "../../content/books/24-sahabat-yang-memiliki-2-sayap/raw.json";

type RawBook = {
  id: number;
  title: string;
  slug?: string;
  cover: string | null;
  reference_text_ar: string | null;
  reference_text_id: string | null;
  pages: { page: number; text: string; audio: string | null }[];
};

const rawBooks: RawBook[] = [
  book01, book03, book04, book05, book06, book07, book08, book09,
  book10, book11, book12, book13, book15, book16, book17,
  book20, book21, book22, book23, book24,
] as RawBook[];

function groupPagesIntoParagraphs(
  pages: { page: number; text: string; audio: string | null }[]
): BookPage[] {
  const result: BookPage[] = [];
  let currentTexts: string[] = [];
  let pageNum = 1;

  for (let i = 0; i < pages.length; i++) {
    const text = pages[i].text.trim();
    if (!text) continue;

    currentTexts.push(text);

    const nextText = i + 1 < pages.length ? pages[i + 1]?.text.trim() : null;
    const endsWithPeriod = /[.!?؟]$/.test(text);
    const nextStartsUpper = nextText
      ? /^[A-Z\u0600-\u06FF"]/.test(nextText)
      : false;

    const isLastPage = i === pages.length - 1;
    const shouldBreak = isLastPage || (endsWithPeriod && nextStartsUpper);

    if (shouldBreak && currentTexts.length > 0) {
      result.push({
        page: pageNum,
        text: currentTexts.join("\n"),
      });
      currentTexts = [];
      pageNum++;
    }
  }

  if (currentTexts.length > 0) {
    result.push({
      page: pageNum,
      text: currentTexts.join("\n"),
    });
  }

  return result;
}

function rawToBook(raw: RawBook): Book {
  return {
    id: raw.slug || String(raw.id),
    title: raw.title,
    coverPath: raw.cover,
    pageCount: raw.pages.length,
    hasAudio: raw.pages.some((p) => p.audio != null),
  };
}

function rawToBookContent(raw: RawBook): BookContent {
  return {
    id: raw.slug || String(raw.id),
    title: raw.title,
    coverPath: raw.cover,
    referenceAr: raw.reference_text_ar,
    referenceId: raw.reference_text_id,
    pages: groupPagesIntoParagraphs(raw.pages),
  };
}

// In-memory cache for downloaded books
let downloadedBooks: Book[] | null = null;

/**
 * Get all books for library display.
 * Resolution: downloaded → bundled (merged, no duplicates).
 */
export function getAllBooks(): Book[] {
  const bundled = rawBooks.map(rawToBook);

  if (downloadedBooks && downloadedBooks.length > 0) {
    const slugs = new Set(downloadedBooks.map(b => b.id));
    // Add bundled books not in downloaded
    for (const b of bundled) {
      if (!slugs.has(b.id)) downloadedBooks.push(b);
    }
    return downloadedBooks;
  }

  return bundled;
}

/**
 * Async version that checks downloaded content from SQLite.
 */
export async function fetchAllBooks(): Promise<Book[]> {
  try {
    const downloaded = await getAllDownloadedByType("book");
    if (downloaded.length > 0) {
      downloadedBooks = downloaded.map((d: any) => ({
        id: d.slug || String(d.id),
        title: d.title,
        coverPath: d.cover,
        pageCount: d.pages?.length || 0,
        hasAudio: d.pages?.some((p: any) => p.audio != null) || false,
      }));
      return getAllBooks();
    }
  } catch {
    // Fall through to bundled
  }
  return rawBooks.map(rawToBook);
}

/**
 * Get book content by ID/slug.
 * Resolution: downloaded → bundled → null.
 */
export function getBookContent(bookId: string): BookContent | null {
  const raw = rawBooks.find((b) => String(b.id) === bookId || b.slug === bookId);
  if (raw) return rawToBookContent(raw);
  return null;
}

/**
 * Async version that checks downloaded content.
 */
export async function fetchBookContent(bookId: string): Promise<BookContent | null> {
  // Try downloaded
  try {
    const downloaded = await getDownloadedContent(bookId);
    if (downloaded) {
      return {
        id: downloaded.slug || bookId,
        title: downloaded.title,
        coverPath: downloaded.cover,
        referenceAr: downloaded.reference_text_ar,
        referenceId: downloaded.reference_text_id,
        pages: groupPagesIntoParagraphs(downloaded.pages || []),
      };
    }
  } catch {
    // Fall through
  }

  // Bundled
  return getBookContent(bookId);
}
