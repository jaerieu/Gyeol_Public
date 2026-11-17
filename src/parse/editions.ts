// 결 v0.8.5 선언형 에디션·프로파일·모드 규칙표
import type { Head, Profile } from '../types.ts';
import { LON_VERSION, SPEC_VERSION } from '../tables.ts';

export type EditionId = '0.7' | '0.8' | '0.8.2' | '0.8.5';

export interface EditionConfig {
  id: EditionId;
  version: string;
  profile: Profile;
  mode: 'delta' | 'snapshot' | null;
  requireDot: boolean;
  requireChae: boolean;
  tailStyle: 'chae' | 'colon_conf';
  allowUnmeasuredMuk: boolean;
  isolateBodySpan: boolean;
  autoRestoreLimSay: boolean;
  exemptW29: boolean;
  exemptW32: boolean;
  enforceAsciiIds: boolean;
  checkSnapshotContinuity: boolean;
}

export function normalizeEditionId(spec?: string | null): EditionId {
  const s = String(spec ?? '').trim();
  if (s === '0.7' || s.startsWith('0.7.')) return '0.7';
  if (s === '0.8' || s === '0.8.0' || s === '0.8.1') return '0.8';
  if (s === '0.8.2' || s === '0.8.3' || s === '0.8.4') return '0.8.2';
  return '0.8.5';
}

export function resolveEditionConfig(opts: {
  spec?: string | null;
  profile?: Profile | null;
  mode?: 'delta' | 'snapshot' | null;
  snapshot?: boolean;
  head?: Head | null;
} = {}): EditionConfig {
  const id = normalizeEditionId(opts.spec ?? SPEC_VERSION);
  const profile: Profile = opts.profile === 'lon' ? 'lon' : 'gyeol';
  const isLon = profile === 'lon';
  const mode: 'delta' | 'snapshot' | null =
    opts.mode ?? opts.head?.mode ?? (opts.snapshot || opts.head?.snapshot ? 'snapshot' : isLon && id === '0.8.5' ? 'delta' : null);
  const is085 = id === '0.8.5';
  const requireChae = isLon ? !is085 : true;
  return {
    id,
    version: isLon && is085 ? LON_VERSION : id === '0.8.5' ? SPEC_VERSION : id,
    profile,
    mode,
    requireDot: true,
    requireChae,
    tailStyle: isLon && is085 ? 'colon_conf' : 'chae',
    allowUnmeasuredMuk: is085,
    isolateBodySpan: is085 || id === '0.8.2',
    autoRestoreLimSay: isLon && is085,
    exemptW29: isLon,
    exemptW32: isLon,
    enforceAsciiIds: id !== '0.7',
    checkSnapshotContinuity: mode === 'snapshot',
  };
}
