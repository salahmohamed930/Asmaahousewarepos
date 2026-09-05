/**
 * Text utility functions for Arabic search normalization and number formatting.
 */

/**
 * Normalizes Arabic text by removing diacritics, unifying similar characters
 * (e.g. أ, إ, آ -> ا | ة -> ه | ى -> ي), and converting Eastern/Persian digits to Western (0-9).
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
 * Extracts digits only from text after normalizing Eastern/Persian digits
 */
export function extractDigits(text: string | null | undefined): string {
  if (!text) return '';
  const norm = normalizeArabicText(text);
  return norm.replace(/\D/g, '');
}

/**
 * Checks if candidate text matches search query with Arabic-aware, multi-word, and phone/digit normalization
 */
export function matchesArabicQuery(candidate: string | null | undefined, query: string): boolean {
  if (!query) return true;
  if (!candidate) return false;

  const normCandidate = normalizeArabicText(candidate);
  const normQuery = normalizeArabicText(query);
  if (!normQuery) return true;

  // Direct substring match
  if (normCandidate.includes(normQuery)) return true;

  // Digits-only phone/code matching
  const candidateDigits = extractDigits(candidate);
  const queryDigits = extractDigits(query);
  if (queryDigits.length >= 2 && candidateDigits.includes(queryDigits)) {
    return true;
  }

  // Multi-word keyword search (all words in query must exist in candidate)
  const queryWords = normQuery.split(' ').filter(Boolean);
  if (queryWords.length > 1) {
    const candidateWords = normCandidate.split(' ').filter(Boolean);
    const allWordsMatch = queryWords.every((qWord) =>
      candidateWords.some((cWord) => cWord.includes(qWord)) || normCandidate.includes(qWord)
    );
    if (allWordsMatch) return true;
  }

  return false;
}

