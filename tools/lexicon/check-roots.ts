// 어근 점검: 한자 어근의 뜻이 한국어와 중국어 사전에서 같은지 본다(거짓 친구 후보 찾기).
// 사전 자료는 저장소에 넣지 않는다. tools/lexicon/README.md 대로 받아 둔다.
//
// 쓰는 법:
//   node tools/lexicon/check-roots.ts <자료 폴더> 整列 新法 愛人 …
//   node tools/lexicon/check-roots.ts <자료 폴더> --from <결 글 파일>
//
// 판정은 후보일 뿐이다. 모델이 실제로 어떻게 읽는지는 V14가 잰다(spec/11-validation.md).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '../../src/index.ts';

const [dataDir, ...rest] = process.argv.slice(2);
if (!dataDir) {
  console.error('쓰는 법: node tools/lexicon/check-roots.ts <자료 폴더> <어근…> | --from <파일>');
  process.exit(1);
}

let roots: string[] = [];
if (rest[0] === '--from') {
  const msg = parse(readFileSync(rest[1], 'utf8')).message;
  const set = new Set<string>();
  for (const c of msg.clauses) for (const w of c.words) if (w.root && /\p{Script=Han}/u.test(w.root)) set.add(w.root);
  roots = [...set];
} else roots = rest;

// ── 자료 읽기 ──
const ko = new Map<string, { reading: string; gloss: string }[]>();
for (const line of readFileSync(join(dataDir, 'kengdic/kengdic.tsv'), 'utf8').split('\n').slice(1)) {
  const [, surface, hanja, gloss] = line.split('\t');
  if (!hanja || !gloss) continue;
  if (!ko.has(hanja)) ko.set(hanja, []);
  ko.get(hanja)!.push({ reading: surface, gloss });
}
const zh = new Map<string, string[]>();
for (const line of readFileSync(join(dataDir, 'zhongwen/data/cedict_ts.u8'), 'utf8').split(/\r?\n/)) {
  if (line.startsWith('#')) continue;
  const m = /^(\S+) (\S+) \[[^\]]*\] \/(.*)\/$/u.exec(line);
  if (!m) continue;
  const glosses = m[3].split('/').filter((g) => !/^(CL:|variant of|old variant|see )/i.test(g));
  for (const form of new Set([m[1], m[2]])) {
    if (!zh.has(form)) zh.set(form, []);
    zh.get(form)!.push(...glosses);
  }
}
const def = new Map<string, string>();
for (const line of readFileSync(join(dataDir, 'unihan-database/kDefinition.txt'), 'utf8').split('\n')) {
  if (!line.startsWith('U+')) continue;
  const [head, , value] = line.split('\t');
  def.set(String.fromCodePoint(parseInt(head.split(' ')[0].slice(2), 16)), value);
}

// ── 뜻 낱말 집합과 겹침 ──
const STOP = new Set('to a an the of and or in on for be one one\'s with by as at from etc sb sth something somebody it is are this that up out into used also'.split(' '));
function stem(w: string): string {
  let s = w;
  for (const suf of ['ations', 'ation', 'ings', 'ing', 'ness', 'ment', 'ions', 'ion', 'ies', 'ed', 'es', 's']) {
    if (s.length > suf.length + 3 && s.endsWith(suf)) {
      s = s.slice(0, -suf.length);
      break;
    }
  }
  if (s.length > 4 && s.endsWith('e')) s = s.slice(0, -1); // examine → examin
  if (s.length > 4 && s.endsWith('y')) s = s.slice(0, -1) + 'i'; // certainty → certainti
  return s;
}
function bag(glosses: string[]): Set<string> {
  const out = new Set<string>();
  for (const g of glosses)
    for (const w of g
      .toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .split(/[^a-z]+/))
      if (w.length > 1 && !STOP.has(w)) out.add(stem(w));
  return out;
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// ── 판정 ──
console.log('| 어근 | 한국어 | 중국어 | 겹침 | 판정 |');
console.log('| --- | --- | --- | --- | --- |');
for (const r of roots) {
  const k = ko.get(r) ?? [];
  const z = zh.get(r) ?? [];
  const kGloss = k.map((e) => e.gloss);
  const kb = bag(kGloss);
  const zb = bag(z);
  const j = jaccard(kb, zb);
  let verdict: string;
  let jj = j;
  const single = [...r].length === 1;
  if (single) {
    // 한 글자는 낱말 사전 대신 Unihan 낱자 뜻과 중국어 낱자 뜻을 비교한다
    jj = jaccard(bag([def.get(r) ?? '']), zb);
    verdict = !def.has(r) ? '낱자 뜻 자료 없음' : z.length === 0 ? '한 글자: 중국어 낱자 항목 없음' : jj === 0 ? '한 글자: 뜻 겹침 없음 — 확인 필요' : '한 글자: 겹침 있음';
  } else if (k.length === 0 && z.length === 0) verdict = '사전에 없는 합성어: 글자 뜻을 조합해 읽힌다. 조율 용어로 정해 두는 것이 좋다';
  else if (z.length === 0) verdict = '중국어 사전에 없음: 중국어 중심 모델이 글자 뜻으로 읽을 수 있다';
  else if (k.length === 0) verdict = '한국어 사전에 없음';
  else if (j < 0.08) verdict = '뜻 겹침 없음: 거짓 친구 후보 — 확인 필요';
  else verdict = '겹침 있음';
  const kText = k.length ? `${k[0].reading} — ${kGloss.slice(0, 2).join('; ').slice(0, 60)}` : single ? `(낱자) ${(def.get(r) ?? '').slice(0, 50)}` : '';
  const zText = z.slice(0, 3).join('; ').slice(0, 60);
  console.log(`| ${r} | ${kText} | ${zText} | ${jj.toFixed(2)} | ${verdict} |`);
}
