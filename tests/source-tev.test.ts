// 출처 세 갈래(맥락 ↓T · 받은 자료 ↓evd · 가져온 자료 ↓ref)와 봄의 닿음 W40, 옛 ↓Q W41 (2026-11-12 Jae, spec/03-grammar.md 3.22절)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, format, rules08 } from '../src/index.ts';
import { parseTurn } from '../src/turn.ts';

const codes = (doc: string, profile: 'lon' | 'gyeol' = 'lon') => {
  const r = parse(doc, { v08: true });
  return { parse: r.diagnostics.map((d) => d.code), rules: rules08(r, { lang: 'en', profile }).map((d) => [d.line, d.code]) };
};

test('맥락 ↓T: 읽고 { ctx } 틀로 두며 정규형은 T번호, 메시지 밖이라 E17이 없다', () => {
  const r = parse('<1 · [see,say] the topic is the rollout plan *5G8↓T0>', { v08: true });
  assert.deepEqual(r.diagnostics, []);
  assert.deepEqual(r.message.clauses[0].because, [{ ctx: 0 }]);
  assert.equal(format(r.message), '<1 · [see,say] the topic is the rollout plan *5G8↓T0>\n');
  const low = parse('<1 · [see,say] the topic is the rollout plan *5G8↓t3>', { v08: true });
  assert.deepEqual(low.diagnostics.map((d) => d.code), ['W01']);
  assert.deepEqual(low.message.clauses[0].because, [{ ctx: 3 }]);
});

test('W40 t1형(근거 없는 see 및 그 사슬)은 론에서만, 결에서는 내지 않는다', () => {
  const t1 = '<1 · [see,say] the server returned 500 *5B9>';
  assert.deepEqual(codes(t1, 'lon').rules, [[1, 'W40']]);
  assert.deepEqual(codes(t1, 'gyeol').rules.filter(([, c]) => c === 'W40'), []);
  const chain = '<1 · [see,say] the 門 is open *B8>\n<2 ·→gemma ↔1 [see,new,say] the 風 opens the 門 *Y7↓1>';
  assert.deepEqual(codes(chain, 'lon').rules.filter(([, c]) => c === 'W40'), [[1, 'W40'], [2, 'W40']]);
  assert.deepEqual(codes(chain, 'gyeol').rules.filter(([, c]) => c === 'W40'), []);
});

test('W40 t3형(see의 근거가 추론 절뿐)은 결·론 모두 낸다', () => {
  const t3 = '<1 · [inf,say] the cause is probably a timeout *5B6>\n<2 · ● [see,say] the cause is a timeout *5B9↓1>';
  assert.deepEqual(codes(t3, 'lon').rules, [[2, 'W40']]);
  assert.deepEqual(codes(t3, 'gyeol').rules.filter(([, c]) => c === 'W40'), [[2, 'W40']]);
});

test('W40 닿음: ↓T·↓evd·↓ref·주소·참가자·지난 대화, see 사슬, 앞 차례 절이면 내지 않는다', () => {
  for (const doc of [
    '<1 · [see,say] the topic is rollout *5G8↓T0>',
    '<1 · [see,say] the spec says 3 retries *5G8↓ref1> ref1 <[ retries: 3 ]>',
    '<1 · [see,say] build 42 failed *5G8↓evd1> evd1 <[ build 42 FAILED ]>\n<2 · [see,say] the failure is in step 3 *5G7↓1>',
    '<1 · [see,say] the page says so *5G8↓https://example.com>',
    '<1 · [see,say] kimi said it *5G8↓@kimi>',
    '<1 · [see,say] thread 53 showed it *5G8↓53:12>',
  ]) assert.deepEqual(codes(doc).rules, [], doc);
  // 앞 차례의 절(남의 말)을 가리키면 본 것으로 닿는다
  const t = parseTurn('<2 · [see,say] you reported a timeout *5G7↓1>', { profile: 'lon', lang: 'en', priorLines: ['<1 · [inf,say] maybe a timeout *5B6>'] });
  assert.deepEqual(t.warnings.map((d) => d.code), []);
  // 같은 차례 안 see 사슬이 끝내 출처 없이 돌면 닿지 않는다
  assert.deepEqual(codes('<1 · [see,say] a is true *5G7↓2>\n<2 · [see,say] b is true *5G7↓1>').rules, [[1, 'W40'], [2, 'W40']]);
});

test('W41 옛 ↓Q: 뜻은 그대로 읽고(quiz 틀) 경고한다', () => {
  const r = parse('<1 · [see,say] the delay is 12 minutes *5G8↓Q103>', { v08: true });
  assert.deepEqual(r.diagnostics, []);
  assert.deepEqual(r.message.clauses[0].because, [{ quiz: 103 }]);
  assert.deepEqual(rules08(r, { profile: 'lon' }).map((d) => d.code), ['W41']);
});

test('받은 자료 issued: 호출부가 준 evd 번호는 선언 없이 가리켜도 E17이 없고, ref는 받지 않는다', () => {
  const line = '<1 · [see,say] the delay is 12 minutes *5G8↓evd103>';
  assert.deepEqual(parse(line, { v08: true }).diagnostics.map((d) => d.code), ['E17']);
  assert.deepEqual(parse(line, { v08: true, issued: ['evd103'] }).diagnostics, []);
  assert.deepEqual(parse(line, { v08: true, issued: ['증103'] }).diagnostics, []);
  const refLine = '<1 · [see,say] the spec says 3 retries *5G8↓ref5>';
  assert.deepEqual(parse(refLine, { v08: true, issued: ['ref5'] }).diagnostics.map((d) => d.code), ['E17']);
  const t = parseTurn(line, { profile: 'lon', lang: 'en', issued: ['evd103'] });
  assert.equal(t.ok, true);
  assert.deepEqual(t.warnings, []);
});
