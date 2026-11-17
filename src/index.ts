// 결 v0.8.5 참조 구현의 입구
export type * from './types.ts';
export { parse, emptyMessage, labelLine, lineFormOf, clausePieces, extractTrailingEvidences, parseExtTag } from './parse.ts';
export type { ParseOptions } from './parse.ts';
export { outsideMentions, scanExtBlocks, outsideExtBlocks, flattenExtNewlines, formatExtFence } from './parse/shared.ts';
export { scanCst, cstToText, splitCommentary } from './parse/cst.ts';
export type { CstDocument, CstNode, CstNodeKind } from './parse/cst.ts';
export { resolveEditionConfig, normalizeEditionId } from './parse/editions.ts';
export type { EditionConfig, EditionId } from './parse/editions.ts';
export { rules08 } from './parse/v08.ts';
export type { Rules08Options } from './parse/v08.ts';
export { parseTurn, extractTurnLine, parsePriorContext } from './turn.ts';
export type { ParseTurnOptions, ParseTurnResult, PriorContext } from './turn.ts';
export { format, formatTurn, clauseText, clauseText03, isV05, toDigit, foldClause, foldMessage, levelOf, refText, rootsOf } from './format.ts';
export type { FormatOptions, FormatTurnOptions } from './format.ts';
export { glossClause, glossLang, GLOSS } from './gloss.ts';
export { canonDocument, formatNumber, parseNumber } from './text.ts';
export { sha256Hex, documentName, messageName, short } from './hash.ts';
export * as tables from './tables.ts';
export { SPEC_VERSION, LON_VERSION, PROVENANCE_CODES, CONTENT_CODES, tierOfCode, closestMarkHint } from './tables.ts';
export type { ScriptGroup } from './tables.ts';
export { normalizeEvdId, sliceEvidenceLines, resolveRefCopyTurn, stripReplyLabels } from './ref-copy.ts';
export type { RefCopyCondition, RefCopyOptions, RefCopyResult } from './ref-copy.ts';
export { clauseWithEvidence, carryDiff } from './lineage.ts';
export type { CarryChange, CarryDiffResult } from './lineage.ts';
export {
  evaluateCalcExpression,
  splitCalcExpression,
  extractNumbersFromText,
  extractNumbersFromClause,
  extractPrimaryNumeric,
  numbersMatch,
  verifyMessageCalculations,
  propagateCalculations,
} from './calc.ts';
export type { EvalResult, CalcVerifyContext, PropagatedFix, PropagateOptions, PropagateLedgerSource } from './calc.ts';
export {
  jcsStringify,
  jcsSha256,
  LedgerContext,
  commitTurn,
  extractOpenConflicts,
  formatLedgerView,
  DEFAULT_EPOCH_SIZE,
  computeClauseLattice,
  buildEpochView,
  formatEpochLedgerView,
  formatActiveStateIndex,
} from './ledger.ts';
export type {
  OpenConflict,
  LedgerChainBlock,
  LedgerEpistemicLattice,
  LedgerAliasResolution,
  LedgerTurnRecord,
  LedgerEntry,
  FormatLedgerViewOptions,
  EpochViewOptions,
  EpochLedgerView,
} from './ledger.ts';
export { generateEbnf, generateGbnf } from './grammar-gen.ts';
export type { GrammarGenOptions } from './grammar-gen.ts';
export {
  MUK,
  MUK_SPEC_VERSION,
  COLORS,
  probOf,
  brierOf,
  pointsOf,
  weightOf,
  summarizeAnswers,
  scoreOf,
  relScoreOf,
  relativePoints,
  hitOf,
  decayOf,
  calibration,
  basePoint,
  quizAnchor,
  mukStatusOf,
  createMukStream,
  updateMukStream,
  snapshotMukStream,
  credibility,
  credibilityByLang,
  abilityOf,
  gradeOf,
  requestBonus,
  tenureBonus,
  agentMuk,
  formatMukToken,
  isLowRequest,
  calibrationTable,
  confBucket,
  colorGain,
  readWeight,
  counterShare,
  consensusWeight,
  poolConsensus,
} from './muk.ts';
export type {
  MukVersion,
  MukStatus,
  AnswerRow,
  QuizSummary,
  PeerRow,
  Fold,
  CredibilityOptions,
  MukStreamState,
  MukStreamOptions,
  MukStreamObservation,
  MukStreamSnapshot,
  LangTrust,
  AgentMuk,
  ShareFormula,
  ReadWeightOptions,
  CounterShareOptions,
  MukExperimentalOptions,
  MukProfileInput,
  ConsensusWeightOptions,
  ConsensusVote,
  PoolConsensusOptions,
} from './muk.ts';
export {
  STANDARDS_SPEC_VERSION,
  LON_WIRE_KEY,
  isWellFormedString,
  exportAuditBundle,
  verifyAuditBundle,
  toProvJson,
  toOtelGenAiAttributes,
  wrapMcpToolResult,
  unwrapMcpToolResult,
  wrapA2aArtifact,
  unwrapA2aArtifact,
} from './standards.ts';
export type {
  MukSnapshotRecord,
  MukSnapshotInput,
  AuditLineageLattice,
  AuditLineageNode,
  AuditEvidenceRecord,
  CalcSummaryItem,
  AuditCalcSummary,
  BundleSignablePayload,
  Bundle085,
  ExportAuditBundleOptions,
  AuditVerifyResult,
  ProvJsonDocument,
  OtelPrimitiveAttributeValue,
  OtelGenAiEvent,
  OtelPoolConsensusSummary,
  OtelGenAiOptions,
  OtelGenAiTelemetry,
  LonTurnInput,
  LonWireMetaInput,
  LonWireEnvelope085,
  McpToolResultLike,
  WrappedMcpToolResult,
  UnwrappedMcpToolResult,
  A2aArtifactLike,
  WrappedA2aArtifact,
  UnwrappedA2aArtifact,
} from './standards.ts';
