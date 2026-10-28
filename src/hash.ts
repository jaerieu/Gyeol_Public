// 결 v0.2 — 먹 이름(SHA-256). spec/09-names.md.
// WebCrypto만 쓰므로 Node(19+), 브라우저, Cloudflare Workers에서 같게 돈다.

import type { Message } from './types.ts';
import { canonDocument } from './text.ts';
import { format } from './format.ts';

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 사전·짝 약속·정답 글처럼 결 문법으로 읽지 않는 글의 먹 이름. */
export async function documentName(text: string): Promise<string> {
  return sha256Hex(canonDocument(text));
}

/** 결 메시지의 먹 이름: 정규형 글의 해시. */
export async function messageName(msg: Message): Promise<string> {
  return sha256Hex(format(msg));
}

/** 짧은 표기: #앞여섯자리. */
export function short(hex: string, n = 6): string {
  return '#' + hex.slice(0, n);
}
