// 결 v0.2 명령줄 도구.
//   node tools/cli.ts check  <파일|-> [--rules05]  구문 분석하고 오류·경고를 보인다(기준 글꼴 경고 포함).
//                                                --rules05: 새로 쓰는 줄의 v0.5 쓰기 규칙(E25·E26·E30, W23~W27)도 본다(2026-10-15)
//                                                --rules051, --rules06: v0.5.1·v0.6(실험적, 2026-10-24) 쓰기 규칙
//   node tools/cli.ts format <파일|->            정규형 글
//   node tools/cli.ts json   <파일|->            틀(JSON)
//   node tools/cli.ts name   <파일|-> [--doc]    먹 이름(메시지, 또는 --doc이면 문서)
//   node tools/cli.ts fold   <파일|-> <점|절|펼침>
//   node tools/cli.ts hashes                    dict/HASHES.md 를 다시 만든다
//   node tools/cli.ts simplify <파일|->          한자를 기준 글꼴(간체)로 바꾼다

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parse, format, foldMessage, documentName, messageName, short, harmony, altInterval, variantWarnings, toSimplified, rules05, rules051, rules06 } from '../src/index.ts';
import type { FoldLevel } from '../src/index.ts';

const root = new URL('..', import.meta.url);
const [cmd, file, arg] = process.argv.slice(2);

function read(f: string | undefined): string {
  if (!f || f === '-') return readFileSync(0, 'utf8');
  return readFileSync(f, 'utf8');
}

function toSimplifiedMap(): Record<string, string> | null {
  const u = new URL('dict/variants-v0.2.json', root);
  return existsSync(u) ? JSON.parse(readFileSync(u, 'utf8')).to_simplified : null;
}

async function main() {
  switch (cmd) {
    case 'check': {
      const r = parse(read(file));
      const simp = toSimplifiedMap();
      const diags = [...r.diagnostics, ...(simp ? variantWarnings(r.message, simp) : [])];
      for (const d of diags) console.log(`${d.severity} ${d.code}${d.line ? ` (줄 ${d.line})` : ''}: ${d.message}`);
      // 쓰기 규칙의 줄 번호는 절 차례다(rules04와 같다)
      const written = arg === '--rules05' ? rules05(r) : arg === '--rules051' ? rules051(r) : arg === '--rules06' ? rules06(r) : [];
      for (const d of written) console.log(`${d.severity} ${d.code} (절 ${d.line}째, 쓰기 규칙): ${d.message}`);
      r.message.clauses.forEach((c, i) => {
        const h = harmony(c);
        const iv = c.muk?.alt ? altInterval(c.muk.alt) : null;
        const label = c.label ?? `절${i + 1}`;
        if (h) console.log(`화음 ${label}: ${h.verdict} (드러낸 ${h.e} − 잰 ${h.m} = ${h.d}, ${h.direction}, ${h.source})`);
        if (iv) console.log(`대안음 ${label}: ${iv.interval} (비 ${iv.r})`);
      });
      const ok = r.ok && !written.some((d) => d.severity === '오류');
      console.log(ok ? `통과 · 절 ${r.message.clauses.length}개 · ${short(await messageName(r.message))}` : '오류 있음');
      process.exitCode = ok ? 0 : 1;
      break;
    }
    case 'format':
      process.stdout.write(format(parse(read(file)).message));
      break;
    case 'json':
      console.log(JSON.stringify(parse(read(file)).message, null, 2));
      break;
    case 'name': {
      const text = read(file);
      const name = arg === '--doc' ? await documentName(text) : await messageName(parse(text).message);
      console.log(name);
      break;
    }
    case 'fold':
      process.stdout.write(format(foldMessage(parse(read(file)).message, (arg ?? '점') as FoldLevel)));
      break;
    case 'hashes': {
      // 지난 판 사전(v0.2.1·v0.3)은 2026-10-14, v0.4는 2026-10-15(v0.5 뒤) archive/dict/로 옮겼다. 먹 이름 기록은 그대로 남긴다(archive/README.md).
      const files = ['sources/dict-v0.txt', 'dict/base-v0.2.txt', 'archive/dict/base-v0.2.1.txt', 'archive/dict/base-v0.3.txt', 'archive/dict/base-v0.3.1.txt', 'archive/dict/base-v0.3.2.txt', 'archive/dict/base-v0.4.txt', 'archive/dict/base-v0.5.txt', 'archive/dict/base-v0.5.1.txt', 'archive/dict/base-v0.5.2.txt', 'dict/base-v0.5.5.txt', 'dict/base-v0.6.txt', 'dict/base-v0.6.5.txt', 'dict/examples-v0.2.txt'];
      const rows: string[] = [];
      for (const f of files) {
        const name = await documentName(readFileSync(new URL(f, root), 'utf8'));
        rows.push(`| \`${f}\` | \`${short(name)}\` | \`${name}\` |`);
      }
      const md = [
        '# 사전의 먹 이름',
        '',
        '`node tools/cli.ts hashes` 가 만든다. 문서 정규화(spec/02-text.md 2.3절) 뒤 SHA-256이다.',
        '',
        '| 파일 | 짧은 이름 | 전체 |',
        '| --- | --- | --- |',
        ...rows,
        '',
      ].join('\n');
      writeFileSync(new URL('dict/HASHES.md', root), md);
      console.log(md);
      break;
    }
    case 'simplify': {
      const map = toSimplifiedMap();
      if (!map) throw new Error('dict/variants-v0.2.json 이 없다');
      process.stdout.write(toSimplified(read(file), map));
      break;
    }
    default:
      console.log('명령: check [--rules05] | format | json | name [--doc] | fold <점|절|펼침> | hashes | simplify');
      process.exitCode = 2;
  }
}

await main();
