// 결 v0.3 줄꼴(2026-10-14): <절N 앞붙이 [표지(자신|먹)] 내용>. 새 꼴이 정규형이고, 옛 꼴(v0.2.1)은 그대로 읽는다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, format, messageName, labelLine, lineFormOf, clausePieces, glossClause, toDigit } from '../src/index.ts';

const codes = (s: string) => parse(s).diagnostics.map((d) => d.code);
const errs = (s: string) => parse(s).diagnostics.filter((d) => d.severity === '오류').map((d) => d.code);
const one = (s: string) => parse(s).message.clauses[0];

test('v0.3 설계 초안의 보기가 오류도 경고도 없이 읽히고, 값이 맞다', () => {
  const src = [
    '<절1 [봄,다(8)] 门 开>',
    '<절2 ↓1 [겠,다(6)] 有人 来过>',
    '<절3 ↖2 →kimi [까] 谁>',
    '<절4 ↔2 [들,네,다(7)] 风 开 门>',
    '<절5 [면,다] 明日 雨> <절6 ↓5 [겠,다(6)] 比赛 延期>',
  ].join('\n');
  const r = parse(src);
  assert.equal(r.ok, true, JSON.stringify(r.diagnostics));
  assert.deepEqual(r.diagnostics, []);
  assert.deepEqual(r.forms, ['0.3', '0.3', '0.3', '0.3', '0.3', '0.3']);
  const [c1, c2, c3, c4] = r.message.clauses;
  assert.deepEqual(c1.marks, { ev: '봄', act: '다' });
  assert.equal(c1.chae?.self, 0.8);
  assert.deepEqual(c1.words.map((w) => w.root), ['门', '开']);
  assert.deepEqual(c2.place, { rel: '↓', target: { msg: null, label: '절1' } });
  assert.equal(c3.to, 'kimi');
  assert.deepEqual(c3.marks, { act: '까' });
  assert.deepEqual(c4.marks, { ev: '들', news: true, act: '다' });
  assert.equal(r.message.clauses[5].place?.target.label, '절5');
});

test('표지 블록은 너그럽게 읽는다: 쉼표·가운뎃점·띄어쓰기·붙여 쓰기, 순서 무관 — 경고 없이 같은 틀', () => {
  const ref = one('<[겠,네,다] 雨>');
  for (const s of ['<[겠·네·다] 雨>', '<[겠 네 다] 雨>', '<[겠네다] 雨>', '<[다,네,겠] 雨>', '<[겠, 네, 다] 雨>', '<[겠、네、다] 雨>']) {
    assert.deepEqual(codes(s), [], s);
    assert.deepEqual(one(s).marks, ref.marks, s);
  }
  assert.deepEqual(one('<[추론,단언] 雨>').marks, { ev: '겠', act: '다' }); // 표지 이름은 W11
  assert.deepEqual(codes('<[추론,단언] 雨>'), ['W11', 'W11']);
});

test('오류로 남는 것: 화행 없음·둘, 근거 둘, 근거 없는 단언, 다 아닌 네, 모르는 표지, 수 아닌 괄호, 내용 없음', () => {
  assert.deepEqual(errs('<[봄] 雨>'), ['E03']);
  assert.deepEqual(errs('<[] 雨>'), ['E03']);
  assert.deepEqual(errs('<[봄,다,까] 雨>'), ['E04']);
  assert.deepEqual(errs('<[봄,들,다] 雨>'), ['E06']);
  assert.deepEqual(errs('<[다] 雨>'), ['E07']);
  assert.deepEqual(errs('<[봄,네,까] 雨>'), ['E08']);
  assert.deepEqual(errs('<[봄,다,조심] 雨>'), ['E05']);
  assert.deepEqual(errs('<[봄,다(조심)] 雨>'), ['E10']);
  assert.deepEqual(errs('<[봄,다(150)] 雨>'), ['E10']);
  assert.deepEqual(errs('<[봄,다]>'), ['E16']);
  assert.deepEqual(errs('<절1 雨>'), ['E01']);
  assert.deepEqual(errs('<절1 [봄,다 雨>'), ['E02']);
  assert.deepEqual(errs('<[봄,다] 雨> 덧붙인 말'), ['E19']);
  assert.deepEqual(errs('<[봄,다] 雨 [들]>'), ['E19']); // 표지 블록 둘
  assert.deepEqual(errs('<→kimi →gemma [봄,다] 雨>'), ['E18']); // 받는 이는 하나
  assert.deepEqual(errs('<↓5 [겠,다] 雨>'), ['E17']); // 가리킨 절이 없다
  // 내용이 비어도 되는 것: 물음, 오류 알림, 받은대로
  assert.deepEqual(errs('<[까]>'), []);
  assert.deepEqual(errs('<절1 [봄,다] 雨>\n<절2 ↖1 →kimi [까]>'), []);
  assert.deepEqual(errs('<절1 [봄,다] 雨>\n<절2 오류→1 [봄,다]>'), []);
  assert.deepEqual(errs('<절2 받은대로 [겠,네]>'), []);
});

