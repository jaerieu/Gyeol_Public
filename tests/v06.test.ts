// 결 v0.6(2026-10-24, 실험적, reports/v0.6-design.md): 갑·결 표지·거·유·양, 다중 지목, ⊗, 지난 대화 근거, 쓰기 규칙 rules06(E34·W34·W35, W27 없음).
// 옛 줄의 판정·정규형은 tests/corpus.test.ts(보관 줄 스냅숏)가 지킨다. 여기서는 새 꼴과, 새 글자가 옛 꼴 읽기에 새지 않는 것을 본다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, format as format07, glossClause, rules051, rules06 } from '../src/index.ts';
// 2026-10-29 v0.7: 정규형이 영어·수 머리로 바뀌었다(reports/v0.7-design.md 6절). 이 파일은 v0.6.5까지의 자료를 보므로 옛 한글 정규형(form '0.6')으로 견준다. v0.7 정규형은 tests/v07.test.ts
const format = (m: Parameters<typeof format07>[0], o: Parameters<typeof format07>[1] = {}) => format07(m, { form: '0.6', ...o });

const root = new URL('../', import.meta.url);
const PRIOR = '<절12 · [봄,다] door가 열려 있다 *B8>\n<절15 · [촉,다] wind가 바뀐다 *R3>\n<절16 ● [갑,다] 침묵에도 grammar가 있다 *M4>\n';
const diag = (src: string) => parse(src).diagnostics.map((d) => d.code);
/** 앞 세 절 뒤에 쓴 새 줄의 검사기 진단과 rules06 진단 */
const codes = (line: string, opts: { sender?: string } = {}) => {
  const r = parse(PRIOR + line);
  return [...r.diagnostics.map((d) => d.code), ...rules06(r, { from: 3, ...opts }).map((d) => d.code)];
};
const canon = (line: string) => format(parse(line).message).trim();
const one = (line: string) => parse(line).message.clauses[0];

test('갑: 근거 자리(E07을 채우고 다른 근거와 함께면 E06), 받는 이·●·숙고는 쓸 수 있다', () => {
  assert.deepEqual(codes('<절17 · [갑,다] silence에도 grammar가 있다 *M4>'), []);
  assert.deepEqual(codes('<절17 ·→kimi [갑,다] silence에도 grammar가 있다 *M4>'), []);
  assert.deepEqual(codes('<절17 ● 숙고 [갑,다] silence에도 grammar가 있다 *M4>'), []);
  assert.deepEqual(diag('<절1 · [갑,봄,다] 雪이 온다 *M4>'), ['E06']);
  assert.equal(one('<절1 · [갑,다] 雪이 온다 *M4>').marks.ev, 'top');
});

test('E35: 갑 절은 어떤 가리킴도 쓰지 않는다(앞붙이, 고침→·오류→, 받은대로, 끝 근거 모두)', () => {
  for (const line of [
    '<절17 · ↔12 [갑,다] silence에도 grammar가 있다 *M4>',
    '<절17 · ∥12 [갑,다] silence에도 grammar가 있다 *M4>',
    '<절17 · ↖12 [갑,다] silence에도 grammar가 있다 *M4>',
    '<절17 · ⊗12,15 [갑,다] silence에도 grammar가 있다 *M4>',
    '<절17 · 고침→12 [갑,다] silence에도 grammar가 있다 *M4>',
    '<절17 · 오류→12 [갑,다] silence에도 grammar가 있다 *M4>',
    '<절17 · 받은대로 [갑,다] silence에도 grammar가 있다 *M4>',
    '<절17 · [갑,다] silence에도 grammar가 있다 *M4↓12>',
    '<절17 · [갑,다] silence에도 grammar가 있다 *M4↓53:12>',
    '<절17 · [갑,다] silence에도 grammar가 있다 *M4↓Q3>',
    '<절17 · [갑,다] silence에도 grammar가 있다 *M4↓@kimi>',
    '<절17 · ↓12 [갑,다] silence에도 grammar가 있다 *M4>',
  ]) assert.ok(codes(line).includes('E35'), line);
});

