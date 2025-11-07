Welcome to albatross

Test line

Hello Albatross

Hello Albatros and welcome

last dance

real last dance

test 7

test8
# Circuit - Test-Fix Loop 문서

> MCP 기반 자동 테스트-수정 루프 시스템

---

## 📚 문서 구조

### **최신 문서 (Implementation Ready)**

1. **[FINAL_ARCHITECTURE.md](./FINAL_ARCHITECTURE.md)** ⭐ **START HERE**
   - 최종 확정 아키텍처
   - 단순화된 접근 (하이브리드 제거)
   - 구현 계획 (4주)
   - **이 문서부터 읽으세요**

2. **[IDEAS.md](./IDEAS.md)**
   - 8개 JTBD 아이디어
   - 로드맵 & 가격 전략
   - Test-Fix Loop이 P0

---

### **참고 문서 (Archive)**

3. **[HYBRID_ANALYSIS.md](./HYBRID_ANALYSIS.md)**
   - 하이브리드 방식 분석
   - 엣지케이스 검토
   - Conductor.build 방식 조사
   - **결론: 단순한 방식 채택**

4. **[ARCHITECTURE_ANALYSIS.md](./ARCHITECTURE_ANALYSIS.md)**
   - 5가지 질문에 대한 상세 분석
   - 디렉토리, Auto-detect, API 키 등
   - **결론: FINAL_ARCHITECTURE로 통합**

5. **[TEST_FIX_LOOP_ARCHITECTURE.md](./TEST_FIX_LOOP_ARCHITECTURE.md)**
   - 초기 하이브리드 설계안
   - Conductor 패턴 분석
   - **결론: 단순화 필요 → FINAL_ARCHITECTURE**

---

## 🎯 Quick Start

### **핵심 결정사항**

| 항목 | 결정 |
|------|------|
| **디렉토리** | Local만 (`.circuit/`) |
| **API 키** | OS Keychain + 우선순위 찾기 |
| **Auto-detect** | 확신도 기반 (90%+ 자동) |
| **UI** | Desktop App (Electron) |
| **워크플로우** | AI 제안 → 사용자 승인 → 적용 |

### **다음 단계**

```bash
# 1. FINAL_ARCHITECTURE.md 읽기
# 2. Phase 1 구현 시작
#    - Day 1-2: Project Setup
#    - Day 3-4: Detection & Init
#    - Day 5-7: File Watch & Test Run
```

---

## 📁 프로젝트 구조

```
octave/
├── src/
│   ├── core/
│   │   ├── detector.ts          # Project auto-detect
│   │   ├── watcher.ts           # File watcher
│   │   └── runner.ts            # Test runner
│   ├── ai/
│   │   ├── provider.ts          # API key management
│   │   └── suggester.ts         # Fix suggestion
│   ├── ui/
│   │   ├── TestFixTab.tsx       # New tab
│   │   ├── SuggestionCard.tsx   # Suggestion UI
│   │   └── HistoryPanel.tsx     # History view
│   └── storage/
│       └── history.ts           # JSON storage
│
└── templates/
    ├── react.md
    ├── nextjs.md
    └── node-api.md
```

---

## 🚀 Implementation Timeline

| Week | Focus | Deliverable |
|------|-------|-------------|
| **1** | Core Infrastructure | File watch, Test run, Error parse |
| **2** | AI Integration | API provider, Suggestion gen |
| **3** | Desktop UI | Test-Fix tab, Suggestion cards |
| **4** | Polish | Notifications, Learning, Docs |

---

## 📊 Success Criteria

- ✅ Setup < 2분
- ✅ First fix < 5분
- ✅ Approval rate > 70%
- ✅ Time saved > 80%

---

_Project Status: Architecture Finalized, Ready for Week 1 Implementation_
_Last Updated: 2025-10-21_