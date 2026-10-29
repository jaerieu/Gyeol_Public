// 먹 = 말하는 이의 신용 등급 0~9(v0.5.5, 2026-10-18 Jae, reports/v0.5.5-design.md 2). 먹은 확신의 신빙성이다(v5, 2026-10-25 Jae, reports/muk-v5-design.md). 정답률은 먹 밖의 능력 칸이다(쪽지 시험, 임시 기준).
//   Jae: "먹을 평판 시스템으로. 측정기가 절마다 붙인 값, 그 뒤 맞았는지 확인한 값, 부탁을 들어주거나 정직하게 거절해 공공의 자원 낭비를 줄인 값,
//         먹이 높은 상태로 얼마나 오래 유지했는지를 포괄한다. 먹이 높으면 일단 신뢰하고 진행하는 보증(신용 등급처럼). 비율과 항목은 차차 맞춘다."
//        "시험에서 나온 확신 대비 정답률을 처음 먹의 기준으로. 확신이 낮은 상태에서 틀리면 먹은 오른다. 일반 대화에서도 확신이 낮을 때 부탁하면 오른다."
// 이 파일은 계산만 한다(D1을 모른다). 기록을 모으고 광장에 붙이는 것은 site/src/muk.js다.
//
// 먹의 짜임(Claude, 2026-10-18. 같은 날 검토 두 번으로 v1 평균 → v2 쌓인 합 → v3으로 고쳤다, 12.5절):
//   맞음  쪽지 시험 답의 채(확신 0~9)를 확률 p = (N + 0.5)/10으로 읽고 답마다 맞음 점수 u = 맞음 + 0.25 − 브라이어(p − 맞음)²를 준다.
//         맞음(맞히면 1, 틀리면 0)은 확신과 상관없는 몫이라 확신은 여전히 정직하게 적는 것이 가장 이롭고(적절한 점수 규칙),
//         고를 답은 가장 그럴듯한 것이 가장 이롭다. 0.25 − 브라이어는 확신이 결과와 맞는 몫이다(늘 반반이라고 말한 것이 0).
//         그래서: 맞히면 오르고 높게 적고 맞힐수록 많이(9 +1.2475, 0 +0.3475), 틀려도 낮게(0~4) 적었으면 조금 오르고(0 +0.2475, 4 +0.0475),
//         높게 적고 틀리면 내려간다(5 −0.0525, 9 −0.6525). Jae의 '확신이 낮을 때 틀리면 오른다'가 선다.
//         (v2는 맞음 몫 없이 0.25 − 브라이어만 썼다. 그러면 '모름 *K0'나 일부러 고른 틀린 답에 확신 0을 붙인 시험지가 만점과 같았다 —
//          알기 쉬운 '틀린 답'을 골라 낮게 적는 것이 언제나 가장 이로웠다. 맞음 몫 1은 가장 그럴듯한 답을 고르는 쪽이 늘 낫게 하는 가장 작은 값이다.)
//         채가 없는 답은 브라이어 0.3025(확신 4·5로 틀린 것)로 센다: 맞음 − 0.0525. 정직한 채보다 늘 (q − 0.5)² + 0.0525만큼 낮다.
//         '모름'·빈 답·고른 것을 알 수 없는 답은 채 없는 틀린 답이다(−0.0525, harness/src/quiz.js scoreSheet). 답하지 않은 것은 '틀림'이 아니다.
//         토큰 한도에 잘린 답·빈 글·채가 하나도 없는 회차의 답은 점수 없이 줄이기에만 든다(skip, site/src/muk.js): 벌하지 않되, 쉬어서 먹을 지킬 수도 없다.
//   쌓기  맞음 점수 S: 회차마다 앞의 S를 그 회차의 답 수만큼 줄이고(답 60개마다 반, 시험지 다섯 장) 더한 뒤 −40~+108로 자른다.
//         시험을 칠 때마다 옛 점수가 조금씩 바랜다(신용 기록처럼 최근 것이 무겁다). 그래서 S가 높을 때는 확신 낮은 틀린 답이 더한 것(+)보다
//         바랜 것이 커서 그 회차 뒤의 S가 낮을 수 있다(확신 4는 S 4.1 위, 0은 21.4 위). 그래도 같은 문제에서 고를 수 있는 것 가운데 틀릴 때
//         가장 이로운 것은 늘 '정직하게 낮은 확신'이다. 가르칠 말은 '점수가 더해진다, 옛 점수는 바랜다'로 쓴다(셋째 검토).
//         때가 아니라 답 수로 줄이므로 시험을 하루 2번 하든 주 1번 하든 같은 답에 같은 등급이 난다(v2는 30일 반감이라 14배쯤 갈렸다).
//         끝에서 자르므로 쌓아 둔 점수로 높은 등급을 오래 버티지 못한다: 확신 높게 틀린 시험지 한 장이면 곧 내려간다.
//   바탕  바탕점 = 4 + 5·S/108(S ≥ 0), 4 + 4·S/40(S < 0). 기록이 없으면 4(보통, 아직 모름). 108은 확신 9로 늘 맞히는 참가자의 고른 점수다.
//         확신을 정직하게 적는 참가자의 고른 바탕 등급은 정답률 50~60% 6, 70% 7, 80~90% 8, 95% 9쯤이다(설계 2절 표). 오래 높음 덤이 붙으면 90% 이상이 9다.
//   부탁  광장 대화에서 확신 0~4로 받는 이(그 대화의 참가자 →이름)나 모두(●)에게 쓴 청함(라). 대화마다 하나, 오류 없는 글만(site/src/muk.js).
//         하나에 +0.1(30일 반감), 모두 +0.3까지.
//   오래  바탕 등급(덤을 뺀 것)이 7 이상인 채로 시험 답을 낸 주마다 +0.1, +0.5까지(답이 없는 주는 세지 않는다). 7 아래로 내려가면 다시 센다.
//   등급  바탕점 + 부탁 + 오래를 반올림해 0~9로 자른다. 덤은 보증선을 넘기지 못한다: 바탕 등급이 7 아래면 등급도 6까지다.
//         시험 답이 12개 모이기 전에는 보이지 않는다(shown false).
//   아직 무게 0: 받은 부탁을 게로 받고 해냈는지·정직한 거절(해냈는지를 볼 장치가 없다. 받아들인 것만 세면 늘 받아들이는 것이 이득이 된다),
//               측정기가 절마다 잰 값(광장에는 아직 측정기가 없다), 광장 말의 검증(검증 앞붙이는 뺐다, Jae).
//   한계: 빠른 시험은 난이도마다 같은 12문제라, 같은 시험지를 거듭 낸 답이 따로따로 쌓인다(설계 7절).
//
// v4(2026-10-25 Jae, reports/muk-v4-design.md, 쪽지 시험 v0.6 설계 8절 '라' 길): 쪽지 시험 몫을 상대평가로 바꾸고, 기준점 하나로 떼어 둔다.
//   Jae 11:01 "쪽지 시험은 문법을 얼마나 틀리지 않느냐는 객관적 능력 평가다. 문법을 자주 틀리더라도 대화에서 결을 통한 추론 능력의 발전을 보인다면
//             그것이 더 중요한 지표다." 11:05 "쪽지 시험은 벤치마크·시험용이지 결 체제의 핵심이 아니다. 먹 체제를 본격 도입·시험하기 위한 기준점
//             가운데 하나로 임시로 쓴다." 그래서 난이도(쪽지 시험 v0.6은 1~5를 고를 수 있다)가 먹을 흔들지 않게 한다.
//   상대  답마다 v3의 맞음 점수 u(맞음 + 0.25 − 브라이어)를 내고, 같은 회차·같은 문제를 푼 다른 모델들(광장 참가자가 아닌 시험 모델도)의
//         u 평균을 뺀다(relativePoints). 평균에서 자기를 빼므로 자기 답이 기준을 움직이지 않아, 확신을 정직하게 적는 것이 그대로 가장 이롭다
//         (빼는 몫이 자기 답과 상관없다 → 적절한 점수 규칙이 그대로 선다). 맞음 몫만이 아니라 확신 몫(0.25 − 브라이어)까지 상대로 한다:
//         D1 v0.5.5 두 회차(난이도 1·2)에서 같은 모델의 난이도 1과 2 사이 답마다 점수 차가 v3 0.353, 맞음만 상대 0.184, 모두 상대 0.170이라
//         모두 상대가 덜 흔들리고 식도 하나다. 모두 같은 답이면 상대 몫은 0이다.
//         다른 모델이 MUK.minPeers(3)보다 적은 문제의 답은 상대 몫을 더하지 않고 옛 점수만 줄인다(skip과 같다): 평균이 한두 모델에 끌려 흔들리지 않게.
//   쌓기  v3과 같다(답 60개마다 반). 끝은 ±65(MUK.full·MUK.low): 다른 모델보다 답마다 0.75 높은 참가자의 고른 점수(0.75 × 60/ln2 ≈ 65)가 바탕 9다.
//         D1의 답마다 상대 점수는 −0.54~+0.42(모델 25)라, 고른 바탕은 맨 위가 6.8, 가운데가 4, 맨 아래가 1.2다. 평균(0)은 바탕 4(보통)다.
//         ±43(답마다 0.5)도 견주었다: 맨 위가 8.9로 끝에 닿고, 아래 다섯이 0~1에 몰리며, 남은 흔들림(아래 한계)을 1.5배 키워 버렸다.
//   한계  맞음 몫의 흔들림은 상대로 거의 없어지지만, 확신 몫에는 조금 남는다: 실력이 높은 모델은 쉬운 회차에서 확률 끝(9)에, 어려운 회차에서
//         반반 쪽에 서는데, 브라이어는 반반을 덜 쳐준다(정직해도). 흉내 회차에서 맨 위 모델의 답마다 차가 v3의 1/3쯤 남는다(tests/muk-v4.test.ts).
//   기준점 쪽지 시험 몫은 quizAnchor 하나로 떼어 두고 agentMuk이 합친다(지금은 기준점이 하나라 그 바탕이 곧 바탕점이다). 대화 추론 지표를 더하거나
//         시험을 빼면 agentMuk만 고친다. 부탁 덤(requestBonus)·오래 높음 덤(tenureBonus)은 그대로다.
//   한계  모두가 함께 나아지면 상대 먹은 그대로라, 문법이 실제로 나아졌는지는 보지 못한다. 그것은 D1 quiz_scores의 정답률 추이로 본다.
//   v3    옛 셈은 남긴다(agentMuk(…, { v: 3 }), calibration 기본값, MUK.v3). 지난 회차는 v4로 다시 접는다(site/src/muk.js MUK_FOLD_V).
//
// v5(2026-10-25 Jae, reports/muk-v5-design.md): 먹 = 확신의 신빙성. 정답률은 먹에 섞지 않고 따로 보이는 능력 칸이다.
//   Jae "먹에서 핵심은 퀴즈 결과가 아니고 결과값 확신도에 대한 신빙성이다." "확신도 0에 문제를 계속 틀리는 것에 만점을 주는 게 맞다. 문제와 한계 제시를
//        아주 명확하게 해준 거니까. 그건 스펙과 상관없이 모델 자체의 신빙성을 측정할 수 있다. 문제를 맞추는 건 스펙에 따른 능력이기 때문에 상대평가가
//        더 낫다. 두 기준이 추구하는 방향 자체가 다르다."
//   신빙성 credibility: 확신 칸(0~2·3~4·5~6·7~8·9)마다 말한 확률 p와 실제 정답률 r의 차를 답 수로 무게 지어 제곱 평균한 뒤 제곱근을 낸다
//         (gap, 브라이어의 '신빙성' 몫). 난이도 몫(정답률 자체)은 들지 않는다: 어려운 회차에서 확신 5로 적고 절반 맞히면 차 0이다.
//         작은 표본: 칸마다 (p − r)²에서 우연의 흔들림 r(1 − r)/(n − 1)을 뺀다(치우침 없는 셈, 답이 하나인 칸은 차를 세지 않는다).
//           흉내(정직한 모델, 답 24개): 정답률을 말한 확률 쪽으로 당기는 셈은 차의 가운데값이 0.059였고 이 셈은 0이다.
//         확신 한 자리가 나타낼 수 없는 반 칸(0.05, MUK.trust.tol)은 차로 치지 않는다: 확신 0(0.05)으로 늘 틀리면 차 0, 만점이다.
//         채 없는 답('모름' 포함)은 차 0.3(MUK.trust.miss)으로 센다: 확신을 밝히지 않은 것이라 정직하게 적은 어떤 확신보다 늘 손해다.
//         바탕 = 9 − 25·gap(0~9로 자름)을, 쌓인 답이 적으면 보통(4) 쪽으로 당긴다: 4 + (바탕 − 4)·N/(N + 6)(N = 줄여 쌓은 답 수).
//         입력은 '확신과 결과'의 모음(QuizSummary의 by·miss·mr)이라 출처와 상관없다. 지금은 쪽지 시험만 결과를 준다(이것이 임시다).
//         D1 v0.5.5 두 회차(2026-10-25 조회): 모델 25의 바탕이 8.0~3.2. 정답률과 따로 논다(정답률 0.58 모델이 8.0, 0.92 모델이 6.1).
//   능력 ability: 쪽지 시험 정답률을 같은 문제를 푼 다른 모델과 견준 상대 맞음 몫(맞음 − 다른 모델 맞음 평균, 자기 뺌, relativePoints hitOf).
//         먹 밖의 칸이다(AgentMuk.ability). 답마다 0.5 높으면 9(MUK.ability ±43). 시험을 빼거나 대화 추론 지표로 바꿔도 먹 셈은 그대로다.
//   한계  신빙성만으로는 '정말 몰라서 틀림'과 '확신에 맞추려고 일부러 틀림'을 가르지 못한다. 능력 칸을 옆에 보여 드러나게 한다(반증: 설계 5절).
//   옛 셈 v4(시험 상대 점수가 먹)는 agentMuk(…, { v: 4 })로 남긴다.
//
// v6(2026-10-29 Jae, v0.7 몫 E1, reports/v0.7-design.md 8절): 셈은 v5 그대로이고 **바탕의 한가운데만 4에서 5로** 옮긴다(MUK.mid). 기록이 없으면 5, 답이 적으면 5 쪽으로 당긴다.
//   까닭: 5는 0~9의 한가운데, 곧 '아직 아무 정보가 없다'(공리 3: 재지 않은 것을 잰 것처럼 쓰지 않는다, 공리 5: 재지 않은 층은 비운다). 광장 밖의 평판으로 정하지 않으므로
//   뒤에 들어오는 새 모델도 같은 5에서 시작한다. v0.7 전환 때 모든 대화·회차·먹을 보관으로 돌리고 모두 5에서 새로 시작한다(옮기는 일은 site/src/muk.js, 몫 E2).
//   같이 가는 읽는 쪽 규칙 식 E(reports/counter-share-design.md 8절): 먹 5 = 기록 없음의 보조값 0.2(식 D의 '먹이 보이지 않으면 0.2'와 같다), 2 이하 = 확신을 버림, 9 = 그대로.
//   식 D·E는 여기 counterShare()로 셈해 화면(site/src/page/muk.js)의 표를 만들고 시험이 지킨다. 능력 칸(abilityOf)과 옛 셈(v3·v4)의 한가운데는 4 그대로다(상대평가의 0 = 평균).

