// 결 v0.8.5 무손실 구문 트리(CST: Concrete Syntax Tree) 스캐너
// 원문의 모든 문자 구간([start, end])을 공백·줄바꿈·해설 구분자까지 손실 없이 보존해 cstToText(cst) === normalizedInput 을 보장한다.

import { scanExtBlocks } from './shared.ts';

export type CstNodeKind = 'head' | 'clause' | 'ext_fence' | 'commentary' | 'trivia';

export interface CstNode {
  kind: CstNodeKind;
  start: number;
  end: number;
  raw: string;
  tag?: { ext: 'evd' | 'ref' | 'calc'; id: string };
  depth?: number;
  closed?: boolean;
}

export interface CstDocument {
  text: string;
  nodes: CstNode[];
  commentaryStart: number | null;
}

const HEAD_LINE_RE = /^(?:결|론|gyeol|lon)\s+\d+\.\d+/iu;
const COMMENTARY_SEP_RE = /^(?:---+\s*|(?:[*_`'"“”]+\s*)*(?:풀이|gloss)\s*(?:[*_`'"“”]+\s*)*[:：].*)$/iu;

/**
 * 입력 문자열(NFC + \n 정규화)을 무손실 CST 노드 배열로 분할한다.
 * 외부 근거 펜스 밖의 `---` 또는 `풀이:`/`gloss:` 줄 이후는 비발화 `commentary` 노드로 분리된다.
 */
export function scanCst(input: string): CstDocument {
  const text = String(input ?? '').replace(/\r\n?/g, '\n').normalize('NFC');
  const nodes: CstNode[] = [];
  const extSpans = scanExtBlocks(text);

  const inExtBlock = (pos: number): boolean => extSpans.some((sp) => pos >= sp.start && pos < sp.end);

  // 1. 비발화 해설 시작 위치 찾기 (외부 근거 펜스 밖의 단독 `---` 또는 `gloss:`/`풀이:`)
  let commentaryStart: number | null = null;
  let lineStart = 0;
  while (lineStart < text.length) {
    const nl = text.indexOf('\n', lineStart);
    const lineEnd = nl === -1 ? text.length : nl;
    const rawLine = text.slice(lineStart, lineEnd);
    const trimmed = rawLine.trim();
    if (!inExtBlock(lineStart) && COMMENTARY_SEP_RE.test(trimmed)) {
      commentaryStart = lineStart;
      break;
    }
    if (nl === -1) break;
    lineStart = nl + 1;
  }

  const activeLimit = commentaryStart ?? text.length;

  // 2. activeLimit 이전 영역을 ext_fence · head · clause · trivia로 선형 분할
  // scanExtBlocks의 구간과 겹치지 않는 범위에서 절(<...>)과 머리줄을 스캔
  const extActive = extSpans.filter((sp) => sp.start < activeLimit);
  let pos = 0;
  let extIdx = 0;
  let atLineStart = true;

  const pushTrivia = (start: number, end: number) => {
    if (end <= start) return;
    const prev = nodes.at(-1);
    if (prev && prev.kind === 'trivia' && prev.end === start) {
      prev.end = end;
      prev.raw += text.slice(start, end);
    } else {
      nodes.push({ kind: 'trivia', start, end, raw: text.slice(start, end) });
    }
  };

  while (pos < activeLimit) {
    // ext_fence 시작점
    if (extIdx < extActive.length && pos === extActive[extIdx].start) {
      const sp = extActive[extIdx++];
      const end = Math.min(sp.end, activeLimit);
      nodes.push({
        kind: 'ext_fence',
        start: sp.start,
        end,
        raw: text.slice(sp.start, end),
        ...(sp.tag ? { tag: { ext: sp.tag.ext as 'evd' | 'ref' | 'calc', id: sp.tag.id } } : {}),
        depth: sp.depth,
        closed: sp.closed,
      });
      pos = end;
      atLineStart = pos > 0 && text[pos - 1] === '\n';
      continue;
    }

    const nextExtStart = extIdx < extActive.length ? extActive[extIdx].start : activeLimit;
    if (atLineStart) {
      const nl = text.indexOf('\n', pos);
      const lineEnd = Math.min(nl === -1 ? activeLimit : nl, nextExtStart);
      const lineStr = text.slice(pos, lineEnd);
      if (HEAD_LINE_RE.test(lineStr.trim())) {
        nodes.push({ kind: 'head', start: pos, end: lineEnd, raw: lineStr });
        pos = lineEnd;
        atLineStart = false;
        continue;
      }
    }

    const ch = text[pos];
    if (ch === '<' && text[pos + 1] !== '[') {
      // 절(<...>) 경계 찾기: 백틱과 ext_fence 전까지만 탐색
      let end = pos + 1;
      let inTick = false;
      let foundClose = false;
      while (end < nextExtStart && text[end] !== '\n') {
        if (text[end] === '`') inTick = !inTick;
        else if (!inTick && text[end] === '>') {
          end++;
          foundClose = true;
          break;
        }
        end++;
      }
      if (foundClose || text.slice(pos + 1, end).includes('[')) {
        nodes.push({ kind: 'clause', start: pos, end, raw: text.slice(pos, end), closed: foundClose });
        pos = end;
        atLineStart = false;
        continue;
      }
    }

    // 다음 의미 토큰이나 줄바꿈까지 trivia로 묶는다
    let nextPos = pos + 1;
    while (nextPos < nextExtStart) {
      const c = text[nextPos];
      if (c === '\n') {
        nextPos++;
        break;
      }
      if (c === '<' && text[nextPos + 1] !== '[') break;
      nextPos++;
    }
    pushTrivia(pos, nextPos);
    atLineStart = text[nextPos - 1] === '\n';
    pos = nextPos;
  }

  if (commentaryStart !== null && commentaryStart < text.length) {
    nodes.push({
      kind: 'commentary',
      start: commentaryStart,
      end: text.length,
      raw: text.slice(commentaryStart),
    });
  }

  return { text, nodes, commentaryStart };
}

/** 무손실 CST에서 원문 문자열을 완전히 복원한다. */
export function cstToText(cst: CstDocument): string {
  return cst.nodes.map((n) => n.raw).join('');
}

/** commentary 노드를 제외한 발화 본문과 비발화 해설 본문을 분리 반환한다. */
export function splitCommentary(input: string): { utterance: string; commentary: string | null } {
  const cst = scanCst(input);
  if (cst.commentaryStart === null) return { utterance: cst.text, commentary: null };
  const utterance = cst.text.slice(0, cst.commentaryStart).trimEnd();
  const rawComm = cst.text.slice(cst.commentaryStart).trim();
  const cleaned = rawComm.replace(/^---+\s*\n?/u, '').replace(/^(?:[*_`'"“”]+\s*)*(?:풀이|gloss)\s*(?:[*_`'"“”]+\s*)*[:：]\s*/iu, '').trim();
  return { utterance, commentary: cleaned || null };
}
