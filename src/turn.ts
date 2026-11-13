// 단일 차례 진입점(parseTurn): 생각 태그·머리표·다중 줄 외부 근거(<[ … ]>) 정규화와 명시 규격(0.7 · 0.8)·프로파일(gyeol · lon) 판정을 한 번에 수행한다.
import type { Clause, Diagnostic, ExtEvidence, Message, Profile } from './types.ts';
import { parse, type ParseOptions } from './parse.ts';
import { rules08 } from './parse/v08.ts';

export interface PriorContext {
  clauses: Clause[];
  evidences: ExtEvidence[];
}

/** 앞 차례 줄 목록을 한 번만 읽어 `priorClauses`·`priorEvidences` 맥락을 만든다. */
export function parsePriorContext(
  priorLines: readonly string[] | undefined,
  opts: { v08?: boolean; issued?: readonly string[] } = {},
): PriorContext {
  const priors = Array.isArray(priorLines) ? priorLines.map((x) => String(x ?? '').trim()).filter(Boolean) : [];
  if (!priors.length) return { clauses: [], evidences: [] };
  const p = parse(priors.join('\n'), { v08: opts.v08 ?? true, ...(opts.issued?.length ? { issued: opts.issued } : {}) });
  const evidences: ExtEvidence[] = [];
  for (const c of p.message.clauses) if (c.evidences?.length) evidences.push(...c.evidences);
  if (p.message.evidences?.length) evidences.push(...p.message.evidences);
  return { clauses: p.message.clauses, evidences };
}

export interface ParseTurnOptions {
  profile?: Profile;
  spec?: '0.7' | '0.8';
  lang?: string;
  ink?: number | null;
  priorLines?: string[];
  turnNo?: number | null;
  /** v0.8.1(3.22절): 호출부가 미리 준 받은 자료 번호(`evd103` 등). 선언 없이 ↓evd103으로 가리켜도 E17을 내지 않는다 */
  issued?: readonly string[];
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

import { scanExtBlocks } from './parse/shared.ts';

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
  // v0.8.2 재검토: 줄마다 쌓인 본문 전체를 다시 훑으면 줄 수의 제곱이라, 여는 기호가 나온 뒤
  // 풀이 머리표나 백틱 감싸기를 판단해야 하는 줄에서만 훑는다(판정은 같다).
  const EXT_OPENER_RE = /<\[|\[<|⟪/u;
  const BACKTICK_WRAP_RE = /^\s*`+(?=<)|(?<=>)`+\s*$/u;
  let sawOpener = false;
  const inUnclosedExt = () => sawOpener && kept.length > 0 && scanExtBlocks(kept.join('\n')).some((sp) => !sp.closed);
  for (const rawL of lines) {
    const t = rawL.trim();
    const glossHit = GLOSS_LABEL_RE.test(t);
    const inExt = glossHit || BACKTICK_WRAP_RE.test(rawL) ? inUnclosedExt() : false;
    if (!inExt && glossHit) break;
    if (!started) {
      const m = HEAD_LABEL_RE.exec(t);
      if (m) {
        started = true;
        const body = m[1].replace(/\s*`+\s*$/u, '').trim();
        if (body) {
          kept.push(body);
          if (EXT_OPENER_RE.test(body)) sawOpener = true;
        }
        continue;
      }
      if (!t) continue;
      started = true;
    }
    const cleaned = !inExt ? rawL.replace(/^\s*`+(?=<)/u, '').replace(/(?<=>)`+\s*$/u, '') : rawL;
    kept.push(cleaned);
    if (EXT_OPENER_RE.test(cleaned)) sawOpener = true;
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
  const issued = Array.isArray(opts.issued) && opts.issued.length ? opts.issued : undefined;
  const prior = parsePriorContext(opts.priorLines, { v08: use08, issued });
  const parseOpts: ParseOptions = {
    ...(use08 ? { v08: true } : {}),
    ...(issued ? { issued } : {}),
    ...(prior.clauses.length ? { priorClauses: prior.clauses } : {}),
    ...(prior.evidences.length ? { priorEvidences: prior.evidences } : {}),
    ...(opts.turnNo != null ? { turnNo: opts.turnNo } : {}),
  };
  const res = parse(line, parseOpts);
  const ruleDiags = rules08(res, {
    lang,
    ink,
    profile,
    spec,
    priorClauses: prior.clauses,
    priorEvidences: prior.evidences,
    issued,
  });
  const diagnostics = [...res.diagnostics, ...ruleDiags];
  const errors = diagnostics.filter((d) => d.severity === '오류');
  const warnings = diagnostics.filter((d) => d.severity !== '오류');
  return {
    line,
    message: res.message,
    diagnostics,
    errors,
    warnings,
    ok: errors.length === 0,
  };
}