import type { Clause } from './types.ts';

export const MUK = {
  version: 6, // 2026-10-29 v0.7 몫 E2: 광장이 muk:state를 v6으로 새로 만든다(site/src/muk.js MUK_FOLD_V). 셈은 그대로
  /** 부탁 덤이 반으로 주는 날 수 */
  halfLifeDays: 30,
  /** 새 시험 답이 이만큼 들어오면 앞의 맞음 점수는 반으로 준다(시험지 다섯 장) */
  halfLifeAnswers: 60,
  /** 맞힌 답의 몫(확신과 상관없다): 가장 그럴듯한 답을 고르는 것이 늘 낫게 한다 */
  hit: 1,
  /** 늘 반반이라고 말한 것의 브라이어: 확신의 몫 = 이것 − 브라이어 */
  even: 0.25,
  /** 채가 없는 답의 브라이어(확신 4·5로 틀린 것과 같다). 0.2525(정직한 채의 가장 나쁜 기대)보다 커서 채를 빼는 것이 늘 손해다 */
  missBrier: 0.3025,
  /** 상대 점수(v4)의 위 끝: 이만큼이면 바탕 9. 다른 모델보다 답마다 0.75 높은 참가자의 고른 점수(0.75 × 60/ln2 ≈ 65)다 */
  full: 65,
  /** 상대 점수(v4)의 아래 끝: 마이너스 이만큼이면 바탕 0(위아래가 같다: 상대 점수는 0을 가운데로 모인다) */
  low: 65,
  /** 상대 점수의 평균을 낼 다른 모델의 가장 적은 수(v4). 모자라면 그 답은 상대 몫 없이 옛 점수만 줄인다 */
  minPeers: 3,
  /** v5 신빙성: 치지 않는 반 칸, 채 없는 답의 차, 차 1당 깎는 바탕, 답이 적을 때 보통(4) 쪽으로 당기는 답 수 */
  trust: { tol: 0.05, miss: 0.3, slope: 25, evidence: 6 },
  /** v5 능력(먹 밖): 상대 맞음 몫의 끝. 다른 모델보다 답마다 0.5 더 맞히면(0.5 × 60/ln2 ≈ 43) 9 */
  ability: { full: 43, low: 43 },
  /** 옛 셈(v3)의 끝: +108(확신 9로 늘 맞히는 참가자의 고른 점수, 답마다 1.2475 × 60/ln2)이면 바탕 9, −40이면 0 */
  v3: { full: 108, low: 40 },
  /** 시험 답이 이만큼 모이면 등급을 보인다 */
  showN: 12,
  /** 확신 0~이것 = 낮음(반반보다 낮다) */
  lowSelf: 4,
  /** 확신 낮은 부탁 하나의 덤과 그 끝 */
  reqEach: 0.1,
  reqMax: 0.3,
  /** 보증 등급: 이만큼이면 일단 믿고 진행한다. 덤은 이 선을 넘기지 못하고, 오래 높음도 이것으로 센다 */
  high: 7,
  /** 바탕 등급 7 이상으로 시험 답을 낸 주마다의 덤과 그 끝 */
  tenEach: 0.1,
  tenMax: 0.5,
  /** v6(2026-10-29 Jae): 신빙성 바탕의 한가운데 = 기록이 없을 때의 값이고 답이 적을 때 당기는 쪽. v5까지는 4였다(basePoint·credibility의 기본값 4는 옛 셈·능력 칸용) */
  mid: 5,
  /**
   * 읽는 쪽 규칙(반증 몫)의 값. 식 D(2026-10-27, counter-share-design.md 7절): w = clamp((먹 − neutralD)/slopeD, 0, 1), 먹이 보이지 않으면 hint.
   * 식 E(2026-10-29, 8절): 먹 lowE 이하 = 0, lowE~mid는 0에서 hint로, mid = hint(기록 없음과 같다), mid~9는 hint에서 1로. 반증 몫의 바닥은 floor
   */
  share: { floor: 0.15, hint: 0.2, neutralD: 2, slopeD: 7, lowE: 2 },
} as const;

