/**
 * Text utility functions for Arabic search normalization and number formatting.
 */

/**
 * Normalizes Arabic text by removing diacritics and unifying similar characters
 * (e.g. أ, إ, آ -> ا | ة -> ه | ى -> ي)
 */
export function normalizeArabicText(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove Arabic tashkeel / diacritics
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // Eastern Arabic digits to Western
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0)) // Persian digits to Western
    .replace(/[\s\-_/\\,.]+/g, ' ');
}

/**
 * Checks if candidate text contains the search query with Arabic-aware normalization
 */
export function matchesArabicQuery(candidate: string | null | undefined, query: string): boolean {
  if (!query) return true;
  if (!candidate) return false;
  const normCandidate = normalizeArabicText(candidate);
  const normQuery = normalizeArabicText(query);
  if (!normQuery) return true;
  return normCandidate.includes(normQuery);
}
