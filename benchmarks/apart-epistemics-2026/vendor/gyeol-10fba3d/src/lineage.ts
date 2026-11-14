// 결·론 snapshot(통째) 계보 이어쓰기와 절·외부근거 직렬화·변조 대조 도우미
import type { Clause, ExtEvidence } from './types.ts';
import { clauseText03 } from './format.ts';
import { formatExtFence } from './parse/shared.ts';

export interface CarryChange {
  label: string;
  before: string;
  after: string;
}

export interface CarryDiffResult {
  preserved: string[];
  dropped: string[];
  altered: CarryChange[];
  added: string[];
  reordered: string[];
  ok: boolean;
}

function clauseKey(c: Clause, idx: number): string {
  return c.label ? c.label.replace(/^[절점]/u, '') : `@${idx}`;
}

/**
 * 절 하나를 정규형 글(`clauseText03`)로 직렬화하고,
 * 절에 붙은 `evidences` 외에 메시지 수준 외부 근거(`allEvidences`)에서 인용(`↓evdN`·`↓refN`)했지만
 * 아직 본문에 안 붙은 블록이 있으면 같은 줄 뒤에 이어 붙인다.
 */
export function clauseWithEvidence(clause: Clause, allEvidences: readonly ExtEvidence[] = []): string {
  const base = clauseText03(clause).replace(/\r\n/gu, '\n');
  if (!allEvidences.length || !clause.because?.length) return base;
  const attached = new Set((clause.evidences ?? []).map((ev) => `${ev.kind}:${ev.id}`));
  const byKey = new Map<string, ExtEvidence>();
  for (const ev of allEvidences) {
    const k = `${ev.kind}:${ev.id}`;
    if (!byKey.has(k)) byKey.set(k, ev);
  }
  const extra: string[] = [];
  for (const b of clause.because) {
    if (!('ext' in b)) continue;
    const k = `${b.ext}:${b.id}`;
    if (attached.has(k)) continue;
    const ev = byKey.get(k);
    if (!ev) continue;
    attached.add(k);
    extra.push(`${ev.kind}${ev.id} ${formatExtFence(ev.text).replace(/\r\n/gu, '\n')}`);
  }
  return extra.length ? `${base} ${extra.join(' ')}` : base;
}

/**
 * 직전 차례(`priorClauses`)가 다음 `snapshot` 차례(`nextClauses`)에서
 * 삭제(`dropped`)·내용 변조(`altered`)·순서 뒤바뀜(`reordered`) 없이 그대로 이어졌는지 대조한다.
 */
export function carryDiff(
  priorClauses: readonly Clause[],
  nextClauses: readonly Clause[],
  opts: { priorEvidences?: readonly ExtEvidence[]; nextEvidences?: readonly ExtEvidence[] } = {},
): CarryDiffResult {
  const priorEvs = opts.priorEvidences ?? [];
  const nextEvs = opts.nextEvidences ?? priorEvs;

  const nextMap = new Map<string, { index: number; text: string }[]>();
  nextClauses.forEach((c, idx) => {
    const k = clauseKey(c, idx);
    const list = nextMap.get(k) ?? [];
    list.push({ index: idx, text: clauseWithEvidence(c, nextEvs) });
    nextMap.set(k, list);
  });

  const priorKeys = new Set<string>();
  const preserved: string[] = [];
  const dropped: string[] = [];
  const altered: CarryChange[] = [];
  const reordered: string[] = [];

  let prevNextIdx = -1;
  priorClauses.forEach((p, idx) => {
    const k = clauseKey(p, idx);
    priorKeys.add(k);
    const before = clauseWithEvidence(p, priorEvs);
    const matches = nextMap.get(k);
    if (!matches || matches.length === 0) {
      dropped.push(k);
      return;
    }
    const first = matches[0];
    if (first.index < prevNextIdx) reordered.push(k);
    prevNextIdx = Math.max(prevNextIdx, first.index);

    if (matches.length > 1 || first.text !== before) {
      altered.push({
        label: k,
        before,
        after: matches.map((m) => m.text).join(' || '),
      });
    } else {
      preserved.push(k);
    }
  });

  const added: string[] = [];
  nextClauses.forEach((c, idx) => {
    const k = clauseKey(c, idx);
    if (!priorKeys.has(k)) added.push(k);
  });

  return {
    preserved,
    dropped,
    altered,
    added,
    reordered,
    ok: dropped.length === 0 && altered.length === 0 && reordered.length === 0,
  };
}