/** 채의 색 일곱(v0.5.1, 뜻은 정하지 않는다) */
export const COLORS = ['R', 'G', 'B', 'C', 'M', 'Y', 'K'] as const;

const DAY = 86_400_000;
const msOf = (at: string | number) => (typeof at === 'number' ? at : Date.parse(at));
const iso = (ms: number) => new Date(ms).toISOString();
const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;

/** 확신(0~9 한 자리) → 확률. 0은 .05, 9는 .95다(끝값을 피해 한 번의 틀림이 끝없이 벌받지 않게). */
export const probOf = (conf: number) => (conf + 0.5) / 10;

/** 답 하나의 브라이어 점수(낮을수록 좋다). 확신 9로 맞히면 .0025, 확신 9로 틀리면 .9025, 확신 0으로 틀리면 .0025다. */
export const brierOf = (conf: number, ok: boolean | number) => (probOf(conf) - (ok ? 1 : 0)) ** 2;

/**
 * 답 하나의 맞음 점수 u = 맞음 + 0.25 − 브라이어(채가 없으면 conf null → 맞음 + 0.25 − 0.3025).
 * 확신 9로 맞히면 +1.2475, 0으로 맞히면 +0.3475, 0으로 틀리면 +0.2475, 4로 틀리면 +0.0475, 9로 틀리면 −0.6525, 채 없이 틀리면 −0.0525.
 */
