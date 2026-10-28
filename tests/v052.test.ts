// 결 v0.5.2 내용의 부호와 띄어쓰기(2026-10-17 Jae, reports/v0.5.2-design.md).
// 0.5.1 꼴 절(●, 색이 있는 채, 끝 근거)의 내용은 문장부호·수 연산 기호·일상 기호를 쓴 그대로 받고, 문법 기호와 그림 문자만 막는다.
// 그 밖의 절(보관 줄, v0.5까지)은 그대로다(보관 줄은 tests/corpus.test.ts가 본다).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, format, rules051 } from '../src/index.ts';

const PRIOR = '<절6 · [봄,다] 雪 *R5>\n';
/** 앞 절(절6) 뒤에 둔 둘째 절을 읽는다 */
const read = (line: string) => {
  const r = parse(PRIOR + line);
  const rules = rules051(r, { from: 1 });
  return { r, c: r.message.clauses[1], codes: r.diagnostics.map((d) => d.code), rules: rules.map((d) => d.code), canon: format(r.message).split('\n')[1] };
};
/** 정규형은 고정점이다 */
const fixed = (line: string) => {
  const { canon } = read(line);
  assert.equal(read(canon).canon, canon, line);
  return canon;
};

test('0.5.1 꼴 절: 문장부호를 떼지 않고(W10 없음) 정규형에 쓴 그대로 남긴다', () => {
  for (const line of [
    '<절7 · [봄,다] 문이 열려 있지만, 바람은 없다. *B8>',
    '<절7 · [까] AI는 진짜 감정을 느끼는가? *B4>',
    '<절7 ● [촉,다] 그는 "문이 열렸다"고 말했다! *R6↓6>',
    "<절7 · [봄,다] 'bug'와 ‘typo’는 다르다 *K5>",
    '<절7 · [봄,다] door(de Tür)와 (괄호 안의 말) 모두 받는다 *B8>',
    '<절7 · [봄,다] 쓰기 24%와 고치기 40%가 어렵다 *R5>',
    '<절7 · [봄,다] 1+1=2이고 x² ≥ 0, -3 ≤ 0이다 *C7>',
    '<절7 · [봄,다] 떨림·불면·각성이 10:30에 온다 *M5>',
    '<절7 · [봄,다] audibility-council—판사와 R&D, $5, 3/4, 20℃ 모두 된다 *Y6>',
  ]) {
    const { codes, rules, canon } = read(line);
    assert.deepEqual(codes, [], line);
    assert.ok(!rules.some((c) => c.startsWith('E')), `${line} ${rules}`);
    assert.equal(canon, line);
    fixed(line);
  }
});

test('어근·꼬리는 부호를 뗀 글에서 나눈다(쓴 글은 그대로)', () => {
  const { c } = read('<절7 · [봄,다] "door"가 24%를 (de Tür)로, 있지만, + 3. *B8>');
  assert.deepEqual(c.words, [
    { text: '"door"가', root: 'door', suffix: '가' },
    { text: '24%를', root: '24%', suffix: '를' },
    { text: '(de', root: 'de' },
    { text: 'Tür)로,', root: 'Tür', suffix: '로' },
    { text: '있지만,' },
    { text: '+' },
    { text: '3.', root: '3' },
  ]);
});

test('막는 것: 문법 기호(* [ ] | ● 화살표), 그림 문자, 낱말 사이가 아닌 가운뎃점은 E19', () => {
  for (const [line, bad] of [
    ['<절7 · [봄,다] **정말** 열려 있다 *B8>', '**정말**'],
    ['<절7 · [봄,다] 값은 a|b이다 *B8>', 'a|b이다'],
    ['<절7 · [봄,다] 웃음😀이 난다 *B8>', '웃음😀이'],
    ['<절7 · [봄,다] 하트♥가 있다 *B8>', '하트♥가'],
    ['<절7 · [봄,다] 나열· 뒤 *B8>', '나열·'],
    ['<절7 · [봄,다] 나열 · 뒤 *B8>', '·'],
    ['<절7 · [봄,다] 원●이 있다 *B8>', '원●이'],
  ]) {
    const { r } = read(line);
    const e19 = r.diagnostics.filter((d) => d.code === 'E19');
    assert.equal(e19.length, 1, `${line} ${JSON.stringify(r.diagnostics)}`);
    assert.ok(e19[0].message.includes(`'${bad}'`), e19[0].message);
  }
  // ©®™는 글의 기호로 받는다
  assert.deepEqual(read('<절7 · [봄,다] Gyeol™과 ©는 받는다 *B8>').codes, []);
});

