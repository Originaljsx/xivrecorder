/**
 * Translation management for xiv-recorder.
 */
import { Phrase } from './phrases';
import { ENGLISH, Translations } from './english';

const translations: Record<string, Translations> = {
  English: ENGLISH,
};

/**
 * Get a translated phrase. Falls back to English if not found.
 */
export function getLocalePhrase(
  language: string,
  phrase: Phrase,
): string {
  const localeStrings = translations[language] || translations.English;
  return localeStrings[phrase] || ENGLISH[phrase] || phrase;
}

/**
 * Get all available languages.
 */
export function getAvailableLanguages(): string[] {
  return Object.keys(translations);
}