test('자신 0~9 한 자리와 먹: (7|9)는 자신 7, 먹 9. 한 자리가 아닌 수는 바꿔 읽고 W20', () => {
  const c = one('<절3 →kimi [봄,다(7|9)] 雪>');
  assert.equal(c.chae?.self, 0.7);
  assert.equal(c.muk?.conf, 0.9);
  assert.deepEqual(codes('<[봄,다(7|9)] 雪>'), ['W21']); // 측정법(W05)은 v0.3 줄에서 묻지 않는다. 이름표 없는 먹은 W21(v0.3.1)
  assert.equal(one('<[봄,다(|9)] 雪>').muk?.conf, 0.9);
  assert.equal(one('<[봄,다(|9)] 雪>').chae, undefined);
  for (const [s, v] of [
    ['(0.8)', 0.8],
    ['(.85)', 0.8],
    ['(80%)', 0.8],
    ['(85)', 0.8],
    ['(1.0)', 0.9],
    ['(10)', 0.9],
    ['(７)', 0.7],
  ] as const) {
    const r = parse(`<[봄,다${s}] 雪>`);
    assert.equal(r.message.clauses[0].chae?.self, v, s);
    assert.equal(r.ok, true, s);
    if (s !== '(７)') assert.ok(codes(`<[봄,다${s}] 雪>`).includes('W20'), s);
  }
  assert.deepEqual([0, 0.05, 0.1, 0.45, 0.8, 0.89, 0.9, 1].map(toDigit), [0, 0, 1, 4, 8, 8, 9, 9]);
});

