# "하이브리드" 접근 방식 분석

> 각 하이브리드 방식의 실제 의미, 엣지케이스, Conductor 실제 방식 분석

---

## 1. 디렉토리 위치 하이브리드

### **제안한 방식**
```
~/.circuit/          # Global 기본 설정
/project/.circuit/   # Local override (팀 공유)
```

---

### **Conductor.build 실제 방식 조사 결과**

```
/project/.conductor/     # 프로젝트 로컬만 사용
├── workspace1/
├── workspace2/
└── config/
```

**핵심 발견:**
- **Global 설정 없음**
- 프로젝트별로만 `.conductor/` 사용
- 환경변수: `$CONDUCTOR_WORKSPACE_PATH`로 경로 지정

---

### **Claude Code 방식 (참고)**

```
~/.claude/settings.json              # Global (모든 프로젝트)
/project/.claude/settings.json        # Local (팀 공유, git 포함)
/project/.claude/settings.local.json  # Local (개인, gitignore)
```

**특징:**
- Global + Local 혼합
- `settings.local.json`은 git ignore (API 키 등)
- Local이 Global override

---

### **엣지케이스 분석**

#### **Case 1: Monorepo**
```
/monorepo/
├── .circuit/               # Monorepo 전체 설정
├── packages/
│   ├── frontend/
│   │   └── .circuit/       # Frontend 설정
│   └── backend/
│       └── .circuit/       # Backend 설정
```

**문제:**
- 3개 설정 파일 충돌 가능
- 우선순위 복잡: Global < Monorepo < Package?

---

#### **Case 2: Git Submodule**
```
/main-project/
├── .circuit/
└── lib/
    └── shared-module/      # Git submodule
        └── .circuit/       # 독립 프로젝트 설정
```

**문제:**
- Submodule의 `.circuit/`이 우선? Main의 `.circuit/`이 우선?

---

#### **Case 3: 새 프로젝트**
```
$ cd ~/new-project
$ circuit init

→ ~/.circuit/ 있으면?
  - Global 설정 복사?
  - 또는 새로 생성?
  - 사용자에게 물어봐야 함 (UX 복잡)
```

---

### **3가지 선택지 비교**

| 방식 | 장점 | 단점 | 엣지케이스 |
|------|------|------|-----------|
| **A. Local만** (Conductor 방식) | - 간단 명확<br>- Git으로 팀 공유<br>- 충돌 없음 | - 새 프로젝트마다 설정 반복<br>- API 키도 매번 입력 | ⭐ 거의 없음 |
| **B. Global만** | - 한 번만 설정<br>- 모든 프로젝트 동일 | - 팀 공유 불가<br>- 프로젝트별 차이 불가 | ⭐⭐ 보통 |
| **C. Hybrid** (Claude 방식) | - 개인 설정 재사용<br>- 프로젝트 커스텀 가능 | - 우선순위 복잡<br>- Monorepo, Submodule 혼란 | ⭐⭐⭐⭐ 많음 |

---

### **⭐ 추천: A (Local만) + Template System**

```
# 디렉토리 구조
/project/.circuit/                    # 이것만 사용
├── strategies/
│   └── react.md
├── mcps/
│   ├── test-runner.json
│   └── ai-provider.json             # API 키 (gitignore)
├── history/
└── circuit.config.md

# .gitignore
.circuit/mcps/ai-provider.json       # API 키만 ignore
.circuit/history/                    # 개인 히스토리 ignore
```

**새 프로젝트 초기화:**
```bash
$ cd ~/new-project
$ circuit init

→ Template 선택:
  1. React
  2. Next.js
  3. Node API
  4. Custom

→ [1 선택]
  ✅ .circuit/ 생성 완료
  ✅ react.md strategy 복사
  📝 API 키 설정 필요 (한 번만)
```

**API 키 재사용 방법 (OS Keychain):**
```typescript
// API 키를 OS Keychain에 저장
import keytar from 'keytar'

// 첫 설정 시
await keytar.setPassword('circuit', 'anthropic-api-key', 'sk-ant-...')

// 이후 프로젝트에서
const apiKey = await keytar.getPassword('circuit', 'anthropic-api-key')
// → 파일에 저장 안 함, OS가 관리
```

