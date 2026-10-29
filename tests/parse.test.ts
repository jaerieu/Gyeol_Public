import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, format as format07, messageName, foldMessage, levelOf } from '../src/index.ts';
// 2026-10-29 v0.7: 정규형이 영어·수 머리로 바뀌었다(reports/v0.7-design.md 6절). 이 파일은 v0.6.5까지의 자료를 보므로 옛 한글 정규형(form '0.6')으로 견준다. v0.7 정규형은 tests/v07.test.ts
const format = (m: Parameters<typeof format07>[0], o: Parameters<typeof format07>[1] = {}) => format07(m, { form: '0.6', ...o });

const codes = (s: string) => parse(s).diagnostics.map((d) => d.code);
const errs = (s: string) => parse(s).diagnostics.filter((d) => d.severity === '오류').map((d) => d.code);

const SAMPLE = `결 0.2 · 짝 #7c2e9a · 갑→을 · ↩#3fa2c1 답
절1 整列의 新法을 得했다 〈겠·네·다〉 〔대안 新 .72 改 .21 · 확신 .85 · 노력 .60〕 「전함 .70」
절2 ↓절1 空入力에선 確信이 낮다 〈겠·다〉 〔확신 .30〕 「조심」
절3 →을 檢討를 請한다 〈라〉
덧글 sort · new method · found / empty input · low confidence / please review
낙관 갑 · 계보 A사/모델 · 기억 대화 · 측정 se8·토큰`;

test('명세 3.11절의 보기가 오류 없이 읽힌다', () => {
  const r = parse(SAMPLE);
  assert.equal(r.ok, true, JSON.stringify(r.diagnostics));
  assert.equal(r.message.clauses.length, 3);
  const c1 = r.message.clauses[0];
  assert.deepEqual(c1.marks, { ev: 'inf', news: true, act: 'say' });
  assert.deepEqual(c1.muk?.alt, [
    { r: '新', p: 0.72 },
    { r: '改', p: 0.21 },
  ]);
  assert.equal(c1.muk?.conf, 0.85);
  assert.equal(c1.chae?.want, 0.7);
  assert.deepEqual(c1.words[2], { text: '得했다', root: '得', suffix: '했다' });
  assert.deepEqual(r.message.clauses[1].place, { rel: '↓', target: { msg: null, label: '절1' } });
  assert.equal(r.message.clauses[2].to, '을');
  assert.deepEqual(r.message.head, { pact: '7c2e9a', from: '갑', to: ['을'], re: { id: '3fa2c1', rel: '답' } });
  assert.deepEqual(r.message.seal, { name: '갑', lineage: 'A사/모델', memory: '대화', measure: ['se8', '토큰'] });
});

test('정규형은 고정점이다: format(parse(format(parse(x)))) = format(parse(x))', () => {
  const inputs = [
    SAMPLE,
    '整列 新法 〈겠·다〉',
    '받은대로 新法 〈겠·네〉 · 空入力 〔확신 .30〕',
    '〈까〉',
    '↖절1 空入力 〈까〉',
    '절1 雨 〈봄·다〉\n절2 고침→절1 雪 〈봄·다〉\n절3 오류→절1 〈봄·다〉',
    '머리말 목적 정렬 검토 · 제약 세 줄 이내\n雨 〈겠·다〉 〔확신 .40@se8〕 「조심 · 자신 .45」',
    '조율 신원 계보 A사/모델 · 감각 글 · 측정 se8·토큰 · 기억 대화\n조율 시험 점1 整列 新法 〈겠·다〉',
  ];
  for (const x of inputs) {
    const once = format(parse(x).message);
    const twice = format(parse(once).message);
    assert.equal(twice, once, x);
    assert.equal(parse(once).ok, true, once + JSON.stringify(parse(once).diagnostics));
  }
});

