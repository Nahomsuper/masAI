const AMHARIC = 'am';

/** Reads the UI language the browser sent, defaulting to English for API clients. */
export function requestLanguage(req) {
  const header = String(req.get?.('x-masai-language') ?? req.headers?.['x-masai-language'] ?? '').toLowerCase();
  return header.startsWith(AMHARIC) ? AMHARIC : 'en';
}

/** Prompt suffix that makes Gemini write farmer-facing copy in the selected language. */
export function languageRule(language, { keepCropName = false } = {}) {
  if (language !== AMHARIC) return '';
  return `

LANGUAGE: Write every human-readable string value in Amharic using Ethiopic script. Keep all JSON property names, enum values (category, urgency, stage key) and snake_case identifiers in English.${keepCropName ? ' Keep cropName and variety exactly as the farmer supplied them.' : ''}`;
}
