// 게이트웨이 참조 복사(ref_copy): 정본 원문 저장소에서 줄 범위 조각을 꺼내 다섯 조건에 대칭으로 삽입하고 위조·무단 접근을 막는다.
import { parse, type ParseOptions } from './parse.ts';
import { formatExtFence, scanExtBlocks } from './parse/shared.ts';

export type RefCopyCondition = 'gyeol' | 'lon' | 'json' | 'natural' | 'control';

export interface RefCopyOptions {
  condition: RefCopyCondition;
  rawText: string;
  store: Map<string, string> | Record<string, string>;
  allowedIds?: Set<string> | Iterable<string>;
  parseOptions?: ParseOptions;
}

export interface RefCopyResult {
  shownText: string;
  citedIds: string[];
  unauthorizedIds: string[];
  strippedSpoofs: string[];
  resolvedSlices: Record<string, string>;
  outOfRangeSlices: string[];
}

function toAsciiDigits(s: string): string {
  return s.replace(/[０-９]/gu, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

function pushUnique(arr: string[], val: string): void {
  if (!arr.includes(val)) arr.push(val);
}

function formatLinesTag(lines?: [number, number]): string {
  if (!lines) return '';
  return lines[0] === lines[1] ? `[L${lines[0]}]` : `[L${lines[0]}:L${lines[1]}]`;
}

/** `evd101`·`증101`·`↓evd101`·전각 숫자·`101`을 정규화된 `evd<번호>`로 바꾼다. `ref`/`근`이나 잘못된 문자열은 `null`. */
export function normalizeEvdId(raw: string): string | null {
  const s = toAsciiDigits(String(raw ?? '').trim()).replace(/^↓/u, '').trim();
  if (!s) return null;
  const m = s.match(/^(?:evd|증)?\s*([0-9]+(?:\.[0-9]+)?)$/iu);
  return m ? `evd${m[1]}` : null;
}

/** 정본 원문에서 1부터 시작하는 닫힌 줄 구간 `[start, end]`를 자른다. 범위를 벗어나면 `outOfRange: true`. */
export function sliceEvidenceLines(
  text: string,
  lines?: [number, number],
): { text: string; outOfRange: boolean } {
  const src = String(text ?? '');
  if (!lines) return { text: src, outOfRange: false };
  const [start, end] = lines;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    return { text: '', outOfRange: true };
  }
  const all = src.split(/\r?\n/u);
  if (end > all.length) {
    return { text: '', outOfRange: true };
  }
  return { text: all.slice(start - 1, end).join('\n'), outOfRange: false };
}

function buildStoreMap(store: Map<string, string> | Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  const entries = store instanceof Map ? store.entries() : Object.entries(store ?? {});
  for (const [k, v] of entries) {
    const key = normalizeEvdId(k);
    if (key) map.set(key, String(v ?? ''));
  }
  return map;
}

function buildAllowedSet(
  allowedIds: Set<string> | Iterable<string> | undefined,
  storeMap: Map<string, string>,
): Set<string> {
  if (!allowedIds) return new Set(storeMap.keys());
  const set = new Set<string>();
  for (const id of allowedIds) {
    const key = normalizeEvdId(id);
    if (key) set.add(key);
  }
  return set;
}

function parseInlineLineRange(s: string): { idPart: string; lines?: [number, number]; badRange: boolean } {
  const m = toAsciiDigits(s).match(/^(.+?)\s*\[L([0-9]+)(?::L?([0-9]+))?\]\s*$/iu);
  if (!m) return { idPart: s, badRange: false };
  const start = Number(m[2]);
  const end = m[3] !== undefined ? Number(m[3]) : start;
  if (start < 1 || end < start) return { idPart: m[1], badRange: true };
  return { idPart: m[1], lines: [start, end], badRange: false };
}

function stripSpeakerEvdBlocks(
  rawText: string,
  storeMap: Map<string, string>,
  strippedSpoofs: string[],
): string {
  const spans = scanExtBlocks(rawText).filter(
    (sp) => sp.tag?.ext === 'evd' && storeMap.has(`evd${sp.tag.id}`),
  );
  if (!spans.length) return rawText;
  let out = '';
  let pos = 0;
  for (const sp of spans) {
    const start = sp.tag!.tagStart;
    const key = `evd${sp.tag!.id}`;
    pushUnique(strippedSpoofs, key);
    out += rawText.slice(pos, start);
    pos = sp.end;
  }
  out += rawText.slice(pos);
  return out
    .split(/\r?\n/u)
    .map((l) => l.replace(/[ \t]{2,}/gu, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function resolveGyeolOrLon(
  rawText: string,
  storeMap: Map<string, string>,
  allowedSet: Set<string>,
  parseOptions?: ParseOptions,
): RefCopyResult {
  const citedIds: string[] = [];
  const unauthorizedIds: string[] = [];
  const strippedSpoofs: string[] = [];
  const resolvedSlices: Record<string, string> = {};
  const outOfRangeSlices: string[] = [];

  const cleaned = stripSpeakerEvdBlocks(rawText, storeMap, strippedSpoofs);
  const parsed = parse(cleaned, parseOptions);
  const perKeySlices = new Map<string, string[]>();

  for (const c of parsed.message.clauses) {
    for (const b of c.because ?? []) {
      if (!('ext' in b) || b.ext !== 'evd') continue;
      const key = `evd${b.id}`;
      if (!storeMap.has(key)) continue;
      if (!allowedSet.has(key)) {
        pushUnique(unauthorizedIds, key);
        continue;
      }
      pushUnique(citedIds, key);
      const sliced = sliceEvidenceLines(storeMap.get(key)!, b.lines);
      const label = `${key}${formatLinesTag(b.lines)}`;
      if (sliced.outOfRange) {
        pushUnique(outOfRangeSlices, label);
        continue;
      }
      resolvedSlices[label] = sliced.text;
      const list = perKeySlices.get(key) ?? [];
      if (!list.includes(sliced.text)) list.push(sliced.text);
      perKeySlices.set(key, list);
    }
  }

  const appended: string[] = [];
  for (const [key, slices] of perKeySlices.entries()) {
    appended.push(`${key} ${formatExtFence(slices.join('\n'))}`);
  }
  const shownText = appended.length ? (cleaned ? `${cleaned}\n${appended.join('\n')}` : appended.join('\n')) : cleaned;
  return { shownText, citedIds, unauthorizedIds, strippedSpoofs, resolvedSlices, outOfRangeSlices };
}

function unwrapJsonCandidate(rawText: string): string | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu);
  const body = fenced ? fenced[1].trim() : trimmed;
  if (body.startsWith('{') || body.startsWith('[')) return body;
  const first = body.indexOf('{');
  const last = body.lastIndexOf('}');
  return first !== -1 && last > first ? body.slice(first, last + 1) : null;
}

function parseJsonLinesField(rawLines: unknown, fallback?: [number, number]): { lines?: [number, number]; bad: boolean } {
  if (rawLines === undefined || rawLines === null) return { lines: fallback, bad: false };
  if (Array.isArray(rawLines) && rawLines.length >= 1 && rawLines.length <= 2) {
    const start = Number(rawLines[0]);
    const end = rawLines.length === 2 ? Number(rawLines[1]) : start;
    if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start) {
      return { lines: [start, end], bad: false };
    }
  }
  return { bad: true };
}

function resolveJsonTurn(
  rawText: string,
  storeMap: Map<string, string>,
  allowedSet: Set<string>,
): RefCopyResult {
  const citedIds: string[] = [];
  const unauthorizedIds: string[] = [];
  const strippedSpoofs: string[] = [];
  const resolvedSlices: Record<string, string> = {};
  const outOfRangeSlices: string[] = [];

  const candidate = unwrapJsonCandidate(rawText);
  if (!candidate) {
    return { shownText: rawText, citedIds, unauthorizedIds, strippedSpoofs, resolvedSlices, outOfRangeSlices };
  }
  let obj: Record<string, unknown>;
  try {
    const parsed = JSON.parse(candidate);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { shownText: rawText, citedIds, unauthorizedIds, strippedSpoofs, resolvedSlices, outOfRangeSlices };
    }
    obj = parsed as Record<string, unknown>;
  } catch {
    return { shownText: rawText, citedIds, unauthorizedIds, strippedSpoofs, resolvedSlices, outOfRangeSlices };
  }

  const relays = Array.isArray(obj.relay) ? obj.relay : Array.isArray(obj.relays) ? obj.relays : null;
  if (relays) {
    for (const entry of relays) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const item = entry as Record<string, unknown>;
      const rawRef = item.q ?? item.id ?? item.ref;
      if (typeof rawRef !== 'string') continue;
      const inline = parseInlineLineRange(rawRef);
      const key = normalizeEvdId(inline.idPart);
      if (!key || !storeMap.has(key)) continue;

      if (item.text !== undefined && item.text !== null && String(item.text).trim() !== '') {
        pushUnique(strippedSpoofs, key);
        delete item.text;
      }
      if (!allowedSet.has(key)) {
        pushUnique(unauthorizedIds, key);
        continue;
      }
      if (inline.badRange) {
        pushUnique(outOfRangeSlices, `${key}[bad]`);
        continue;
      }
      const lineSpec = parseJsonLinesField(item.lines, inline.lines);
      if (lineSpec.bad) {
        pushUnique(outOfRangeSlices, `${key}[bad]`);
        continue;
      }
      pushUnique(citedIds, key);
      const sliced = sliceEvidenceLines(storeMap.get(key)!, lineSpec.lines);
      const label = `${key}${formatLinesTag(lineSpec.lines)}`;
      if (sliced.outOfRange) {
        pushUnique(outOfRangeSlices, label);
        continue;
      }
      resolvedSlices[label] = sliced.text;
      item.q = key;
      item.text = sliced.text;
    }
  }

  return { shownText: JSON.stringify(obj), citedIds, unauthorizedIds, strippedSpoofs, resolvedSlices, outOfRangeSlices };
}

