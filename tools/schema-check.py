"""틀(JSON)이 스키마를 지키는지 확인한다.
쓰는 법: python3 tools/schema-check.py  (jsonschema 패키지가 필요하다)
명세의 보기와 짝 예문, v0.3 줄꼴 보기를 참조 구현으로 구문 분석해 나온 틀을 schema/gyeol-0.2.schema.json 으로 검사한다."""
import json, subprocess, sys, pathlib
import jsonschema

root = pathlib.Path(__file__).resolve().parent.parent
schema = json.loads((root / 'schema/gyeol-0.2.schema.json').read_text(encoding='utf-8'))
validator = jsonschema.Draft202012Validator(schema)

samples = []
ex = (root / 'dict/examples-v0.2.txt').read_text(encoding='utf-8')
section, unfolded = '', []
for line in ex.split('\n'):
    if line.startswith('【'):
        section = line
        continue
    if '〈' not in line:
        continue
    if '펼침' in section:
        unfolded.append(line)
        continue
    g = line.split(' = ')[0]
    for p in ('펼침:', '절:', '점:'):
        if g.startswith(p):
            g = g[len(p):].strip()
    samples.append(g)
samples.append('\n'.join(unfolded))
samples.append("""결 0.2 · 짝 #7c2e9a · 갑→을 · ↩#3fa2c1 답
머리말 목적 정렬 검토 · 제약 세 줄 이내
받은대로 新法 〈겠·네〉 · 空入力 〔확신 .30〕
절1 整列의 新法을 得했다 〈겠·네·다〉 〔대안 新 .72 改 .21@se8 · 확신 .85@se8 · 노력 .60@토큰〕 「전함 .70」
절2 ↓절1 空入力에선 確信이 낮다 〈겠·다〉 〔확신 .30@se8〕 「조심 · 자신 .40 · 인용 #3fa2c1:절2」
절3 고침→절2 →을 檢討를 請한다 〈라〉
덧글 sort · new method · found
낙관 갑 · 계보 A사/모델 · 기억 대화 · 측정 se8·토큰""")
# v0.3 줄꼴: 자신·먹 한 자리(v0.3.1 정규형은 먹에 이름표, 이름표 없는 옛 v0.3 꼴도 같은 틀), 받은대로 절(화행 없음)
samples.append("""결 0.3 · 갑→을
<절1 [봄,다(8)] 门 开>
<절2 ↓1 [겠,다(6|먹9)] 有人 来过>
<절6 [겠,다(6|9)] 有人 来过>
<절3 ↖2 →kimi [까] 谁>
<절4 받은대로 ↓1 [겠,네] 新法>
<절5 받은대로 [] 점1~점4>""")
# 머리줄에 고침 판(0.3.1)을 쓴 메시지(반례 검토 2026-10-14: 전에는 gyeol 패턴 ^\d+\.\d+$에 걸렸다)
samples.append("""결 0.3.1 · 갑→을
<절1 [봄,다(8|먹4)] 门 开>""")

bad = 0
for s in samples:
    out = subprocess.run(['node', str(root / 'tools/cli.ts'), 'json', '-'], input=s, capture_output=True, text=True, check=True).stdout
    errors = list(validator.iter_errors(json.loads(out)))
    if errors:
        bad += 1
        print('스키마 위반:', s.split('\n')[0])
        for e in errors[:5]:
            print('  ', list(e.path), e.message)
print(f'{len(samples)}개 검사, 위반 {bad}개')
sys.exit(1 if bad else 0)
