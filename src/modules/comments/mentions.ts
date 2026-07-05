const MENTION = /(^|[\s(])@([a-z0-9][a-z0-9._-]{1,63})\b/gi;

export function extractMentionHandles(body: string) {
  const handles = new Set<string>();
  for (const match of body.matchAll(MENTION)) {
    handles.add(match[2].toLowerCase());
  }
  return [...handles];
}
