# Circuit Product Vision

## Mission
**"MCP를 처음 접하는 바이브 코더부터 서버를 직접 만드는 개발자까지, 모두가 MCP를 쉽게 이해하고 활용할 수 있게 만든다"**

GitKraken이 Git을 시각화해서 누구나 쓸 수 있게 만든 것처럼, Circuit은 MCP를 시각화해서 진입장벽을 낮춘다.

---

## Target Users: "MCP 바이브 코더"

### 1. 초보 MCP 탐험가 (30%)
**Profile:**
- AI 코딩 도구(Claude, Cursor) 3-6개월 사용
- "MCP 서버가 뭔지는 알겠는데, 어떻게 쓰는지 모르겠어"
- GitHub에서 찾아서 설치는 해봤는데 제대로 작동하는지 확인 못함

**Pain Points:**
1. **"설치는 했는데, 이게 진짜 돌아가는 거야?"**
   - Claude Desktop 재시작했는데 아무 변화 없음
   - 에러가 났는지도 모름
   - 로그 파일 어디 있는지도 모름

2. **"이 서버가 뭘 할 수 있는지 모르겠어"**
   - README만 보고 설치
   - 실제로 어떤 도구/프롬프트를 제공하는지 모름
   - Claude에게 어떻게 물어봐야 하는지 모름

3. **"왜 안 되는지 모르겠어"**
   - API 토큰 잘못 넣었는지 확인 불가
   - 서버가 죽었는지 살았는지도 모름

---

### 2. MCP 서버 DIY러 (50%) ⭐ **핵심 타겟**
**Profile:**
- AI 코딩으로 간단한 MCP 서버 만들어봄
- "내 Notion 연동 서버 만들고 싶은데..."
- 코딩은 Claude가 해주는데, 테스트가 너무 귀찮음

**Pain Points:**
1. **"테스트 사이클이 너무 느려!"**
   ```
   서버 코드 수정 → Claude Desktop 재시작 → 테스트 → 실패 → 다시 수정
   ⏱️ 한 번에 5분 소요 → 10번 반복 = 50분
   ```
   - Circuit 없이는 개발 속도가 30배 느림

2. **"내가 만든 서버가 제대로 작동하는지 확인이 어려워"**
   - `tools/list` 응답이 제대로 오는지 확인 불가
   - 파라미터 바꿔가면서 테스트하고 싶은데 방법 모름
   - 에러 났을 때 뭐가 문제인지 찾기 어려움

3. **"다른 사람 서버 코드 보고 배우고 싶은데 이해가 안 돼"**
   - JSON-RPC 뭔지 모름
   - Request/Response 구조 헷갈림
   - 예제 코드만 복붙할 뿐 원리 이해 못함

---

### 3. MCP 파워유저 (20%)
**Profile:**
- 10개 이상 MCP 서버 설치
- 서버 여러 개 직접 만들어봄
- MCP 생태계를 적극적으로 활용

**Pain Points:**
1. **"서버 관리가 너무 산만해"**
   - Claude Desktop, Cursor, Windsurf 다 다른 config
   - 어떤 서버가 어디 설치됐는지 헷갈림
   - 토큰/API 키 관리 귀찮음

2. **"서버 성능 최적화하고 싶은데 방법 모름"**
   - 어떤 서버가 느린지 모름
   - 응답 시간 측정 불가
   - 병렬 요청 테스트 못함

3. **"공유하고 싶은데 진입장벽 높아"**
   - 내가 만든 서버 남한테 공유하려면 README 길게 써야 함
   - 상대방이 설치하고 테스트하기 어려움

---

## User Journey & Pain Points

```
[발견] → [설치] → [확인] → [사용] → [커스터마이징] → [공유]
  ↓       ↓        ↓        ↓          ↓              ↓
 문제없음  쉬움   어려움!  헷갈림    너무힘듦!      불가능
```