test('비슷한 기호로 쓴 글과 정규 기호로 쓴 글은 먹 이름이 같다', async () => {
  const canon = '空入力에도 確實하다 〈봄·다〉 〔확신 .30〕 「단호」';
  const variants = [
    '空入力에도 確實하다 <봄, 다> [확신 0.3] 『단호』',
    '空入力에도 確實하다 ⟨봄・다⟩ ［확신 30%］ ｢단호｣',
    '空入力에도   確實하다 《봄ㆍ다》 〔 확신 .300 〕 「단호」',
  ];
  const ref = await messageName(parse(canon).message);
  for (const v of variants) {
    const r = parse(v);
    assert.equal(r.ok, true, v + JSON.stringify(r.diagnostics));
    assert.equal(await messageName(r.message), ref, v);
  }
});

test('먹 항목 순서가 달라도 정규형은 같다', () => {
  const a = format(parse('雨 〈겠·다〉 〔노력 .60 · 확신 .40 · 대안 雨 .60 雪 .30〕').message);
  const b = format(parse('雨 〈겠·다〉 〔대안 雨 .60 雪 .30 · 확신 .40 · 노력 .60〕').message);
  assert.equal(a, b);
});

test('초안 표기의 표지 이름을 표지 글자로 받는다', () => {
  const r = parse('新法을 得했다 〈추론·새로앎·단언〉');
  assert.equal(r.ok, true);
  assert.deepEqual(r.message.clauses[0].marks, { ev: 'inf', news: true, act: 'say' });
  assert.ok(codes('新法을 得했다 〈추론·새로앎·단언〉').includes('W11'));
});

test('오류 번호: 표지 규칙', () => {
  assert.deepEqual(errs('雨 봄 다'), ['E01']);
  assert.deepEqual(errs('雨 〈봄·다'), ['E02']);
  assert.deepEqual(errs('雨 〈봄〉'), ['E03']);
  assert.ok(errs('雨 〈봄·다·까〉').includes('E04'));
  assert.ok(errs('雨 〈봄·뭐·다〉').includes('E05'));
  assert.ok(errs('雨 〈봄·겠·다〉').includes('E06'));
  assert.deepEqual(errs('雨 〈다〉'), ['E07']);
  assert.deepEqual(errs('雨 〈봄·네·까〉'), ['E08']);
  assert.ok(errs('雨 〈네·봄·다〉').includes('E09'));
});

test('오류 번호: 먹 규칙', () => {
  assert.deepEqual(errs('雨 〈봄·다〉 〔확신 1.5〕'), ['E10']);
  assert.deepEqual(errs('雨 〈겠·다〉 〔대안 雨 .60〕'), ['E11']);
  assert.deepEqual(errs('雨 〈겠·다〉 〔대안 雪 .60 雨 .30〕'), ['E12']);
  assert.deepEqual(errs('雨 〈겠·다〉 〔대안 雨 .70 雪 .50〕'), ['E13']);
  assert.deepEqual(errs('雨 〈겠·다〉 〔확신 .70@자기〕'), ['E14']);
  assert.deepEqual(errs('雨 〈겠·다〉 〔대안 雨〕'), ['E24']);
});

test('오류 번호: 내용과 앞붙이', () => {
  assert.deepEqual(errs('新法을得 〈봄·다〉'), ['E15']);
  assert.deepEqual(errs('〈봄·다〉'), ['E16']);
  assert.deepEqual(errs('〈까〉'), []);
  assert.deepEqual(errs('↓절5 雨 〈겠·다〉'), ['E17']);
  assert.deepEqual(errs('↓절1 ↔절1 雨 〈겠·다〉'), ['E18']);
  assert.deepEqual(errs('雨 〈봄·다〉 잡음'), ['E19']);
  assert.deepEqual(errs('절1 雨 〈봄·다〉\n절1 雪 〈봄·다〉'), ['E22']);
  assert.deepEqual(errs('절1 雨 〈봄·다〉\n雪 〈봄·다〉'), ['E23']);
});