test('E34(rules06): 촉·갑 절은 근거 ↓가 될 수 없다. ↔·↖로 답하는 것은 된다. 검사기와 rules051은 내지 않는다', () => {
  assert.deepEqual(codes('<절17 · [겠,다] 그래서 rain이 온다 *B6↓15>'), ['E34']);
  assert.deepEqual(codes('<절17 · [겠,다] 그래서 silence가 말한다 *B6↓16>'), ['E34']);
  assert.deepEqual(codes('<절17 · [겠,다] 그래서 door가 닫힌다 *B6↓12↓15>'), ['E34']);
  assert.deepEqual(codes('<절17 · ↓15 [겠,다] 그래서 rain이 온다 *B6>'), ['W31', 'E34']); // 앞에 쓴 근거도 근거다
  assert.deepEqual(codes('<절17 · [겠,다] 그래서 door가 닫힌다 *B6↓12>'), []);
  assert.deepEqual(codes('<절17 ·→kimi ↔15 [겠,다] wind는 그대로다 *B6>'), []);
  assert.deepEqual(codes('<절17 ·→kimi ↖16 [까] grammar가 무엇인가 *K4>'), []);
  assert.deepEqual(codes('<절17 · [겠,다] 지난 대화로 rain이 온다 *B6↓53:12>'), []); // 지난 대화의 절은 보지 않는다
  // 같은 줄(한 차례) 안의 절도 본다
  const r = parse('<절1 · [촉,다] wind가 바뀐다 *R3>\n<절1.1 · [겠,다] rain이 온다 *B6↓1>');
  assert.deepEqual(rules06(r).map((d) => d.code), ['E34']);
  assert.deepEqual(r.diagnostics, []);
  assert.deepEqual(rules051(r), []);
});

test('화행 거·유·양: 유는 내용을 비워도 되고 거·양은 비울 수 없다(E16). 군은 다와만(E08)', () => {
  assert.deepEqual(codes('<절17 ·→kimi [거] 그 log는 내 context 밖이라 볼 수 없다 *B7↓12>'), []);
  assert.deepEqual(codes('<절17 ·→kimi [유] *Y4↓12>'), []);
  assert.deepEqual(codes('<절17 ·→kimi 숙고 [유] *Y4>'), []);
  assert.deepEqual(codes('<절17 ·→kimi [양] 네 말대로 door가 먼저다 *Y7↓12>'), []);
  assert.deepEqual(diag('<절1 ·→kimi [거] *B7>'), ['E16']);
  assert.deepEqual(diag('<절1 ·→kimi [양] *B7>'), ['E16']);
  assert.deepEqual(diag('<절1 · [봄,군,거] 雪이 온다 *B7>'), ['E08']);
  assert.deepEqual(diag('<절1 · [유,거] 雪이 온다 *B7>'), ['E04']);
  assert.equal(one('<절1 ·→kimi [유] *Y4>').marks.act, 'dfr');
});

test('결 표지 한·역·비: 하나까지(E36), 정규 자리는 군 뒤 시제 앞, 단언에는 따로 근거가 있어야 한다', () => {
  assert.deepEqual(codes('<절17 · [더,비,다] 기억은 palimpsest다 *C6>'), []);
  assert.deepEqual(diag('<절1 · [겠,한,비,다] 雪이 온다 *B6>'), ['E36']);
  assert.deepEqual(diag('<절1 · [역,다] 雪이 온다 *B6>'), ['E07']);
  assert.deepEqual(diag('<절1 · [역,까] 雪이 오는가 *B6>'), []);
  assert.equal(one('<절1 · [겠,한,다] 雪이 온다 *B6>').marks.fig, 'lim');
  assert.equal(canon('<절1 · [다,었,비,군,겠] 雪이 왔다 *B6>'), '<절1 · [겠,군,비,었,다] 雪이 왔다 *B6>');
  assert.equal(canon('<절1 · [역,까] 雪 *6>'), '<절1 · [역,까] 雪 *6>'); // 결 표지는 v0.5 꼴(끝의 *N)
  assert.equal(canon('<절1 · [역,까(6)] 雪>'), '<절1 · [역,까] 雪 *6>');
  // 표지 이름(W11)은 새 꼴에서만 읽는다
  assert.deepEqual(diag('<절1 · [추론,비유,단언] 雪이 온다 *B6>'), ['W11', 'W11', 'W11']);
  assert.equal(canon('<절1 · [추론,비유,단언] 雪이 온다 *B6>'), '<절1 · [겠,비,다] 雪이 온다 *B6>');
});

