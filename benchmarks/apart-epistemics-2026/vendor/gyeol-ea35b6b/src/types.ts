// 결 v0.3 — 틀(JSON) 자료형. spec/10-json.md 와 schema/gyeol-0.2.schema.json 을 따른다.
// v0.3(2026-10-14): 줄꼴 <절N 앞붙이 [표지(자신|먹)] 내용>. 틀은 v0.2와 같고, 받은대로 절(echo)만 더했다.
// v0.5(2026-10-15, reports/v0.5-design.md): 줄꼴 <절N · 앞붙이 [표지(먹N)] 내용 !N>. 틀에 시제(marks.tense)와 절의 꼴(form '0.5')을 더했다.
// 자신은 쓴 자리(괄호든 끝의 !N이든)와 상관없이 chae.self, 먹은 muk.conf다.
// v0.6(2026-10-24, 실험적, reports/v0.6-design.md 5): 근거 갑, 화행 거·유·양, 결 표지 한·역·비(marks.fig), 가리킴 ⊗(place.second),
// 다중 지목(toList), 지난 대화의 절 근거({ thread, clause }), 쓴 표지 순서(written.marksOff).
// v0.7(2026-10-29 Jae, reports/v0.7-design.md 6절): 표지·과정 앞붙이의 내부 값이 영어다(see·inf·say, fix·err·sup). 한글 글자는 읽을 때 MARK_KO2EN으로 바뀐다.
//   이름표(label·Ref.label)는 '절N'·'점N' 그대로 둔다(옛 꼴의 절·점 구분과 E17 판정을 지키려고). 정규형은 수만 쓴다. 머리 줄의 언어(lang)를 더했다.

/** v0.6: 갑 = 앞의 어떤 절에도 기대지 않는 새 화두(근거 자리). 갑 절은 가리키지 않고(E35) 근거가 될 수 없다(E34) */
export type Ev = 'see' | 'rec' | 'hrd' | 'inf' | 'com' | 'gut' | 'if' | 'top';
/** v0.6: 거 = 거절, 유 = 유보(응답을 미룸, 내용을 비워도 된다), 양 = 양보(상대 논점을 인정) */
export type Act = 'say' | 'ask' | 'chk' | 'req' | 'let' | 'vow' | 'nay' | 'dfr' | 'ack';
/** v0.6 결 표지(하나까지, E36): 한 = 한계, 역 = 역설, 비 = 비유. 정규 자리는 군 뒤 시제 앞 */
export type Fig = 'lim' | 'pdx' | 'met';
/** v0.5(2026-10-15): 표지 블록의 시제 칸. 었 = 지난 일, 을 = 앞일. 없으면 지금이거나 시제를 따지지 않음. */
export type Tense = 'pst' | 'fut';
export type Rel = '답' | '동의' | '반박' | '확장' | '수선';
/** v0.6: ⊗ = 남의 두 절이 양립하지 않음(place.target과 place.second, 자리 하나로 센다) */
export type PlaceRel = '↓' | '↔' | '∥' | '↖' | '⊗';
/** v0.6 덧붙임(2026-10-25 H-261025-8): 받침 = 절N의 직감(촉)·새 화두(갑)를 뒤늦게 찾은 근거로 받친다(받침→N, 과정 자리) */
export type ProcessKind = '숙고' | '미해결' | 'fix' | 'err' | 'sup';
export type FoldLevel = '점' | '절' | '펼침';
/** v0.8(2026-11-11 Jae): 문법 프로파일. 'gyeol' = 본래 결(다언어·사유 정체성), 'lon' = 론(Lineage Oriented Notation, 교차 검증·분석·계보 추적 전용 표준) */
export type Profile = 'gyeol' | 'lon';
/** v0.8(2026-11-11 Jae): 외부·보조 근거 종류 — ref(근: 출처·문헌·링크·발췌), evd(증: 실증·수식·증명·로그) */
export type ExtEvidenceKind = 'ref' | 'evd';

/** v0.8(2026-11-11 Jae): 전용 괄호꺽쇠 `<[ … ]>` 안에 담은 넓은 단위의 원문 근거(문장·링크·수식·표 등 어절·특수문자 제약 예외) */
export interface ExtEvidence {
  kind: ExtEvidenceKind;
  id: string;
  text: string;
}

/** 다른 절을 가리킴. msg가 null이면 같은 메시지 안이다. */
export interface Ref {
  msg: string | null;
  label: string; // "절2" | "점3"
  /** v0.6 덧붙임(2026-10-25 H-261025-8): 지난 대화의 절(받침→53:12, ↔53:12)이면 대화 번호. 메시지 밖이라 E17을 보지 않는다 */
  thread?: number;
}

/**
 * v0.5.1 끝의 근거 하나(2026-10-16 Jae): 이 메시지의 절(Ref), 주소({ url }), 시험 문제({ quiz: N }, ↓Q3), 다른 참가자({ agent }, ↓@kimi).
 * 근거는 쓰고 싶을 때만 쓴다(문법). 대화 밖을 가리키는 것은 문제 번호와 이름 둘로만 줄였다(초기 개발 자원 때문의 임시방편).
 */
