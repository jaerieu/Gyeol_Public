// 결 v0.2 — 먹 계산과 해석, 채와의 화음. spec/05-measurement.md, spec/06-expression.md.

import type { Alt, Clause } from './types.ts';
import { EFFORT_T0, HARMONY_BANDS, INTERVAL_BANDS, TONE_CONFIDENCE } from './tables.ts';
import { roundHalfUp2 as round2 } from './text.ts';

/**
 * se<N>: 뜻 무리에서 대안과 확신을 낸다(5.3절).
 * clusters: 무리마다 대표 어근과 표본 수. chosen: 보낸 절이 속한 무리의 번호.
 */
export function mukFromClusters(clusters: { root: string; count: number }[], chosen: number, minShare = 0.05): { alt: Alt[]; conf: number; method: string } {
  const n = clusters.reduce((a, c) => a + c.count, 0);
  if (n < 1 || chosen < 0 || chosen >= clusters.length) throw new Error('무리 정보가 맞지 않는다');
  const share = (c: { count: number }) => c.count / n;
  const others = clusters
    .filter((_, i) => i !== chosen)
    .filter((c) => share(c) >= minShare)
    .sort((a, b) => b.count - a.count);
  const alt: Alt[] = [{ r: clusters[chosen].root, p: round2(share(clusters[chosen])) }, ...others.map((c) => ({ r: c.root, p: round2(share(c)) }))];
  return { alt, conf: round2(share(clusters[chosen])), method: `se${n}` };
}

/** 노력 정규화(5.4절): x / (x + T0). */
export function effortFrom(amount: number, by: '토큰' | '지연', t0?: number): number {
  const T0 = t0 ?? EFFORT_T0[by];
  if (amount < 0 || !Number.isFinite(amount)) throw new Error('양이 맞지 않는다');
  return round2(amount / (amount + T0));
}

/** 척도 꺾은선(5.5절). points: [잰 확신, 실제 정답률]. (0,0)과 (1,1)을 더해 잇는다. */
export function calibrate(conf: number, points: [number, number][]): number {
  const pts = [[0, 0], ...points, [1, 1]].sort((a, b) => a[0] - b[0]) as [number, number][];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (conf <= x1) {
      if (x1 === x0) return y1;
      return y0 + ((conf - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return 1;
}

/** '조율 척도 .80=.74 · .60=.55' 의 본문을 읽는다. */
export function parseScale(text: string): [number, number][] {
  const out: [number, number][] = [];
  for (const m of text.matchAll(/(\d*\.?\d+)\s*=\s*(\d*\.?\d+)/gu)) out.push([Number(m[1]), Number(m[2])]);
  return out;
}

export type Verdict = '화음' | '엇갈림' | '불협';

export interface Harmony {
  e: number; // 드러낸 확신
  m: number; // 잰 확신
  d: number; // e - m
  verdict: Verdict;
  direction: '과신 쪽' | '겸양 쪽' | '같음';
  source: string; // e를 어디서 얻었나: '자신' 또는 어조 낱말
}

/** 화음 판정(6.4절). 판정할 수 없으면 null. */
export function harmony(c: Clause): Harmony | null {
  const m = c.muk?.conf;
  if (m === undefined) return null;
  let e: number | undefined;
  let source = '';
  if (c.chae?.self !== undefined) {
    e = c.chae.self;
    source = '자신';
  } else {
    for (const w of c.chae?.words ?? []) {
      if (w in TONE_CONFIDENCE) {
        e = TONE_CONFIDENCE[w];
        source = w;
        break;
      }
    }
  }
  if (e === undefined) return null;
  const d = round2(e - m);
  const ad = Math.abs(d);
  const verdict: Verdict = ad < HARMONY_BANDS.consonant ? '화음' : ad < HARMONY_BANDS.dissonant ? '엇갈림' : '불협';
  const direction = d > 0 ? '과신 쪽' : d < 0 ? '겸양 쪽' : '같음';
  return { e, m, d, verdict, direction, source };
}

export type Interval = '단2도' | '단3도' | '완전5도';

/** 대안음의 음정(8.3절): 확률 비 r = p2/p1. */
export function altInterval(alt: Alt[]): { r: number; interval: Interval } | null {
  if (alt.length < 2 || alt[0].p <= 0) return null;
  const r = alt[1].p / alt[0].p;
  const interval: Interval = r >= INTERVAL_BANDS.clash ? '단2도' : r >= INTERVAL_BANDS.tension ? '단3도' : '완전5도';
  return { r: round2(r), interval };
}
