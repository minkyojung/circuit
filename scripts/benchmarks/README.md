# Memory Benchmarks

Performance testing tools for SharedMemoryPool optimization.

## 목적

Octave의 메모리 사용량을 측정하고 최적화하기 위한 벤치마크 스크립트입니다.
SharedMemoryPool이 여러 conversation에서 메모리를 얼마나 절약하는지 측정합니다.

## Files

### benchmark-memory.ts (272 lines)
전체 기능 벤치마크 - SharedMemoryPool과 ConversationStorage 통합 테스트

**측정 항목**:
- SharedMemoryPool 사용 전/후 메모리 사용량
- Global memories deduplication 효과
- Agent context 생성 시 메모리 사용량

**실행**:
```bash
npx tsx scripts/benchmarks/benchmark-memory.ts
```

**예상 결과**:
```
Without SharedMemoryPool: 600 memory objects
With SharedMemoryPool:    200 memory objects
Memory object reduction: 67%
```

---

### benchmark-memory-standalone.ts (293 lines)
독립 실행 벤치마크 - Electron 의존성 없이 실행 가능

**특징**:
- ConversationStorage 없이 실행 가능
- 순수 메모리 풀 성능 측정
- CI/CD 환경에서 실행 가능

**실행**:
```bash
npx tsx scripts/benchmarks/benchmark-memory-standalone.ts
```

---

### benchmark-simple.ts (234 lines)
간단한 메모리 풀 테스트 - 기본 기능만 검증

**특징**:
- SimpleMemoryPool 클래스 (최소 구현)
- 빠른 실행 (1-2초)
- 개발 중 빠른 검증용

**실행**:
```bash
npx tsx scripts/benchmarks/benchmark-simple.ts
```

---

## 언제 실행하나요?

### 1. 메모리 최적화 검증
SharedMemoryPool 코드를 수정했을 때:
```bash
# Before
npm run benchmark

# After making changes
npm run benchmark

# Compare results
```

### 2. 성능 회귀 체크
새로운 기능 추가 후 메모리 사용량 확인:
```bash
npx tsx scripts/benchmarks/benchmark-memory.ts
```

### 3. 프로덕션 배포 전
메모리 사용량이 예상 범위 내인지 확인

---

## 결과 해석

### Good (정상)
```
Memory object reduction: 60-70%
Cache hit rate: >80%
Avg memory per conversation: <5MB
```

### Warning (주의)
```
Memory object reduction: 40-60%
Cache hit rate: 50-80%
Avg memory per conversation: 5-10MB
```

### Critical (문제)
```
Memory object reduction: <40%
Cache hit rate: <50%
Avg memory per conversation: >10MB
```

문제가 있다면:
1. SharedMemoryPool cache 설정 확인
2. TTL (Time To Live) 확인
3. Deduplication 로직 검증

---

## 주의사항

### GC (Garbage Collection)
더 정확한 측정을 위해 `--expose-gc` 플래그 사용:
```bash
node --expose-gc --loader tsx scripts/benchmarks/benchmark-memory.ts
```

### 데이터 크기
벤치마크는 테스트 데이터를 사용합니다:
- 100 global memories
- 5 conversations × 20 memories each

실제 프로덕션 환경에서는 더 많을 수 있습니다.

---

## 관련 문서

- `COMPREHENSIVE_ANALYSIS_AND_ACTION_PLAN.md` - 성능 최적화 계획
- `circuit/electron/sharedMemoryPool.ts` - 구현 코드
- `circuit/electron/memoryStorage.ts` - 메모리 저장소

---

## 문제 해결

### Error: Cannot find module 'memoryStorage'
```bash
# Make sure you're in the right directory
cd /path/to/circuit
npx tsx scripts/benchmarks/benchmark-memory.ts
```

### Memory measurements are inconsistent
```bash
# Run with GC exposed and multiple times
for i in {1..5}; do
  node --expose-gc --loader tsx scripts/benchmarks/benchmark-memory.ts
done
```

---

**Last Updated**: 2025-11-05
