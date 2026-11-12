// 결 v0.8 및 론(Lon: Lineage Oriented Notation) 코어 단위 시험 (2026-11-11).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractTrailingEvidences, format, glossClause, parse, parseTurn, rules08 } from '../src/index.ts';

function codesOf(text: string, opts: Parameters<typeof rules08>[1] = {}) {
  const r = parse(text, { v08: true });
  return [...r.diagnostics, ...rules08(r, opts)].map((d) => d.code);
}

test('v0.8 <N · 고정 표기: <1 · ●>, <1 ·→●>, <1 ·●> 모두 E18 없이 <1 · ●>로 정규화되고 · 누락(<1 ●>)은 E25', () => {
  for (const input of [
    '<1 · ● [see,say] 기온이 3度 올랐다 *5B8↓T1>',
    '<1 ·→● [see,say] 기온이 3度 올랐다 *5B8↓T1>',
    '<1 ·● [see,say] 기온이 3度 올랐다 *5B8↓T1>',
  ]) {
    const r = parse(input, { v08: true });
    assert.deepEqual(r.diagnostics, [], input);
    assert.deepEqual(rules08(r, { lang: 'ko', ink: 5 }), [], input);
    const canon = format(r.message);
    assert.equal(canon, '<1 · ● [see,say] 기온이 3度 올랐다 *5B8↓T1>\n', input);
    const again = parse(canon);
    assert.deepEqual(again.diagnostics, []);
    assert.equal(format(again.message), canon);
  }

  assert.deepEqual(codesOf('<1 ● [see,say] 기온이 3度 올랐다 *5B8>', { lang: 'ko', ink: 5 }), ['E25']);
  assert.ok(codesOf('<1 · ●→kimi [see,say] 기온이 3度 올랐다 *5B8>').includes('E31'));
});

test('v0.8 E34 완화 및 E15 폐지: top 절은 ↓N 근거 가능하고 gut 절만 E34, 한 어절 한글 뒤 한자 허용', () => {
  const doc = [
    'gyeol 0.8 · lang ko',
    '<1 · ● [top,say] 새로운 話頭를 연다 *5B7>',
    '<2 · ● ↔1 [inf,say] 新法을得하여 분석한다 *6C8↓1>',
    '<3 · ● [gut,say] 미세 tremor가 느껴진다 *6Y5>',
    '<4 · ● [inf,say] 미검증 hunch를 근거 삼음 *6B7↓3>',
    '<5 · ● sup→3 [see,say] 실측 로그에서 latency 급증을 확인함 *6G9↓T2>',
  ].join('\n');
  const r = parse(doc);
  assert.deepEqual(r.diagnostics, []);
  const w = rules08(r);
  assert.deepEqual(
    w.map((d) => [d.line, d.code]),
    [[4, 'E34']],
  );
});

test('론(Lon: Lineage Oriented Notation) 프로파일: 머리 줄 왕복, *먹채·gut·시제 유지, W29·W32 면제, 비허용 표지 E39', () => {
  const lonDoc = [
    'lon 0.8 · lang ko',
    '<1 · ● [see,pst,say] 센서 데이터가 정상 범위(normal)였다 *7B8↓T1>',
    '<2 ·→kimi ↔1 [gut,lim,say] 미세 진동 패턴이 이상하다 *6Y4>',
    '<3 · ● sup→2 [inf,fut,say] 베어링 마모가 진행될 것이다 *7C8↓T2>',
  ].join('\n');
  const r = parse(lonDoc);
  assert.equal(r.message.profile, 'lon');
  assert.equal(r.message.gyeol, '0.8');
  assert.deepEqual(r.diagnostics, []);
  assert.deepEqual(rules08(r), []);

  const formatted = format(r.message);
  assert.match(formatted, /^lon 0\.8 · lang ko\n/);
  const r2 = parse(formatted);
  assert.equal(r2.message.profile, 'lon');
  assert.equal(format(r2.message), formatted);

  assert.deepEqual(codesOf('<1 · ● [top,say] 화두 열기 *5B7>', { profile: 'lon' }), ['E39']);
  assert.deepEqual(codesOf('<1 · ● [see,new,say] 새 발견 *5B7↓T0>', { profile: 'lon' }), ['E39']);
  assert.deepEqual(codesOf('<1 · ● [inf,met,say] 비유 표현 *5B7>', { profile: 'lon' }), ['E39']);
  assert.deepEqual(codesOf('<1 · ● [see,say] 채 누락>', { profile: 'lon' }), ['E33', 'W40']);
  assert.deepEqual(codesOf('<1 · ● [봄,다] 한글 표지 *5B7↓T0>', { profile: 'lon' }), ['W26']);

  const gyeolSingle = parse('gyeol 0.8 · lang ko\n<1 · ● [see,say] 한글 어절만 둘 이상 썼다 *5B8>');
  const gd = rules08(gyeolSingle);
  assert.equal(gd.length, 1);
  assert.equal(gd[0].code, 'W29');
  assert.equal(gd[0].severity, '경고');
});

