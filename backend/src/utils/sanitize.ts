const BLOCKED_META = /path|filepath|screenshot|tracefile|cookie|authorization|password|secret|otp|cvv|card|storage/i;

export function sanitizeExecutionMetadata(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const source = metadata as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (BLOCKED_META.test(key)) {
      continue;
    }
    if (typeof value === 'string' && (value.includes('\\') || value.includes('/artifacts/'))) {
      continue;
    }
    next[key] = value;
  }
  return next;
}
