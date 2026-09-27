import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ASSISTANT_SYSTEM_PROMPT, buildUserContent, firstJsonObject, sanitizeLlmOutput } from './llm-output';
import { Draft, Slot } from './slots';

/**
 * Optional slot extraction via an OpenAI-compatible chat-completions endpoint
 * (OpenRouter by default, model configurable). This is plain HTTP — no
 * Anthropic SDK involved — matching the AI_API_KEY / MODEL_NAME / AI_API_URL
 * the user configured. As with the Claude path, the model only ever proposes
 * slot values; sanitizeLlmOutput() Zod-validates and re-normalises everything
 * before it reaches the conversation draft. No tools, no database/provider/
 * browser access.
 */

export function openRouterEnabled(): boolean {
  return Boolean(env.AI_API_KEY) && env.ASSISTANT_LLM_ENABLED && env.NODE_ENV !== 'test';
}

type ChatCompletion = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

/**
 * The actual HTTP call + parsing, with no enabled/test-mode gate. Exported
 * separately so it can be unit tested against a mocked fetch without needing
 * to fight the environment guard that keeps normal test runs offline.
 */
export async function runOpenRouterExtraction(
  message: string,
  draft: Draft,
  awaiting: Slot | null | undefined,
  todayIso: string,
): Promise<Partial<Draft> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.ASSISTANT_LLM_TIMEOUT_MS);

  try {
    const response = await fetch(env.AI_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.AI_API_KEY}`,
        // Recommended by OpenRouter for request attribution; harmless elsewhere.
        'HTTP-Referer': 'https://github.com/AfzalSurti/railway',
        'X-Title': 'AI Travel Booking Agent',
      },
      body: JSON.stringify({
        model: env.MODEL_NAME,
        temperature: 0,
        max_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
          { role: 'user', content: buildUserContent(message, draft, awaiting, todayIso) },
        ],
      }),
    });

    if (!response.ok) {
      logger.warn('Assistant OpenRouter extraction failed; using rule-based parser only', {
        service: 'api',
        event: 'ASSISTANT_OPENROUTER_FAILED',
        message: `HTTP ${response.status}`,
      });
      return null;
    }

    const data = (await response.json()) as ChatCompletion;
    const text = data.choices?.[0]?.message?.content ?? '';
    const json = firstJsonObject(text);
    return json ? sanitizeLlmOutput(json, todayIso) : null;
  } catch (error) {
    logger.warn('Assistant OpenRouter extraction failed; using rule-based parser only', {
      service: 'api',
      event: 'ASSISTANT_OPENROUTER_FAILED',
      message: error instanceof Error ? error.message.slice(0, 200) : 'unknown',
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function openRouterExtract(
  message: string,
  draft: Draft,
  awaiting: Slot | null | undefined,
  todayIso: string,
): Promise<Partial<Draft> | null> {
  if (!openRouterEnabled()) return null;
  return runOpenRouterExtraction(message, draft, awaiting, todayIso);
}
