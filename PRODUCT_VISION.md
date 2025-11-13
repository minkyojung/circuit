# Octave Product Vision

## Mission
**"Octave: The MCP Package Manager - Discover, Install, Monitor, and Test MCP Servers"**

Claude Desktop처럼 MCP를 설정 파일로 관리하는 것이 아니라, **Octave이 MCP 런타임이 되어 중앙에서 모든 MCP 서버를 실행하고 관리**합니다.

### Core Identity
- **MCP Package Manager**: npm처럼 MCP 서버를 검색, 설치, 업데이트
- **Discover Platform**: 마켓플레이스에서 MCP 찾고 추천받기
- **Playground**: 설치 전 MCP 도구 테스트해보기
- **Health Monitor**: 실시간 상태 확인, 로그, 성능 모니터링

GitKraken이 Git을 시각화한 것처럼, Octave은 MCP 생태계를 시각화하고 관리 가능하게 만듭니다.

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
   - Octave 없이는 개발 속도가 30배 느림

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

### 🎯 Problem 1: "MCP 서버 설치와 관리가 너무 어려움"
**Octave Solution: One-Click Install & Centralized Management**

```
📦 Discover Tab
┌────────────────────────────────┐
│ Search: "github"               │
├────────────────────────────────┤
│ 🔍 GitHub MCP Server           │
│    ⭐ Official • 2.4k stars    │
│    Access repos, issues, PRs   │
│                                │
│    [Add to Claude] [Playground]│
└────────────────────────────────┘
```

**How It Works:**
1. Click "Add to Claude"
2. Octave installs & starts MCP server
3. Claude Code automatically uses it via circuit-proxy
4. No config file editing needed!

**Features:**
- 원클릭 설치 (설정 파일 수동 편집 불필요)
- Octave이 모든 MCP 서버 프로세스 실행
- Claude Code, Cursor, Windsurf 모두 Octave의 MCP 사용
- 통합 관리 (한 곳에서 모든 AI 도구의 MCP 관리)

---

### 🎯 Problem 2: "MCP 서버가 제대로 작동하는지 확인할 방법 없음"
**Octave Solution: Real-time Health Monitoring**

```
📊 Installed Tab
┌────────────────────────────────┐
│ ✅ GitHub Server               │
│    Running • 3 tools available │
│    Uptime: 2h 15m              │
│    Calls: 142 • Errors: 0      │
│    [Stop] [Restart] [Logs]     │
├────────────────────────────────┤
│ ⚠️ Notion Server              │
│    Error: Connection timeout   │
│    Last seen: 5 mins ago       │
│    [View Logs] [Restart]       │
└────────────────────────────────┘
```

**Features:**
- Octave이 직접 MCP 실행 → 완전한 가시성
- 실시간 헬스체크 (30초마다)
- 성능 메트릭 (API 호출 수, 응답 시간, 에러율)
- 로그 수집 & 검색
- 에러 발생 시 자동 재시작

**Impact:** 블랙박스 → 완전 투명화

---

### 🎯 Problem 3: "서버가 뭘 할 수 있는지 발견이 어려움"
**Octave Solution: Server Explorer (Playground Mode)** ⭐ **우선순위 1**

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

### Phase 1: MCP Runtime Core (Week 1-2) ⭐ **현재 진행**
- [ ] MCP Server Manager
  - install/start/stop/restart
  - Process management (spawn, health check)
  - StdioClientTransport 연동
- [ ] IPC API (Main ↔ Renderer)
- [ ] DiscoverTab: One-click install
- [ ] InstalledTab: Real-time status monitoring

### Phase 2: Monitoring & Observability (Week 3)
- [ ] Health check system (30s interval)
- [ ] Log collection & rotation
- [ ] Performance metrics
  - Call count, response time, error rate
- [ ] Auto-restart on failure
- [ ] InstalledTab: Logs viewer

### Phase 3: Claude Code Integration (Week 4)
- [ ] HTTP API Server (localhost:3737)
- [ ] circuit-proxy implementation
  - MCP server that proxies to Octave
- [ ] Installation automation
  - `claude mcp add circuit -s stdio ~/.circuit/bin/circuit-proxy`

### Phase 4: Playground & Testing (Week 5)
- [ ] PlaygroundTab
  - 자동 기능 탐색 (listTools/Prompts/Resources)
  - Try it 버튼으로 즉시 테스트
  - 예제 자동 생성
- [ ] Custom Server testing
- [ ] Request Builder

### Phase 5: Performance & Polish (Week 6+)
- [ ] Lazy loading (첫 호출 시 서버 시작)
- [ ] Tool caching (1분 TTL)
- [ ] Idle timeout (5분 미사용 시 종료)
- [ ] Parallel server start
- [ ] UI polish & animations

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
- Octave은 JSON-RPC + MCP 프로토콜 특화
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

## Architecture Reference

자세한 아키텍처는 `MCP_RUNTIME_ARCHITECTURE.md` 참고

### Key Differences: Octave vs Claude Desktop

| 항목 | Claude Desktop | Octave |
|------|---------------|---------|
| **MCP 실행** | Claude Desktop이 실행 | Octave이 실행 |
| **설정 방법** | JSON 파일 수동 편집 | UI에서 원클릭 |
| **모니터링** | ❌ 로그 파일만 | ✅ 실시간 대시보드 |
| **다중 도구** | 각 도구마다 별도 설정 | Octave proxy 하나만 |
| **상태 확인** | ❌ 불가능 | ✅ 헬스체크 |
| **에러 처리** | ❌ 수동 | ✅ 자동 재시작 |

---

## Next Steps

**Immediate (이번 세션):**
1. MCP Server Manager 구현 시작
   - `circuit/electron/mcp-manager.ts` 생성
   - install/start/stop 기본 로직
   - StdioClientTransport 연동

**This Week:**
2. IPC API 구현
3. DiscoverTab "Add to Claude" 버튼 구현
4. InstalledTab 실시간 상태 모니터링

**Next Week:**
5. Health check & logging
6. HTTP API Server
7. circuit-proxy