test('전용 괄호꺽쇠 외부 근거(증N·근N·refN·evdN <[ … ]>): 결·론 모두 어절·스크립트·특수문자 제약 예외로 무결성 왕복', () => {
  // 1. 본래 결(gyeol) 프로파일: 절 뒤 증1·근2 부착 (문장·링크·수학 증명·예약 기호 < > * → ↔ | ● 모두 오류 없음, W29·W32 완전 면제)
  const gyeolEvd = [
    'gyeol 0.8 · lang ko',
    '<1 · ● [see,say] 원문報告의 수렴식을 검증했다 *7B9> 증1 <[∀ε > 0, ∃N : n > N → |a_n - L| < ε * 1, [0, 1] 구간 성립 | 참조: https://spec.example.org/p?a=1&b=2#thm-3]>',
    '<2 · ● sup→1 [inf,say] 후속補正도 일치한다 *7C8↓근2>',
    '근2 <[원문 4절 발췌: "단일 언어 문장으로 길게 적은 외부 근거도 어절·스크립트 제약(W29) 없이 그대로 수용한다."]>',
  ].join('\n');

  const rg = parse(gyeolEvd);
  assert.deepEqual(rg.diagnostics, []);
  // 절 1은 top이 아니라 see이므로 sup→1에는 W36만 나고, 외부 근거 블록 내부 특수문자나 한국어 단일 스크립트에는 어떤 오류·경고도 나지 않음
  const gw = rules08(rg);
  assert.deepEqual(gw.map((d) => d.code), ['W36']);
  assert.equal(rg.message.clauses[0].evidences?.[0]?.kind, 'evd');
  assert.equal(rg.message.clauses[0].evidences?.[0]?.id, '1');
  assert.match(rg.message.clauses[0].evidences?.[0]?.text ?? '', /∀ε > 0/);
  assert.equal(rg.message.evidences?.[0]?.kind, 'ref');
  assert.equal(rg.message.evidences?.[0]?.id, '2');
  assert.match(glossClause(rg.message.clauses[0], 'ko'), /증1 때문/);
  assert.match(glossClause(rg.message.clauses[1], 'en'), /because of ref2/);

  // 정규형 왕복 고정점 확인
  const canonG = format(rg.message);
  assert.match(canonG, /\*7B9↓evd1> evd1 <\[∀ε > 0/);
  assert.match(canonG, /\nref2 <\[원문 4절 발췌:/);
  const rg2 = parse(canonG);
  assert.deepEqual(rg2.diagnostics, []);
  assert.equal(format(rg2.message), canonG);

  // 2. 론(lon) 프로파일 + 유니코드 ⟪ … ⟫ 별칭 입력도 <1 · ● …> evd1 <[ … ]>로 정규화
  const lonEvd = [
    'lon 0.8 · lang ko',
    '<1 · ● [gut,say] 배열 경계 조건이 위험해 보인다 *6Y5>',
    '<2 · ● sup→1 [see,say] 재현 시험에서 오버플로를 확인했다 *7R9> 증1 ⟪idx >= buf[0] * 2 -> panic("OOB <fatal>") at line 412⟫',
  ].join('\n');
  const rl = parse(lonEvd);
  assert.deepEqual(rl.diagnostics, []);
  assert.deepEqual(rules08(rl), []);
  assert.match(format(rl.message), /\*7R9↓evd1> evd1 <\[idx >= buf\[0\] \* 2 -> panic/);
});

test('extractTrailingEvidences: 다중 외부 근거 분리, 내부 꺽쇠 보존, 미완성 열림 O(n) 방어', () => {
  const two = extractTrailingEvidences('<1 · ● [see,say] 검증 *7B9↓증1↓증2> 증1 <[ A ]> 증2 <[ B ]>');
  assert.equal(two.head, '<1 · ● [see,say] 검증 *7B9↓증1↓증2>');
  assert.deepEqual(two.evidences, [
    { kind: 'evd', id: '1', text: 'A' },
    { kind: 'evd', id: '2', text: 'B' },
  ]);

  const inner = extractTrailingEvidences('<1 · ● [see,say] 코드 *7B9↓증1> 증1 <[ if (a[i]>0) return 1; ]>');
  assert.equal(inner.evidences.length, 1);
  assert.equal(inner.evidences[0].text, 'if (a[i]>0) return 1;');

  const nestedVerbatim = extractTrailingEvidences('<1 · ● [see,say] 시험 *7B9> 증1 <[ outer 증2 <[ inner ]>');
  assert.deepEqual(nestedVerbatim.evidences, [{ kind: 'evd', id: '1', text: 'outer 증2 <[ inner' }]);

  const midLine = parse('<1 ·→B [see,say] Q101 전달 *G8↓증101> 증101 <[ 원문 그대로 ]> <1.1 ·→B [inf,say] 추론 *Y6↓1>', { v08: true });
  assert.deepEqual(midLine.diagnostics, []);
  assert.equal(midLine.message.clauses.length, 2);
  assert.deepEqual(rules08(midLine, { knownExtra: new Set(['Q101']) }), []);

  const unclosedSecond = parse('<1 · ● [see,say] 시험 *7B9> 증1 <[ outer ]> 증2 <[ inner', { v08: true });
  assert.ok(unclosedSecond.diagnostics.some((d) => d.code === 'E19'));

  const huge = '<1 · ● [see,say] x *5B8> 증1 <[ ' + 'a '.repeat(50_000);
  const t0 = performance.now();
  const he = extractTrailingEvidences(huge);
  const dtExtract = performance.now() - t0;
  assert.equal(he.evidences.length, 0);
  assert.ok(dtExtract < 20, `100KB 미완성 외부 근거 추출 지연: ${dtExtract.toFixed(2)}ms`);
  const hr = parse(huge, { v08: true });
  assert.ok(hr.diagnostics.some((d) => d.code === 'E19'));
});

test('다중 줄 외부 근거 정규화와 §3.21 E22·E17', () => {
  const multi = [
    '<1 · ● [see,say] 다중줄 *7B9↓증1> 증1 <[',
    '<2 · ● [see,say] 가짜절 *9R9>',
    'x > 0 && y < 1',
    ']>',
    '<3 · ● [inf,say] 다음절 *7C8> 꼬리',
  ].join('\n');
  const mr = parse(multi, { v08: true });
  assert.deepEqual(mr.message.clauses.map((c) => c.label), ['절1', '절3']);
  assert.equal(mr.diagnostics.length, 1);
  assert.equal(mr.diagnostics[0].code, 'E19');
  assert.equal(mr.diagnostics[0].line, 5);

  const unclosedMulti = parse('<1 · ● [see,say] 미완 *7B8> 증1 <[\n둘째 줄', { v08: true });
  assert.ok(unclosedMulti.diagnostics.some((d) => d.code === 'E19' && d.line === 1));

  const dup = parse('<1 · ● [see,say] 중복 *7B8↓증1> 증1 <[ A ]> 증1 <[ B ]>', { v08: true });
  assert.ok(dup.diagnostics.some((d) => d.code === 'E22'));

  const missExt = parse('<1 · ● [see,say] 누락 *7B8↓증99>', { v08: true });
  assert.ok(missExt.diagnostics.some((d) => d.code === 'E17'));
});

test('단일 진입점 parseTurn: 마크다운 머리표·다중 줄 블록·명시 규격(0.7 대 0.8) 고정', () => {
  const okLon = parseTurn('<think>추론</think>\n`론:` <2 · ● [inf,say] 원인 확정 *6G8↓1↓증1>\n풀이: 요약', {
    profile: 'lon',
    spec: '0.8',
    lang: 'ko',
    turnNo: 2,
    priorLines: ['<1 · ● [see,say] 로그 확인 *6B9↓증1> 증1 <[ 첫 줄\n둘째 줄 ]>'],
  });
  assert.equal(okLon.ok, true, okLon.errors.map((e) => e.code).join(','));
  assert.equal(okLon.message.clauses.length, 1);

  const strict08 = parseTurn('<1 ● [봄,다] 옛 꼴 *B9>', { profile: 'gyeol', spec: '0.8', lang: 'ko' });
  assert.equal(strict08.ok, false);
  assert.ok(strict08.errors.some((e) => e.code === 'E25'));

  const explicit07 = parseTurn('<1 ● [봄,다] 옛 꼴 *B9>', { profile: 'gyeol', spec: '0.7', lang: 'ko' });
  assert.equal(explicit07.ok, true);
});
