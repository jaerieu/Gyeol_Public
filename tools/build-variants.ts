// 이체자 대응표를 만든다: dict/variants-v0.2.json
// 쓰는 법: node tools/build-variants.ts <unihan-database 폴더>
// 자료: https://github.com/unicode-org/unihan-database (Unicode License v3)
//
// 규칙(spec/02-text.md 2.6절):
//   글자 c의 정자 집합 T(c) = 간체→번체(kTraditionalVariant) ∪ Z 이체(kZVariant)
//                            ∪ 뜻이 완전히 같은 의미 이체(kSemanticVariant 가운데 출처 표시가 :T인 것)
//   두 글자는 T(a) ∪ {a} 와 T(b) ∪ {b} 가 겹치면 같은 글자로 본다(이행적으로 넓히지 않는다).
//   그래서 發과 髮은 둘 다 发과 같지만 서로는 다르다.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('쓰는 법: node tools/build-variants.ts <unihan-database 폴더>');
  process.exit(1);
}

const cp = (u: string) => String.fromCodePoint(parseInt(u.replace(/^U\+/, ''), 16));
const map = new Map<string, Set<string>>();
const add = (from: string, to: string) => {
  if (from === to) return;
  if (!map.has(from)) map.set(from, new Set());
  map.get(from)!.add(to);
};

function each(file: string, fn: (ch: string, values: string[]) => void) {
  const text = readFileSync(join(dir, file), 'utf8');
  for (const line of text.split('\n')) {
    if (!line.startsWith('U+')) continue;
    const [head, , value] = line.split('\t');
    const ch = cp(head.split(' ')[0]);
    fn(ch, value.trim().split(/\s+/));
  }
}

let counts = { trad: 0, z: 0, semT: 0 };
const simplified: Record<string, string[]> = {};
each('kTraditionalVariant.txt', (ch, vals) => {
  const ts = vals.map(cp);
  for (const t of ts) {
    add(ch, t);
    counts.trad++;
  }
  // 정자가 아닌 글자(간체): 번체 목록에 자기 자신이 없는 글자
  if (!ts.includes(ch)) simplified[ch] = ts.sort();
});
// 번체 → 간체(기준 글꼴). 목록의 첫째를 쓴다. 자기 자신이 첫째면 바꾸지 않는다.
const toSimplified: Record<string, string> = {};
each('kSimplifiedVariant.txt', (ch, vals) => {
  const first = cp(vals[0]);
  if (first !== ch) toSimplified[ch] = first;
});
each('kZVariant.txt', (ch, vals) => {
  for (const v of vals) {
    add(ch, cp(v.split('<')[0]));
    counts.z++;
  }
});
each('kSemanticVariant.txt', (ch, vals) => {
  for (const v of vals) {
    const [u, src] = v.split('<');
    // 출처 꼬리표 가운데 하나라도 ':T'(완전히 같은 뜻)가 붙은 것만 쓴다
    if (src && /:T\b/.test(src)) {
      add(ch, cp(u));
      counts.semT++;
    }
  }
});

const obj: Record<string, string[]> = {};
for (const k of [...map.keys()].sort()) obj[k] = [...map.get(k)!].sort();

const out = {
  name: '결 이체자 대응표 v0.2',
  source: 'Unicode Unihan database (github.com/unicode-org/unihan-database): kTraditionalVariant, kZVariant, kSemanticVariant(:T)',
  license: 'Unicode License v3 — https://www.unicode.org/license.txt',
  rule: 'T(a)∪{a} 와 T(b)∪{b} 가 겹치면 같은 글자. 이행적으로 넓히지 않는다.',
  map: obj,
  simplified_note: '간체 → 번체(하나 이상). 일본 신자체는 Unihan에서 일부만 덮는다.',
  simplified: Object.fromEntries(Object.entries(simplified).sort()),
  to_simplified_note: '번체 → 간체(기준 글꼴, spec/02-text.md 2.6절). kSimplifiedVariant의 첫째 값.',
  to_simplified: Object.fromEntries(Object.entries(toSimplified).sort()),
};
writeFileSync(new URL('../dict/variants-v0.2.json', import.meta.url), JSON.stringify(out) + '\n');
console.log(`글자 ${Object.keys(obj).length}개, 간체→번체 ${counts.trad}, Z ${counts.z}, 의미:T ${counts.semT}, 간체 ${Object.keys(simplified).length}, 번체→간체 ${Object.keys(toSimplified).length}`);
