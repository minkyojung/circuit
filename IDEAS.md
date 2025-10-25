# Circuit JTBD Ideas

## 🎯 Core Vision
MCP를 "관리"하는 도구가 아닌, **개발 워크플로우의 병목을 제거**하는 도구

---

## 💡 8 JTBD Candidates

### **P0 - 즉시 착수**

#### 1. Test-Fix Loop Automation ⭐ **[IN PROGRESS]**
**Problem:** AI 생성 코드를 수동으로 테스트 → 에러 복붙 → 수정 요청 → 반복 (평균 15-35분)

**Solution:**
- 코드 변경 감지 → 자동 테스트 실행 → 에러 발생 시 AI에게 context와 함께 자동 피드백 → 성공할 때까지 루프
- 개발자는 결과만 확인

**Value:** 83% 시간 절약 (30분 → 5분)
**Frequency:** 매일 3-5회
**Pricing:** Freemium (월 100회) / Pro $29/mo (무제한)

---

#### 4. Unified Coding Context
**Problem:** Context switching으로 하루 평균 47회 인터럽션, 개발자당 연 $50K 손실

**Solution:**
- IDE 내에서 Stripe 문서 + 최근 로그 + 슬랙 쓰레드 자동 표시
- AI가 필요한 컨텍스트 자동 수집 & 요약
- 시간순 타임라인으로 시각화

**Value:** 인터럽션 80% 감소, $50K/dev/year 절약
**Frequency:** 매일 수십 회
**Pricing:** Pro $29/mo

---

### **P1 - 팀/Enterprise 가치**

#### 3. Deployment Intelligence
**Problem:** 배포 시 불안, 문제 발생 시 수동 롤백, 사고 발생 후 대응

**Solution:**
- 자동 health check, smoke test, 성능 비교
- 이상 감지 시 자동 롤백
- "배포해도 되나?" 불안 제거

**Value:** 프로덕션 사고 방지 (priceless)
**Frequency:** 주 5-10회
**Pricing:** Enterprise $299/mo

---

#### 5. AI Code Review Accelerator
**Problem:** PR 리뷰 대기 평균 5일, 리뷰어 과부하

**Solution:**
- 3분 내 자동 리뷰 (Security, Performance, Style, Tests)
- 명백한 이슈는 자동 수정
- 리뷰어에게 "수동 리뷰 필요한 부분만" 요약 전달

**Value:** 리뷰 시간 5일 → 1일 (80% 단축)
**Frequency:** 매일 1-3회
**Pricing:** Team $99/mo

---

#### 6. Production Debug Assistant
**Problem:** 프로덕션 버그 디버깅 평균 2시간, 환경 재현 어려움

**Solution:**
- Sentry/DataDog 에러 → 10초 내 로컬 환경 재현 (DB snapshot, request payload)
- 근본 원인 자동 분석 (어떤 PR에서 발생했는지, 영향 범위)
- Hotfix 자동 생성 & 배포

**Value:** MTTR 90% 단축 (2시간 → 10분)
**Frequency:** 주 3-5회
**Pricing:** Enterprise $299/mo

---

#### 8. Cross-Repo Intelligence
**Problem:** 마이크로서비스에서 breaking change로 인한 장애

**Solution:**
- API 변경 시 영향받는 모든 repo 자동 감지
- 각 서비스별 수정 PR 자동 생성
- 안전한 배포 순서 제안

**Value:** 서비스 간 장애 90% 예방
**Frequency:** 주 5-10회
**Pricing:** Enterprise $299/mo

---

### **P2 - 추가 기능**

#### 2. Multi-Service Orchestration
**Problem:** 여러 서비스 통합 시 각각 문서 읽고 설정하는데 2시간 소요

**Solution:**
- Postgres, Redis, S3, Stripe 등 MCP 기반 자동 연결
- Schema/API 자동 탐색, test 데이터로 사전 검증
- 성능 메트릭 실시간 제공

**Value:** 러닝커브 제거, 2시간 → 10분
**Frequency:** 주 2-3회
**Pricing:** Pro $29/mo

---

#### 7. AI Code Trust Layer
**Problem:** AI 생성 코드 46% 불신, "거의 맞지만 완벽하지 않음"

**Solution:**
- AI 코드 자동 검증 (Security, Correctness, Performance, Tests)
- 신뢰도 점수 (0-100) + 상세 분석
- 자동 수정 제안

**Value:** AI 도구 ROI 200% 향상
**Frequency:** 매일 10-20회
**Pricing:** Pro $29/mo

---

## 🚀 Recommended Roadmap

### **Phase 1: Hook 개인 개발자 (2개월)**
- Test-Fix Loop (Freemium)
- Unified Context (Pro $29/mo)

**Goal:** 일일 사용자 확보, Product-Market Fit 검증

---

### **Phase 2: 팀 가치 제공 (1개월)**
- AI Code Review Accelerator (Team $99/mo)

**Goal:** B2C → B2B 전환, 팀 단위 확장

---

### **Phase 3: Enterprise 진입 (2개월)**
- Production Debug Assistant
- Deployment Intelligence
- Cross-Repo Intelligence

**Goal:** High-ACV Enterprise 고객 확보 ($299+/mo)

---

## 💰 Pricing Strategy

```
Free:
  - Test-Fix Loop (월 100회)
  - 1 user

Pro ($29/mo):
  - Test-Fix Loop (무제한)
  - Unified Context
  - AI Trust Layer
  - Multi-Service (5개)
  - 5 users

Team ($99/mo):
  - All Pro features
  - AI Code Review
  - 20 users
  - Slack integration

Enterprise ($299/mo):
  - All Team features
  - Production Debug
  - Deployment Intelligence
  - Cross-Repo Intelligence
  - Unlimited users
  - SSO/SAML
  - Dedicated support
```

---

## 📊 Key Metrics to Track

- **개인:** Daily Active Users, Time Saved per Feature
- **팀:** PR Review Time, Code Quality Score
- **Enterprise:** MTTR, Deployment Success Rate, Prevention of Production Incidents

---

_Last Updated: 2025-10-21_