// v0.3.1(2026-10-14): 정규형의 먹 자리에 이름표 '먹'. 검증 회차 2026-10-14v2 mc3-2에서 32개 중 9개가 (6|9)의 9를 자신으로 읽었다.
test('v0.3.1 먹 이름표: 정규형은 (7|먹4)·(|먹4), 이름표 없는 v0.3 꼴도 같은 뜻·같은 먹 이름, 제자리가 아닌 이름표는 E10', async () => {
  // 정규형과 고정점
  assert.equal(format(parse('<[봄,다(7|9)] 雪>').message), '<[봄,다(7|먹9)] 雪>\n');
  assert.equal(format(parse('<[봄,다(|9)] 雪>').message), '<[봄,다(|먹9)] 雪>\n');
  assert.equal(format(parse('<[봄,다(7)] 雪>').message), '<[봄,다(7)] 雪>\n'); // 자신만 있는 줄은 바이트가 그대로
  assert.equal(format(parse('<[봄,다(7|먹4)] 雪>').message), '<[봄,다(7|먹4)] 雪>\n');
  // 같은 뜻의 여러 꼴: 틀이 같고 진단이 없고 먹 이름이 같다
  const same = ['<[봄,다(7|4)] 雪>', '<[봄,다(7|먹4)] 雪>', '<[봄,다(자신7|먹4)] 雪>', '<[봄,다(7|먹 4)] 雪>', '<[봄,다(7 | 먹4)] 雪>', '<[봄,다(자신 7 | 먹 4)] 雪>', '<[봄,다（７｜먹４）] 雪>', '雪 〈봄·다〉 〔확신 .40@se8〕 「자신 .70」'];
  const ref = await messageName(parse(same[1]).message);
  for (const s of same) {
    // 이름표 없는 먹((7|4))만 W21: 가르치는 말('이름 없는 수는 자신')과 어긋나 보이는 v0.3 꼴. 띄어쓰기는 이름표 앞뒤 어디든 읽는다
    assert.deepEqual(codes(s), s === same[0] ? ['W21'] : [], s);
    assert.equal(one(s).chae?.self, 0.7, s);
    assert.equal(one(s).muk?.conf, 0.4, s);
    assert.equal(await messageName(parse(s).message), ref, s);
  }
  // 이름표 '먹'만 쓴 한 자리는 (|먹N)
  for (const s of ['<[봄,다(먹4)] 雪>', '<[봄,다(먹 4)] 雪>', '<[봄,다(| 먹4)] 雪>', '<[봄,다(|4)] 雪>']) {
    assert.deepEqual(codes(s), s.includes('(|4)') ? ['W21'] : [], s);
    assert.equal(one(s).muk?.conf, 0.4, s);
    assert.equal(one(s).chae, undefined, s);
    assert.equal(format(parse(s).message), '<[봄,다(|먹4)] 雪>\n', s);
  }
  // 제자리가 아닌 이름표는 자리대로 읽으면 뜻이 뒤바뀌므로 오류이고, 틀에 어느 수도 두지 않는다
  for (const s of ['<[봄,다(먹4|7)] 雪>', '<[봄,다(7|자신4)] 雪>', '<[봄,다(먹4/7)] 雪>', '<[봄,다(먹4|)] 雪>']) {
    assert.ok(errs(s).includes('E10'), s);
    assert.equal(one(s).muk, undefined, s);
    assert.equal(one(s).chae, undefined, s);
  }
  // 빈 이름표와 셋으로 나눈 것은 전처럼 E10
  assert.deepEqual(errs('<[봄,다(먹)] 雪>'), ['E10']);
  assert.deepEqual(errs('<[봄,다(7|먹4|3)] 雪>'), ['E10']);
  // 괄호 없이 쓴 수가 둘이면 둘째를 말없이 버리지 않고 E19
  assert.deepEqual(errs('<[겠,다,7|9] 门 开>'), ['E19']);
  assert.deepEqual(errs('<[겠,다,7,9] 门 开>'), ['E19']);
  assert.deepEqual(errs('<[겠,다,7] 门 开>'), []);
  // 한 자리가 아닌 먹은 바꿔 읽고 W20(이름표가 있어도 같다)
  assert.deepEqual(codes('<[봄,다(7|먹.9)] 雪>'), ['W20']);
  assert.equal(one('<[봄,다(7|먹.9)] 雪>').muk?.conf, 0.9);
  // 풀이는 이름표와 상관없이 같다
  assert.deepEqual(glossClause(one('<[겠,다(6|먹9)] 雪>')), glossClause(one('<[겠,다(6|9)] 雪>')));
});