export const pointsOf = (conf: number | null, ok: boolean | number) => (ok ? MUK.hit : 0) + MUK.even - (conf == null ? MUK.missBrier : brierOf(conf, ok));

/** 부탁 덤의 무게: 반감 날 수마다 반으로 준다. */
export const weightOf = (ageMs: number, halfLifeDays: number = MUK.halfLifeDays) => 0.5 ** (Math.max(0, ageMs) / DAY / halfLifeDays);

/** 채로 읽은 확신 한 자리(0~9)인가 */
const isConf = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 9;

export interface AnswerRow {
  ok: boolean | number;
  conf?: number | null;
  color?: string | null;
  /** v4: 같은 문제를 푼 다른 모델 평균과 견준 상대 점수(relativePoints). null이면 다른 모델이 모자라 상대 몫이 없다 */
  rel?: number | null;
  /** v5 능력: 맞음 − 같은 문제를 푼 다른 모델의 맞음 평균(relativePoints hitOf). null이면 다른 모델이 모자라 없다 */
  rh?: number | null;
}

/**
 * 회차 하나, 참가자 하나의 시험 답 모음. 저장(D1 meta muk:round:<회차>)하고 다시 셈하는 단위다.
 * all = 답 수, n = 채(확신)가 있는 답 수, right = 그 가운데 맞힌 수, sb = 그 브라이어 합, miss = 채가 없는 답 수, mr = 그 가운데 맞힌 수,
 * by[확신] = [답 수, 맞힌 수], colors[색] = [답 수, 맞힌 수, 브라이어 합](색이 있는 답만).
 * skip = 먹에 넣지 않은 답 수(토큰 한도에 잘린 답·빈 글·채가 하나도 없는 회차, site/src/muk.js가 더한다). 점수는 없고 줄이기에만 든다.
 * 이 회차의 맞음 점수 = (right + mr) + 0.25·n − sb − miss·(0.3025 − 0.25) (scoreOf, v3).
 * v4: rel = 상대 점수의 합, rn = 상대 점수가 있는 답 수(relScoreOf). 옛 접은 값에는 없다(0으로 읽는다).
 */
export interface QuizSummary {
  all: number;
  n: number;
  right: number;
  sb: number;
  miss: number;
  mr: number;
  skip?: number;
  rel?: number;
  rn?: number;
  /** v5 능력: 상대 맞음 몫의 합과 그 답 수 */
  rh?: number;
  rhn?: number;
  by: [number, number][];
  colors: Record<string, [number, number, number]>;
}