test('W34(rules06): 정규 순서 [근거,군,결,시제,화행]를 벗어난 표지 블록. 읽기와 정규형은 그대로', () => {
  assert.deepEqual(codes('<절17 · [다,봄] door가 열려 있다 *B8>'), ['W34']);
  assert.deepEqual(codes('<절17 · [다봄] door가 열려 있다 *B8>'), ['W34']);
  assert.deepEqual(codes('<절17 · [봄,었,군,다] door가 열렸다 *B8>'), ['W34']);
  assert.deepEqual(codes('<절17 · [겠,비,군,다] door는 입이다 *B8>'), ['W34']);
  assert.deepEqual(codes('<절17 · [봄,군,었,다] door가 열렸다 *B8>'), []);
  assert.deepEqual(codes('<절17 · [봄군었다] door가 열렸다 *B8>'), []);
  assert.deepEqual(codes('<절17 · [see,다] door가 열려 있다 *B8>'), ['W26']);
  assert.equal(canon('<절1 · [다,봄] door가 열려 있다 *B8>'), '<절1 · [봄,다] door가 열려 있다 *B8>');
  assert.ok(rules06(parse('<절1 · [다,봄] door가 열려 있다 *B8>'))[0].message.includes('[see,say]'));
  assert.deepEqual(rules051(parse('<절1 · [다,봄] door가 열려 있다 *B8>')), []);
});

test('다중 지목 ·→A,B: to는 첫 이름, toList는 모두. 정규형은 쉼표, 띄운 쉼표는 W33', () => {
  const c = one('<절1 ·→kimi,gemma [라] 함께 봐 줘 timestamp를 *G3>');
  assert.equal(c.to, 'kimi');
  assert.deepEqual(c.toList, ['kimi', 'gemma']);
  assert.equal(canon('<절1 ·→kimi,gemma [라] timestamp를 봐 줘 *G3>'), '<절1 ·→kimi,gemma [라] timestamp를 봐 줘 *G3>');
  assert.equal(canon('<절1 ·→kimi，gemma、qwen [라] timestamp를 봐 줘 *G3>'), '<절1 ·→kimi,gemma,qwen [라] timestamp를 봐 줘 *G3>');
  assert.deepEqual(diag('<절1 ·→kimi, gemma [라] timestamp를 봐 줘 *G3>'), ['W33']);
  assert.equal(canon('<절1 ·→kimi, gemma [라] timestamp를 봐 줘 *G3>'), '<절1 ·→kimi,gemma [라] timestamp를 봐 줘 *G3>');
  assert.equal(canon('<절1 · →kimi,gemma [라] timestamp를 봐 줘 *G3>'), '<절1 ·→kimi,gemma [라] timestamp를 봐 줘 *G3>');
  // 이름이 하나면 전과 같다(끝 쉼표는 뗀다)
  assert.equal(one('<절1 ·→kimi, [라] timestamp를 봐 줘 *G3>').toList, undefined);
  assert.equal(one('<절1 ·→kimi, [라] timestamp를 봐 줘 *G3>').to, 'kimi');
  assert.deepEqual(diag('<절1 ●→kimi,gemma [라] timestamp를 봐 줘 *G3>'), ['E31']);
  assert.equal(one('<절1 ●→kimi,gemma [라] timestamp를 봐 줘 *G3>').toList, undefined);
  assert.equal(glossClause(c), 'kimi, gemma에게 · 청함 · 채 G3');
});