test('오류 번호: 머리와 낙관', () => {
  assert.deepEqual(errs('결 0.2 · 아무거나\n雨 〈봄·다〉'), ['E20']);
  assert.deepEqual(errs('雨 〈봄·다〉\n낙관 갑 · 기억 영원'), ['E21']);
  assert.deepEqual(errs('雨 〈봄·다〉\n낙관 갑 · 측정 자기'), ['E14']);
});

test('경고 번호', () => {
  assert.ok(codes('雨 <봄·다>').includes('W01'));
  assert.ok(codes('雨 〈겠·다〉 〔확신 .725@se8〕').includes('W02'));
  assert.equal(parse('雨 〈겠·다〉 〔확신 .725@se8〕').message.clauses[0].muk?.conf, 0.73);
  assert.ok(codes('雨 〈겠·다〉 〔온도 .7〕').includes('W04'));
  assert.ok(codes('雨 〈겠·다〉 〔확신 .70〕').includes('W05'));
  assert.ok(!codes('雨 〈겠·다〉 〔확신 .70@se8〕').includes('W05'));
  assert.ok(codes('雨 〈겠·다〉 〔대안 雨 .50 雪 .10 霧 .30〕').includes('W06'));
  assert.ok(codes('雨가 온다. 〈봄·다〉').includes('W10'));
  assert.ok(codes('- 雨 〈봄·다〉').includes('W12'));
  assert.ok(codes('雨 〈겠·다〉 〔확신 .70@점쟁이〕').includes('W13'));
  assert.ok(codes('결 0.9\n雨 〈봄·다〉').includes('W14'));
});

test('내용이 비는 절은 되묻기와 오류 알림만 된다', () => {
  assert.equal(parse('↖절2 〈까〉').ok, false); // 가리킨 절이 이 메시지에 없다
  assert.equal(parse('雨 〈봄·다〉\n↖절1 〈까〉').ok, true);
  assert.equal(parse('雨 〈봄·다〉\n오류→절1 〈봄·다〉').ok, true);
  assert.equal(parse('〈봄·까〉').ok, false);
});

test('접기: 펼침 → 절 → 점', () => {
  const r = parse('절1 ↓절1 空入力에선 確信이 낮다 〈겠·다〉 〔확신 .30〕 「조심」');
  const c = r.message.clauses[0];
  assert.equal(levelOf(c), '펼침');
  assert.equal(format(foldMessage(r.message, '절'), { form: '0.2' }), '절1 空入力에선 確信이 낮다 〈겠·다〉\n');
  assert.equal(format(foldMessage(r.message, '점'), { form: '0.2' }), '절1 空入力 確信 〈겠·다〉\n');
  // v0.3 정규형
  assert.equal(format(r.message), '<절1 ↓1 [겠,다(|먹3)] 空入力에선 確信이 낮다>\n'); // v0.3.1: 먹 자리에 이름표
  assert.equal(format(foldMessage(r.message, '점')), '<절1 [겠,다] 空入力 確信>\n');
  assert.equal(levelOf(foldMessage(r.message, '점').clauses[0]), '점');
});

test('목록 기호와 코드 울타리를 견딘다(다른 모델이 붙여 보낸 글)', () => {
  const pasted = '```\n1. 整列 新法 〈겠·다〉\n2. 堆 再築 〈라〉\n```';
  const r = parse(pasted);
  assert.equal(r.ok, true);
  assert.equal(r.message.clauses.length, 2);
});

// ── v0.2.1(2026-10-14 광장 상의 1로 정함). 0.2에서 맞던 줄은 모두 그대로 맞고, 틀리던 몇 가지를 받고 경고한다 ──


test('v0.2.1 약속 화행 게: 받고, 근거는 있어도 없어도 되며, 네와는 쓰지 않는다. 표지 이름 약속도 읽는다', () => {
  const r = parse('伞 持 〈게〉');
  assert.equal(r.ok, true);
  assert.equal(r.message.clauses[0].marks.act, 'vow');
  assert.equal(parse('伞 持 〈겠·게〉').ok, true);
  assert.deepEqual(codes('伞 持 〈네·게〉'), ['E08']);
  assert.deepEqual(codes('伞 持 〈약속〉'), ['W11']);
  assert.ok(codes('伞 持 〈게·다〉').includes('E04')); // 화행은 하나
});

