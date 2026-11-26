export type Language = 'am' | 'en';

export const LANGUAGE_KEY = 'masai.language';

export const getStoredLanguage = (): Language => {
  try {
    return localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'am';
  } catch {
    return 'am';
  }
};

export const storeLanguage = (language: Language) => {
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Ignore storage failures; the UI still works for this session.
  }
};
