import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parse, format as format07 } from '../src/index.ts';
// 2026-10-29 v0.7: 정규형이 영어·수 머리로 바뀌었다(reports/v0.7-design.md 6절). 이 파일은 v0.6.5까지의 자료를 보므로 옛 한글 정규형(form '0.6')으로 견준다. v0.7 정규형은 tests/v07.test.ts
const format = (m: Parameters<typeof format07>[0], o: Parameters<typeof format07>[1] = {}) => format07(m, { form: '0.6', ...o });

const root = new URL('..', import.meta.url);

test('짝 예문의 결 쪽이 모두 오류 없이 읽힌다', () => {
  const text = readFileSync(new URL('dict/examples-v0.2.txt', root), 'utf8');
  let n = 0;
  let section = '';
  const unfolded: string[] = [];
  for (const line of text.split('\n')) {
    const h = /^【(.+)】$/u.exec(line);
    if (h) {
      section = h[1];
      continue;
    }
    if (!line.includes('〈')) continue;
    if (section === '펼침') {
      unfolded.push(line); // 한 메시지의 줄들
      continue;
    }
    const gyeol = line.split(' = ')[0].replace(/^(펼침|절|점):\s*/u, '');
    const r = parse(gyeol);
    assert.equal(r.ok, true, `${gyeol}\n${JSON.stringify(r.diagnostics)}`);
    n++;
  }
  const r = parse(unfolded.join('\n'));
  assert.equal(r.ok, true, `${unfolded.join('\n')}\n${JSON.stringify(r.diagnostics)}`);
  assert.equal(r.message.clauses.length, 3);
  assert.ok(n >= 18, `예문이 너무 적다: ${n}`);
});

function codeBlocks(md: string): { lang: string; body: string }[] {
  const out: { lang: string; body: string }[] = [];
  let open: { lang: string; lines: string[] } | null = null;
  for (const line of md.split('\n')) {
    const f = /^```(.*)$/u.exec(line);
    if (f) {
      if (open) {
        out.push({ lang: open.lang, body: open.lines.join('\n') });
        open = null;
      } else open = { lang: f[1].trim(), lines: [] };
    } else if (open) open.lines.push(line);
  }
  return out;
}

test('명세의 결 보기(언어 표시 없는 코드 블록)가 모두 오류 없이 읽힌다', () => {
  const dir = new URL('spec/', root);
  let n = 0;
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const md = readFileSync(new URL(f, dir), 'utf8');
    for (const b of codeBlocks(md)) {
      if (b.lang !== '') continue;
      if (!b.body.includes('〈') && !/^(결|조율|받은대로|낙관)\s/mu.test(b.body) && !/^\s*<[^>]*\[/mu.test(b.body)) continue;
      const r = parse(b.body);
      assert.equal(r.ok, true, `${f}\n${b.body}\n${JSON.stringify(r.diagnostics)}`);
      n++;
    }
  }
  assert.ok(n >= 2, `보기가 너무 적다: ${n}`);
});

test('틀 → 글 → 틀이 같은 틀을 낸다', () => {
  const src = `결 0.2 · 짝 #7c2e9a · 갑→을 · ↩#3fa2c1 답
머리말 목적 정렬 검토 · 제약 세 줄 이내
받은대로 新法 〈겠·네〉 · 空入力 〔확신 .30〕
절1 整列의 新法을 得했다 〈겠·네·다〉 〔대안 新 .72 改 .21@se8 · 확신 .85@se8 · 노력 .60@토큰〕 「전함 .70」
절2 ↓절1 空入力에선 確信이 낮다 〈겠·다〉 〔확신 .30@se8〕 「조심 · 자신 .40 · 인용 #3fa2c1:절2」
절3 고침→절2 →을 檢討를 請한다 〈라〉
덧글 sort · new method · found
낙관 갑 · 계보 A사/모델 · 기억 대화 · 측정 se8·토큰`;
  const m1 = parse(src).message;
  // 옛 꼴(0.2)은 잃는 것 없이 왕복한다. v0.3 정규형은 어조·전함·인용과 먹의 대안·노력·측정법을 줄에 싣지 않는다(3.13절).
  const m2 = parse(format(m1, { form: '0.2' })).message;
  assert.deepEqual(m2, m1);
});

// v0.3.1 사전(광장 참가자가 받는 것)과 그 앞의 v0.3 사전. 사전의 보기는 자신만 쓰므로 v0.3.1의 먹 이름표와 상관없이 정규형이다.
// v0.3 사전은 2026-10-14, v0.4 사전은 2026-10-15(v0.5 뒤) archive/dict/로 옮겼다. 옛 사전의 보기가 지금 검사기에서도 그대로 읽히는지(옛 꼴 호환) 계속 본다.
// v0.5 사전의 보기가 v0.5 쓰기 규칙(rules05)에도 깨끗한지는 tests/v05.test.ts가 본다.
for (const file of ['archive/dict/base-v0.3.txt', 'archive/dict/base-v0.3.1.txt', 'archive/dict/base-v0.3.2.txt', 'archive/dict/base-v0.4.txt', 'archive/dict/base-v0.5.txt', 'archive/dict/base-v0.5.1.txt', 'archive/dict/base-v0.5.2.txt', 'dict/base-v0.5.5.txt']) {
  test(`기본 사전 ${file}의 결 줄(보기·예)이 모두 오류 없이 읽히고 정규형과 같다`, () => {
    const text = readFileSync(new URL(file, root), 'utf8');
    // 【 】 마디마다 한 메시지로 읽는다(예의 ↓1이 앞 예를 가리킨다)
    let n = 0;
    const sections: string[][] = [];
    for (const raw of text.split('\n')) {
      if (raw.startsWith('【')) sections.push([]);
      const line = raw.replace(/^(?:【[^】]+】\s*)?예:\s*/u, '');
      if (!line.startsWith('<절')) continue;
      sections.at(-1)!.push(line.split(' = ')[0].trim());
    }
    for (const lines of sections.filter((x) => x.length)) {
      const r = parse(lines.join('\n'));
      assert.equal(r.ok, true, `${lines.join('\n')}\n${JSON.stringify(r.diagnostics)}`);
      assert.deepEqual(r.diagnostics, [], lines.join('\n'));
      // 사전의 보기는 정규형으로 쓴다(한 줄에 둘을 이어 쓴 것은 정규형에서 두 줄이 된다)
      assert.equal(format(r.message).trim(), lines.flatMap((l) => l.split(/(?<=>) (?=<)/u)).join('\n'));
      n += r.message.clauses.length;
    }
    assert.ok(n >= 8, `보기가 너무 적다: ${n}`);
  });
}
