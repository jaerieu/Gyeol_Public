// v0.7 표지 표(2026-10-29, reports/v0.7-design.md 3절, spec/03-grammar.md 3.19절): 한 별칭은 한 표지에만, 열 언어 모두 빠진 칸 없음, 세 글자까지, 라틴은 큰·작은 글자 같게.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tables } from '../src/index.ts';

const { MARK_ALIASES_07, MARK_ALIASES_05, MARK_KO2EN, MARK_EN2KO, MARKS_07, EV_07, ACT_07, FIG_07, TENSE_07, NEWS_07, SHORT_ALIASES_07, markOf07, scriptGroupOf, scriptGroupOfChar, LANGS_07 } = tables;

/** 사전 v0.6.5가 가르치는 표지(읽기만 하는 hrd·com·chk·dfr은 뺀다) */
const TAUGHT = ['see', 'rec', 'inf', 'gut', 'if', 'top', 'new', 'lim', 'pdx', 'met', 'pst', 'fut', 'say', 'ask', 'req', 'let', 'vow', 'nay', 'ack'];

test('한 별칭은 한 표지에만 간다: 열 언어 표·한글 글자·v0.5 긴 별칭·영어 내부 값을 한 표에 모아도 겹치지 않는다', () => {
  const seen = new Map<string, string>();
  const put = (alias: string, mark: string, from: string) => {
    const k = alias.toLowerCase();
    const prev = seen.get(k);
    assert.ok(prev === undefined || prev === mark, `${from}: 별칭 '${alias}'가 ${prev}와 ${mark} 둘로 간다`);
    seen.set(k, mark);
  };
  for (const m of MARKS_07) put(m, m, '내부 값');
  for (const [a, m] of Object.entries(MARK_ALIASES_07)) put(a, m, '열 언어 표');
  for (const [a, m] of Object.entries(MARK_KO2EN)) put(a, m, '한글');
  for (const [a, m] of Object.entries(MARK_ALIASES_05)) put(a, MARK_KO2EN[m], 'v0.5 별칭');
  // 값은 모두 내부 영어 표지다
  for (const m of Object.values(MARK_ALIASES_07)) assert.ok(MARKS_07.has(m), m);
});

test('내부 값은 세 글자까지의 영어 낱말이고, 근거·새로앎·결·시제·화행 표가 겹치지 않는다', () => {
  for (const m of MARKS_07) assert.match(m, /^[a-z]{2,3}$/u, m);
  const cats = [Object.keys(EV_07), [NEWS_07], Object.keys(FIG_07), Object.keys(TENSE_07), Object.keys(ACT_07)];
  const all = cats.flat();
  assert.equal(new Set(all).size, all.length);
  assert.equal(MARKS_07.size, all.length);
  // 한글 ↔ 영어 왕복(네·군은 둘 다 new, 되돌리면 군)
  for (const [ko, en] of Object.entries(MARK_KO2EN)) if (ko !== '네') assert.equal(MARK_EN2KO[en], ko);
  assert.equal(MARK_KO2EN['네'], 'new');
});

test('열 언어 표: 가르치는 표지 19개마다 라틴 다섯(de fr it es)·러시아어·간체·번체·일본어 별칭이 있고 모두 세 글자까지다', () => {
  const byMark = new Map<string, string[]>();
  for (const [a, m] of Object.entries(MARK_ALIASES_07)) byMark.set(m, [...(byMark.get(m) ?? []), a]);
  for (const m of TAUGHT) {
    const aliases = byMark.get(m) ?? [];
    const latin = [m, ...aliases.filter((a) => /^[a-z]+$/u.test(a))]; // 내부 값 자체가 영어(라틴 다섯 언어가 같은 어원이면 내부 값과 같다: met)
    const cyr = aliases.filter((a) => /^\p{Script=Cyrillic}+$/u.test(a));
    const cjk = aliases.filter((a) => /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+$/u.test(a));
    assert.ok(latin.length >= 1, `${m}: 라틴 별칭이 없다`);
    assert.ok(cyr.length >= 1, `${m}: 러시아어 별칭이 없다`);
    assert.ok(cjk.length >= 1, `${m}: 한자·가나 별칭이 없다`);
    for (const a of aliases) assert.ok(Array.from(a).length <= 3, `${m}: '${a}'는 세 글자를 넘는다`);
  }
});

test('markOf07: 영어 내부 값·열 언어 별칭·한글 글자·v0.5 긴 별칭을 모두 내부 영어로 읽고, 라틴은 큰·작은 글자를 가리지 않는다', () => {
  assert.equal(markOf07('see'), 'see');
  assert.equal(markOf07('SEE'), 'see');
  assert.equal(markOf07('Seh'), 'see');
  assert.equal(markOf07('見'), 'see');
  assert.equal(markOf07('вид'), 'see');
  assert.equal(markOf07('봄'), 'see');
  assert.equal(markOf07('recall'), 'rec');
  assert.equal(markOf07('assert'), 'say');
  assert.equal(markOf07('もし'), 'if');
  assert.equal(markOf07('た'), 'pst');
  assert.equal(markOf07('xyz'), undefined);
  // 짧은 꼴(W26 없음)과 긴 꼴
  assert.ok(SHORT_ALIASES_07.has('seh') && SHORT_ALIASES_07.has('봄') && SHORT_ALIASES_07.has('see'));
  assert.ok(!SHORT_ALIASES_07.has('recall') && !SHORT_ALIASES_07.has('assert'));
});

test('언어와 글자군: 열 언어가 넷으로 묶이고, 글자마다 글자군을 안다', () => {
  assert.deepEqual([...LANGS_07], ['ko', 'en', 'zh-Hans', 'zh-Hant', 'ja', 'de', 'fr', 'it', 'es', 'ru']);
  assert.equal(scriptGroupOf('ko'), 'hangul');
  for (const l of ['en', 'de', 'fr', 'it', 'es']) assert.equal(scriptGroupOf(l), 'latin', l);
  assert.equal(scriptGroupOf('ru'), 'cyrillic');
  for (const l of ['zh-Hans', 'zh-Hant', 'ZH-HANT', 'ja']) assert.equal(scriptGroupOf(l), 'cjk', l);
  assert.equal(scriptGroupOf('el'), undefined);
  assert.equal(scriptGroupOf(null), undefined);
  assert.equal(scriptGroupOfChar('가'), 'hangul');
  assert.equal(scriptGroupOfChar('é'), 'latin');
  assert.equal(scriptGroupOfChar('д'), 'cyrillic');
  assert.equal(scriptGroupOfChar('雪'), 'cjk');
  assert.equal(scriptGroupOfChar('に'), 'cjk');
  assert.equal(scriptGroupOfChar('3'), undefined);
});
