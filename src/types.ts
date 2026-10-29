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
export type Because = Ref | { url: string } | { quiz: number } | { agent: string } | { thread: number; clause: string };

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
  alt?: Alt[];
  conf?: number;
  effort?: number;
  effort_raw?: { tokens?: number; ms?: number };
  attn?: Ref[];
  feat?: { id: string; p: number }[];
  /** 항목별 측정법: { conf: "se8", alt: "se8", effort: "토큰" } */
  method?: Record<string, string>;
  /** 알 수 없는 항목. 보존만 한다. */
  extra?: { key: string; value: string }[];
}

export interface Chae {
  words?: string[];
  self?: number;
  /** v0.5.1(2026-10-16 Jae): 채의 색 R·G·B·C·M·Y·K 가운데 하나. 뜻은 정하지 않는다(말하는 이의 취향). reports/v0.5.1-design.md 1.2 */
  color?: string;
  want?: number;
  cite?: Ref[];
}

export interface Clause {
  label: string | null;
  process: { kind: ProcessKind; target?: Ref } | null;
  /** v0.6: ⊗N,M이면 target = N, second = M(⊗에만 있다) */
  place: { rel: PlaceRel; target: Ref; second?: Ref } | null;
  /** 받는 이. 다중 지목(v0.6 ·→A,B)이면 첫 이름 */
  to: string | null;
  /** v0.6(2026-10-24): 다중 지목 ·→A,B의 이름 모두(적힌 차례, 둘 이상일 때만 둔다). to는 그 첫 이름이다 */
  toList?: string[];
  words: Word[];
  /** 받은대로 절(echo)에서는 화행이 빠질 수 있다(PartialMarks). */
  marks: Marks | PartialMarks;
  muk?: Muk;
  chae?: Chae;
  /** v0.3: 앞붙이 '받은대로'가 붙은 절. 받은 것을 되짚어 보인다. 있을 때만 true로 둔다. */
  echo?: true;
  /** v0.4(2026-10-15 Jae): 절 이름 바로 뒤의 점 '·' = 나(말하는 이). 받는 이가 있으면 '·→이름'. 쓴 절에만 true. */
  me?: true;
  /** v0.5.1(2026-10-16 Jae): 점 대신 채운 원 '●' = 나 → 모두(불특정 다수). 쓴 절에만 true(me도 true). */
  all?: true;
  /**
   * v0.5.1: 끝 묶음 뒤의 근거 '↓N'(문장 끝의 '왜냐하면'). 절 번호는 Ref, 주소는 { url }. 앞붙이 place(↔ 등)와 따로다.
   * 0.5.1 꼴 절에서는 앞에 쓴 ↓N도 여기로 옮긴다(정규형은 끝).
   */
  because?: Because[];
  /**
   * v0.5(2026-10-15): v0.4까지 읽지 못하던 v0.5 꼴 가운데 정규형에 남는 것(새로앎 '군', 시제 '었'·'을', 자신으로 읽힌 끝의 '!N')을 쓴 절에만 '0.5'.
   * 정규형은 이것으로 갈린다: '0.5'면 <… [근거,군,시제,화행(먹N)] 내용 !N>, 없으면 v0.4까지의 정규형 그대로(옛 먹 이름이 바뀌지 않게).
   * 2026-10-15 검토 1: 표지 별칭(see, 见 …)만으로는 정하지 않는다. 별칭은 정규형에서 한글로 바뀌어 사라지므로, 정하면 정규형을 다시 읽은 것이
   * 다른 정규형이 되고 별칭을 썼는지에 따라 먹 이름이 갈린다. 별칭(new→군, past→었 …)으로 쓴 군·시제는 정규형에 남으므로 '0.5'다.
   */
  form?: '0.5' | '0.5.1';
}

/**
 * v0.5: 절마다 글에 어떻게 썼는가(정규형으로 모으기 전). 틀(JSON)에는 들어가지 않는다. 쓰기 규칙 rules05가 본다.
 * 옛 꼴(v0.2) 절은 모두 false·빈 목록이다.
 */