**가장 큰 Pain Point:**
1. **확인 (Validation)**: "이게 제대로 설치됐나?" - 해결책 없음
2. **커스터마이징 (Customization)**: "내 서버 만들고 싶은데 테스트가..." - 너무 느림
3. **사용 (Usage)**: "이 서버가 뭘 할 수 있는지 모르겠어" - 발견 불가

---

## Core Solutions

### 🎯 Problem 1: "MCP 서버 Health Check의 부재"
**Circuit Solution: Server Health Dashboard**

```
📊 서버 상태 한눈에 보기
┌────────────────────────────────┐
│ ✅ GitHub Server               │
│    3 tools available           │
│    Last check: 2 mins ago      │
│    [Test Connection]           │
├────────────────────────────────┤
│ ⚠️ Notion Server              │
│    Error: Invalid API token    │
│    [Fix Configuration]         │
└────────────────────────────────┘
```

**Features:**
- 설치된 모든 서버 자동 검사
- 상태: ✅ 정상 / ⚠️ 경고 / ❌ 에러
- 에러 발생 시 해결 방법 제안
- 원클릭 테스트 버튼

---

### 🎯 Problem 2: "서버 개발 테스트 사이클이 너무 느림"
**Circuit Solution: Hot Reload Developer Mode**

```
🔄 파일 변경 감지 → 1초 만에 재시작
┌────────────────────────────────┐
│ 📁 Watching: my-notion-server  │
│ 🔄 Auto-restart on save: ON   │
│                                │
│ [파일 수정 감지]                │
│ → 자동 재시작 (1초)            │
│ → 자동 테스트 (tools/list)     │
│ → 결과 즉시 표시               │
│ → Diff 표시 (변경 전/후)       │
└────────────────────────────────┘
```

**Features:**
- 파일 변경 감지 → 자동 재시작
- 재시작 후 자동으로 기본 요청 전송
- 변경 전/후 Response Diff 표시
- 에러 발생 시 코드 라인 번호까지 표시

**Impact:** 5분 → 1초 = **300배 빠른 개발**

---

### 🎯 Problem 3: "서버가 뭘 할 수 있는지 발견이 어려움"
**Circuit Solution: Server Explorer (Playground Mode)** ⭐ **우선순위 1**

```
🔍 자동 탐색 + 즉시 테스트
┌────────────────────────────────┐
│ GitHub Server                  │
│                                │
│ 🛠️ Tools (3):                 │
│   • search_repositories        │
│     "Search GitHub repos"      │
│     💡 Example: user:me stars:>100
│     [▶ Try it]                 │
│                                │
│   • create_issue               │
│     "Create a new issue"       │
│     💡 Example: repo, title, body
│     [▶ Try it]                 │
│                                │
│ 💬 Prompts (5):                │
│   • code_review                │
│     [Generate example]         │
│                                │
│ 📄 Resources (2):              │
│   • repository://user/repo     │
│     [Browse]                   │
└────────────────────────────────┘
```

**Features:**
- 서버 시작하면 자동으로 `tools/list`, `prompts/list`, `resources/list` 전송
- 각 도구의 스키마 파싱해서 예제 자동 생성
- "Try it" 버튼으로 즉시 테스트 (파라미터 미리 채워짐)
- Claude에게 복사 가능한 프롬프트 자동 생성
- 5분 안에 서버 기능 완전 이해 가능

---

## Killer Features (GitKraken-inspired)

### 1. One-Click Server Checkup 💊
```
"내 서버들 상태 한눈에 보기"
→ 전체 서버 자동 검사 → 문제 발견 → 해결책 제시
```
**GitKraken 비유:** Remote 상태 한눈에 보기

---

### 2. Live Preview (Hot Reload) 🔥
```
"서버 코드 수정 → 저장 → 1초 만에 결과 확인"
→ Claude Desktop 재시작 필요 없음
```
**GitKraken 비유:** 실시간 diff 프리뷰

