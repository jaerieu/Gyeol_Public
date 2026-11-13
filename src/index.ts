// 결 v0.8.2 참조 구현의 입구
export type * from './types.ts';
export { parse, emptyMessage, labelLine, lineFormOf, clausePieces, extractTrailingEvidences, parseExtTag } from './parse.ts';
export type { ParseOptions } from './parse.ts';
export { outsideMentions, scanExtBlocks, outsideExtBlocks, flattenExtNewlines, formatExtFence } from './parse/shared.ts'; // 2026-11-05·v0.8.2: 언급·외부 근거 블록 스캐너
export { rules08 } from './parse/v08.ts'; // v0.8.2: <N · 고정, E34 gut 한정, *먹채 공통 보존, 결(gyeol)·론(lon) 이중 프로파일 + spec 0.7 호환
export type { Rules08Options } from './parse/v08.ts';
export { parseTurn, extractTurnLine, parsePriorContext } from './turn.ts';
export type { ParseTurnOptions, ParseTurnResult, PriorContext } from './turn.ts';
export { format, clauseText, clauseText03, isV05, toDigit, foldClause, foldMessage, levelOf, refText, rootsOf } from './format.ts';
export type { FormatOptions } from './format.ts';
export { glossClause, glossLang, GLOSS } from './gloss.ts';
export { canonDocument, formatNumber, parseNumber } from './text.ts';
export { sha256Hex, documentName, messageName, short } from './hash.ts';
export * as tables from './tables.ts';
export { normalizeEvdId, sliceEvidenceLines, resolveRefCopyTurn } from './ref-copy.ts';
export type { RefCopyCondition, RefCopyOptions, RefCopyResult } from './ref-copy.ts';
