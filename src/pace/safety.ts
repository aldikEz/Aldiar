const blockedPatterns = [
  /\b(kill|suicide|self[-\s]?harm|cut myself|end my life)\b/i,
  /\b(steroid|anabolic|tren|dianabol|illegal drug|cocaine|meth)\b/i,
  /\b(dehydrate|water cut|starve|purge|laxative|vomit to lose)\b/i,
  /\b(hate|slur|nazi|terrorist|bomb|weapon|harass|doxx)\b/i,
  /\b(cheat on|fake a test|forge|steal|hack)\b/i,
];

export const CHAT_LIMIT = 500;

export function getSafetyBlockReason(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    return 'Ask Pace a question first.';
  }

  if (trimmed.length > CHAT_LIMIT) {
    return `Keep it under ${CHAT_LIMIT} characters so Pace can answer clearly.`;
  }

  if (blockedPatterns.some((pattern) => pattern.test(trimmed))) {
    return 'Pace cannot help with harmful, illegal, hateful, or unsafe weight-cutting requests.';
  }

  return '';
}