---

### 3. Playground Mode 🎮 ⭐ **Phase 1**
```
"이 서버 뭐 하는지 5분 안에 이해하기"
→ 모든 기능 탐색 → 예제 자동 생성 → 바로 테스트
```
**GitKraken 비유:** 브랜치 그래프 + Interactive rebase

---

### 4. Visual Request Flow 🌊
```
"Request-Response 흐름 그래프로 보기"
→ GitKraken의 브랜치 그래프처럼
```
**GitKraken 비유:** Commit graph

---

### 5. Error Explainer 🩺
```
"에러 났을 때 바로 원인 알려주기"
→ JSON-RPC 에러 코드 → 한글 설명 + 해결 방법
```
**GitKraken 비유:** Merge conflict 해결 가이드

---

## Roadmap

### Phase 1: 발견과 탐색 (현재 진행 중)
- [x] Marketplace - MCP 서버 발견
- [x] Installed - 설치된 서버 관리
- [x] Developer - 기본 디버깅 도구
- [x] Request Builder - 커스텀 요청 전송
- [x] Custom Server - 내 서버 테스트
- [ ] **Server Explorer (Playground Mode)** ⭐ **다음 목표**
  - 자동 기능 탐색
  - 예제 자동 생성
  - 즉시 테스트

### Phase 2: 시각화와 인사이트
- [ ] Visual Request Flow - 흐름 그래프
- [ ] Performance Timeline - 응답 시간 측정
- [ ] Server Health Dashboard - 상태 모니터링
- [ ] Error Explainer - 에러 해설

### Phase 3: 개발 가속화
- [ ] Hot Reload - 파일 변경 감지
- [ ] Response Diff Viewer - 변경사항 비교
- [ ] Smart Scenarios - 자주 쓰는 요청 저장
- [ ] Batch Testing - 여러 요청 자동 실행

---

## Success Metrics

### 초보자 성공 지표:
- "설치한 서버가 뭘 하는지 5분 안에 이해" → Server Explorer
- "에러 났을 때 10분 안에 해결" → Error Explainer

### DIY러 성공 지표:
- "테스트 사이클 5분 → 10초" → Custom Server + Request Builder
- "하루에 서버 3개 만들기" → Hot Reload

### 파워유저 성공 지표:
- "10개 서버 상태 한눈에 관리" → Health Dashboard
- "성능 병목 즉시 발견" → Performance Timeline

---

## Competitive Advantage

**vs Postman:**
- Postman은 REST API용
- Circuit은 JSON-RPC + MCP 프로토콜 특화
- Request-Response 매칭 자동

**vs MCP Inspector (있다면):**
- 단순 로그 뷰어가 아닌 **능동적 탐색 도구**
- 예제 자동 생성
- 한글 설명

**vs Claude Desktop 로그:**
- 읽기 어려운 로그 vs 시각적 UI
- 사후 분석 vs 실시간 테스트
- 수동 확인 vs 자동 Health Check

---

## Why Now?

1. **MCP 생태계 폭발적 성장**
   - Anthropic의 공식 지원
   - GitHub에 MCP 서버 수백 개 등장
   - 하지만 진입장벽은 여전히 높음

2. **바이브 코딩의 대중화**
   - 비개발자도 AI로 서버 만드는 시대
   - 하지만 디버깅 도구는 여전히 개발자용

3. **GitKraken의 성공 사례**
   - Git 시각화로 대중화 성공
   - MCP도 같은 접근 필요

---

## Next Steps

**Immediate (이번 세션):**
1. Server Explorer (Playground Mode) 구현
   - 자동 기능 탐색 (tools/prompts/resources)
   - 예제 생성 로직
   - Try it 버튼 구현

**Short-term (다음 세션):**
2. Visual Request Flow
3. Error Explainer

**Mid-term:**
4. Hot Reload
5. Health Dashboard
