// Submission QA linter for Apart Research AI x Epistemics Sprint deliverables.
import { readFileSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUB = join(ROOT, 'submission');
const MAX_BYTES = 25 * 1024 * 1024;
let fails = 0;

function check(cond, msg) {
  if (cond) {
    console.log(`PASS  ${msg}`);
  } else {
    console.error(`FAIL  ${msg}`);
    fails++;
  }
}

function pdfPages(pdfPath) {
  const out = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  const m = out.match(/Pages:\s+(\d+)/);
  return m ? Number(m[1]) : 0;
}

function pdfPageText(pdfPath, page) {
  return execFileSync('pdftotext', ['-f', String(page), '-l', String(page), pdfPath, '-'], { encoding: 'utf8' });
}

// 1. Deliverables existence and size < 25 MB
const reqFiles = [
  'apart-report-en.typ', 'apart-report-en.pdf', 'apart-report-en.md',
  'apart-report-ko.typ', 'apart-report-ko.pdf', 'apart-report-ko.md',
  'apart-slides-en.typ', 'apart-slides-en.pdf',
  'apart-slides-ko.typ', 'apart-slides-ko.pdf',
  'apart-project-image.png', 'presentation-script-en-ko.md',
];
for (const f of reqFiles) {
  const p = join(SUB, f);
  const ok = existsSync(p) && statSync(p).size > 0 && statSync(p).size < MAX_BYTES;
  check(ok, `file ${f} exists, non-empty, < 25 MB (${existsSync(p) ? statSync(p).size : 0} bytes)`);
}

// 2. English Abstract word count in [150, 250]
const enTyp = readFileSync(join(SUB, 'apart-report-en.typ'), 'utf8');
const typAbsM = enTyp.match(/#text[^\]]*\[Abstract\][^\n]*\n([\s\S]*?)\n\]/);
const typWords = typAbsM
  ? typAbsM[1].replace(/`([^`]*)`/g, '$1').replace(/#strong\[([A-Za-z])\]/g, '$1').replace(/[*_]/g, ' ').trim().split(/\s+/).length
  : 0;
check(typWords >= 150 && typWords <= 250, `apart-report-en.typ Abstract word count = ${typWords} (150..250)`);

const enMd = readFileSync(join(SUB, 'apart-report-en.md'), 'utf8');
const mdAbsM = enMd.match(/\*\*Abstract\*\*\s*\n+([^\n]+)\n/);
const mdWords = mdAbsM
  ? mdAbsM[1].replace(/`([^`]*)`/g, '$1').replace(/[*_]/g, '').trim().split(/\s+/).length
  : 0;
check(mdWords >= 150 && mdWords <= 250, `apart-report-en.md Abstract word count = ${mdWords} (150..250)`);

// 3. Page constraints for English report & slide decks
const enPdf = join(SUB, 'apart-report-en.pdf');
const enPages = pdfPages(enPdf);
let conclPage = 999, codePage = 999;
for (let p = 1; p <= enPages; p++) {
  const txt = pdfPageText(enPdf, p);
  if (conclPage === 999 && /\b6\.\s+Conclusion\b/.test(txt)) conclPage = p;
  if (codePage === 999 && /\bCode and Data\b/.test(txt)) codePage = p;
}
check(conclPage <= 8, `apart-report-en.pdf Section 6 Conclusion on page ${conclPage} (<= 8)`);
check(codePage <= 9 && codePage > conclPage, `apart-report-en.pdf Code and Data starts on page ${codePage} (<= 9, after Conclusion)`);
check(pdfPages(join(SUB, 'apart-slides-en.pdf')) === 11, `apart-slides-en.pdf exact page count = ${pdfPages(join(SUB, 'apart-slides-en.pdf'))} (== 11)`);
check(pdfPages(join(SUB, 'apart-slides-ko.pdf')) === 11, `apart-slides-ko.pdf exact page count = ${pdfPages(join(SUB, 'apart-slides-ko.pdf'))} (== 11)`);

// 4. Chae color non-definition check across submission files
const chaeBanRe = /\b(?:Red|Green|Blue|Cyan|Magenta|Yellow|Black)\s*(?:=|means|indicates|stands for|denotes|represents)/i;
for (const f of reqFiles.filter((x) => x.endsWith('.typ') || x.endsWith('.md'))) {
  const txt = readFileSync(join(SUB, f), 'utf8').replace(/^#let\s+\w+\s*=\s*rgb\([^)]+\)/gm, '');
  check(!chaeBanRe.test(txt), `Chae non-definition axiom clean in ${f}`);
}

// 5. Korean prose formatting checks (no ~, no numeric range dashes, no box-drawing chars)
const koScript = readFileSync(join(SUB, 'presentation-script-en-ko.md'), 'utf8').split('## 한국어 발표 대본')[1] ?? '';
const koTargets = [
  ['design-sprint.md', readFileSync(join(ROOT, 'design-sprint.md'), 'utf8')],
  ['submission/apart-report-ko.typ', readFileSync(join(SUB, 'apart-report-ko.typ'), 'utf8')],
  ['submission/apart-report-ko.md', readFileSync(join(SUB, 'apart-report-ko.md'), 'utf8')],
  ['submission/apart-slides-ko.typ', readFileSync(join(SUB, 'apart-slides-ko.typ'), 'utf8')],
  ['submission/presentation-script-en-ko.md (ko)', koScript],
];

for (const [name, raw] of koTargets) {
  const stripped = raw
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\b[0-9a-f]{32,64}\b/gi, '')
    .replace(/`[^`]*`/g, '');
  const hasTilde = /~/.test(raw);
  const hasBox = /[\u2500-\u257F]/.test(raw);
  const rangeM = stripped.match(/(?:\b\d+(?:\.\d+)?%[–—-]\d+(?:\.\d+)?%|\b\d+(?:\.\d+)?[–—]\d+(?:\.\d+)?|\b(?:1[0-8]|[0-9])-(?:[1-9]\d?)(?:홉|개|단어|점|세션|페이지|단계|번|등급|회|건|쪽|초|분|명))/g);
  check(!hasTilde, `KO prose no '~' in ${name}`);
  check(!hasBox, `KO prose no box-drawing chars in ${name}`);
  check(!rangeM, `KO prose no Korean numeric range dashes in ${name}${rangeM ? ` (found: ${rangeM.join(', ')})` : ''}`);
}

console.log(`\nSummary: ${fails === 0 ? 'ALL CHECKS PASSED' : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
