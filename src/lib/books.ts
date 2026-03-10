import type { Book, BookContent, BookPage } from "../types";

// Book data loaded from content/books/*/raw.json at build time
// For now we'll use a static registry. Later this can be dynamic (downloaded bundles).

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
  // Group original single-line pages into logical paragraphs
  // Heuristic: start new paragraph when text starts with capital letter
  // and previous text ends with period, or text is a title-like line
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

    // Break paragraph when sentence ends and next starts fresh
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

  // Flush remaining
  if (currentTexts.length > 0) {
    result.push({
      page: pageNum,
      text: currentTexts.join("\n"),
    });
  }

  return result;
}

export function getAllBooks(): Book[] {
  return rawBooks.map((raw) => ({
    id: String(raw.id),
    title: raw.title,
    coverPath: raw.cover,
    pageCount: raw.pages.length,
    hasAudio: raw.pages.some((p) => p.audio != null),
  }));
}

export function getBookContent(bookId: string): BookContent | null {
  const raw = rawBooks.find((b) => String(b.id) === bookId);
  if (!raw) return null;

  return {
    id: String(raw.id),
    title: raw.title,
    coverPath: raw.cover,
    referenceAr: raw.reference_text_ar,
    referenceId: raw.reference_text_id,
    pages: groupPagesIntoParagraphs(raw.pages),
  };
}