test('자리를 옮겨 쓴 것은 읽되 W19, < >로 싸지 않았거나 닫지 않은 것은 W18, 비슷한 기호는 W01', () => {
  const want = format(parse('<절1 ↓1 [봄,다(8)] 门 开>').message);
  for (const [s, code] of [
    ['<절1 ↓1 门 开 [봄,다(8)]>', 'W19'], // 표지 블록이 내용 뒤
    ['<절1 [봄,다(8)] ↓1 门 开>', 'W19'], // 앞붙이가 표지 블록 뒤
    ['<절1 ↓1 [봄,다](8) 门 开>', 'W19'], // 괄호가 ] 밖
    ['<절1 ↓1 [봄,다,8] 门 开>', 'W19'], // 괄호 없는 수
    ['절1 <↓1 [봄,다(8)] 门 开>', 'W19'], // 이름표가 < 밖
    ['절1 ↓1 [봄,다(8)] 门 开', 'W18'], // < > 없음
    ['<절1 ↓1 [봄,다(8)] 门 开', 'W18'], // > 없음
    ['〈절1 ↓1 ［봄，다（8）］ 门 开〉', 'W01'],
    ['<절1 ↓ 절1 [봄,다(8)] 门 开>', null], // 앞붙이 안의 띄어쓰기는 붙여 읽는다
  ] as const) {
    const r = parse(s);
    assert.equal(r.ok, true, `${s} ${JSON.stringify(r.diagnostics)}`);
    if (code) assert.ok(codes(s).includes(code), `${s}: ${codes(s)}`);
    else assert.deepEqual(codes(s), [], s);
    assert.equal(format(r.message), want, s);
  }
});

test('정규형은 v0.3 줄꼴이고 고정점이다. 옛 꼴과 새 꼴이 같은 뜻이면 먹 이름이 같다', async () => {
  // 3.13절의 대응: 门 开 〈봄·다〉 「자신 .80」 = <[봄,다(8)] 门 开>
  assert.equal(format(parse('门 开 〈봄·다〉 「자신 .80」').message), '<[봄,다(8)] 门 开>\n');
  assert.equal(await messageName(parse('门 开 〈봄·다〉 「자신 .80」').message), await messageName(parse('<[봄,다(8)] 门 开>').message));
  assert.equal(format(parse('절2 ↓절1 →kimi 雪 〈봄·네·다〉 〔확신 .91@se8〕\n절1 雨 〈봄·다〉').message), '<절2 ↓1 →kimi [봄,네,다(|먹9)] 雪>\n<절1 [봄,다] 雨>\n');
  const inputs = [
    '<절1 [봄,다(8)] 门 开>\n<절2 ↓1 [겠,다(6)] 有人 来过>',
    '<[다,봄] 雨>',
    '<절3 받은대로 ↓1 [겠,네] 新法>\n<절1 [봄,다] 雨>',
    '<[까]>',
    '결 0.3 · 갑→을\n<절1 고침→1 [봄,다(7|9)] 雪>\n낙관 갑 · 기억 대화',
    '절1 整列의 新法을 得했다 〈겠·네·다〉 〔대안 新 .72 改 .21 · 확신 .85 · 노력 .60〕 「전함 .70」',
    '조율 시험 <점1 [겠,다] 整列 新法>',
  ];
  for (const x of inputs) {
    const once = format(parse(x).message);
    assert.equal(format(parse(once).message), once, x);
    assert.equal(parse(once).ok, true, once + JSON.stringify(parse(once).diagnostics));
  }
});

test('옛 꼴은 v0.2.1과 똑같이 읽는다: 옛 줄의 판정은 그대로다(맞던 줄은 맞고 틀리던 줄은 틀린다)', () => {
  assert.deepEqual(parse('门 开 〈봄·다〉 「자신 .80」').forms, ['0.2']);
  assert.deepEqual(errs('雨 〈겠다〉'), ['E05', 'E03']); // 옛 꼴의 붙여 쓰기는 여전히 오류(새 꼴에서만 너그럽다)
  assert.deepEqual(errs('雨 〈다·봄〉'), ['E09', 'E04']);
  assert.deepEqual(errs('↓1 雨 〈겠·다〉'), ['E19']); // 옛 꼴은 번호만 쓴 가리킴을 읽지 않는다(v0.2.1 그대로)
  assert.deepEqual(errs('〈까〉'), []); // 옛 되묻기
  assert.deepEqual(errs('<까>'), []); // ASCII 꺾쇠의 옛 되묻기(표지 블록이 없으니 새 꼴이 아니다)
  assert.equal(lineFormOf('〈까〉'), null);
  assert.equal(lineFormOf('雨 〈봄·다〉 [확신 .8]'), null);
  assert.equal(lineFormOf('<까> [확신 .30]'), null);
  assert.equal(lineFormOf('<절1 [봄,다] 雨>'), 'wrapped');
  assert.equal(lineFormOf('절1 [봄,다] 雨'), 'bare');
  assert.equal(lineFormOf('절1 [확신 .3]'), null); // 표지가 아닌 [ ]는 옛 꼴의 먹으로
  // 한 메시지 안에 두 꼴을 섞어도 된다(광장의 앞 대화는 옛 꼴)
  const mixed = parse('절1 雨 〈봄·다〉\n<절2 ↔1 [들,다] 雪>\n절3 ↓절2 风 〈겠·다〉');
  assert.equal(mixed.ok, true, JSON.stringify(mixed.diagnostics));
  assert.deepEqual(mixed.forms, ['0.2', '0.3', '0.2']);
});

