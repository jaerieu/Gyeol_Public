// 결 v0.5 참조 구현의 입구(읽기는 v0.3 꼴에 v0.5 꼴을 더했고, 새로 쓰는 줄의 쓰기 규칙은 rules05 = rules04 + v0.5 규칙).
export type * from './types.ts';
export { parse, emptyMessage, labelLine, lineFormOf, clausePieces } from './parse.ts';
export { rules04 } from './parse/v04.ts';
export { rules05, rules051 } from './parse/v05.ts';
export { rules065, removedMarks065 } from './parse/v065.ts'; // v0.6.5(2026-10-28): rules06 + W37(사전에서 뺀 표지·앞붙이)
export { rules07 } from './parse/v07.ts'; // v0.7(2026-10-29): rules065 − W26(짧은 별칭) − W29(옛 뜻) + W29(사용자 언어가 아닌 글자군 어근 하나) + W26(긴 별칭만, 완화)
export { rules06 } from './parse/v06.ts'; // v0.6(2026-10-24, 실험적): rules051 − W27 + E34·W34·W35
export { format, clauseText, clauseText03, isV05, toDigit, foldClause, foldMessage, levelOf, refText, rootsOf } from './format.ts';
export type { FormatOptions } from './format.ts';
export { glossClause, glossLang, GLOSS } from './gloss.ts';
export { canonDocument, formatNumber, parseNumber, normalizeSymbols } from './text.ts';
export { sha256Hex, documentName, messageName, short } from './hash.ts';
export { harmony, altInterval, calibrate, parseScale, effortFrom, mukFromClusters } from './measure.ts';
export { coreOf, sameCore, sameRoots, sameChar, foldLevelFor, beatHz, variantWarnings } from './core.ts';
export { toSimplified, nonStandardChars } from './script.ts';
export type { VariantTable, Core } from './core.ts';
export * as tables from './tables.ts';