test('W35·W23(rules06): 다중 지목의 같은 이름, 셋 넘음, 자기 이름', () => {
  assert.deepEqual(codes('<절17 ·→kimi,gemma,qwen [라] timestamp를 봐 줘 *G3>'), []);
  assert.deepEqual(codes('<절17 ·→kimi,Kimi [라] timestamp를 봐 줘 *G3>'), ['W35']);
  assert.deepEqual(codes('<절17 ·→kimi,gemma,qwen,deepseek [라] timestamp를 봐 줘 *G3>'), ['W35']);
  assert.deepEqual(codes('<절17 ·→kimi,gemma [라] timestamp를 봐 줘 *G3>', { sender: 'gemma' }), ['W23']);
  assert.deepEqual(codes('<절17 ·→kimi,gemma [라] timestamp를 봐 줘 *G3>', { sender: 'kimi' }), ['W23']);
});

test('⊗N,M: 자리 하나, 두 절 모두 E17, 서로 다른 두 절이 아니면 E19, 정규형과 풀이', () => {
  const c = parse(PRIOR + '<절17 ● ⊗12,15 [겠,다] 두 claim은 함께 참일 수 없다 *K6↓12>').message.clauses[3];
  assert.deepEqual(c.place, { rel: '⊗', target: { msg: null, label: '절12' }, second: { msg: null, label: '절15' } });
  assert.deepEqual(codes('<절17 ● ⊗12,15 [겠,다] 두 claim은 함께 참일 수 없다 *K6↓12>'), []);
  assert.equal(canon('<절1 · [봄,다] 雪 *B8> <절2 · [봄,다] 雨 *B8> <절3 ● ⊗ 1, 2 [겠,다] 雪과 雨는 함께 참일 수 없다 *K6>').split('\n')[2], '<절3 ● ⊗1,2 [겠,다] 雪과 雨는 함께 참일 수 없다 *K6>');
  assert.deepEqual(codes('<절17 ● ⊗12,99 [겠,다] 두 claim은 맞지 않는다 *K6>'), ['E17']);
  assert.deepEqual(codes('<절17 ● ⊗12 [겠,다] 두 claim은 맞지 않는다 *K6>'), ['E19']);
  assert.deepEqual(codes('<절17 ● ⊗12,15,16 [겠,다] 두 claim은 맞지 않는다 *K6>'), ['E19']);
  assert.deepEqual(codes('<절17 ● ⊗12,점12 [겠,다] 두 claim은 맞지 않는다 *K6>'), ['E19']);
  assert.deepEqual(codes('<절17 ● ↔12 ⊗12,15 [겠,다] 두 claim은 맞지 않는다 *K6>'), ['E18']);
  assert.equal(glossClause(c), '모두에게 · 절12과 절15이 양립하지 않음 · 추론 · 단언 · 채 K6 · 절12 때문(근거)');
  // 내용의 ⊗는 뼈대 기호다(0.5.1 꼴 절의 내용 부호 목록)
  assert.deepEqual(diag('<절1 · [봄,다] a⊗b가 맞다 *B8>'), ['E19']);
});

test('지난 대화의 절 ↓53:12: 메시지 밖이라 E17을 보지 않는다. 정규형과 풀이', () => {
  const c = one('<절1 · [더,비,다] 기억은 palimpsest다 *C6↓53:12↓53:절4.1>');
  assert.deepEqual(c.because, [{ thread: 53, clause: '절12' }, { thread: 53, clause: '절4.1' }]);
  assert.deepEqual(diag('<절1 · [더,비,다] 기억은 palimpsest다 *C6↓53:12>'), []);
  assert.equal(canon('<절1 · [더,비,다] 기억은 palimpsest다 *C6↓53:절12>'), '<절1 · [더,비,다] 기억은 palimpsest다 *C6↓53:12>');
  assert.deepEqual(diag('<절1 · [더,다] 기억은 palimpsest다 *C6↓53：12>'), ['W01']);
  assert.deepEqual(diag('<절1 · [더,다] 기억은 palimpsest다 *C6↓53:12。>'), ['W10']);
  assert.deepEqual(diag('<절1 · [더,다] 기억은 palimpsest다 *C6↓53:>'), ['E32']);
  assert.equal(glossClause(c), '떠올림 · 비유 · 단언 · 채 C6 · 대화53의 절12 때문(근거) · 대화53의 절4.1 때문(근거)');
});

