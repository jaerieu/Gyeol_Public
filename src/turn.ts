// 단일 차례 진입점(parseTurn): 생각 태그·머리표·다중 줄 외부 근거(<[ … ]>) 정규화와 명시 규격(0.7 · 0.8)·프로파일(gyeol · lon) 판정을 한 번에 수행한다.
import type { Diagnostic, Message, Profile } from './types.ts';
import { parse, parseExtTag } from './parse.ts';
import { rules07 } from './parse/v07.ts';
import { rules08 } from './parse/v08.ts';

export interface ParseTurnOptions {
  profile?: Profile;
  spec?: '0.7' | '0.8';
  lang?: string;
  ink?: number | null;
  priorLines?: string[];
  turnNo?: number | null;
}

export interface ParseTurnResult {
  line: string;
  message: Message;
  diagnostics: Diagnostic[];
  errors: Diagnostic[];
  warnings: Diagnostic[];
  ok: boolean;
}

const HEAD_LABEL_RE = /^\s*(?:[*_`'"“”]+\s*)*(?:결|gyeol|론|lon)\s*(?:[*_`'"“”]+\s*)*[:：]\s*(?:[*_`'"“”]+\s*)?(.*)$/iu;
const GLOSS_LABEL_RE = /^\s*(?:[*_`'"“”]+\s*)*(?:풀이|gloss)\s*(?:[*_`'"“”]+\s*)*[:：]/iu;

function stripThinkBlocks(raw: string): string {
  let s = String(raw ?? '');
  const end = s.lastIndexOf('</think>');
  if (end !== -1) s = s.slice(end + 8);
  s = s.replace(/<think>[\s\S]*?<\/think>/gu, '');
  const open = s.indexOf('<think>');
  if (open !== -1) s = s.slice(0, open);
  return s.trim();
}

/** 응답 원문에서 결·론 본문 줄만 발라낸다(마크다운 감싼 머리표 수용, 풀이: 이후 분리). */
export function extractTurnLine(rawText: string): string {
  let clean = stripThinkBlocks(rawText);
  if (!clean) return '';
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```[^\n]*\n?/u, '').replace(/\n?```\s*$/u, '').trim();
  }
  const lines = clean.split(/\r?\n/u);
  const kept: string[] = [];
  let started = false;
  let inExt: ']>' | '>]' | '⟫' | null = null;
  const updateExt = (chunk: string) => {
    for (let i = 0; i < chunk.length; i++) {
      if (!inExt) {
        if (chunk[i] === '<' && chunk[i + 1] === '[') {
          inExt = ']>';
          i++;
        } else if (chunk[i] === '[' && chunk[i + 1] === '<') {
          inExt = '>]';
          i++;
        } else if (chunk[i] === '⟪') {
          inExt = '⟫';
        }
      } else if (inExt === '⟫' && chunk[i] === '⟫') {
        inExt = null;
      } else if (inExt.length === 2 && chunk[i] === inExt[0] && chunk[i + 1] === inExt[1]) {
        inExt = null;
        i++;
      }
    }
  };
  for (const rawL of lines) {
    const t = rawL.trim();
    if (!inExt && GLOSS_LABEL_RE.test(t)) break;
    if (!started) {
      const m = HEAD_LABEL_RE.exec(t);
      if (m) {
        started = true;
        const body = m[1].replace(/\s*`+\s*$/u, '').trim();
        if (body) {
          kept.push(body);
          updateExt(body);
        }
        continue;
      }
      if (!t) continue;
      started = true;
    }
    const cleaned = !inExt ? rawL.replace(/^\s*`+(?=<)/u, '').replace(/(?<=>)`+\s*$/u, '') : rawL;
    kept.push(cleaned);
    updateExt(cleaned);
  }
  return kept.join('\n').trim();
}

const diagKey = (d: Diagnostic) => `${d.severity}|${d.code}|${d.line}|${d.message}`;

/**
 * 단일 진입점: 규격 자동 감지 없이 명시된 spec('0.8' 기본)과 profile('gyeol' | 'lon')로 차례를 정규화·검사한다.
 */
export function parseTurn(rawText: string, opts: ParseTurnOptions = {}): ParseTurnResult {
  const profile: Profile = opts.profile === 'lon' ? 'lon' : 'gyeol';
  const spec = profile === 'lon' ? '0.8' : (opts.spec ?? '0.8');
  const use08 = spec === '0.8';
  const lang = opts.lang ?? 'ko';
  const ink = opts.ink ?? null;
  const line = extractTurnLine(rawText);
  if (!line) {
    const emptyErr: Diagnostic = { severity: '오류', code: 'E01', line: 1, message: '결 줄이 비었다' };
    return { line: '', message: parse('').message, diagnostics: [emptyErr], errors: [emptyErr], warnings: [], ok: false };
  }
  const parseOpts = use08 ? { v08: true } : undefined;
  let priors = Array.isArray(opts.priorLines) ? opts.priorLines.map((x) => String(x ?? '').trim()).filter(Boolean) : [];
  const turnDiags: Diagnostic[] = [];
  if (opts.turnNo != null) {
    const tStr = String(opts.turnNo);
    const selfParsed = parse(line, parseOpts);
    for (const c of selfParsed.message.clauses) {
      if (c.label != null) {
        const mNo = String(c.label).replace(/^[절점]/u, '');
        if (mNo !== tStr && !mNo.startsWith(`${tStr}.`)) {
          turnDiags.push({ severity: '오류', code: 'E22', line: 1, message: `차례 번호 불일치(다른 차례 번호 사용): 절${mNo}` });
        }
      }
    }
    if (priors.length) {
      const selfHasDupExt = selfParsed.diagnostics.some((d) => d.code === 'E22' && String(d.message).startsWith('외부 근거 이름표가 겹친다:'));
      const selfExtKeys = new Set<string>();
      if (!selfHasDupExt) {
        for (const c of selfParsed.message.clauses) for (const ev of c.evidences ?? []) selfExtKeys.add(`${ev.kind}:${ev.id}`);
        for (const ev of selfParsed.message.evidences ?? []) selfExtKeys.add(`${ev.kind}:${ev.id}`);
      }
      const escT = tStr.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
      const squatWrapRe = new RegExp(`([<〈＜⟨《‹]\\s*(?:[절점cC]\\s*)?)${escT}(\\.\\d+)?(?=\\s|[·•・ㆍ∙⋅‧●⬤⚫\\[])`, 'gu');
      const squatLeadRe = new RegExp(`(^|\\n)(\\s*(?:[절점cC]\\s*))${escT}(\\.\\d+)?(?=\\s*[<〈＜⟨《‹])`, 'gu');
      let seq = 1;
      priors = priors.map((p) => {
        let out = p
          .replace(squatWrapRe, (_m, p1, sub) => `${p1}9000${seq++}${sub ?? ''}`)
          .replace(squatLeadRe, (_m, p1, p2, sub) => `${p1}${p2}9000${seq++}${sub ?? ''}`);
        if (selfExtKeys.size > 0) {
          out = out.replace(
            /(^|\s+)((?:증|근|evd|ref)[0-9０-９]+(?:\.[0-9０-９]+)?)(\s*[:：]?\s*(?:<\[|⟪|\[<))/giu,
            (full, lead, rawTag, openPart) => {
              const tag = parseExtTag(rawTag);
              if (!tag || !selfExtKeys.has(`${tag.ext}:${tag.id}`)) return full;
              return `${lead}${tag.ext}9000${seq++}${openPart}`;
            },
          );
        }
        return out;
      });
    }
  }
  const selfOnly = parse(line, parseOpts);
  const priorParsed = priors.length ? parse(priors.join('\n'), parseOpts) : null;
  const known = new Set((priorParsed?.diagnostics ?? []).map(diagKey));
  const from = priorParsed ? priorParsed.message.clauses.length : 0;
  const combined = priors.length ? parse([...priors, line].join('\n'), parseOpts) : selfOnly;
  const after = combined.diagnostics.filter((d) => !known.has(diagKey(d)));
  const ruleDiags = use08 ? rules08(combined, { lang, ink, from, profile }) : rules07(combined, { lang, ink, from });
  const diagnostics = [...turnDiags, ...after, ...ruleDiags];
  const errors = diagnostics.filter((d) => d.severity === '오류');
  const warnings = diagnostics.filter((d) => d.severity !== '오류');
  return {
    line,
    message: selfOnly.message,
    diagnostics,
    errors,
    warnings,
    ok: errors.length === 0,
  };
}
