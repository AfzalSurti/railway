import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ASSISTANT_SYSTEM_PROMPT, buildUserContent, firstJsonObject, sanitizeLlmOutput } from './llm-output';
import { Draft, Slot } from './slots';

/**
 * Optional Claude-powered understanding of free-form travel requests, via the
 * official Anthropic SDK. See ./llm-output.ts for the shared, untrusted
 * output contract every extractor follows.
 */

let client: Anthropic | null = null;

export function llmEnabled(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY) && env.ASSISTANT_LLM_ENABLED && env.NODE_ENV !== 'test';
}

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1 });
  }
  return client;
}

export async function llmExtract(
  message: string,
  draft: Draft,
  awaiting: Slot | null | undefined,
  todayIso: string,
): Promise<Partial<Draft> | null> {
  if (!llmEnabled()) return null;

  try {
    const response = await getClient().messages.create(
      {
        model: env.ASSISTANT_MODEL,
        max_tokens: 600,
        output_config: { effort: 'low' },
        system: ASSISTANT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserContent(message, draft, awaiting, todayIso) }],
      },
      { timeout: env.ASSISTANT_LLM_TIMEOUT_MS },
    );

    if (response.stop_reason === 'refusal') return null;
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    const json = firstJsonObject(text);
    return json ? sanitizeLlmOutput(json, todayIso) : null;
  } catch (error) {
    logger.warn('Assistant LLM extraction failed; using rule-based parser only', {
      service: 'api',
      event: 'ASSISTANT_LLM_FAILED',
      message: error instanceof Error ? error.message.slice(0, 200) : 'unknown',
    });
    return null;
  }
}