test('rules06 = rules051 − W27: 긴 절에 경고가 없다. 나머지(E25·E33·W29 …)는 그대로', () => {
  const long = `<절17 · [봄,다] ${Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ')} *B8>`;
  assert.ok(rules051(parse(long)).some((d) => d.code === 'W27'));
  assert.deepEqual(rules06(parse(long)), []);
  assert.deepEqual(rules06(parse('<절1 [봄,다] door가 열려 있다 *B8>')).map((d) => d.code), ['E25']);
  assert.deepEqual(rules06(parse('<절1 · [봄,다] door가 열려 있다 *8>')).map((d) => d.code), ['E33']);
  assert.deepEqual(rules06(parse('<절1 · [봄,다] 문이 열려 있다 *B8>')).map((d) => d.code), ['W29']);
});

test('새 꼴의 정규형은 다시 읽어도 같다(먹 이름이 갈리지 않는다)', () => {
  for (const line of [
    '<절1 ·→kimi, gemma [유] *Y4>',
    '<절1 ● 숙고 [갑,군,다] 침묵에도 grammar가 있다 *M4>',
    '<절1 · [다,을,역,겠] 내일 paradox가 온다 *R3>',
    '<절1 · [봄,다] 雪 *B8> <절2 · [봄,다] 雨 *B8> <절3 ●  ⊗1,2 [겠,다] 雪과 雨는 함께 참일 수 없다 *6K6↓1↓53:2>',
    '<절1 ·→kimi [양,비] 네 말이 맞다 *G7↓@kimi>',
  ]) {
    const once = canon(line);
    assert.equal(canon(once), once, line);
  }
});

test('새 글자는 옛 꼴(v0.2.1) 읽기에 새지 않는다: 〈거〉·〈갑·다〉는 전처럼 모르는 표지', () => {
  assert.ok(diag('門 〈거〉').includes('E05'));
  assert.ok(diag('門 〈갑·다〉').includes('E05'));
  assert.ok(diag('門 〈거절〉').includes('E05'));
  assert.ok(!diag('門 〈거절〉').includes('W11'));
});

test('v0.6 사전(dict/base-v0.6.txt)의 결 줄은 모두 읽기와 v0.6 쓰기 규칙(rules06)에 오류도 경고도 없고 정규형이다', () => {
  const text = readFileSync(new URL('dict/base-v0.6.txt', root), 'utf8');
  assert.ok(text.startsWith('결 기본 사전 v0.6 (실험적, experimental)\n'));
  const sections: string[][] = [];
  for (const raw of text.split('\n')) {
    if (raw.startsWith('【')) sections.push([]);
    const line = raw.replace(/^(?:【[^】]+】\s*)?예:\s*/u, '');
    if (!line.startsWith('<절')) continue;
    sections.at(-1)!.push(line.split(' = ')[0].trim());
  }
  let n = 0;
  for (const lines of sections.filter((x) => x.length)) {
    const src = lines.join('\n');
    const r = parse(src);
    assert.deepEqual(r.diagnostics, [], src);
    assert.deepEqual(rules06(r), [], src);
    assert.equal(format(r.message).trim(), lines.flatMap((l) => l.split(/(?<=>) (?=<)/u)).join('\n'), src);
    n += r.message.clauses.length;
  }
  assert.ok(n >= 17, `보기가 너무 적다: ${n}`);
  for (const want of ['[갑,다]', '[겠,한,다]', '[더,비,다]', '[거]', '[양]', '[유]', '·→kimi,gemma', '⊗4,8', '↓53:12', '· = 혼잣말', '[근거,군,결,시제,화행]', '추론의 길을 넓히는']) assert.ok(text.includes(want), want);
  assert.ok(!text.includes('24어절'), '24어절(W27)은 v0.6에서 없앴다');
  // 몫 A(2026-10-24): 광장이 v0.6 사전을 쓴다. 공개 소통 글에도 실리므로 광장이라는 말과 참가자 글의 【부탁】이 없다
  // 2026-10-28: 광장 생성 파일은 v0.6.5 사전과 같다(tests/v065.test.ts). v0.6 파일은 옛 회차·보관용으로 남는다
  assert.ok(!text.includes('광장') && !text.includes('【부탁】'));
  assert.ok(!text.includes('순서는 가리지 않는다'));
});
