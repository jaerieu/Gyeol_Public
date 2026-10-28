// 결 v0.2 — 기준 글꼴(간체)로 옮기기. spec/02-text.md 2.6절.
// map: dict/variants-v0.2.json 의 "to_simplified" (번체 → 간체).

/** 한자만 간체로 바꾼다. 한글·로마자·기호는 그대로 둔다. */
export function toSimplified(text: string, map: Record<string, string>): string {
  let out = '';
  for (const ch of text) out += map[ch] ?? ch;
  return out;
}

/** 기준 글꼴(간체)이 아닌 글자: 따로 간체가 있는 번체·이체자. */
export function nonStandardChars(text: string, map: Record<string, string>): string[] {
  return Array.from(text).filter((ch) => ch in map);
}