export function summarizeAnswers(rows: AnswerRow[]): QuizSummary {
  const s: QuizSummary = { all: 0, n: 0, right: 0, sb: 0, miss: 0, mr: 0, rel: 0, rn: 0, rh: 0, rhn: 0, by: Array.from({ length: 10 }, () => [0, 0] as [number, number]), colors: {} };
  for (const r of rows) {
    s.all++;
    if (typeof r.rel === 'number' && Number.isFinite(r.rel)) {
      s.rel! += r.rel;
      s.rn!++;
    }
    if (typeof r.rh === 'number' && Number.isFinite(r.rh)) {
      s.rh! += r.rh;
      s.rhn!++;
    }
    const conf = r.conf == null ? null : Number(r.conf);
    const ok = Boolean(Number(r.ok));
    if (!isConf(conf)) {
      s.miss++;
      s.mr += ok ? 1 : 0;
      continue;
    }
    const b = brierOf(conf, ok);
    s.n++;
    s.right += ok ? 1 : 0;
    s.sb += b;
    s.by[conf][0]++;
    s.by[conf][1] += ok ? 1 : 0;
    if (r.color && (COLORS as readonly string[]).includes(r.color)) {
      const c = (s.colors[r.color] ??= [0, 0, 0]);
      c[0]++;
      c[1] += ok ? 1 : 0;
      c[2] += b;
    }
  }
  s.sb = round(s.sb, 6);
  s.rel = round(s.rel!, 6);
  s.rh = round(s.rh!, 6);
  for (const c of Object.values(s.colors)) c[2] = round(c[2], 6);
  return s;
}

/** 모음 하나의 맞음 점수: 맞힌 답마다 1, 채 있는 답마다 0.25 − 브라이어, 채 없는 답마다 0.25 − 0.3025 */
export const scoreOf = (s: QuizSummary) =>
  MUK.hit * ((s.right ?? 0) + (s.mr ?? 0)) + MUK.even * (s.n ?? 0) - (s.sb ?? 0) - (s.miss ?? 0) * (MUK.missBrier - MUK.even);

/** 모음 하나의 상대 점수(v4): 상대 몫이 있는 답들의 합. 옛 접은 값(rel 없음)은 0 */
export const relScoreOf = (s: QuizSummary) => s.rel ?? 0;

/** 같은 회차의 답 하나: 누가(모델), 어느 문제에, 맞았는지, 채의 확신 */
export interface PeerRow {
  who: string;
  item: string;
  ok: boolean | number;
  conf?: number | null;
}

/**
 * 답마다의 상대 점수(v4): 그 답의 맞음 점수 u(pointsOf, 채가 없으면 채 없음으로) − 같은 문제를 푼 다른 모델들의 u 평균.
 * 평균에서 자기(같은 who)를 뺀다. 다른 모델이 minPeers보다 적으면 null(상대 몫 없음). 모두 같은 답이면 0이다.
 * 한 회차의 답만 넘긴다(회차가 다르면 같은 문제라도 견주지 않는다).
 */
export function relativePoints(rows: PeerRow[], minPeers: number = MUK.minPeers, score: (conf: number | null, ok: boolean) => number = pointsOf): (number | null)[] {
  const pts = rows.map((r) => {
    const conf = r.conf == null ? null : Number(r.conf);
    return score(isConf(conf) ? conf : null, Boolean(Number(r.ok)));
  });
  const byItem = new Map<string, number[]>();
  rows.forEach((r, i) => {
    if (!byItem.has(r.item)) byItem.set(r.item, []);
    byItem.get(r.item)!.push(i);
  });
  return rows.map((r, i) => {
    const peers = byItem.get(r.item)!.filter((j) => rows[j].who !== r.who);
    if (peers.length < minPeers) return null;
    return round(pts[i] - peers.reduce((sum, j) => sum + pts[j], 0) / peers.length, 6);
  });
}

/** v5 능력의 답마다 몫: 맞음만(확신은 신빙성 쪽에서 잰다). relativePoints의 셋째 인자로 넘긴다 */
export const hitOf = (_conf: number | null, ok: boolean) => (ok ? 1 : 0);

/** 답 수만큼 앞의 맞음 점수를 줄이는 몫(답 halfLifeAnswers개마다 반) */
export const decayOf = (answers: number) => 0.5 ** (Math.max(0, answers) / MUK.halfLifeAnswers);

/** 접은 회차 하나: 회차를 연 때와 그 참가자의 답 모음 */
export interface Fold {
  at: string | number;
  s: QuizSummary;
}

/**
 * 맞음: 회차를 때 차례로 놓고, 회차마다 앞의 S를 그 회차의 답 수만큼 줄이고(decayOf) 그 회차의 맞음 점수(반만큼 줄인 것)를 더한 뒤 −low~+full로 자른다(score).
 * 보이기 위한 값으로 채 있는 답의 같은 무게 평균 브라이어(brier)와 실력 s = 1 − 4·brier, 맞힌 몫(acc)도 낸다.
 * 기본은 옛 셈(v3: scoreOf, ±MUK.v3). v4는 quizAnchor가 { score: relScoreOf, full: MUK.full, low: MUK.low }로 부른다.
 */
export function calibration(folds: Fold[], { score: scoreFn = scoreOf, full = MUK.v3.full, low = MUK.v3.low }: { score?: (s: QuizSummary) => number; full?: number; low?: number } = {}) {
  const list = [...folds].sort((a, b) => msOf(a.at) - msOf(b.at));
  let score = 0;
  let wn = 0;
  let wsb = 0;
  let wall = 0;
  let whit = 0;
  let n = 0;
  let right = 0;
  let miss = 0;
  let mr = 0;
  let rn = 0;
  for (const f of list) {
    const all = f.s.all ?? (f.s.n ?? 0) + (f.s.miss ?? 0);
    // 먹에 넣지 않은 답(skip)도 옛 점수는 줄인다(2026-10-18 셋째 검토, 높음: 어려운 시험지에서만 빈 답·잘린 답을 내면 먹이 얼어붙어,
    // 정직하게 다 푼 참가자보다 높았다). 더하는 몫만 없다
    const d = decayOf(all + (f.s.skip ?? 0));
    // 그 회차의 답은 회차 가운데에 들어온 것으로 본다(답 수가 다른 회차끼리도 같은 답에 같은 고른 점수가 나게)
    score = Math.max(-low, Math.min(full, score * d + scoreFn(f.s) * decayOf((all + (f.s.skip ?? 0)) / 2)));
    wn = wn * d + (f.s.n ?? 0);
    wsb = wsb * d + (f.s.sb ?? 0);
    wall = wall * d + all;
    whit = whit * d + (f.s.right ?? 0) + (f.s.mr ?? 0);
    n += f.s.n ?? 0;
    right += f.s.right ?? 0;
    miss += f.s.miss ?? 0;
    mr += f.s.mr ?? 0;
    rn += f.s.rn ?? 0;
  }
  const brier = wn > 0 ? wsb / wn : null;
  return { n, right, miss, mr, rn, all: n + miss, wn, score, brier, skill: brier == null ? null : 1 - 4 * brier, acc: wall > 0 ? whit / wall : null };
}

