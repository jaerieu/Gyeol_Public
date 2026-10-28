// 보관된 결 줄의 판정 스냅숏을 만든다: node tools/corpus-snapshot.ts
// 검사기를 고친 뒤 판정(통과·오류·경고·정규형)이 바뀌었는지 tests/corpus.test.ts가 이 스냅숏과 견준다.
// 바뀐 것이 의도한 것이면 이 도구로 다시 만들고, 바뀐 줄과 까닭을 명세 12.5절에 적는다.

import { writeFileSync } from 'node:fs';
import { verdicts } from '../tests/fixtures/corpus.ts';

const out = new URL('../tests/fixtures/corpus-verdicts.json', import.meta.url);
writeFileSync(out, JSON.stringify(verdicts(), null, 1) + '\n');
console.log(`${verdicts().length}줄의 판정을 적었다: tests/fixtures/corpus-verdicts.json`);