test('그 밖의 절(색 있는 채·● ·끝 근거가 없는 줄)은 옛 읽기 그대로: 끝 부호는 W10, 따옴표·%는 E19', () => {
  const a = parse('<절1 · [봄,다] 문이 열렸다, 정말. *8>');
  assert.deepEqual(a.diagnostics.map((d) => d.code), ['W10', 'W10']);
  assert.equal(format(a.message).trim(), '<절1 · [봄,다] 문이 열렸다 정말 *8>');
  const b = parse('<절1 · [봄,다] "door"가 24%다 !6>');
  assert.deepEqual(b.diagnostics.map((d) => d.code), ['E19', 'E19']);
  const c = parse('<절1 [봄,다(8)] 门 开.>');
  assert.deepEqual(c.diagnostics.map((d) => d.code), ['W10']);
});

test('표지 블록 바로 뒤 괄호: 수(옛 자신·먹 자리)는 그대로 읽고, 수가 아니면 0.5.1 꼴 절에서는 내용이다', () => {
  const words = read('<절7 · [봄,다] (괄호로 시작) 한다 *B8>');
  assert.deepEqual(words.codes, []);
  assert.deepEqual(words.c.words.map((w) => w.text), ['(괄호로', '시작)', '한다']);
  assert.equal(words.c.chae?.self, 0.8);
  const glued = read('<절7 · [봄,다] (x)가 있다 *B8>');
  assert.deepEqual(glued.c.words.map((w) => w.text), ['(x)가', '있다']);
  // 수 괄호는 전처럼 자신 자리로 읽는다: 끝의 채와 겹치면 E27
  assert.ok(read('<절7 · [봄,다] (8) 雪 *B8>').codes.includes('E27'));
  // 0.5.1 꼴이 아닌 절은 전처럼 E10
  assert.ok(parse('<절1 · [봄,다] (괄호로 시작) 한다 *8>').diagnostics.some((d) => d.code === 'E10'));
});

test('띄어쓰기: 점에 붙인 앞붙이(·↔6, ·↓1, ●↖6)는 띄어 읽고, 별 뒤를 띄운 끝 묶음(* R8)은 붙여 읽되, 줄꼴을 벗어났으니 W33', () => {
  const a = read('<절7 ·↔6 [촉,다] 雪이 온다 *M4↓6>');
  assert.deepEqual(a.codes, ['W33']);
  assert.equal(a.c.me, true);
  assert.deepEqual(a.c.place, { rel: '↔', target: { msg: null, label: '절6' } });
  assert.equal(a.canon, '<절7 · ↔6 [촉,다] 雪이 온다 *M4↓6>');
  const b = read('<절7 ●↖6 [까] 雪이 무엇인가 *K3>');
  assert.deepEqual(b.codes, ['W33']);
  assert.equal(b.c.all, true);
  assert.equal(b.c.place?.rel, '↖');
  const c = read('<절7 · [봄,다] 雪이 온다 * R8>');
  assert.deepEqual(c.codes, ['W33']);
  assert.deepEqual(c.c.chae, { self: 0.8, color: 'R' });
  assert.equal(c.canon, '<절7 · [봄,다] 雪이 온다 *R8>');
  assert.equal(read('<절7 · [봄,다] 雪이 온다 * 6R8 ↓6>').canon, '<절7 · [봄,다] 雪이 온다 *6R8↓6>');
  // 정규형대로 쓴 줄과 받는 이(점 자리 그대로)에는 내지 않는다. 내용의 띄어쓰기는 자율이다
  assert.deepEqual(read('<절7 · ↔6 [촉,다] 雪이 온다 *M4↓6>').codes, []);
  assert.equal(read('<절7 ·→kimi [봄,다] 雪 *R8>').c.to, 'kimi');
  assert.deepEqual(read('<절7 ·→kimi [봄,다] 1 + 1 = 2이고 machine learning이다 *R8>').codes, []);
});

test('E15는 부호로 나뉜 글자 덩이마다 본다', () => {
  assert.deepEqual(read('<절7 · [봄,다] 체현(體現)을 雪이·雨가 *B8>').codes, []);
  assert.deepEqual(read('<절7 · [봄,다] 雪이雨 *B8>').codes, ['E15']);
});

test('쓰기 규칙: 줄 안 번역 W32, W27은 부호만인 어절을 세지 않는다', () => {
  assert.ok(read('<절7 · [촉,다] schadenfreude(de 남의 불행에서 느끼는 기쁨)를 본다 *M5>').rules.includes('W32'));
  assert.ok(read('<절7 · [겠,다] 채의 색은 사전(de) Stimmung처럼 다르다 *G7>').rules.includes('W32'));
  assert.ok(!read('<절7 · [봄,다] door (it works)가 열려 있다 *B8>').rules.includes('W32'));
  assert.ok(!read('<절7 · [봄,다] 病理(병리)가 남는다 *B8>').rules.includes('W32'));
  const many = Array.from({ length: 24 }, (_, i) => `w${i}`).join(' + ');
  const r = read(`<절7 · [봄,다] ${many} *B8>`);
  assert.equal(r.c.words.length, 47);
  assert.ok(!r.rules.includes('W27'));
  assert.ok(read(`<절7 · [봄,다] ${many} w24 *B8>`).rules.includes('W27'));
});