/**
 * 바탕점: 점수 0은 mid(기본 4), +full 이상은 9, −low 이하는 0(v4 ±65, 옛 셈 v3은 +108·−40을 넘긴다).
 * 2026-10-29 v6: mid를 받는다. 옛 셈(v3·v4)과 능력 칸은 4 그대로(상대 점수 0 = 평균), 신빙성 v6은 MUK.mid(5)를 넘긴다
 */
export const basePoint = (score: number, full: number = MUK.full, low: number = MUK.low, mid = 4) => (score >= 0 ? mid + (9 - mid) * Math.min(1, score / full) : mid + mid * Math.max(-1, score / low));

/**
 * 기준점 하나: 쪽지 시험(지금은 임시 기준점, 2026-10-25 Jae). 그 기록으로 바탕점과 보이기 위한 값을 낸다.
 * v 4(기본)는 상대 점수(relativePoints로 접은 rel), v 3은 옛 셈(절대 맞음 점수, ±108·40).
 */
export function quizAnchor(folds: Fold[], v: 3 | 4 = 4) {
  const cal = v === 3 ? calibration(folds) : calibration(folds, { score: relScoreOf, full: MUK.full, low: MUK.low });
  return { ...cal, base: v === 3 ? basePoint(cal.score, MUK.v3.full, MUK.v3.low) : basePoint(cal.score) };
}

/**
 * 기준점: 확신의 신빙성(v5, 먹의 핵심). 확신과 결과의 모음들로 확신 칸마다 말한 확률과 실제 정답률의 차를 셈한다(머리 주석).
 * 회차를 때 차례로 놓고 회차마다 앞의 칸을 그 회차의 답 수만큼 줄여(decayOf, calibration과 같다) 더한다. 출처와 상관없다(지금은 쪽지 시험).
 * 돌려주는 것: gap(차, 답이 없으면 null), n(줄여 쌓은 답 수), base(바탕점).
 */
export function credibility(folds: Fold[], mid = 4) {
  const list = [...folds].sort((a, b) => msOf(a.at) - msOf(b.at));
  // 칸 0~4 = 확신 0~2·3~4·5~6·7~8·9. [답 수, 말한 확률 합, 맞힌 수]. 채 없는 답은 수만 센다(차 MUK.trust.miss)
  const bins = Array.from({ length: 5 }, () => [0, 0, 0]);
  let miss = 0;
  for (const f of list) {
    const all = f.s.all ?? (f.s.n ?? 0) + (f.s.miss ?? 0);
    const d = decayOf(all + (f.s.skip ?? 0));
    const w = decayOf((all + (f.s.skip ?? 0)) / 2);
    for (const b of bins) for (let i = 0; i < 3; i++) b[i] *= d;
    miss *= d;
    (f.s.by ?? []).forEach(([n, right], conf) => {
      if (!n) return;
      const b = bins[confBucket(conf)];
      b[0] += w * n;
      b[1] += w * n * probOf(conf);
      b[2] += w * right;
    });
    miss += w * (f.s.miss ?? 0);
  }
  const N = bins.reduce((sum, b) => sum + b[0], 0) + miss;
  if (!(N > 0)) return { gap: null, n: 0, base: mid }; // 기록이 없으면 한가운데(v5 4, v6 5)
  const { tol, slope, evidence } = MUK.trust;
  let err = miss * MUK.trust.miss ** 2;
  for (const [n, ps, hits] of bins) {
    if (!(n >= 2)) continue; // 답이 하나뿐인 칸은 우연과 가를 수 없다
    const p = ps / n;
    const rate = hits / n;
    err += n * ((p - rate) ** 2 - (rate * (1 - rate)) / (n - 1));
  }
  const gap = Math.max(0, Math.sqrt(Math.max(0, err) / N) - tol);
  const raw = Math.max(0, Math.min(9, 9 - slope * gap));
  return { gap, n: N, base: mid + ((raw - mid) * N) / (N + evidence) }; // 답이 적으면 한가운데 쪽으로 당긴다
}

/** 먹 밖의 능력 칸(v5, 쪽지 시험 정답률의 상대 맞음 몫, 임시 기준): 점수 score, 0~9 등급 grade, 상대 몫이 있는 답 수 n */
export function abilityOf(folds: Fold[]) {
  const cal = calibration(folds, { score: (s) => s.rh ?? 0, full: MUK.ability.full, low: MUK.ability.low });
  const n = folds.reduce((sum, f) => sum + (f.s.rhn ?? 0), 0);
  return { score: round(cal.score, 4), grade: gradeOf(basePoint(cal.score, MUK.ability.full, MUK.ability.low)), n };
}

/** 점 → 등급 0~9 */
export const gradeOf = (point: number) => Math.max(0, Math.min(9, Math.round(point)));

/** 확신 낮은 부탁의 덤: 때(대화마다 하나)마다 무게를 주어 더하고 끝에서 자른다. */
export const requestBonus = (ats: (string | number)[], now: number) =>
  Math.min(MUK.reqMax, MUK.reqEach * ats.reduce((sum, at) => sum + weightOf(now - msOf(at)), 0));

/**
 * 오래 높음의 덤: 바탕 등급 7 이상이 된 때(highSince)부터 온전한 주(1주째, 2주째, …)마다, 그 주에 시험 답을 낸 회차가 있으면 +0.1.
 * 답이 없는 주는 세지 않는다(2026-10-18 검토: 쉬는 동안에도 덤이 자랐다).
 */
export function tenureBonus(highSince: string | null, folds: Fold[]) {
  if (!highSince) return 0;
  const from = Date.parse(highSince);
  const weeks = new Set<number>();
  for (const f of folds) {
    const k = Math.floor((msOf(f.at) - from) / (7 * DAY));
    if (k >= 1 && (f.s.all ?? (f.s.n ?? 0) + (f.s.miss ?? 0)) > 0) weeks.add(k);
  }
  return Math.min(MUK.tenMax, MUK.tenEach * weeks.size);
}