test('받은대로 절: 화행을 빼도 되고, 받은 절·점 이름을 내용에 써도 되며, 접어도 받은대로 절이다', () => {
  const r = parse('<절1 [봄,다] 雨>\n<절2 받은대로 ↓1 [겠,네] 新法>\n<절3 받은대로 [] 점1~점10>');
  assert.equal(r.ok, true, JSON.stringify(r.diagnostics));
  const [, c2, c3] = r.message.clauses;
  assert.equal(c2.echo, true);
  assert.deepEqual(c2.marks, { ev: '겠', news: true });
  assert.deepEqual(c3.words, [{ text: '점1~점10' }]);
  assert.equal(format(r.message).split('\n')[1], '<절2 받은대로 ↓1 [겠,네] 新法>');
  assert.equal(format(r.message, { form: '0.2' }).split('\n')[1], '<절2 받은대로 ↓1 [겠,네] 新法>'); // 옛 꼴로 쓸 수 없어 새 꼴 그대로
});

test('번호만 쓴 가리킴(↓1)은 절1과 점1을 모두 찾는다. 다른 메시지는 #해시:번호', () => {
  assert.deepEqual(errs('<점1 [봄,다] 雨>\n<점2 ↓1 [겠,다] 雪>'), []);
  assert.deepEqual(errs('<절1 [봄,다] 雨>\n<절2 ↓점1 [겠,다] 雪>'), []);
  const c = one('<↔#5be210:2 [봄,다] 雪>');
  assert.deepEqual(c.place, { rel: '↔', target: { msg: '5be210', label: '절2' } });
  assert.equal(format(parse('<↔#5be210:2 [봄,다] 雪>').message), '<↔#5be210:2 [봄,다] 雪>\n');
});

test('채점 쪽의 도구: 이름표 매기기(두 꼴), 한 줄의 절 조각', () => {
  assert.equal(labelLine('<[봄,다] 雨>', '절3'), '<절3 [봄,다] 雨>');
  assert.equal(labelLine('<절9 [봄,다] 雨>', '절3'), '<절3 [봄,다] 雨>');
  assert.equal(labelLine('<절9[봄,다] 雨>', '절3'), '<절3 [봄,다] 雨>');
  assert.equal(labelLine('절9 <↓1 [봄,다] 雨>', '절3'), '<절3 ↓1 [봄,다] 雨>');
  assert.equal(labelLine('절9 [봄,다] 雨', '절3'), '절3 [봄,다] 雨');
  assert.equal(labelLine('절9 雨 〈봄·다〉', '절3'), '절3 雨 〈봄·다〉');
  assert.equal(labelLine('雨 〈봄·다〉', '절3'), '절3 雨 〈봄·다〉');
  assert.deepEqual(clausePieces('<절5 [면,다] 明日 雨> <절6 ↓5 [겠,다(6)] 比赛 延期>'), ['<절5 [면,다] 明日 雨>', '<절6 ↓5 [겠,다(6)] 比赛 延期>']);
  assert.deepEqual(clausePieces('雨 〈봄·다〉'), ['雨 〈봄·다〉']);
  assert.deepEqual(clausePieces('<절1 ->kimi [까] 谁>'), ['<절1 →kimi [까] 谁>']);
});