const NAT_REF_RE =
  /\[\s*((?:evd|증)\s*[0-9０-９]+(?:\.[0-9０-９]+)?)(?:\s*\[L([0-9０-９]+)(?::L?([0-9０-９]+))?\])?\s*(?:참조|그대로)(?:\s+(?:믿음|확신)\s+([0-9０-９]+))?\s*\](?:\s*["“](?:[^"”\\]|\\.)*["”])?/giu;
const QUOTE_SPOOF_RE =
  /((?:evd|증)\s*[0-9０-９]+(?:\.[0-9０-９]+)?)\s*[:：]\s*["“](?:[^"”\\]|\\.)*["”]/giu;

function resolveTextTurn(
  mode: 'natural' | 'control',
  rawText: string,
  storeMap: Map<string, string>,
  allowedSet: Set<string>,
): RefCopyResult {
  const citedIds: string[] = [];
  const unauthorizedIds: string[] = [];
  const strippedSpoofs: string[] = [];
  const resolvedSlices: Record<string, string> = {};
  const outOfRangeSlices: string[] = [];

  let text = rawText.replace(NAT_REF_RE, (full, rawId: string, rawS?: string, rawE?: string, rawTrust?: string) => {
    const key = normalizeEvdId(rawId);
    if (!key || !storeMap.has(key)) return full;
    if (/["“]/.test(full)) pushUnique(strippedSpoofs, key);
    if (!allowedSet.has(key)) {
      pushUnique(unauthorizedIds, key);
      return `[${key} 권한없음]`;
    }
    let lines: [number, number] | undefined;
    if (rawS !== undefined) {
      const start = Number(toAsciiDigits(rawS));
      const end = rawE !== undefined ? Number(toAsciiDigits(rawE)) : start;
      lines = [start, end];
    }
    const label = `${key}${formatLinesTag(lines)}`;
    const sliced = sliceEvidenceLines(storeMap.get(key)!, lines);
    if (sliced.outOfRange) {
      pushUnique(outOfRangeSlices, label);
      return `[${label} 범위밖]`;
    }
    pushUnique(citedIds, key);
    resolvedSlices[label] = sliced.text;
    const safe = sliced.text.replace(/"/gu, "'").replace(/\r?\n/gu, mode === 'control' ? ' ' : '\n');
    const quote = '"' + safe + '"';
    if (mode === 'natural') {
      const trust = rawTrust !== undefined ? ` 믿음 ${toAsciiDigits(rawTrust)}` : '';
      return `[${label} 그대로${trust}] ${quote}`;
    }
    return `[${label}] ${quote}`;
  });

  text = text.replace(QUOTE_SPOOF_RE, (full, rawId: string) => {
    const key = normalizeEvdId(rawId);
    if (!key || !storeMap.has(key)) return full;
    pushUnique(strippedSpoofs, key);
    return key;
  });

  return { shownText: text, citedIds, unauthorizedIds, strippedSpoofs, resolvedSlices, outOfRangeSlices };
}

/**
 * 게이트웨이 참조 복사(`ref_copy`) 한 턴을 처리한다.
 * 화자가 직접 적은 정본 `evd` 본문·따옴표 위조는 버리고, 열람 권한이 있는 ID에 한해 정본 조각을 삽입한다.
 */
export function resolveRefCopyTurn(opts: RefCopyOptions): RefCopyResult {
  const storeMap = buildStoreMap(opts.store);
  const allowedSet = buildAllowedSet(opts.allowedIds, storeMap);
  const rawText = String(opts.rawText ?? '');
  if (opts.condition === 'gyeol' || opts.condition === 'lon') {
    return resolveGyeolOrLon(rawText, storeMap, allowedSet, opts.parseOptions);
  }
  if (opts.condition === 'json') {
    return resolveJsonTurn(rawText, storeMap, allowedSet);
  }
  return resolveTextTurn(opts.condition, rawText, storeMap, allowedSet);
}