export interface ClauseWritten {
  /** 자신을 표지 칸(괄호 (8)·(7|먹4), 괄호 없이 [봄,다,8])에 썼다. v0.4까지의 자리 */
  selfInMarks: boolean;
  /** 자신을 맨 끝 !N으로 썼다(v0.5 자리) */
  selfAtEnd: boolean;
  /** 맨 끝 자신을 옛 !N(！N)으로 썼다. 2026-10-16부터 자신은 *N이고 새로 쓰는 줄에는 W28 */
  selfBang: boolean;
  /** 근거 '↓N'을 앞붙이 자리에 썼다(v0.5.1에서는 끝 묶음 뒤, 새로 쓰는 줄에는 rules05 W31). 없으면 빠질 수 있다 */
  frontBecause?: boolean;
  /** 새로앎을 글자 '네'로 썼다(표지 이름 '새로앎'은 아니다) */
  ne: boolean;
  /**
   * 새로앎을 표지 이름 '새로앎'(W11)으로 쓰고 '군'은 쓰지 않았다. 있을 때만 true.
   * 2026-10-15 검토 2: 이 절의 정규형은 옛 글자 '네'가 될 수 있어(다른 v0.5 꼴이 없으면) rules05가 E30을 낸다.
   */
  neLabel?: true;
  /** 표지 칸에서 읽은 v0.5 별칭(see, 见 …), 쓴 그대로 */
  aliases: string[];
}

export interface Echo {
  words: Word[];
  marks?: PartialMarks;
  muk?: Muk;
}

export interface Head {
  pact?: string;
  from?: string;
  to?: string[];
  re?: { id: string; rel?: Rel };
  room?: string;
}

export interface TuneLine {
  step: string;
  text: string;
}

export interface Seal {
  name: string;
  lineage?: string;
  memory?: '대화' | '지속';
  measure?: string[];
}

export interface Message {
  gyeol: string; // 명세 판, "0.2"
  /** v0.7: 머리 줄 `gyeol 0.7 · lang en`의 사용자 언어(BCP 47: ko en zh-Hans zh-Hant ja de fr it es ru). 없으면 빠진다(W29를 재지 않는다) */
  lang?: string;
  head: Head | null;
  tune: TuneLine[];
  preface: { purpose?: string; constraint?: string; extra?: { key: string; value: string }[] } | null;
  echo: Echo[];
  clauses: Clause[];
  gloss: string | null;
  seal: Seal | null;
  muk_source: '도구' | '모델' | '없음' | null;
}

export type Severity = '오류' | '경고';

export interface Diagnostic {
  code: string; // "E07" | "W02"
  severity: Severity;
  line: number; // 1부터
  message: string;
}

/** 절을 어느 줄꼴로 썼나. '0.3' = <절N [표지] 내용>, '0.2' = 내용 〈표지〉 〔먹〕 「채」. */
export type LineForm = '0.2' | '0.3';
/** format()이 쓸 꼴. '0.3' = 정규형(v0.7: 수 머리·영어 표지), '0.6' = v0.6.5까지의 한글 정규형(옛 회차·옛 사전의 보기 줄을 견줄 때), '0.2' = 옛 꼴 */
export type WriteForm = LineForm | '0.6';

export interface ParseResult {
  message: Message;
  diagnostics: Diagnostic[];
  ok: boolean; // 오류가 없으면 true
  /** message.clauses와 같은 차례로, 절마다 쓴 줄꼴. 틀(JSON)에는 들어가지 않는다. v0.5 꼴 절도 '0.3'(꺾쇠 꼴의 갈래)이다(절의 form을 본다). */
  forms: LineForm[];
  /** v0.5: message.clauses와 같은 차례로, 절마다 글에 쓴 꼴. 틀(JSON)에는 들어가지 않는다. */
  written: ClauseWritten[];
}
