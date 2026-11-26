import { config, isGeminiConfigured } from '../config.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);

/** Thrown when no API key is configured so callers can fall back to local logic. */
export class GeminiUnavailableError extends Error {
  constructor(message = 'Gemini API key is not configured') {
    super(message);
    this.name = 'GeminiUnavailableError';
    this.code = 'gemini_unavailable';
  }
}

/** Thrown when Gemini is reachable but the call failed. */
export class GeminiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.code = code ?? 'gemini_error';
  }
}

export const isGeminiReady = isGeminiConfigured;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Pulls the first JSON object/array out of a model reply, tolerating fences. */
export function extractJson(text) {
  const raw = String(text ?? '').trim();
  if (!raw) throw new GeminiError('Gemini returned an empty response', { code: 'empty_response' });

  const withoutFence = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.search(/[[{]/);
    const end = Math.max(withoutFence.lastIndexOf('}'), withoutFence.lastIndexOf(']'));
    if (start === -1 || end <= start) {
      throw new GeminiError('Gemini response was not valid JSON', { code: 'invalid_json' });
    }
    try {
      return JSON.parse(withoutFence.slice(start, end + 1));
    } catch {
      throw new GeminiError('Gemini response was not valid JSON', { code: 'invalid_json' });
    }
  }
}

const joinParts = (candidate) =>
  (candidate?.content?.parts ?? [])
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim();

/**
 * Calls Gemini and returns parsed JSON.
 * Always fails loudly rather than silently returning a half answer.
 */
export async function generateJson({ system, parts, temperature = 0.35, maxOutputTokens = 2600 }) {
  if (!isGeminiConfigured()) throw new GeminiUnavailableError();

  const model = config.gemini.model;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature,
      maxOutputTokens,
      responseMimeType: 'application/json',
      ...(model.includes('2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.gemini.timeoutMs);
    try {
      const response = await fetch(`${API_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.gemini.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = payload?.error?.message ?? `Gemini request failed (${response.status})`;
        lastError = new GeminiError(message, {
          status: response.status,
          code: response.status === 400 || response.status === 403 ? 'invalid_api_key' : 'gemini_error',
        });
        if (RETRY_STATUSES.has(response.status) && attempt === 0) {
          await sleep(1200);
          continue;
        }
        throw lastError;
      }

      const candidate = payload?.candidates?.[0];
      const finishReason = candidate?.finishReason;
      if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
        throw new GeminiError(`Gemini stopped early (${finishReason})`, { code: 'blocked' });
      }

      return extractJson(joinParts(candidate));
    } catch (error) {
      if (error instanceof GeminiError) throw error;
      lastError =
        error?.name === 'AbortError'
          ? new GeminiError('Gemini took too long to answer', { code: 'timeout' })
          : new GeminiError(error?.message ?? 'Could not reach Gemini', { code: 'network_error' });
      if (attempt === 0) {
        await sleep(900);
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new GeminiError('Gemini request failed');
}