test('표지 풀이표(한국어): 앞붙이·근거·새로앎·화행·자신·먹을 코드가 옮긴다', () => {
  const r = parse('<절1 [봄,다(8)] 门 开>\n<절2 ↓1 →kimi [겠,네,다(6|9)] 有人 来过>\n<절3 받은대로 [들] 风>');
  const [c1, c2, c3] = r.message.clauses;
  assert.equal(glossClause(c1), '직접 봄 · 단언 · 자신 8');
  assert.equal(glossClause(c2), '절1 아래(근거) · kimi에게 · 추론 · 방금 앎 · 단언 · 자신 6 · 먹 9');
  assert.equal(glossClause(c3), '받은 대로 되짚음 · 전해 들음');
  assert.equal(glossClause(one('雨 〈더·다〉 「자신 .55」')), '떠올림 · 단언 · 자신 5'); // 옛 꼴도 같은 표로
});

test('받는 이를 내용 뒤나 < > 밖에 둔 것(2026-10-14v2 쓰기의 주된 오답)은 읽되 W16', () => {
  for (const x of ['<[봄,다] 雪 →kimi>', '<[봄,다] 雪> →kimi', '→kimi <[봄,다] 雪>', '<[봄,다] →kimi 雪>']) {
    const r = parse(x);
    assert.equal(r.ok, true, `${x} ${JSON.stringify(r.diagnostics)}`);
    assert.equal(r.message.clauses[0].to, 'kimi', x);
    assert.equal(format(r.message), '<→kimi [봄,다] 雪>\n', x);
  }
  assert.ok(codes('<[봄,다] 雪 →kimi>').includes('W16'));
  assert.ok(codes('→kimi <[봄,다] 雪>').includes('W16'));
  assert.deepEqual(errs('<→gemma [봄,다] 雪 →kimi>'), ['E18']); // 받는 이는 여전히 하나
  // 화살표 뒤 띄어쓰기·비슷한 화살표도 < > 밖에서 읽고, 경고는 이름마다 한 번
  for (const x of ['<[봄,다] 雪> -> kimi', '<[봄,다] 雪> → kimi', '→ kimi <[봄,다] 雪>']) {
    const r = parse(x);
    assert.equal(r.ok, true, `${x} ${JSON.stringify(r.diagnostics)}`);
    assert.equal(format(r.message), '<→kimi [봄,다] 雪>\n', x);
    assert.equal(codes(x).filter((c) => c === 'W16').length, 1, x);
  }
  // 여러 절이면 줄 끝의 받는 이는 마지막 절, 줄 앞의 받는 이는 첫 절의 것
  const two = parse('<절1 [봄,다] 雪> <절2 [겠,다] 冷> →kimi');
  assert.deepEqual(two.message.clauses.map((c) => c.to), [null, 'kimi']);
  assert.deepEqual(codes('<절1 [봄,다] 雪> <절2 [겠,다] 冷> →kimi'), ['W16']);
  assert.deepEqual(parse('→kimi <절1 [봄,다] 雪>').message.clauses[0].label, '절1');
  assert.deepEqual(errs('<[봄,다] 雪> →kimi, →qwen'), ['E18']); // 여럿은 읽되 하나까지
  assert.deepEqual(errs('<[봄,다] 雪> kimi'), ['E19']); // 화살표 없는 이름은 읽지 않는다
});

test('반례 검토(2026-10-14): 꺾쇠 없이 쓴 줄 끝의 닫는 꺾쇠는 받는 이 이름에 들지 않고, 정규형을 다시 읽을 수 있다', () => {
  for (const s of ['[봄,다] 门 →kimi＞', '[봄,다] 门 →kimi>']) {
    const r = parse(s);
    assert.equal(r.ok, true, `${s} ${JSON.stringify(r.diagnostics)}`);
    assert.equal(r.message.clauses[0].to, 'kimi', s);
    const canon = format(r.message);
    assert.equal(canon, '<→kimi [봄,다] 门>\n', s);
    assert.equal(parse(canon).ok, true, canon);
  }
});