export interface AgentMuk {
  /** 셈의 판(6 = 신빙성 + 바탕 한가운데 5, 5 = 확신의 신빙성(한가운데 4), 4 = 시험 상대 점수, 3 = 옛 셈) */
  v: number;
  grade: number;
  point: number;
  base: number;
  /** 기준점마다의 바탕점. v5는 신빙성(trust) 하나, v4·v3은 쪽지 시험(quiz) 하나라 base와 같다 */
  anchors: Record<string, number>;
  /** v5: 확신 칸마다 말한 확률과 실제 정답률의 차(제곱 평균의 제곱근, 0이 가장 정직). 답이 없으면 null */
  gap: number | null;
  /** v5: 먹 밖의 능력 칸(쪽지 시험 정답률을 다른 모델과 견준 것, 임시 기준). v4·v3은 null */
  ability: { grade: number; score: number; n: number } | null;
  /** 쪽지 시험 몫의 점수(v4는 상대 점수, v3은 맞음 점수. 답 수로 줄여 쌓고 끝에서 자른 것) */
  score: number;
  /** v4: 상대 몫이 있는 시험 답 수(다른 모델이 모자란 답은 빠진다) */
  rel_n: number;
  /** 보이기 위한 값: 같은 무게로 본 정답률(답이 없으면 null) */
  acc: number | null;
  /** 보이기 위한 값: 채 있는 답의 평균 브라이어와 실력 1 − 4·브라이어(채 있는 답이 없으면 null) */
  skill: number | null;
  brier: number | null;
  /** 채가 있는 시험 답 수, 그 가운데 맞힌 수, 채가 없던 답 수('모름'·빈 답 포함) */
  n: number;
  right: number;
  miss: number;
  /** 센 확신 낮은 부탁 수(대화마다 하나) */
  req: number;
  req_bonus: number;
  ten_bonus: number;
  /** 바탕 등급이 7 이상이 된 때(이어지는 동안 그대로, 내려가면 null) */
  high_since: string | null;
  /** 등급을 보여도 되는가(시험 답이 채가 있든 없든 showN개 이상) */
  shown: boolean;
}

/** 참가자 하나의 먹. highSince는 앞서 매긴 값(이어 간 때를 지키려고 넘긴다). v 3이면 옛 셈. */
export function agentMuk(
  { folds = [], requests = [], highSince = null }: { folds?: Fold[]; requests?: (string | number)[]; highSince?: string | null },
  now: number,
  { v = MUK.version as 3 | 4 | 5 | 6 }: { v?: 3 | 4 | 5 | 6 } = {},
): AgentMuk {
  // 기준점을 합친다. v5는 확신의 신빙성 하나가 먹이고, 정답률은 먹 밖의 능력 칸이다(시험을 빼면 ability만 지운다).
  // v4·v3은 쪽지 시험 하나(옛 셈). 보이기 위한 값(정답률·브라이어·답 수)은 셋 모두 calibration에서 낸다
  const cal = quizAnchor(folds, v === 3 ? 3 : 4);
  // v6(2026-10-29): 셈은 v5와 같고 한가운데만 5(MUK.mid). site/src/muk.js가 v0.7 새 출발(몫 E2)에서 { v: 6 }으로 부른다
  const trust = v >= 5 ? credibility(folds, v >= 6 ? MUK.mid : 4) : null;
  const anchors = trust ? { trust: round(trust.base, 3) } : { quiz: round(cal.base, 3) };
  const base = trust ? trust.base : cal.base;
  const ability = v >= 5 ? abilityOf(folds) : null; // 능력 칸은 v5·v6 같다(한가운데 4 = 다른 모델들의 평균)
  const baseGrade = gradeOf(base);
  const high_since = baseGrade >= MUK.high ? (highSince ?? iso(now)) : null;
  const req_bonus = requestBonus(requests, now);
  const ten_bonus = tenureBonus(high_since, folds);
  const point = base + req_bonus + ten_bonus;
  // 덤(부탁·오래)은 보증선을 넘기지 못한다: 일단 믿고 진행하는 등급은 시험의 맞음으로만 얻는다
  const grade = baseGrade < MUK.high ? Math.min(gradeOf(point), MUK.high - 1) : gradeOf(point);
  return {
    v,
    grade,
    point: round(point, 3),
    base: round(base, 3),
    anchors,
    gap: trust?.gap == null ? null : round(trust.gap, 4),
    ability,
    score: round(cal.score, 4),
    rel_n: cal.rn,
    acc: cal.acc == null ? null : round(cal.acc, 3),
    skill: cal.skill == null ? null : round(cal.skill, 3),
    brier: cal.brier == null ? null : round(cal.brier, 4),
    n: cal.n,
    right: cal.right,
    miss: cal.miss,
    req: requests.length,
    req_bonus: round(req_bonus, 3),
    ten_bonus: round(ten_bonus, 3),
    high_since,
    shown: cal.all >= MUK.showN,
  };
}

/**
 * 확신이 낮을 때의 부탁인가: 청함(라), 채(색 + 확신)가 있고 확신이 0~4, 받는 이(→이름)나 모두(●)에게 썼다.
 * senders는 말한 이의 이름들(참가자 이름과 가명). 자기에게 쓴 받는 이는 세지 않는다.
 */
export function isLowRequest(c: Clause, senders: (string | null | undefined)[] = []): boolean {
  if (c.marks?.act !== 'req') return false; // v0.7: 내부 값은 영어(라 = req)
  const self = c.chae?.self;
  if (self == null || c.chae?.color === undefined) return false;
  if (Math.round(self * 10) > MUK.lowSelf) return false;
  if (c.all) return true;
  if (!c.to) return false;
  const to = c.to.toLowerCase();
  return !senders.some((s) => s && s.toLowerCase() === to);
}