**장점:**
- Conductor처럼 간단 명확
- API 키는 OS Keychain에 (모든 프로젝트 재사용)
- 파일은 프로젝트별로만
- 엣지케이스 거의 없음

---

## 2. Auto-detect 하이브리드

### **제안한 방식: "Auto-detect → 확인 요청"**

```
1. Circuit 시작
2. Auto-detect: "Next.js 감지!"
3. 사용자 확인:
   ┌────────────────────────────┐
   │ Next.js 감지됨             │
   │ [확인] [수정]              │
   └────────────────────────────┘
4. [확인] 클릭 → .circuit/circuit.config.md 생성
5. 이후 자동 사용
```

---

### **바이브코더가 어려워할까?**

#### **시나리오 1: 첫 사용자 (바이브코더)**

```
$ circuit init

✨ 프로젝트 타입 감지 중...

━━━━━━━━━━━━━━━━━━━━━ 100%

✅ Next.js 14 + TypeScript + Tailwind 감지!

전략: nextjs.md 사용
- Vitest로 테스트
- TypeScript 타입 체크
- ESLint 검사

이대로 진행할까요?
[Y] 예, 이대로  [N] 아니요, 수정  [?] 자세히

→ Y 입력 (또는 Enter)
  ✅ 완료! Test-Fix Loop 활성화됨
```

**난이도:** ⭐ 쉬움 (Yes/No만)

---

#### **시나리오 2: 복합 프로젝트**

```
$ circuit init

⚠️ 여러 타입 감지됨:
  - Next.js (app/)
  - React (components/)
  - Node API (api/)

어떤 전략을 사용할까요?
[1] Next.js (Full-stack)
[2] React (Frontend만)
[3] Node API (Backend만)
[4] Custom (직접 설정)

→ 1 입력
  ✅ Next.js 전략 사용
```

**난이도:** ⭐⭐ 보통 (숫자 선택만)

---

### **"하이브리드"가 아니라 "Smart Default"**

```typescript
// 실제로는 이렇게 동작:
const strategy = autoDetect()  // 자동 감지

if (strategy.confidence > 0.9) {
  // 90% 이상 확신 → 바로 사용 (확인 안 물어봄)
  useStrategy(strategy)
  showNotification(`✅ ${strategy.name} 전략 사용`)
} else if (strategy.confidence > 0.5) {
  // 50-90% → 확인 요청
  const confirmed = await askUser(`${strategy.name} 맞나요?`)
  if (confirmed) useStrategy(strategy)
} else {
  // 50% 이하 → 선택 UI 표시
  const chosen = await showStrategyPicker()
  useStrategy(chosen)
}
```

**핵심:**
- 명확한 경우 (90%+): 자동 (확인 안 함) ⭐
- 애매한 경우 (50-90%): Yes/No 확인
- 모르는 경우 (<50%): 선택 UI

**바이브코더 경험:**
- 대부분: 아무것도 안 물어봄 (자동)
- 가끔: Yes/No만 (간단)
- 드물게: 선택 UI (명확한 옵션)

---

## 3. Claude Code 재사용 하이브리드

### **제안한 3가지 옵션**

```
A) Claude Code 설정 읽기 (API 키 공유)
B) Claude Code IPC 통신
C) Circuit 자체 API 키
```

### **"하이브리드"의 실제 의미**

```
우선순위 시스템:
1순위: Claude Code API 키 (있으면)
2순위: Circuit API 키 (Fallback)
3순위: 사용자 입력 요청
```

---

### **"API 마진 얹기"는 아님**

#### **❌ API 마진 모델 (우리가 하지 않을 것)**

```
User → Circuit → Anthropic API
       (중간에서 API 대행)
       (마진 20% 추가)

문제:
- 우리가 모든 API 비용 부담
- 사용자는 Circuit 통해서만 사용
- 악용 리스크 (무제한 사용)
```

---

#### **✅ 실제 의미: API 키 우선순위**

