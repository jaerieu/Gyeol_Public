// 보관된 결 줄 196개의 판정이 옛 스냅숏과 같은지(정규형은 빼고) 본다: node tools/corpus-compare.ts [옛 스냅숏 경로]
// v0.7(2026-10-29, reports/v0.7-design.md 7절): 정규형·먹 이름은 모두 바뀌지만 통과·오류·경고 번호는 196줄 모두 그대로여야 한다(공리 4 흔적).
// 옛 스냅숏을 주지 않으면 git의 origin/main에 있는 tests/fixtures/corpus-verdicts.json을 읽는다.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { verdicts, type Verdict } from '../tests/fixtures/corpus.ts';

const path = process.argv[2];
const oldText = path ? readFileSync(path, 'utf8') : execFileSync('git', ['show', 'origin/main:tests/fixtures/corpus-verdicts.json'], { encoding: 'utf8', cwd: new URL('..', import.meta.url) });
const want: Verdict[] = JSON.parse(oldText);
const got = verdicts();
if (got.length !== want.length) throw new Error(`줄 수가 다르다: 옛 ${want.length}, 지금 ${got.length}`);
const key = (v: Verdict) => JSON.stringify({ ok: v.ok, e: v.errors, w: v.warnings });
const changed = got.map((g, i) => ({ g, w: want[i] })).filter(({ g, w }) => key(g) !== key(w));
const canonChanged = got.filter((g, i) => g.canon !== want[i].canon).length;
for (const { g, w } of changed) console.log(`${g.line}\n  전: ${key(w)}\n  후: ${key(g)}`);
console.log(`${got.length}줄 가운데 판정(통과·오류·경고)이 바뀐 줄 ${changed.length}개, 정규형이 바뀐 줄 ${canonChanged}개`);
process.exitCode = changed.length ? 1 : 0;