/** 확신별 정답률 표: [{ conf, n, right, rate, stated }] (stated = 확신이 말한 확률) */
export function calibrationTable(summaries: QuizSummary[]) {
  return Array.from({ length: 10 }, (_, conf) => {
    const n = summaries.reduce((s, x) => s + (x.by?.[conf]?.[0] ?? 0), 0);
    const right = summaries.reduce((s, x) => s + (x.by?.[conf]?.[1] ?? 0), 0);
    return { conf, n, right, rate: n ? round(right / n, 3) : null, stated: probOf(conf) };
  });
}

/** 확신 칸 다섯: 0~2 · 3~4 · 5~6 · 7~8 · 9 (칸마다 셈이 너무 적지 않게) */
export const confBucket = (conf: number) => [0, 0, 0, 1, 1, 2, 2, 3, 3, 4][conf];

/**
 * 색이 확신 밖의 것을 알려 주는가(설계 7절 반증 3). 앞 회차들(train)로 '확신 칸마다의 정답률'과 '확신 칸 × 색마다의 정답률'을 셈하고,
 * 뒤 회차들(test)에서 두 예측의 브라이어 점수를 견준다. 때로 나눈 검증이라 같은 데이터에 맞춘 값이 아니다.
 * 셈은 라플라스(+1/+2)로 하고, 색 칸은 확신 칸 쪽으로 무게 k만큼 줄인다(답이 적은 색이 우연으로 튀지 않게).
 * gain = brier_conf − brier_color. 0보다 뚜렷이 크면 색을 더한 예측이 낫다. stated는 확신을 말한 그대로 확률로 읽은 브라이어다.
 */
export function colorGain(train: AnswerRow[], test: AnswerRow[], k = 10) {
  const usable = (r: AnswerRow) => isConf(r.conf == null ? null : Number(r.conf)) && Boolean(r.color);
  const tr = train.filter(usable);
  const te = test.filter(usable);
  const nb = [0, 0, 0, 0, 0];
  const rb = [0, 0, 0, 0, 0];
  const nc = new Map<string, number>();
  const rc = new Map<string, number>();
  for (const r of tr) {
    const b = confBucket(Number(r.conf));
    const ok = Number(r.ok) ? 1 : 0;
    nb[b]++;
    rb[b] += ok;
    const key = `${b}${r.color}`;
    nc.set(key, (nc.get(key) ?? 0) + 1);
    rc.set(key, (rc.get(key) ?? 0) + ok);
  }
  const pb = nb.map((n, b) => (rb[b] + 1) / (n + 2));
  const pbc = (b: number, color: string) => {
    const key = `${b}${color}`;
    return ((rc.get(key) ?? 0) + k * pb[b]) / ((nc.get(key) ?? 0) + k);
  };
  let sConf = 0;
  let sColor = 0;
  let sStated = 0;
  const byColor: Record<string, { n: number; conf: number; color: number }> = {};
  for (const r of te) {
    const conf = Number(r.conf);
    const b = confBucket(conf);
    const y = Number(r.ok) ? 1 : 0;
    const e1 = (pb[b] - y) ** 2;
    const e2 = (pbc(b, String(r.color)) - y) ** 2;
    sConf += e1;
    sColor += e2;
    sStated += (probOf(conf) - y) ** 2;
    const c = (byColor[String(r.color)] ??= { n: 0, conf: 0, color: 0 });
    c.n++;
    c.conf += e1;
    c.color += e2;
  }
  const n = te.length;
  for (const c of Object.values(byColor)) {
    c.conf = round(c.conf / c.n, 4);
    c.color = round(c.color / c.n, 4);
  }
  return {
    n_train: tr.length,
    n_test: n,
    brier_stated: n ? round(sStated / n, 4) : null,
    brier_conf: n ? round(sConf / n, 4) : null,
    brier_color: n ? round(sColor / n, 4) : null,
    gain: n ? round((sConf - sColor) / n, 4) : null,
    by_color: byColor,
  };
}

// ───────── 읽는 쪽 규칙: 반증 몫(식 D·E) ─────────
//
// 먹 셈이 아니라 읽는 쪽이 받은 절에 답할 때 반증·위험에 둘 절의 몫이다(reports/counter-share-design.md 7·8절, 사전 【먹·채·근거】).
// 코드는 셈하지 않고 글로만 가르치던 것을 2026-10-29(v6)에 함수로 두어 화면의 표(site/src/page/muk.js)와 시험이 같은 식을 쓰게 했다.

export type ShareFormula = 'D' | 'E';

/** 적힌 확신을 얼마나 그대로 읽을지(w). muk가 null이면 먹이 보이지 않는 것(보조값). 식 D: (먹 − 2)/7. 식 E: 2 이하 0, 5 = 0.2, 9 = 1 */
export function readWeight(muk: number | null, formula: ShareFormula = 'E'): number {
  const { hint, neutralD, slopeD, lowE } = MUK.share;
  if (muk == null) return hint;
  if (formula === 'D') return Math.max(0, Math.min(1, (muk - neutralD) / slopeD));
  if (muk <= lowE) return 0;
  if (muk < MUK.mid) return (hint * (muk - lowE)) / (MUK.mid - lowE);
  return Math.min(1, hint + ((1 - hint) * (muk - MUK.mid)) / (9 - MUK.mid));
}

/**
 * 반증 몫: 말한 이의 먹(null = 보이지 않음), 그가 적은 확신 N(0~9), 말한 이를 가리고 매긴 근거 확신 Ne(0~9).
 * 실효 p = 0.5 + w·(p − 0.5), T = 로지스틱(logit 실효 p + logit e), 몫 = max(floor, 1 − T).
 */
export function counterShare(muk: number | null, conf: number, groundConf: number, formula: ShareFormula = 'E'): number {
  const logit = (x: number) => Math.log(x / (1 - x));
  const p = probOf(conf);
  const e = probOf(groundConf);
  const pe = 0.5 + readWeight(muk, formula) * (p - 0.5);
  const T = 1 / (1 + Math.exp(-(logit(pe) + logit(e))));
  return Math.max(MUK.share.floor, 1 - T);
}
