# 어휘 점검 도구

한자 어근이 한국어와 중국어에서 같은 뜻으로 읽히는지 사전으로 미리 걸러 본다. 거짓 친구(같은 글자, 다른 뜻) 후보와, 한쪽 사전에만 있는 낱말을 찾는다. 판정은 후보일 뿐이고, 모델이 실제로 어떻게 읽는지는 V14가 잰다(`spec/11-validation.md`).

## 자료 받기

사전 자료는 라이선스와 용량 때문에 저장소에 넣지 않는다. 한 폴더(아래에서 `<자료 폴더>`)에 받는다.

```sh
git clone --depth 1 https://github.com/unicode-org/unihan-database   # Unicode License v3
git clone --depth 1 https://github.com/garfieldnate/kengdic          # MPL 2.0 / LGPL 2.0+
git clone --depth 1 https://github.com/cschiller/zhongwen            # data/cedict_ts.u8 = CC-CEDICT, CC BY-SA 4.0
```

| 자료 | 쓰는 것 | 라이선스 |
| --- | --- | --- |
| Unihan (`kDefinition`, 이체자) | 낱자 뜻, 이체자 대응표 | Unicode License v3 |
| Kengdic (`kengdic.tsv`) | 한국어 한자어와 영어 뜻 | MPL 2.0 또는 LGPL 2.0+ |
| CC-CEDICT (`cedict_ts.u8`) | 중국어 낱말과 영어 뜻 | CC BY-SA 4.0 |

일본어 낱말 사전(JMdict)은 git 저장소로 받을 수 있는 판을 아직 찾지 못해 빠져 있다.

## 쓰는 법

```sh
node tools/lexicon/check-roots.ts <자료 폴더> 整列 新法 汽車
node tools/lexicon/check-roots.ts <자료 폴더> --from 메시지.txt
```

## 판정 방식

- 두 글자 이상: 한국어 사전과 중국어 사전의 영어 뜻을 낱말 집합으로 바꿔 겹침(자카드 계수)을 낸다. 겹침이 없으면 거짓 친구 후보다.
- 한 글자: 낱말 사전 대신 Unihan 낱자 뜻과 중국어 낱자 뜻을 비교한다.
- 양쪽 사전에 다 없으면 새로 만든 합성어다. 받는 쪽은 글자 뜻을 조합해 읽으므로, 조율 용어로 뜻을 정해 두는 것이 좋다.

## 이 방식의 한계 (2026-10-13 점검)

알려진 거짓 친구 다섯 개 가운데 넷(`汽車` `工夫` `新聞` `結束`)을 후보로 잡았다. `愛人`은 놓쳤다. CC-CEDICT가 '배우자(중국 대륙)'와 '연인(대륙 밖)'을 함께 실어 겹침이 생기기 때문이다.

반대로 뜻이 같은데 영어 풀이 낱말이 달라 후보로 잡힌 것도 넷 있었다(`確實` `確信` `正確` `共用`). 동의어를 묶지 않는 단순한 비교라서 생기는 오탐이다. 그래서 이 도구는 사람이나 모델이 다시 볼 목록을 줄이는 데만 쓴다. 결과 기록은 `reports/2026-10-13-lexicon-check.md`에 있다.