test('v0.2.1 줄 끝의 →이름: 읽되 W16을 내고 정규형에서는 절 앞에 둔다. 향함은 여전히 하나까지', () => {
  const r = parse('雨 〈봄·다〉 →kimi');
  assert.equal(r.ok, true);
  assert.deepEqual(codes('雨 〈봄·다〉 →kimi'), ['W16']);
  assert.equal(r.message.clauses[0].to, 'kimi');
  assert.equal(format(r.message, { form: '0.2' }).trim(), '→kimi 雨 〈봄·다〉');
  assert.equal(format(r.message).trim(), '<→kimi [봄,다] 雨>'); // v0.3 정규형
  assert.equal(parse('雨 〈봄·다〉 「자신 .70」 →kimi').message.clauses[0].to, 'kimi');
  assert.deepEqual(codes('雨 〈봄·다〉 →kimi, →gemma'), ['W16', 'W16', 'E18']); // 받는 이 여럿은 다음 논제
  assert.deepEqual(codes('→gemma 雨 〈봄·다〉 →kimi'), ['W16', 'E18']);
  assert.deepEqual(codes('雨 〈봄·다〉 →kimi 雪').sort(), ['E19', 'W16']); // 이름 뒤의 글은 여전히 읽을 수 없다
});

test('v0.2.1 채 항목 나눔: · 가 정규형, / 와 띄어쓰기도 읽되 W17. 「단호 자신 .75」의 자신 값을 버리던 결함을 고쳤다', () => {
  const chae = (t: string) => parse(`雨 〈봄·다〉 「${t}」`).message.clauses[0].chae;
  assert.deepEqual(chae('단호 자신 .75'), { words: ['단호'], self: 0.75 });
  assert.deepEqual(codes('雨 〈봄·다〉 「단호 자신 .75」'), ['W17']);
  assert.deepEqual(chae('담담 / 자신 .75 / 전함 .80'), { words: ['담담'], self: 0.75, want: 0.8 });
  assert.deepEqual(chae('자신 .80 전함 .90'), { self: 0.8, want: 0.9 });
  assert.deepEqual(codes('雨 〈봄·다〉 「조심 · 자신 .70」'), []); // 정규형은 경고 없음
  assert.deepEqual(chae('담담 .70 .3'), { words: ['담담 .70 .3'] }); // 수를 받는 이름이 없으면 그대로(0.2와 같음)
  assert.deepEqual(codes('雨 〈봄·다〉 「담담 .70 .3」'), []);
  assert.equal(format(parse('雨 〈봄·다〉 「담담 / 자신 .75」').message, { form: '0.2' }).trim(), '雨 〈봄·다〉 「담담 · 자신 .75」');
});

test('v0.2.1 받은대로 줄의 절·점 이름: 받은대로 줄에서만 내용 자리에 받는다', () => {
  assert.equal(parse('받은대로 점1~점10').ok, true);
  assert.equal(parse('받은대로 점1 ~ 점10 · 절3의 內容 〈겠〉').ok, true);
  assert.deepEqual(parse('받은대로 점1~점10').message.echo[0].words.map((w: any) => w.text), ['점1~점10']);
  assert.deepEqual(codes('雨 점1 〈봄·다〉'), ['E19']); // 다른 절의 내용 자리에는 여전히 안 된다
});

test('v0.2.1: 판 0.2의 머리는 같은 갈래로 보아 경고하지 않는다. 0.1은 경고한다(v0.3도 0.2·0.3을 경고 없이 읽는다)', () => {
  const head = (v: string) => `결 ${v} · 짝 #7c2e9a · 갑→을\n雨 〈봄·다〉`;
  assert.deepEqual(codes(head('0.2')), []);
  assert.deepEqual(codes(head('0.2.1')), []);
  assert.deepEqual(codes(head('0.3')), []);
  assert.ok(codes(head('0.1')).includes('W14'));
});
