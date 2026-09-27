import { llmExtract } from './llm-extractor';
import { openRouterExtract } from './openrouter-extractor';
import { Draft, Slot } from './slots';

/**
 * Picks whichever provider is configured. If both AI_API_KEY (OpenRouter or
 * another OpenAI-compatible endpoint) and ANTHROPIC_API_KEY are set,
 * AI_API_KEY wins. With neither set, this is a no-op and the deterministic
 * parser in ./parser.ts does all the work — the assistant works either way.
 */
export async function extractSlots(
  message: string,
  draft: Draft,
  awaiting: Slot | null | undefined,
  todayIso: string,
): Promise<Partial<Draft> | null> {
  const viaOpenRouter = await openRouterExtract(message, draft, awaiting, todayIso);
  if (viaOpenRouter) return viaOpenRouter;
  return llmExtract(message, draft, awaiting, todayIso);
}