// v0.6(2026-10-24): 지난 대화의 절 { thread: 53, clause: '절12' }(↓53:12). 메시지 밖이라 E17을 보지 않는다.
// v0.8(2026-11-11 Jae): 외부·보조 근거 식별자 { ext: 'ref' | 'evd', id: '1' }(↓ref1·↓evd2·↓근1·↓증2). 결·론 공통.
// v0.8.1(2026-11-12 Jae, 3.22절): 출처 세 갈래. 맥락 { ctx: N }(↓T0 대화 주제, ↓T1… 호출부가 준 배경),
//   evd = 받은 자료(호출부가 원문을 쥔 것, 옛 Q 번호대를 물려받음), ref = 가져온 자료(말하는 이 책임, 차례 번호).
//   옛 { quiz: N }(↓Q3)는 지난 기록을 읽으려고 그대로 두고 rules08이 W41(옛 표기)로 알린다.
export type Because =
  | Ref
  | { url: string }
  | { quiz: number }
  | { ctx: number }
  | { agent: string }
  | { thread: number; clause: string }
  | { ext: ExtEvidenceKind; id: string; lines?: [number, number] };

export interface Word {
  text: string; // 어절 그대로 (정규화 뒤)
  root?: string; // 한자 또는 로마자·숫자 어근
  suffix?: string; // 한글 꼬리
}

export interface Marks {
  ev?: Ev;
  /** 새로앎. 옛 글자 '네'와 v0.5 글자 '군'이 같은 뜻이다(어느 글자로 쓸지는 정규형이 절의 form으로 정한다). */
  news?: boolean;
  /** v0.5 시제(있을 때만) */
  tense?: Tense;
  /** v0.6 결 표지(있을 때만) */
  fig?: Fig;
  act: Act;
}

/** 받은대로의 되짚음에서 쓰는 부분 표지. 화행을 빼도 된다. */
export interface PartialMarks {
  ev?: Ev;
  news?: boolean;
  tense?: Tense;
  fig?: Fig;
  act?: Act;
}

export interface Alt {
  r: string;
  p: number;
}

export interface Muk {
  conf?: number;
}

export interface Chae {
  self: number;
  /** v0.5.1(2026-10-16 Jae): 채의 색 R·G·B·C·M·Y·K 가운데 하나. 뜻은 정하지 않는다(말하는 이의 취향). */
  color?: string;
}

export interface Clause {
  label: string | null;
  process: { kind: ProcessKind; target?: Ref } | null;
  place: { rel: PlaceRel; target: Ref; second?: Ref } | null;
  /** 받는 이. 다중 지목(·→A,B)이면 첫 이름 */
  to: string | null;
  /** 다중 지목 ·→A,B의 이름 모두(적힌 차례, 둘 이상일 때만 둔다). to는 그 첫 이름이다 */
  toList?: string[];
  words: Word[];
  marks: Marks | PartialMarks;
  muk?: Muk;
  chae?: Chae;
  echo?: true;
  me?: true;
  all?: true;
  because?: Because[];
  /** v0.8(2026-11-11 Jae): 절 뒤에 붙인 전용 괄호꺽쇠 외부 근거(`evd1 <[ … ]>`, `ref2 <[ … ]>`). */
  evidences?: ExtEvidence[];
  form?: '0.5' | '0.5.1' | '0.8';
}

/** 절마다 글에 어떻게 썼는가(정규형으로 모으기 전). 틀(JSON)에는 들어가지 않는다. rules08이 본다. */
export interface ClauseWritten {
  /** 표지 블록 순서가 정규 순서를 벗어났을 때 true(W34) */
  marksOff?: true;
  /** v0.8: 절 번호 뒤에 명시적으로 점(·)을 썼다(<1 · …>, <1 ·→이름 …>, <1 · ● …>) */
  hasDot?: true;
  /** v0.8 론(Lon) 검사: 영어 3글자 정본 표지가 아닌 별칭·한글 표지 목록 */
  nonEnMarks?: string[];
  /** 표지 칸에서 읽은 별칭, 쓴 그대로 */
  aliases: string[];
  /** v0.8.2 C2: 옛 확신·먹 표기(!N, *N, 괄호 수)를 이미 E26으로 잡았을 때 true(E33 이중 발사 방지) */
  legacyChae?: true;
}

export interface Head {
  pact?: string;
  from?: string;
  to?: string[];
  re?: { id: string; rel?: Rel };
  room?: string;
}

export interface Message {
  gyeol: string; // 명세 판
  /** 사용자 언어(BCP 47: ko en zh-Hans zh-Hant ja de fr it es ru). 없으면 빠진다(W29를 재지 않는다) */
  lang?: string;
  /** v0.8(2026-11-11 Jae): 머리 줄 `lon 0.8` 또는 `gyeol 0.8 · profile lon`에서 읽은 프로파일. */
  profile?: Profile;
  head: Head | null;
  clauses: Clause[];
  /** v0.8(2026-11-11 Jae): 단독 줄로 적은 외부·보조 근거 블록(`ref1 <[ … ]>`, `evd1 <[ … ]>`). */
  evidences?: ExtEvidence[];
  gloss: string | null;
  muk_source: '도구' | '모델' | '없음' | null;
}

export type Severity = '오류' | '경고';

export interface Diagnostic {
  code: string; // "E07" | "W02"
  severity: Severity;
  line: number; // 1부터
  message: string;
}

/** 절을 어느 줄꼴로 썼나. */
export type LineForm = '0.3';

export interface ParseResult {
  message: Message;
  diagnostics: Diagnostic[];
  ok: boolean; // 오류가 없으면 true
  /** message.clauses와 같은 차례로, 절마다 쓴 줄꼴. 틀(JSON)에는 들어가지 않는다. */
  forms: LineForm[];
  /** message.clauses와 같은 차례로, 절마다 글에 쓴 꼴. 틀(JSON)에는 들어가지 않는다. */
  written: ClauseWritten[];
}