```typescript
// ai-provider.ts
async function getAPIKey(): Promise<string> {
  // 1. Claude Code 설정에서 찾기
  const claudeKey = await tryReadClaudeCodeConfig()
  if (claudeKey) {
    return claudeKey  // ← 사용자의 API 키 그대로 사용
  }

  // 2. Circuit 설정에서 찾기
  const circuitKey = await tryReadCircuitConfig()
  if (circuitKey) {
    return circuitKey  // ← 사용자가 Circuit에 설정한 키
  }

  // 3. 없으면 입력 요청
  throw new Error('API key not found')
}
```

**핵심:**
- 우리는 중간에 끼지 않음
- 사용자 API 키 → Anthropic 직접 호출
- Circuit은 그냥 키를 "찾기만" 함

---

### **사용자 경험 3가지**

#### **Case 1: Claude Code 이미 사용 중**

```
$ circuit init

🔍 Claude Code API 키 발견!
   (sk-ant-***abc)

이 키를 Circuit에서도 사용할까요?
[Y] 예  [N] 아니요, 다른 키 사용

→ Y
  ✅ 설정 완료! (추가 입력 없음)
```

**바이브코더 경험:** ⭐⭐⭐⭐⭐ 완벽 (0번 입력)

---

#### **Case 2: Claude Code 없음, Circuit에 설정**

```
$ circuit init

API 키 설정이 필요합니다.

Anthropic API 키 입력:
sk-ant-_______________

✅ 저장 완료!
   - OS Keychain에 안전하게 저장됨
   - 모든 프로젝트에서 재사용됨
```

**바이브코더 경험:** ⭐⭐⭐⭐ 좋음 (1번만 입력, 이후 재사용)

---

#### **Case 3: Circuit Pro 플랜 (미래)**

```
$ circuit login

Email: user@example.com
Password: ********

✅ 로그인 완료!

Circuit Pro 플랜 활성화됨:
- API 키 입력 불필요
- Circuit 제공 API 사용
- 월 $29 (무제한)

[이제 API 호출은 Circuit 서버 거쳐감 = 마진 모델]
```

**이건 나중 옵션:**
- Free/Self-hosted: 사용자 API 키
- Pro: Circuit API (우리가 부담)

---

## 📊 최종 추천 (하이브리드 제거)

### **1. 디렉토리: Local만 (Conductor 방식)**

```
/project/.circuit/              # 이것만
├── strategies/react.md
├── mcps/
│   └── ai-provider.json       # gitignore
└── circuit.config.md

API 키: OS Keychain에 저장 (프로젝트 간 공유)
```

**엣지케이스:** ⭐ 거의 없음

---

### **2. Auto-detect: Smart Default (확신도 기반)**

```
90% 이상 확신 → 자동 사용 (물어보지 않음)
50-90% → Yes/No 확인
50% 이하 → 선택 UI
```

**바이브코더 난이도:** ⭐ 쉬움

---

### **3. API 키: 우선순위 시스템 (마진 아님)**

```
1. Claude Code 키 찾기 (있으면 재사용)
2. Circuit 키 찾기 (Fallback)
3. 사용자 입력 요청

모두 사용자 키 → Anthropic 직접 호출
(우리는 중간에 안 끼임)
```

**바이브코더 경험:** ⭐⭐⭐⭐⭐ (대부분 0-1번 입력)

---

## ✅ 단순화 버전

| 항목 | 복잡한 하이브리드 ❌ | 단순한 방식 ✅ |
|------|-------------------|--------------|
| **디렉토리** | Global + Local | **Local만** |
| **Auto-detect** | 항상 확인 요청 | **확신도에 따라 자동** |
| **API 키** | 여러 설정 파일 | **우선순위로 찾기** |

---

## 🎯 구현 단순화

```typescript
// circuit.config.ts
export const config = {
  // 1. 디렉토리: 프로젝트 루트만
  configDir: '.circuit',  // 상대경로만

  // 2. Auto-detect: 확신도 기반
  autoDetectThreshold: 0.9,  // 90% 이상이면 자동

  // 3. API 키: 우선순위
  apiKeyPriority: [
    'claude-code',  // ~/.claude/config.json
    'os-keychain',  // Keychain/Credential Manager
    'user-input'    // 마지막 수단
  ]
}
```

**코드 라인 수:** 하이브리드 500줄 → 단순 200줄 (60% 감소)

---

이제 명확한가요? 어떤 방식으로 진행할까요?
